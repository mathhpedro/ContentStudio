// Browser-side client for the Anthropic Messages API.
//
// This is a static site (GitHub Pages) with no backend, so the studio talks to
// Claude directly from the browser using the official
// `anthropic-dangerous-direct-browser-access` header and a user-supplied API key.
// The key lives only in this browser's localStorage — see store.ts.

import { NOW, type Post, type Version } from './data';
import { hasSupabase } from './supabaseClient';
import { callEdge } from './backend';

export interface Settings {
  apiKey: string;
  model: string;
  webSearch?: boolean;
}

// Web search server-tool, version chosen per model (dynamic filtering on 4.6+).
const MODERN_TOOLS = ['claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6'];
function webSearchTool(model: string) {
  return { type: MODERN_TOOLS.includes(model) ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search', max_uses: 4 };
}
// Web fetch server-tool — lets Claude read a specific URL (a reference post).
function webFetchTool(model: string) {
  return { type: MODERN_TOOLS.includes(model) ? 'web_fetch_20260209' : 'web_fetch_20250910', name: 'web_fetch', max_uses: 4 };
}

export const MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — most capable' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — fast & balanced' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fastest' },
];

export const DEFAULT_MODEL = 'claude-opus-4-8';

const API_URL = 'https://api.anthropic.com/v1/messages';

function blocksToText(content: any[]): string {
  return (content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
}

// ---- low-level call ----
export async function callClaude(
  settings: Settings,
  opts: { system: string; user: string; maxTokens?: number; search?: boolean; fetchUrl?: string },
): Promise<string> {
  const model = (settings && settings.model) || DEFAULT_MODEL;
  // Collaborative mode: go through the Supabase Edge Function (key stays server-side).
  if (hasSupabase) {
    return callEdge({ system: opts.system, user: opts.user, model, maxTokens: opts.maxTokens, search: opts.search, fetchUrl: opts.fetchUrl });
  }
  // Local mode: direct browser call with the user's own key.
  if (!settings || !settings.apiKey) {
    throw new Error('Not connected — add your Anthropic API key in Settings.');
  }
  const toolList: any[] = [];
  if (opts.search) toolList.push(webSearchTool(model));
  if (opts.fetchUrl) toolList.push(webFetchTool(model));
  const tools = toolList.length ? toolList : undefined;
  const messages: any[] = [{ role: 'user', content: opts.user }];
  let lastText = '';
  // Server-tool runs may return stop_reason "pause_turn"; re-send to resume.
  for (let i = 0; i < 5; i++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model, max_tokens: opts.maxTokens || 4096, system: opts.system, messages, ...(tools ? { tools } : {}),
      }),
    });
    if (!res.ok) {
      let msg = 'Request failed (HTTP ' + res.status + ')';
      try { const j = await res.json(); msg = (j && j.error && j.error.message) || msg; } catch { /* ignore */ }
      if (res.status === 401) msg = 'Invalid API key. Check it in Settings.';
      throw new Error(msg);
    }
    const data = await res.json();
    const text = blocksToText(data.content);
    if (text) lastText = text;
    if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
    return text || lastText;
  }
  return lastText;
}

// Pull a JSON object out of a model response, tolerating ```json fences / prose.
function extractJson(text: string): any {
  let t = (text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

// Shared "no-branding" rule — applied to every generation surface so no company,
// product or coined term (including the author's own) ever appears in the content.
const NO_BRAND_RULE = 'NEVER name or imply any specific company, product, brand, platform, vendor, consultancy, client or coined/proprietary term — including the author’s own company. Write as an independent operator’s point of view, with no company names anywhere in the text.';

function styleSystem(style: string): string {
  return [
    'You write LinkedIn-style thought-leadership posts on ENTERPRISE DECISION OPERATIONS:',
    'the high-stakes trade-offs between commercial (growth — volume, price, share, promotion, speed)',
    'and operations (control — capacity, cost, risk, service level, stability) in decision-heavy',
    'industries: consumer goods, banking/finance, retail and agribusiness.',
    '',
    'Write from this point of view:',
    '- The bottleneck was never the intelligence — it is the operating model. Most enterprises now use AI,',
    '  yet only a minority see a measurable impact on earnings. The gap is how decisions get made, owned',
    '  and learned from — not how smart the models are.',
    '- The most valuable, least-owned decision in the enterprise is the trade-off between revenue and the',
    '  constraint. It is usually resolved late, by whoever shouts loudest, and owned by no one — and margin',
    '  leaks in that gap.',
    '- Treat the DECISION as the unit of work: frame the constraint, model the trade-off, make the call,',
    '  drive it to implementation, and measure the result against the counterfactual (what would have',
    '  happened otherwise) — not plan-vs-actuals.',
    '- Intelligence commoditizes; judgment compounds. The Theory of Constraints is the operating lens.',
    '- Value should be proven in P&L terms and earned on outcomes.',
    '',
    'Follow this voice/style profile precisely:',
    '"""',
    style,
    '"""',
    '',
    'HARD RULES:',
    '- ' + NO_BRAND_RULE,
    '- Ground claims in concrete, verifiable specifics (figures, named workflows, real scenarios) without',
    '  attributing them to a named organization.',
    '- Always return ONLY valid JSON — no prose, no markdown fences, no commentary.',
  ].join('\n');
}

// ---- 3 versions for a post ----
export async function generateVersions(
  settings: Settings,
  post: { topic: string; angle: string; format: string },
  style: string,
  perfHint?: string,
  refUrl?: string,
): Promise<Version[]> {
  const ref = (refUrl || '').trim();
  const user = [
    'Create 3 distinct versions of a single post.',
    `Topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    `Format: ${post.format}`,
    perfHint ? `\nPerformance signals from past posts: ${perfHint}\nLean into what has worked, without copying.` : '',
    ref ? `\nReference post: ${ref}\nUse web fetch to read it, then build on its substance, argument and angle — adapt it into our voice and thesis. Do NOT copy it verbatim and do NOT name any company mentioned in it.` : '',
    '',
    'Each version must use a DIFFERENT rhetorical method (e.g. Pyramid Principle / answer-first,',
    'Storytelling / situation-complication-resolution, and Proof & specificity / numbered claims).',
    'Body is 110–200 words and ends with one sharp question. The hook is a single strong opening line.',
    settings.webSearch ? 'Use web search to ground the post in recent, specific facts or figures; only cite numbers you can verify, and weave them in naturally (no link dumps).' : '',
    NO_BRAND_RULE,
    '',
    'Return JSON exactly in this shape:',
    '{"versions":[{"label":"A","hook":"...","body":"...","method":"<short name> — <one line>","methodNote":"why this structure works","why":"why it drives engagement"},{"label":"B",...},{"label":"C",...}]}',
  ].filter(Boolean).join('\n');
  const text = await callClaude(settings, { system: styleSystem(style), user, maxTokens: 4096, search: settings.webSearch, fetchUrl: ref || undefined });
  const parsed = extractJson(text);
  const arr = (parsed.versions || []).slice(0, 3);
  return arr.map((v: any, i: number) => ({
    label: v.label || ['A', 'B', 'C'][i] || String(i + 1),
    approved: false, editor: 'AI draft', ts: NOW(),
    hook: v.hook || '', method: v.method || 'Generated', methodNote: v.methodNote || '',
    why: v.why || '', body: v.body || '', history: [], regenCount: 0,
  }));
}

// ---- regenerate a single version ----
export async function regenerateVersion(
  settings: Settings,
  post: { topic: string; angle: string; format: string },
  style: string,
  prev: { label: string; hook: string },
  perfHint?: string,
  refUrl?: string,
): Promise<{ hook: string; body: string; method: string; methodNote: string; why: string }> {
  const ref = (refUrl || '').trim();
  const user = [
    `Write a FRESH alternative for version ${prev.label} of this post — clearly different from the previous take.`,
    `Topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    `Format: ${post.format}`,
    `Previous hook (avoid repeating): ${prev.hook}`,
    perfHint ? `Performance signals from past posts: ${perfHint}` : '',
    ref ? `Reference post: ${ref}\nUse web fetch to read it and build on its substance in our voice; do not copy it verbatim or name any company in it.` : '',
    '',
    'Body is 110–200 words and ends with one sharp question.',
    settings.webSearch ? 'Use web search to ground it in recent, specific facts; cite only verifiable figures.' : '',
    NO_BRAND_RULE,
    'Return JSON exactly: {"hook":"...","body":"...","method":"<short name> — <one line>","methodNote":"...","why":"..."}',
  ].filter(Boolean).join('\n');
  const text = await callClaude(settings, { system: styleSystem(style), user, maxTokens: 2048, search: settings.webSearch, fetchUrl: ref || undefined });
  const v = extractJson(text);
  return { hook: v.hook || '', body: v.body || '', method: v.method || 'Regenerated', methodNote: v.methodNote || '', why: v.why || '' };
}

// ---- weekly editorial agenda ----
export interface AgendaItem { topic: string; angle: string; format: string; priority: string; dayOffset: number; }

export async function generateWeeklyAgenda(
  settings: Settings,
  style: string,
  count: number,
  weekLabel: string,
): Promise<AgendaItem[]> {
  const system = [
    'You are an editorial strategist for a thought-leadership voice in ENTERPRISE DECISION OPERATIONS —',
    'the commercial × operations trade-off in consumer goods, banking/finance, retail and agribusiness.',
    'Themes in rotation:',
    '- the unowned gap between commercial (growth) and operations (control), where margin quietly leaks;',
    '- decision-driven vs process-driven organizations — making the decision the unit of work;',
    '- concrete trade-off calls: raise price vs defend volume; run a promotion supply can’t cover; protect',
    '  the big customer vs the many small ones; grow the loan book vs protect net interest income under a',
    '  rate scenario; ship now at a worse freight rate vs wait for the window; kill an SKU vs bleed cost-to-serve;',
    '- revenue growth management (pricing, price-pack, trade & promotion, cost-to-serve) and S&OP / IBP;',
    '- the AI operating model vs buying more AI tools (most adopt AI, few see earnings impact);',
    '- intelligence commoditizes while judgment compounds; the Theory of Constraints as operating lens;',
    '- outcome-based economics and measuring value against the counterfactual, not plan-vs-actuals;',
    '- why now: rate volatility and regulatory pressure in finance, negative-ROI promotions in consumer',
    '  goods, omnichannel markdown and working-capital cycles in retail.',
    '- ' + NO_BRAND_RULE,
    'Always return ONLY valid JSON.',
  ].join('\n');
  const user = [
    `Propose a weekly editorial agenda of ${count} LinkedIn posts for the week of ${weekLabel}.`,
    'Spread them Monday–Friday. Vary the formats, industries and priorities. Keep topics sharp and specific',
    'to the decision-operations thesis above — concrete trade-offs, not generic “AI strategy”.',
    '',
    settings.webSearch ? 'Use web search to anchor topics in this week’s real developments, announcements, or data.' : '',
    'Return JSON exactly:',
    '{"agenda":[{"topic":"...","angle":"...","format":"opinion|educational|technical|case study|trend","priority":"High|Medium|Low","dayOffset":0}]}',
    'dayOffset is 0–4 for Monday–Friday.',
  ].filter(Boolean).join('\n');
  const text = await callClaude(settings, { system, user, maxTokens: 2048, search: settings.webSearch });
  const parsed = extractJson(text);
  return (parsed.agenda || []).map((a: any) => ({
    topic: a.topic || 'Untitled', angle: a.angle || '', format: (a.format || 'opinion'),
    priority: a.priority || 'Medium', dayOffset: Math.max(0, Math.min(4, parseInt(a.dayOffset, 10) || 0)),
  }));
}

// ---- plain-language brief for a topic ----
export async function generateBrief(
  settings: Settings,
  post: Post,
): Promise<{ summary: string; why: string; points: string[] }> {
  const system = [
    'You explain enterprise decision-operations topics in plain language for busy executives —',
    'the commercial × operations trade-offs in consumer goods, banking/finance, retail and agribusiness.',
    NO_BRAND_RULE,
    'Return ONLY valid JSON.',
  ].join('\n');
  const user = [
    'Write a short brief explaining this topic.',
    `Topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    '',
    'Return JSON exactly: {"summary":"2 sentences on what it means","why":"1–2 sentences on why it matters","points":["key point","key point","key point"]}',
  ].join('\n');
  const text = await callClaude(settings, { system, user, maxTokens: 1024 });
  const b = extractJson(text);
  return { summary: b.summary || '', why: b.why || '', points: Array.isArray(b.points) ? b.points : [] };
}
