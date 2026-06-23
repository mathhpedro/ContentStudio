// Supabase Edge Function: team access gate.
// The caller signs in anonymously (client-side), then posts the team access code
// here. We verify the anonymous session, compare the code against the server-only
// app_config value, and — only if it matches — add the caller as a member of the
// shared workspace using the service role. RLS then grants them access to the
// shared content. The code never reaches the browser bundle.
//
// Deploy: supabase functions deploy gate

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

  // Verify the (anonymous) session.
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Not authenticated' }, 401);
  const uid = userData.user.id;
  const email = userData.user.email || null;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const code = (body && typeof body.code === 'string') ? body.code.trim() : '';
  if (!code) return json({ error: 'Missing code' }, 400);

  const admin = createClient(url, serviceKey);
  const { data: cfg, error: cfgErr } = await admin
    .from('app_config').select('key, value').in('key', ['team_access_code', 'shared_workspace_id']);
  if (cfgErr) return json({ error: 'Server config error' }, 500);
  const map: Record<string, string> = {};
  (cfg || []).forEach((r: any) => { map[r.key] = r.value; });

  if (!map.team_access_code || code !== map.team_access_code) {
    return json({ error: 'Invalid access code' }, 403);
  }
  const wsId = map.shared_workspace_id;
  if (!wsId) return json({ error: 'Shared workspace not configured' }, 500);

  // Ensure the shared workspace exists (created lazily, owned by the first caller).
  const { data: ws } = await admin.from('workspaces').select('id').eq('id', wsId).maybeSingle();
  if (!ws) {
    const { error: wsErr } = await admin.from('workspaces').insert({ id: wsId, name: 'Shared Studio', owner: uid });
    if (wsErr) return json({ error: 'Could not create shared workspace' }, 500);
  }

  // Grant membership (idempotent).
  const { error: memErr } = await admin
    .from('members').upsert({ workspace_id: wsId, user_id: uid, email, role: 'writer' }, { onConflict: 'workspace_id,user_id' });
  if (memErr) return json({ error: 'Could not join shared workspace' }, 500);

  return json({ ok: true, workspaceId: wsId });
});
