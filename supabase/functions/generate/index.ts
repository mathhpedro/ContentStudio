// Supabase Edge Function: secure proxy to the Anthropic Messages API.
// Verifies the caller's Supabase session, then calls Claude with the
// server-side ANTHROPIC_API_KEY. Supports optional web search grounding.
//
// Deploy:  supabase functions deploy generate
//          supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function webSearchTool(model: string) {
  const modern = ['claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6'].includes(model);
  return { type: modern ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search', max_uses: 4 };
}
function blocksToText(content: any[]): string {
  return (content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

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
  const { system, user, model: rawModel, max_tokens, search } = body || {};
  if (!user) return json({ error: 'Missing "user" prompt' }, 400);
  const model = rawModel || 'claude-opus-4-8';
  const tools = search ? [webSearchTool(model)] : undefined;

  const messages: any[] = [{ role: 'user', content: user }];
  let lastText = '';
  for (let i = 0; i < 5; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: max_tokens || 4096, system, messages, ...(tools ? { tools } : {}) }),
    });
    if (!res.ok) {
      let msg = 'Claude request failed (HTTP ' + res.status + ')';
      try { const j = await res.json(); msg = j?.error?.message || msg; } catch { /* ignore */ }
      return json({ error: msg }, res.status);
    }
    const data = await res.json();
    const text = blocksToText(data.content);
    if (text) lastText = text;
    if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
    return json({ text: text || lastText });
  }
  return json({ text: lastText });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });
}
