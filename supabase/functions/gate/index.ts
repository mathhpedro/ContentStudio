// Supabase Edge Function: team access gate.
// The caller signs in anonymously (client-side), then posts the team access code
// here. We verify the anonymous session, compare the code against the server-only
// app_config value, and — only if it matches — make the caller a member of every
// account workspace (Matheus, Vinicius Galera, …) using the service role. RLS then
// grants them access to the shared content. The code never reaches the browser.
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
    .from('app_config').select('key, value').in('key', ['team_access_code', 'accounts', 'shared_workspace_id']);
  if (cfgErr) return json({ error: 'Server config error' }, 500);
  const map: Record<string, string> = {};
  (cfg || []).forEach((r: any) => { map[r.key] = r.value; });

  if (!map.team_access_code || code !== map.team_access_code) {
    return json({ error: 'Invalid access code' }, 403);
  }

  // Account workspaces to provision. Fall back to a single shared workspace.
  let accounts: { id: string; name: string }[] = [];
  try { accounts = JSON.parse(map.accounts || '[]'); } catch { accounts = []; }
  if (!accounts.length && map.shared_workspace_id) {
    accounts = [{ id: map.shared_workspace_id, name: 'Shared Studio' }];
  }
  if (!accounts.length) return json({ error: 'No accounts configured' }, 500);

  for (const acc of accounts) {
    const { data: ws } = await admin.from('workspaces').select('id, name').eq('id', acc.id).maybeSingle();
    if (!ws) {
      const { error: wsErr } = await admin.from('workspaces').insert({ id: acc.id, name: acc.name, owner: uid });
      if (wsErr) return json({ error: 'Could not create workspace' }, 500);
    } else if (ws.name !== acc.name) {
      await admin.from('workspaces').update({ name: acc.name }).eq('id', acc.id);
    }
    const { error: memErr } = await admin
      .from('members').upsert({ workspace_id: acc.id, user_id: uid, email, role: 'writer' }, { onConflict: 'workspace_id,user_id' });
    if (memErr) return json({ error: 'Could not join workspace' }, 500);
  }

  return json({ ok: true, workspaceId: accounts[0].id, accounts });
});
