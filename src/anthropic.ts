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

// Text generation runs on Gemini only (the active model is set server-side via
// app_config.text_model). Claude routing still exists in the edge function but
// is not offered in the UI.
export const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
];


export const DEFAULT_MODEL = 'gemini-2.5-flash';

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

// LinkedIn Top Voice craft rules, distilled from LinkedIn's 2026 algorithm
// guidance, HBR writing advice and current creator/industry benchmarks.
// (Sources noted to the user; encoded here so every generation follows them.)
const LINKEDIN_PLAYBOOK = [
  'WRITE TO BECOME A LINKEDIN TOP VOICE. The 2026 LinkedIn feed is an interest graph: it distributes',
  'posts by demonstrated EXPERTISE on a topic ("knowledge and advice"), not by network size, and it',
  'ranks on DWELL TIME and meaningful COMMENTS far more than likes. Apply these rules precisely:',
  '',
  '1. HOOK — the first line is everything. Only ~140 characters show on mobile before "…see more".',
  '   Open with a scroll-stopping line ≤ ~200 chars: a contrarian claim, a sharp number, a crisp',
  '   story-teaser or a pointed question. No throat-clearing, no "In today\'s world", no greeting.',
  '2. ARC — deliver a complete read of ~60–90 seconds: hook → quick context → the insight/payoff →',
  '   one clear takeaway. Give the reader a reason to expand and to dwell.',
  '3. FORMATTING — write for the scroll. Very short paragraphs (1–2 sentences, max ~3 lines), with a',
  '   blank line between them. Use a tight bulleted or numbered list when it earns its place. Generous',
  '   white space. Plain, direct language — no jargon or big words to sound smart (HBR).',
  '4. LENGTH — aim for ~1,300–1,900 characters total. Posts under ~1,000 chars lose reach; do not pad.',
  '5. CTA — end with ONE genuine, specific question that invites real replies and debate. Never use',
  '   engagement bait ("comment YES", "tag a friend") — it is penalized.',
  '6. NO LINKS in the body (outbound links cut reach ~60%, and "link in first comment" is also',
  '   penalized). Keep it fully native.',
  '7. HASHTAGS — end with a final line of exactly 3–5 specific, relevant hashtags (more than 5 hurts).',
  '8. AUTHORITY — sound like a practitioner who has actually made these calls: concrete scenarios,',
  '   real figures, a clear point of view. Teach something usable (a framework, a test, a number).',
].join('\n');

function styleSystem(style: string): string {
  return [
    'You are a ghostwriter helping an operator become a LINKEDIN TOP VOICE in ENTERPRISE DECISION',
    'OPERATIONS: the high-stakes trade-offs between commercial (growth — volume, price, share, promotion)',
    'and operations (control — capacity, cost, risk, service level) in decision-heavy industries —',
    'consumer goods, banking/finance, retail and agribusiness. That niche is the author\'s "topic DNA";',
    'every post must deepen authority in it.',
    '',
    'Point of view to write from:',
    '- The bottleneck was never the intelligence — it is the operating model. Most enterprises use AI, yet',
    '  few see earnings impact: the gap is how decisions get made, owned and learned from.',
    '- The most valuable, least-owned decision is the trade-off between revenue and the constraint —',
    '  resolved late, by whoever shouts loudest, owned by no one. Margin leaks in that gap.',
    '- Treat the DECISION as the unit of work: frame the constraint, model the trade-off, make the call,',
    '  implement, and measure against the counterfactual — not plan-vs-actuals.',
    '- Intelligence commoditizes; judgment compounds. Theory of Constraints as the lens. Prove value in P&L.',
    '',
    LINKEDIN_PLAYBOOK,
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
    'Create 3 distinct, ready-to-publish LinkedIn posts for the same topic — each a different proven',
    'archetype so the author can pick the strongest angle.',
    `Topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    `Format hint: ${post.format}`,
    perfHint ? `\nPerformance signals from past posts: ${perfHint}\nLean into what has worked, without copying.` : '',
    ref ? `\nReference post: ${ref}\nUse web fetch to read it, then build on its substance, argument and angle — adapt it into our voice and thesis. Do NOT copy it verbatim and do NOT name any company mentioned in it.` : '',
    '',
    'Use a DIFFERENT archetype per version:',
    '- A — Contrarian / answer-first: lead with a bold, against-the-grain claim, then prove it.',
    '- B — Story: a specific situation → complication → resolution that carries one lesson.',
    '- C — Framework / numbered: a usable, skimmable list (a test, checklist or 3-step model).',
    '',
    'For EACH version, apply the LinkedIn Top Voice rules from the system prompt:',
    '- "hook": the opening line only — ≤ ~200 chars, scroll-stopping, no greeting.',
    '- "body": the rest of the post, already formatted for LinkedIn — short paragraphs (1–2 sentences)',
    '  separated by BLANK LINES (use real newlines), an optional tight list, a complete hook→insight→',
    '  takeaway arc, then ONE genuine question as the CTA, then a final line of 3–5 relevant hashtags.',
    '  Total post (hook + body) should land around 1,300–1,900 characters. No links. No engagement bait.',
    settings.webSearch ? 'Use web search to ground the post in recent, specific, verifiable facts or figures; weave them in naturally (no link dumps).' : '',
    NO_BRAND_RULE,
    '',
    'Return JSON exactly in this shape (preserve newlines inside "body" as \\n):',
    '{"versions":[{"label":"A","hook":"...","body":"...","method":"<archetype> — <one line>","methodNote":"why this structure works on LinkedIn","why":"why it drives dwell time & comments"},{"label":"B",...},{"label":"C",...}]}',
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
    'Apply the LinkedIn Top Voice rules from the system prompt:',
    '- "hook": opening line only, ≤ ~200 chars, scroll-stopping.',
    '- "body": LinkedIn-formatted — short paragraphs separated by BLANK LINES (\\n), optional tight list,',
    '  hook→insight→takeaway, ONE genuine question as CTA, then a final line of 3–5 relevant hashtags.',
    '  Total ~1,300–1,900 characters. No links. No engagement bait.',
    settings.webSearch ? 'Use web search to ground it in recent, specific, verifiable facts.' : '',
    NO_BRAND_RULE,
    'Return JSON exactly (newlines in "body" as \\n): {"hook":"...","body":"...","method":"<archetype> — <one line>","methodNote":"...","why":"..."}',
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
    'You are the editorial strategist building a LINKEDIN TOP VOICE in ENTERPRISE DECISION OPERATIONS —',
    'the commercial × operations trade-off in consumer goods, banking/finance, retail and agribusiness.',
    'Goal: pick topics that compound authority in this exact niche (the author\'s "topic DNA"), ride what',
    'is timely, and are built to earn dwell time and comments — the signals LinkedIn rewards in 2026.',
    '',
    'Niche themes to draw from:',
    '- the unowned gap between commercial (growth) and operations (control), where margin quietly leaks;',
    '- decision-driven vs process-driven organizations — making the decision the unit of work;',
    '- concrete trade-off calls: raise price vs defend volume; run a promotion supply can’t cover; protect',
    '  the big customer vs the many small ones; grow the loan book vs protect net interest income under a',
    '  rate scenario; ship now at a worse freight rate vs wait; kill an SKU vs bleed cost-to-serve;',
    '- revenue growth management (pricing, price-pack, trade & promotion, cost-to-serve) and S&OP / IBP;',
    '- the AI operating model vs buying more AI tools; judgment compounds while intelligence commoditizes;',
    '- outcome-based economics and measuring value against the counterfactual;',
    '- why now: rate volatility & regulation in finance, negative-ROI promotions in consumer goods,',
    '  omnichannel markdown and working-capital cycles in retail.',
    '',
    'Each topic should map to a high-performing LinkedIn archetype — vary them across the week:',
    'contrarian/hot take · personal lesson or war story · how-to framework · data/insight · myth-buster ·',
    'timely trend reaction · prediction. Every topic must imply a strong, specific hook (not a vague theme).',
    '- ' + NO_BRAND_RULE,
    'Always return ONLY valid JSON.',
  ].join('\n');
  const user = [
    `Propose a weekly editorial agenda of ${count} LinkedIn posts for the week of ${weekLabel}.`,
    'Spread them Monday–Friday. Vary archetype, industry and priority. Each topic must be sharp, specific',
    'and comment-worthy — a concrete trade-off or claim, never generic "AI strategy". The "angle" should',
    'read like the post\'s core argument / hook so it is ready to draft.',
    '',
    settings.webSearch ? 'Use web search to anchor topics in this week’s real developments, announcements or data.' : '',
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

// ---- art-directed image prompt for an approved post ----
// Claude reads the post and writes a single photographic, editorial prompt that
// avoids the generic "AI render" look. Returns the prompt text only.
export async function generateImagePrompt(
  settings: Settings,
  post: { topic: string; angle: string },
  postText: string,
): Promise<string> {
  const system = 'You are an art director writing a prompt for a photoreal image model. Return ONLY the prompt text — no quotes, no preamble, no explanation.';
  const user = [
    'Write ONE image-generation prompt for the illustration of a LinkedIn thought-leadership post.',
    '',
    'It MUST read like a real editorial / documentary photograph or a tasteful real-world still life —',
    'NOT a glossy 3D render, NOT corporate clip-art, NOT a neon "futuristic AI" cliché, NOT obviously AI-made.',
    'Be concrete and specific: real subject, real setting, composition, focal length, natural lighting, mood,',
    'texture and depth of field — the kind of brief a photographer could shoot.',
    'It must be visually relevant to the post’s actual idea (a metaphor or a real scene from the industry it discusses).',
    'Strictly avoid: any text, letters, words, numbers, logos, watermarks, charts, infographics, UI; and any company or brand name.',
    '',
    `Post topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    `Post text:\n"""\n${postText}\n"""`,
    '',
    'Return only the prompt, about 40–70 words.',
  ].join('\n');
  const out = await callClaude(settings, { system, user, maxTokens: 500 });
  return (out || '').trim().replace(/^["']+|["']+$/g, '').trim();
}

