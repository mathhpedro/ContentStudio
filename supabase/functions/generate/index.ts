// Supabase Edge Function: text generation proxy.
// Verifies the caller's Supabase session, then routes to Gemini (default, free
// tier for Flash) or Anthropic by model id. Supports web-search grounding and
// reading a reference URL.
//
// Secrets:
//   GEMINI_API_KEY        — Gemini text + (shared with) image
//   GEMINI_TEXT_API_KEY   — optional: a no-billing key just for free text
//   GEMINI_TEXT_KEY_<ACCT>— optional: per-account Gemini text key (e.g. _MATHEUS)
//   ANTHROPIC_API_KEY     — Claude key (used when a claude-* model is selected)
//   ANTHROPIC_KEY_<ACCT>  — optional: per-account Claude key (e.g. _MATHEUS)
//   TEXT_MODEL_<ACCT>     — optional: per-account text model override (e.g.
//                           TEXT_MODEL_MATHEUS=claude-opus-4-8 routes only that
//                           account to Claude; others stay on the global model)
//   Deploy:  supabase functions deploy generate

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });
}

// ---- Anthropic (paid) ----
const MODERN = ['claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6'];
function aWebSearch(model: string) { return { type: MODERN.includes(model) ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search', max_uses: 4 }; }
function aWebFetch(model: string) { return { type: MODERN.includes(model) ? 'web_fetch_20260209' : 'web_fetch_20250910', name: 'web_fetch', max_uses: 4 }; }
function aText(content: any[]): string { return (content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim(); }

async function callAnthropic(model: string, system: string, user: string, maxTokens: number, search: boolean, fetchUrl: string, apiKey: string) {
  if (!apiKey) return { error: 'Server is missing ANTHROPIC_API_KEY', status: 500 };
  const tools: any[] = [];
  if (search) tools.push(aWebSearch(model));
  if (fetchUrl) tools.push(aWebFetch(model));
  const messages: any[] = [{ role: 'user', content: user }];
  let last = '';
  for (let i = 0; i < 5; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, ...(tools.length ? { tools } : {}) }),
    });
    if (!res.ok) { let m = 'Claude request failed (HTTP ' + res.status + ')'; try { const j = await res.json(); m = j?.error?.message || m; } catch { /* */ } return { error: m, status: res.status }; }
    const data = await res.json();
    const t = aText(data.content); if (t) last = t;
    if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
    return { text: t || last };
  }
  return { text: last };
}

// ---- Gemini (free tier for Flash) ----
async function callGemini(model: string, system: string, user: string, maxTokens: number, search: boolean, fetchUrl: string, apiKey: string) {
  if (!apiKey) return { error: 'Server is missing GEMINI_API_KEY', status: 500 };
  const tools: any[] = [];
  if (fetchUrl) tools.push({ url_context: {} });
  if (search) tools.push({ google_search: {} });
  const genConfig: any = { maxOutputTokens: Math.max(maxTokens, 2048) };
  // Disable "thinking" on Flash so the token budget goes to the answer (faster, cheaper, reliable JSON).
  if (model.includes('flash')) genConfig.thinkingConfig = { thinkingBudget: 0 };
  const body: any = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: genConfig,
    ...(tools.length ? { tools } : {}),
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) { let m = 'Gemini request failed (HTTP ' + res.status + ')'; try { const j = await res.json(); m = j?.error?.message || m; } catch { /* */ } return { error: m, status: res.status }; }
  const data = await res.json();
  const cand = (data.candidates || [])[0];
  const text = ((cand?.content?.parts) || []).filter((p: any) => typeof p.text === 'string').map((p: any) => p.text).join('\n').trim();
  if (!text) return { error: 'No text returned (possibly blocked or empty)', status: 502 };
  return { text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing auth token' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Not authenticated' }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { system, user, model: rawModel, max_tokens, search, fetch_url, workspace_id } = body || {};
  if (!user) return json({ error: 'Missing "user" prompt' }, 400);

  // The text model is configured server-side (app_config.text_model). The Gemini
  // key is per-account: each account maps to its own secret named
  // GEMINI_TEXT_KEY_<ACCOUNT> (e.g. GEMINI_TEXT_KEY_MATHEUS). Falls back to the
  // shared GEMINI_TEXT_API_KEY / GEMINI_API_KEY.
  let model = rawModel || 'gemini-2.5-flash';
  let geminiKey = Deno.env.get('GEMINI_TEXT_API_KEY') || Deno.env.get('GEMINI_API_KEY') || '';
  let anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'text_model').maybeSingle();
    if (cfg && cfg.value) model = cfg.value;
    if (workspace_id) {
      // Per-account text model override, stored in app_config as
      // "text_model:<workspace_id>" (e.g. claude-opus-4-8 for one account only).
      // This lets a single account run on Claude while others stay on the global model.
      const { data: perAcct } = await admin.from('app_config').select('value').eq('key', 'text_model:' + workspace_id).maybeSingle();
      if (perAcct && perAcct.value) model = perAcct.value;
      const { data: ws } = await admin.from('workspaces').select('name').eq('id', workspace_id).maybeSingle();
      const nm = ws && ws.name ? String(ws.name).toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
      if (nm) {
        // Optional per-account model override via secret (takes precedence over the row).
        const tm = Deno.env.get('TEXT_MODEL_' + nm); if (tm) model = tm;
        // Per-account keys: Gemini and/or Claude, each with its own rate limits.
        const gk = Deno.env.get('GEMINI_TEXT_KEY_' + nm); if (gk) geminiKey = gk;
        const ak = Deno.env.get('ANTHROPIC_KEY_' + nm); if (ak) anthropicKey = ak;
      }
    }
  } catch { /* ignore — use fallback */ }
  const isClaude = String(model).startsWith('claude');
  if (!isClaude && !String(model).startsWith('gemini')) model = 'gemini-2.5-flash';
  const maxTokens = max_tokens || 4096;

  const out = isClaude
    ? await callAnthropic(model, system, user, maxTokens, !!search, fetch_url || '', anthropicKey)
    : await callGemini(model, system || '', user, maxTokens, !!search, fetch_url || '', geminiKey);

  if ((out as any).error) return json({ error: (out as any).error }, (out as any).status || 500);
  return json({ text: (out as any).text || '' });
});
