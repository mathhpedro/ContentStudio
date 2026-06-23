// Supabase Edge Function: secure proxy to the Anthropic Messages API.
//
// The browser never sees the Anthropic key. The studio calls this function with
// the user's Supabase session JWT; the function verifies the user is signed in,
// then calls Claude using the ANTHROPIC_API_KEY stored as a function secret.
//
// Deploy:
//   supabase functions deploy generate
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// (SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // verify the caller is an authenticated Supabase user
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing auth token' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Not authenticated' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Server is missing ANTHROPIC_API_KEY' }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { system, user, model, max_tokens } = body || {};
  if (!user) return json({ error: 'Missing "user" prompt' }, 400);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-opus-4-8',
      max_tokens: max_tokens || 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    let msg = 'Claude request failed (HTTP ' + res.status + ')';
    try { const j = await res.json(); msg = j?.error?.message || msg; } catch { /* ignore */ }
    return json({ error: msg }, res.status);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .trim();
  return json({ text });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}
