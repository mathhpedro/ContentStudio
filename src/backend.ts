// Collaborative backend: Supabase auth, workspace bootstrap, shared persistence
// with realtime, and the Claude proxy (Edge Function) call.

import { supabase } from './supabaseClient';
import type { Post } from './data';

export interface Account { id: string; name: string; }
export interface SessionInfo {
  uid: string;
  email: string;
  workspaceId: string;
  role: 'owner' | 'writer' | 'viewer';
  accounts: Account[];
}

// ---------- access (shared team code, no email) ----------
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}
export function onAuthChange(cb: (signedIn: boolean) => void) {
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(!!session));
  return () => data.subscription.unsubscribe();
}
// Ensure we have a session. No email — everyone signs in anonymously; the team
// access code (verified server-side by the `gate` function) is what grants access.
async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message);
}
// Enter with the shared team code. The edge function checks it against the
// server-only value and, on success, makes this session a member of the shared
// workspace. Returns the workspace id.
export async function enterWithCode(code: string): Promise<string> {
  await ensureSession();
  const { data, error } = await supabase.functions.invoke('gate', { body: { code: code.trim() } });
  if (error) {
    let msg = 'Could not verify the access code';
    try { const ctx = (error as any).context; if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); msg = j.error || msg; } } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  const wsId = data && data.workspaceId;
  if (!wsId) throw new Error('Access denied');
  setActiveWs(wsId);
  return wsId;
}
export async function signOut() { await supabase.auth.signOut(); }

// The active workspace, remembered per browser.
const ACTIVE_WS_KEY = 'pragma.activeWorkspace';
function getActiveWs(): string | null { try { return localStorage.getItem(ACTIVE_WS_KEY); } catch { return null; } }
function setActiveWs(id: string) { try { localStorage.setItem(ACTIVE_WS_KEY, id); } catch { /* ignore */ } }

// ---------- row mapping ----------
function rowToPost(r: any): Post {
  return {
    id: r.id, date: r.date, topic: r.topic, angle: r.angle || '', format: r.format || 'opinion',
    status: r.status || 'Draft', priority: r.priority || 'Medium', change: r.change,
    scheduledFor: r.scheduled_for, versions: (r.versions && r.versions.length ? r.versions : null),
    activeVer: r.active_ver || 0, ...(r.brief ? { brief: r.brief } : {}),
    publishedAt: r.published_at || null, ...(r.metrics ? { metrics: r.metrics } : {}),
    image: r.image_url || null, imagePrompt: r.image_prompt || null,
    images: (r.images && r.images.length ? r.images : null),
    imageSpec: r.image_spec || null,
  } as Post;
}
function postToRow(p: Post, ws: string): any {
  return {
    id: p.id, workspace_id: ws, date: p.date, topic: p.topic, angle: p.angle, format: p.format,
    status: p.status, priority: p.priority, change: p.change, scheduled_for: p.scheduledFor,
    versions: p.versions || [], active_ver: p.activeVer || 0, brief: (p as any).brief || null,
    published_at: p.publishedAt || null, metrics: p.metrics || null,
    image_url: p.image || null, image_prompt: p.imagePrompt || null,
    images: p.images || null, image_spec: (p as any).imageSpec || null,
    updated_at: new Date().toISOString(),
  };
}

// ---------- workspace bootstrap ----------
// In the shared-code model the gate function already made this session a member
// of the shared workspace. If there's no membership yet, the user hasn't entered
// a valid code — signal NOT_GATED so the UI shows the access screen.
export const NOT_GATED = 'NOT_GATED';

export async function bootstrap(): Promise<SessionInfo> {
  const user = await getUser();
  if (!user) throw new Error(NOT_GATED);
  const email = user.email || '';

  const { data: mems, error: memErr } = await supabase
    .from('members').select('workspace_id, role, created_at').eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (memErr) throw new Error(memErr.message);
  if (!mems || !mems.length) throw new Error(NOT_GATED);

  // Build the account list from the workspaces this session belongs to.
  const ids = mems.map((m: any) => m.workspace_id);
  const { data: wss } = await supabase.from('workspaces').select('id, name').in('id', ids);
  const nameById: Record<string, string> = {};
  (wss || []).forEach((w: any) => { nameById[w.id] = w.name; });
  const accounts: Account[] = mems
    .map((m: any) => ({ id: m.workspace_id, name: nameById[m.workspace_id] || 'Studio' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const active = getActiveWs();
  const chosen = (active && mems.find((m: any) => m.workspace_id === active)) || mems[0];
  setActiveWs(chosen.workspace_id);
  return { uid: user.id, email, workspaceId: chosen.workspace_id, role: chosen.role, accounts };
}

// Switch the active account workspace (per browser). Caller reloads to apply.
export function switchAccount(id: string) { setActiveWs(id); }

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
export async function callEdge(opts: { system: string; user: string; model?: string; maxTokens?: number; search?: boolean; fetchUrl?: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate', {
    body: { system: opts.system, user: opts.user, model: opts.model, max_tokens: opts.maxTokens, search: opts.search, fetch_url: opts.fetchUrl, workspace_id: getActiveWs() },
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

// ---------- per-account text key ----------
export async function setTextKey(workspaceId: string, key: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('setkey', { body: { workspaceId, key } });
  if (error) {
    let msg = error.message || 'Could not save key';
    try { const ctx = (error as any).context; if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); msg = j.error || msg; } } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return !!(data && data.set);
}

// ---------- image generation (Imagen) ----------
export async function callImage(opts: { prompt: string; workspaceId: string; postId: string; aspectRatio?: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('image', {
    body: { prompt: opts.prompt, workspaceId: opts.workspaceId, postId: opts.postId, aspectRatio: opts.aspectRatio },
  });
  if (error) {
    let msg = error.message || 'Image generation failed';
    try { const ctx = (error as any).context; if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); msg = j.error || msg; } } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  const u = data && data.url;
  if (!u) throw new Error('No image returned');
  return u as string;
}

// Upload a pre-rendered figure (base64 PNG, no data: prefix) and return its URL.
export async function uploadFigure(opts: { pngBase64: string; workspaceId: string; postId: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('image', {
    body: { pngBase64: opts.pngBase64, workspaceId: opts.workspaceId, postId: opts.postId },
  });
  if (error) {
    let msg = error.message || 'Figure upload failed';
    try { const ctx = (error as any).context; if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); msg = j.error || msg; } } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  const u = data && data.url;
  if (!u) throw new Error('No image returned');
  return u as string;
}
