// Supabase Edge Function: set the per-account (workspace) Gemini text key.
// Verifies the caller's session + workspace membership, then upserts the key via
// the service role into the RLS-locked workspace_keys table. The key is never
// read back to the client.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing auth token' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Not authenticated' }, 401);
  const uid = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const workspaceId = body && body.workspaceId;
  const key = (body && typeof body.key === 'string') ? body.key.trim() : '';
  if (!workspaceId) return json({ error: 'Missing workspace' }, 400);

  const admin = createClient(url, serviceKey);
  const { data: mem } = await admin.from('members').select('user_id').eq('workspace_id', workspaceId).eq('user_id', uid).maybeSingle();
  if (!mem) return json({ error: 'Not a member of this workspace' }, 403);

  const { error: upErr } = await admin.from('workspace_keys')
    .upsert({ workspace_id: workspaceId, gemini_text_key: key || null, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  if (upErr) return json({ error: 'Could not save key: ' + upErr.message }, 500);

  return json({ ok: true, set: !!key });
});
