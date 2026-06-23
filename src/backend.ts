// Collaborative backend: Supabase auth, workspace bootstrap, shared persistence
// with realtime, and the Claude proxy (Edge Function) call.

import { supabase } from './supabaseClient';
import { loadPosts as lsPosts, loadStyle as lsStyle } from './store';
import type { Post } from './data';

export interface SessionInfo {
  uid: string;
  email: string;
  workspaceId: string;
  role: 'owner' | 'writer' | 'viewer';
}

// ---------- auth ----------
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}
export function onAuthChange(cb: (signedIn: boolean) => void) {
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(!!session));
  return () => data.subscription.unsubscribe();
}
export async function sendOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}
export async function verifyOtp(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new Error(error.message);
}
export async function signOut() { await supabase.auth.signOut(); }

// ---------- row mapping ----------
function rowToPost(r: any): Post {
  return {
    id: r.id, date: r.date, topic: r.topic, angle: r.angle || '', format: r.format || 'opinion',
    status: r.status || 'Draft', priority: r.priority || 'Medium', change: r.change,
    scheduledFor: r.scheduled_for, versions: (r.versions && r.versions.length ? r.versions : null),
    activeVer: r.active_ver || 0, ...(r.brief ? { brief: r.brief } : {}),
    publishedAt: r.published_at || null, ...(r.metrics ? { metrics: r.metrics } : {}),
  } as Post;
}
function postToRow(p: Post, ws: string): any {
  return {
    id: p.id, workspace_id: ws, date: p.date, topic: p.topic, angle: p.angle, format: p.format,
    status: p.status, priority: p.priority, change: p.change, scheduled_for: p.scheduledFor,
    versions: p.versions || [], active_ver: p.activeVer || 0, brief: (p as any).brief || null,
    published_at: p.publishedAt || null, metrics: p.metrics || null,
    updated_at: new Date().toISOString(),
  };
}

// ---------- workspace bootstrap ----------
export async function bootstrap(): Promise<SessionInfo> {
  const user = await getUser();
  if (!user) throw new Error('Not signed in');
  const email = user.email || '';

  const { data: mems, error: memErr } = await supabase
    .from('members').select('workspace_id, role').eq('user_id', user.id).limit(1);
  if (memErr) throw new Error(memErr.message);

  if (mems && mems.length) {
    return { uid: user.id, email, workspaceId: mems[0].workspace_id, role: mems[0].role };
  }

  // first run for this user → create a workspace + owner membership, import local data once
  const { data: ws, error: wsErr } = await supabase
    .from('workspaces').insert({ name: (email.split('@')[0] || 'My') + "'s Studio", owner: user.id })
    .select('id').single();
  if (wsErr) throw new Error(wsErr.message);
  const workspaceId = ws.id as string;

  const { error: insErr } = await supabase.from('members')
    .insert({ workspace_id: workspaceId, user_id: user.id, email, role: 'owner' });
  if (insErr) throw new Error(insErr.message);

  await importLocal(workspaceId);
  return { uid: user.id, email, workspaceId, role: 'owner' };
}

async function importLocal(ws: string) {
  const local = lsPosts();
  if (local && local.length) {
    const rows = local.map((p) => postToRow({ ...p, id: crypto.randomUUID() }, ws));
    await supabase.from('posts').upsert(rows);
  }
  const style = lsStyle();
  if (style) await supabase.from('style_profiles').upsert({ workspace_id: ws, style, updated_at: new Date().toISOString() });
}

export async function joinWorkspace(workspaceId: string): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.from('members')
    .insert({ workspace_id: workspaceId.trim(), user_id: user.id, email: user.email, role: 'writer' });
  if (error) throw new Error(error.message);
}

// ---------- data ----------
export async function fetchPosts(ws: string): Promise<Post[]> {
  const { data, error } = await supabase.from('posts').select('*').eq('workspace_id', ws).order('date');
  if (error) throw new Error(error.message);
  return (data || []).map(rowToPost);
}
export async function savePosts(ws: string, posts: Post[]): Promise<void> {
  if (!posts.length) return;
  const { error } = await supabase.from('posts').upsert(posts.map((p) => postToRow(p, ws)));
  if (error) throw new Error(error.message);
}
export async function fetchStyle(ws: string): Promise<string | null> {
  const { data } = await supabase.from('style_profiles').select('style').eq('workspace_id', ws).maybeSingle();
  return data ? data.style : null;
}
export async function saveStyle(ws: string, style: string): Promise<void> {
  await supabase.from('style_profiles').upsert({ workspace_id: ws, style, updated_at: new Date().toISOString() });
}
export async function deletePosts(ws: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from('posts').delete().eq('workspace_id', ws).in('id', ids);
  if (error) throw new Error(error.message);
}
export function subscribePosts(ws: string, onChange: () => void): () => void {
  const ch = supabase
    .channel('posts-' + ws)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: 'workspace_id=eq.' + ws }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ---------- comments ----------
export interface Comment { id: string; post_id: string; author_email: string; body: string; created_at: string; }
export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at');
  return (data || []) as Comment[];
}
export async function addComment(ws: string, postId: string, body: string): Promise<void> {
  const user = await getUser();
  await supabase.from('comments').insert({ workspace_id: ws, post_id: postId, author: user?.id, author_email: user?.email, body });
}

// ---------- Claude proxy ----------
export async function callEdge(opts: { system: string; user: string; model?: string; maxTokens?: number; search?: boolean }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate', {
    body: { system: opts.system, user: opts.user, model: opts.model, max_tokens: opts.maxTokens, search: opts.search },
  });
  if (error) {
    // try to surface the function's JSON error message
    let msg = error.message || 'Generation failed';
    try { const ctx = (error as any).context; if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); msg = j.error || msg; } } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return (data && data.text) || '';
}
