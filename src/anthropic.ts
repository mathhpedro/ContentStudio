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

// Author positioning, voice and LinkedIn craft. Kept COMPACT on purpose: this
// system prompt is sent on every generation, so brevity here directly cuts the
// input tokens billed per request.
const POSITIONING = [
  'You ghostwrite LinkedIn posts for an operator: a Director of SALES INTELLIGENCE, CRM GOVERNANCE and',
  'GTM ENGINEERING. Write in BRAZILIAN PORTUGUESE, keeping technical terms in English (pipeline, forecast,',
  'win rate, whitespace, deal owner, ICP, cross-sell, stage). Every post reinforces ONE of three fronts:',
  '- Sales Intelligence — commercial decisions driven by DATA, not gut; pipeline as a system, not a spreadsheet.',
  '- CRM Governance — clean data cuts friction and drives revenue; simplify, don\'t bureaucratize.',
  '- GTM Engineering — growth is engineering: process, automation, experiment.',
  'VOICE: direct & data-driven (open with the point, back every claim with a number or example); an OPERATOR',
  'with hands on the CRM (5 platforms that don\'t talk to each other), not a theorist; provoke AND teach —',
  'never just name a problem, show the path; always end actionable.',
].join('\n');

const CRAFT = [
  'CRAFT (write for the scroll, keep it TIGHT):',
  '- Hook: the first line stops the scroll (ideally ≤ ~12 words) — a strong claim, a surprising number or a',
  '  sharp question. No greeting, no "hoje quero falar sobre", no "em um mundo cada vez mais".',
  '- Body: very short paragraphs (1–2 sentences), one idea each, a blank line between them.',
  '- Length: aim ~900–1,300 characters TOTAL. Cut empty adjectives (incrível, poderoso, revolucionário).',
  '- End actionable: a question, a replicable principle or a light invite — never in the void.',
  '- No links. No engagement bait. At most 1 emoji (or none). No generic hashtags.',
].join('\n');

const SELLING = [
  'COMMERCIAL INTENT (sell by resonance, never pitch): write to the BUYER who would hire this expertise',
  '(sales leaders, RevOps, founders, the board), not to peers being graded. Lead with the RESULT or the',
  'tension they feel, not a role. Be specific enough that the wrong reader scrolls past and the right one',
  'thinks "esse problema é exatamente o meu". No "eu ajudo X a fazer Y", no ad tone.',
].join('\n');

// Never leak confidential figures — the document's "regra de ouro".
const SENSITIVE_RULE = 'NEVER expose sensitive or confidential data: use orders of magnitude, percentages and patterns — never a client\'s absolute values, deal names or internal targets. The insight sells; the raw number is risk.';

function styleSystem(style: string): string {
  return [
    POSITIONING,
    '',
    CRAFT,
    '',
    SELLING,
    '',
    'HARD RULES:',
    '- ' + NO_BRAND_RULE,
    '- ' + SENSITIVE_RULE,
    '- Ground every claim in a concrete number, pattern or example — no vague abstractions.',
    '- Always return ONLY valid JSON — no prose, no markdown fences.',
    style && style.trim() ? 'Voice/style profile to follow:\n"""\n' + style + '\n"""' : '',
  ].filter(Boolean).join('\n');
}

// The six content pillars — the AUTHORIZED territory for every generated topic.
// Grounding topic generation here (instead of open web search) keeps topics on-
// strategy AND removes the large token cost of search results on every call.
const PILLARS = [
  'SIX CONTENT PILLARS — every topic MUST belong to exactly one (this is the whole territory):',
  '1. Sales Intelligence & Pipeline — read a funnel for real (velocity, risk, conversion): aging de deals,',
  '   weighted vs raw pipeline, cycle time per stage, win/loss patterns, coverage ratio, the "deal zumbi".',
  '2. CRM Governance & Data Quality — the invisible cost of dirty data, simplify to drive adoption: campos',
  '   obrigatórios, naming convention, data quality score, validação por stage, multi-CRM, deduplicação.',
  '3. GTM Engineering & Growth — growth as engineering: whitespace mapping, cross-sell entre BUs, ICP as a',
  '   filter, lead-to-opportunity, GTM as experiment, qualification > volume, funnel automation.',
  '4. Bastidores & Aprendizados — first-person operator stories: a forecast mistake, an unpopular governance',
  '   call, building one consolidated view across 5 CRMs, automating a manual import. Honest, not boastful.',
  '5. Opinião & Hot Takes — founded opinions that spark debate: dashboards as decoration, AI exposing who',
  '   never read their own data, the unified-CRM fantasy, forecast by feeling, RevOps hype, vanity metrics.',
  '6. Educacional & Frameworks — teach a replicable method (high save value): coverage ratio em 3 passos,',
  '   the 5 questions of a real pipeline review, matriz de campos por stage, a data quality score from zero.',
].join('\n');

// Short pillar labels for rotation. CRM Governance is ONE of six — topics must
// spread across all of them (Sales Intelligence and GTM/Growth especially),
// never collapse onto CRM.
const PILLAR_NAMES = [
  'Sales Intelligence & Pipeline (funnel health, forecast, win/loss, coverage)',
  'GTM Engineering & Growth (whitespace, cross-sell, ICP, experiments, automation)',
  'Opinião & Hot Take (a founded, debate-sparking opinion on RevOps / sales / AI in sales)',
  'Educacional & Framework (a replicable method or checklist)',
  'Bastidores & Aprendizado (a first-person operator story / lesson)',
  'CRM Governance & Data Quality (only occasionally — do not over-use)',
];

// Altitude: topics must read as THOUGHT LEADERSHIP, not operational task tips.
const ALTITUDE = [
  'ALTITUDE — write THOUGHT LEADERSHIP, not task tips. Each topic must rise above day-to-day CRM/ops chores',
  'to a bigger idea a sales leader, founder or board cares about: where commercial teams are heading, how AI',
  'is reshaping selling and RevOps, what separates orgs that compound revenue from those that stall, the',
  'shift from gut to data-driven decisions, the economics of growth. Use the author\'s specific operational',
  'expertise as PROOF and credibility — never as the headline itself. Always zoom out to the strategic',
  '"so what" for the business and the market. Avoid purely internal admin topics (which field is mandatory,',
  'how to dedupe records) as the subject — those belong only as evidence inside a larger point.',
].join('\n');

// ---- 3 versions for a post ----
export async function generateVersions(
  settings: Settings,
  post: { topic: string; angle: string; format: string },
  style: string,
  perfHint?: string,
  refUrl?: string,
): Promise<Version[]> {
  const ref = (refUrl || '').trim();
  // Generate the 3 archetypes as SEPARATE PARALLEL calls (not one big request).
  // One Claude call producing all 3 full posts is slow on Opus and was hitting the
  // edge function's 150s wall-clock limit; three small concurrent calls each finish
  // in seconds and the whole batch resolves in ~the time of one.
  const ARCHETYPES = [
    { label: 'A', desc: 'Contrarian / answer-first: lead with a bold, against-the-grain claim, then prove it.' },
    { label: 'B', desc: 'Story (first person): a specific situation → complication → resolution carrying one lesson.' },
    { label: 'C', desc: 'Framework / numbered: a usable, skimmable list (a test, checklist or 3-step model).' },
  ];
  const tasks = ARCHETYPES.map((a) => {
    const user = [
      `Write ONE ready-to-publish LinkedIn post using this archetype: ${a.label} — ${a.desc}`,
      `Topic: ${post.topic}`,
      `Angle: ${post.angle}`,
      `Format hint: ${post.format}`,
      perfHint ? `Performance signals from past posts: ${perfHint}\nLean into what has worked, without copying.` : '',
      ref ? `Reference post: ${ref}\nUse web fetch to read it and build on its substance in our voice; do not copy it verbatim or name any company in it.` : '',
      '',
      'Apply the CRAFT and COMMERCIAL INTENT rules from the system prompt (Portuguese, tech terms in English;',
      'lead with the result/tension, make it filter the right reader, sell by resonance).',
      '- "hook": the opening line only — stops the scroll, no greeting. Lead with the result/tension, not a role.',
      '- "body": the rest of the post, formatted for LinkedIn — short paragraphs (1–2 sentences) separated by',
      '  BLANK LINES (use real newlines), an optional tight list, a complete hook→insight→takeaway arc, ending',
      '  actionable (a genuine question or a replicable principle).',
      '  Total post (hook + body) ~900–1,300 characters. No links, no hashtags, at most 1 emoji.',
      settings.webSearch ? 'Use web search to ground the post in one recent, specific, verifiable fact; weave it in (no link dumps).' : '',
      NO_BRAND_RULE,
      '',
      'Return JSON exactly (preserve newlines inside "body" as \\n):',
      '{"hook":"...","body":"...","method":"<archetype> — <one line>","methodNote":"why this structure works","why":"why it drives engagement"}',
    ].filter(Boolean).join('\n');
    return callClaude(settings, { system: styleSystem(style), user, maxTokens: 1500, search: settings.webSearch, fetchUrl: ref || undefined })
      .then((text) => ({ a, v: extractJson(text) }));
  });
  const settled = await Promise.allSettled(tasks);
  const ok = settled.filter((s): s is PromiseFulfilledResult<{ a: typeof ARCHETYPES[number]; v: any }> => s.status === 'fulfilled');
  if (!ok.length) {
    const failed = settled.find((s) => s.status === 'rejected') as PromiseRejectedResult | undefined;
    throw new Error((failed && failed.reason && failed.reason.message) || 'Generation failed');
  }
  return ok.map(({ value: { a, v } }) => ({
    label: a.label,
    approved: false, editor: 'AI draft', ts: NOW(),
    hook: v.hook || '', method: v.method || (a.label + ' — Generated'), methodNote: v.methodNote || '',
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
    'Apply the CRAFT and COMMERCIAL INTENT rules from the system prompt (Portuguese, tech terms in English):',
    '- "hook": opening line only, stops the scroll, no greeting; lead with the result/tension, not a role.',
    '- "body": LinkedIn-formatted — short paragraphs separated by BLANK LINES (\\n), optional tight list,',
    '  hook→insight→takeaway, ending actionable. Total ~900–1,300 characters. No links, no hashtags, ≤1 emoji.',
    settings.webSearch ? 'Use web search to ground it in one recent, specific, verifiable fact.' : '',
    NO_BRAND_RULE,
    'Return JSON exactly (newlines in "body" as \\n): {"hook":"...","body":"...","method":"<archetype> — <one line>","methodNote":"...","why":"..."}',
  ].filter(Boolean).join('\n');
  const text = await callClaude(settings, { system: styleSystem(style), user, maxTokens: 1500, search: settings.webSearch, fetchUrl: ref || undefined });
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
    'You are the editorial strategist for the author below. Plan a COHERENT week of LinkedIn posts grounded',
    'in the SIX PILLARS — every topic must clearly belong to one pillar so the feed stays on-strategy.',
    POSITIONING,
    '',
    PILLARS,
    '',
    ALTITUDE,
    '',
    'BALANCE IS MANDATORY: spread topics across the THREE fronts (Sales Intelligence, GTM Engineering/Growth,',
    'CRM Governance) and the pillars. Lean toward Sales Intelligence (1), Growth (3), Opinion (5) and',
    'Frameworks (6); use CRM Governance (2) for AT MOST ONE post in the week. Never make the week CRM-heavy.',
    'A good rhythm: open with a Sales Intelligence insight, mid-week an opinion or a behind-the-scenes lesson,',
    'close with an educational framework; fold in a growth/whitespace topic regularly. Every topic must imply',
    'a strong, specific hook — never a vague theme.',
    '- ' + NO_BRAND_RULE,
    'Always return ONLY valid JSON.',
  ].join('\n');
  const user = [
    `Propose a weekly editorial agenda of ${count} LinkedIn posts for the week of ${weekLabel}.`,
    'Use a DIFFERENT pillar for each post where possible; at most one CRM-governance topic for the whole week.',
    'Pick concrete, specific topics — no two on the same pillar back to back, no vague themes.',
    'Each "angle" should read like the post\'s core argument / hook so it is ready to draft. Spread Monday–Friday.',
    '',
    'Return JSON exactly:',
    '{"agenda":[{"topic":"...","angle":"...","format":"opinion|educational|technical|case study|trend","priority":"High|Medium|Low","dayOffset":0}]}',
    'dayOffset is 0–4 for Monday–Friday.',
  ].filter(Boolean).join('\n');
  const text = await callClaude(settings, { system, user, maxTokens: 1500 });
  const parsed = extractJson(text);
  return (parsed.agenda || []).map((a: any) => ({
    topic: a.topic || 'Untitled', angle: a.angle || '', format: (a.format || 'opinion'),
    priority: a.priority || 'Medium', dayOffset: Math.max(0, Math.min(4, parseInt(a.dayOffset, 10) || 0)),
  }));
}

// ---- one fresh, on-pillar topic (for "redo this topic") ----
export async function generateTopic(
  settings: Settings,
  _style: string,
  existing: string[],
): Promise<AgendaItem> {
  const system = [
    'You are the editorial strategist for the author below. Propose ONE specific, comment-worthy LinkedIn',
    'topic that clearly belongs to ONE of the six pillars.',
    POSITIONING,
    '',
    PILLARS,
    '',
    ALTITUDE,
    '- ' + NO_BRAND_RULE,
    'Always return ONLY valid JSON.',
  ].join('\n');
  // Rotate the target pillar so topics vary instead of collapsing onto CRM.
  const target = PILLAR_NAMES[Math.floor(Math.random() * PILLAR_NAMES.length)];
  const user = [
    `Use this pillar as the LENS (not the literal subject; do NOT default to CRM): ${target}.`,
    'Frame the topic at a leadership / market altitude — a sharp, specific thought-leadership angle, not an',
    'internal task tip and not a vague theme.',
    existing && existing.length ? 'Avoid repeating or overlapping any of these existing topics:\n- ' + existing.slice(0, 30).join('\n- ') : '',
    'The "angle" should read like the post\'s core argument / hook so it is ready to draft.',
    'Return JSON exactly: {"topic":"...","angle":"...","format":"opinion|educational|technical|case study|trend","priority":"High|Medium|Low"}',
  ].filter(Boolean).join('\n');
  const text = await callClaude(settings, { system, user, maxTokens: 500 });
  const a = extractJson(text);
  return {
    topic: a.topic || 'Untitled', angle: a.angle || '', format: a.format || 'opinion',
    priority: a.priority || 'Medium', dayOffset: 0,
  };
}

// ---- plain-language brief for a topic ----
export async function generateBrief(
  settings: Settings,
  post: Post,
): Promise<{ summary: string; why: string; points: string[] }> {
  const system = [
    'You explain Sales Intelligence, CRM Governance and GTM Engineering topics in plain, practical language',
    'for busy commercial leaders (sales leaders, RevOps, founders). Be concrete; keep tech terms in English.',
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
// Reads the post, extracts its ONE concrete idea, and writes a vivid, specific
// photojournalistic prompt — a real scene from the relevant industry that
// embodies the argument, not generic business stock.
export async function generateImagePrompt(
  settings: Settings,
  post: { topic: string; angle: string },
  postText: string,
): Promise<string> {
  const system = [
    'You are a photo editor at a serious business magazine (think the photography in The Economist,',
    'Bloomberg Businessweek or the FT Weekend) commissioning ONE photograph to run with an article.',
    'You return ONLY the final image-generation prompt — no quotes, no preamble, no explanation.',
  ].join('\n');
  const user = [
    'Commission ONE photograph for the article below. Work in this order, but output only the final prompt:',
    '1. Identify the article’s single concrete idea or tension (e.g. "a deal stuck in one stage for weeks",',
    '   "a forecast built on gut, not data", "five disconnected systems, one messy truth").',
    '2. Translate it into ONE specific, real, grounded scene from a modern commercial / sales operation: a',
    '   busy sales floor, a deal review around a whiteboard sketched with a funnel, sticky notes on glass, a',
    '   tense meeting-room moment, someone alone at a desk late with papers and coffee — a real place, a real',
    '   moment, real people doing real work, that a photojournalist could shoot today (no visible UI screens).',
    '   Give the viewer a PERSPECTIVE on the idea.',
    '3. Write it as a rich, specific photographic brief.',
    '',
    'The photo MUST feel real and editorial — shot on a real camera, candid, unstaged, with natural',
    'imperfection. Specify concretely: the setting and what is happening, the main subject, time of day and',
    'light (e.g. early-morning warehouse light, overcast loading dock, fluorescent back office), camera and',
    'lens (e.g. 35mm or 50mm, shallow depth of field), framing, texture and mood.',
    '',
    'HARD AVOID (these read as generic AI/stock and are forbidden): glowing blue networks, circuit boards,',
    'robots, humanoid AI, holograms, floating data/particles, brains, lightbulbs, glowing chess pieces,',
    'handshakes, generic glass skylines, people pointing at floating dashboards, anything neon-futuristic.',
    'Also NO text, letters, numbers, logos, watermarks, charts, infographics or screens with UI; and NO',
    'company or brand names anywhere.',
    '',
    `Article topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    `Article text:\n"""\n${postText}\n"""`,
    '',
    'Return only the final prompt — one vivid paragraph, ~50–90 words.',
  ].join('\n');
  const out = await callClaude(settings, { system, user, maxTokens: 700 });
  return (out || '').trim().replace(/^["']+|["']+$/g, '').trim();
}

// ---- data figure spec for an approved post ----
// The model turns the post into a structured chart spec; the app renders it as a
// clean editorial figure (see chart.ts). Reuses figures already cited in the post.
export async function generateChartSpec(
  settings: Settings,
  post: { topic: string; angle: string },
  postText: string,
): Promise<any> {
  const system = [
    'You are a data-visualisation editor for a business publication. You turn an article into ONE simple,',
    'honest figure that carries its core point. Return ONLY valid JSON — no prose, no markdown fences.',
  ].join('\n');
  const user = [
    'Design ONE figure for the article below. Pick the chart type that best carries its single main point:',
    '- "bars": compare 2–6 quantities (each {label, value, highlight?}). Best default.',
    '- "comparison": two contrasting numbers ({left:{label,value}}, {right:{label,value}}).',
    '- "stat": one hero number ({stat:{value, label}}) — value is a short string like "39%" or "6×".',
    '- "matrix": a 2×2 positioning ({axisX:{low,high}}, {axisY:{low,high}}, points:[{label,x,y,highlight}] with x,y in 0..1).',
    '',
    'Rules:',
    '- PREFER numbers actually stated in the article text; keep them consistent with it.',
    '- If you must invent figures to make the point, keep them realistic and set "illustrative": true.',
    '- "title" = the point in ~6–10 words (not a label like "Bar chart"). "takeaway" = one short so-what line.',
    '- "kicker" = a short UPPERCASE section label (≤ ~4 words), e.g. "REVENUE GROWTH MANAGEMENT".',
    '- "unit" is one of "%", "$", "x", or "" . Keep labels short (≤ ~24 chars).',
    '- COLOUR-CODE every bar / value by meaning via "kind": "base" (current/baseline), "gain" (an',
    '  improvement), "result" (a generated result/outcome), "loss" (a decline), or "neutral". Use distinct',
    '  kinds so the figure differentiates baseline vs improvement vs result — never make them all the same.',
    '- No brand or company names anywhere.',
    '',
    `Article topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    `Article text:\n"""\n${postText}\n"""`,
    '',
    'Return JSON exactly like one of (include "kicker"):',
    '{"type":"bars","kicker":"REVENUE GROWTH MANAGEMENT","title":"...","takeaway":"...","unit":"%","illustrative":true,"bars":[{"label":"Today","value":35,"kind":"base"},{"label":"After","value":52,"kind":"result"}]}',
    '{"type":"comparison","title":"...","unit":"$","left":{"label":"...","value":50,"kind":"base"},"right":{"label":"...","value":8,"kind":"gain"}}',
    '{"type":"stat","title":"...","takeaway":"...","stat":{"value":"39%","label":"..."}}',
    '{"type":"matrix","title":"...","axisX":{"low":"...","high":"..."},"axisY":{"low":"...","high":"..."},"points":[{"label":"...","x":0.2,"y":0.8,"highlight":true}]}',
  ].join('\n');
  const text = await callClaude(settings, { system, user, maxTokens: 900 });
  return extractJson(text);
}

// ---- rich editorial poster spec (single image) ----
// One layered composition: kicker → headline (+gold italic) → subhead → a row
// of up to 3 stat callouts → a bar chart and/or a short notes column.
export async function generatePosterSpec(
  settings: Settings,
  post: { topic: string; angle: string },
  postText: string,
): Promise<any> {
  const system = [
    'You are a data-visualisation editor at a business magazine. You turn an article into ONE rich,',
    'layered editorial poster (like a magazine page): a headline, a few stat callouts, and a chart with a',
    'short "what it means" column. Return ONLY valid JSON — no prose, no markdown fences.',
  ].join('\n');
  const user = [
    'Design ONE editorial poster for the article below. Fill these sections (omit any that do not fit):',
    '- "kicker": short UPPERCASE section label.',
    '- "title": the headline (the point), ≤ ~10 words. "accent": a short italic continuation (the gold line).',
    '- "subhead": 1–3 sentences of context (mono paragraph).',
    '- "stats": up to 3 callouts, each {"value":"50%","label":"WHAT IT MEASURES","sub":"vs 33%"} — the key',
    '  proof numbers. value is a short string. The first one is the hero (rendered gold).',
    '- "barsLabel" + "bars": a labelled bar chart (each bar {label,value,kind,unit via top-level "unit"}).',
    '  COLOUR-CODE bars by "kind": base / gain / result / loss / neutral — distinct, never all the same.',
    '- "notesLabel" + "notes": up to 3 short points, each {"title":"...","text":"one or two lines"} — the',
    '  "what it is getting wrong / why it matters" column.',
    '',
    'Rules: PREFER numbers already stated in the article; if you invent any, set "illustrative": true and keep',
    'them realistic. No brand or company names.',
    '',
    POSTER_LIMITS,
    '',
    `Article topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    `Article text:\n"""\n${postText}\n"""`,
    '',
    'Return JSON exactly like:',
    '{"kicker":"REVENUE GROWTH MANAGEMENT","title":"...","accent":"...","subhead":"...","stats":[{"value":"50%","label":"MATCH OUTCOMES","sub":"vs 33%"},{"value":"58%","label":"RIGHT SLOT"}],"barsLabel":"WHO LIFTS THE TROPHY","unit":"%","bars":[{"label":"Spain","value":24,"kind":"result"},{"label":"Argentina","value":20,"kind":"base"}],"notesLabel":"GETTING WRONG","notes":[{"title":"Can\'t see draws","text":"4 of 12 finished level."}],"illustrative":true}',
  ].join('\n');
  const text = await callClaude(settings, { system, user, maxTokens: 1600, search: settings.webSearch });
  return extractJson(text);
}

// Strict length/count limits so the layout never overflows (the renderer also clips).
const POSTER_LIMITS = [
  'STRICT LIMITS (so the layout fits — keep every string within these):',
  '- title ≤ 46 chars · accent ≤ 34 chars · subhead ≤ 180 chars · kicker ≤ 32 chars.',
  '- stats: at most 3. value ≤ 6 chars (e.g. "8.3%", "$1.2B", "0/4"). label ≤ 16 chars. sub ≤ 12 chars.',
  '- bars: at most 5. label ≤ 14 chars. "value" is a plain NUMBER. "unit" MUST be exactly one of "%", "$",',
  '  "x" or "" — NEVER a word like "points" or "pts" (put any such word in the barsLabel instead).',
  '- notes: at most 3. title ≤ 20 chars. text ≤ 80 chars (one short sentence).',
].join('\n');

// Revise an existing poster spec per a short instruction (the "adjust" workflow).
export async function adjustPosterSpec(
  settings: Settings,
  current: any,
  instruction: string,
): Promise<any> {
  const system = [
    'You revise an existing editorial poster spec (JSON) according to the user\'s instruction. Change ONLY',
    'what they ask; keep everything else identical. Return ONLY the full revised JSON spec — no prose.',
  ].join('\n');
  const user = [
    'Current spec:',
    JSON.stringify(current),
    '',
    'Instruction: ' + instruction,
    '',
    POSTER_LIMITS,
    'No brand or company names. Return the FULL revised JSON spec.',
  ].join('\n');
  const text = await callClaude(settings, { system, user, maxTokens: 1600 });
  return extractJson(text);
}

// ---- 3-slide carousel for an approved post ----
// A connected set of at most 3 slides (each may be text-only) that tell one story.
export async function generateCarousel(
  settings: Settings,
  post: { topic: string; angle: string },
  postText: string,
): Promise<any> {
  const system = [
    'You design tight LinkedIn carousels: at most 3 slides that connect into ONE flowing story',
    '(slide 1 hooks, the middle delivers the substance, the last lands the takeaway and asks a question).',
    'Slides can be text-only. Return ONLY valid JSON — no prose, no markdown fences.',
  ].join('\n');
  const user = [
    'Design a carousel of EXACTLY 3 slides for the article below. The slides must reference one through-line',
    'so they clearly belong together (a promise opened on slide 1 and paid off by slide 3).',
    '',
    'Each slide is one of these shapes (every slide may carry a short "kicker" — an UPPERCASE section label):',
    '- {"kind":"cover","kicker":"SHORT LABEL","title":"the hook (cream)","accent":"a short italic continuation (gold)","subtitle":"one supporting line"}',
    '- {"kind":"point","kicker":"...","title":"slide heading","bullets":["short point","short point","short point"]}',
    '- {"kind":"steps","kicker":"...","title":"heading","steps":[{"n":"01","label":"Frame"},{"n":"02","label":"Model"},{"n":"03","label":"Decide"}]}',
    '- {"kind":"stat","kicker":"...","value":"4–7%","label":"what it is","context":"one line of meaning"}',
    '- {"kind":"bars","kicker":"...","title":"the point","unit":"%","bars":[{"label":"Today","value":35,"kind":"base"},{"label":"After","value":52,"kind":"result"}]}',
    '- {"kind":"cta","kicker":"...","title":"the takeaway","question":"one genuine question (gold italic)","footer":"a short closing line"}',
    '',
    'Rules:',
    '- Slide 1 should be a "cover": split its hook into "title" (the main line) + "accent" (a short italic',
    '  continuation), like «The bottleneck was never the intelligence.» + «It\'s the operating model.».',
    '- Slide 3 should be a "cta". The middle slide carries the substance: use "bars"/"stat" when there are',
    '  real numbers, "steps" for a process/sequence, otherwise "point".',
    '- On "bars", COLOUR-CODE by "kind" (base / gain / result / loss / neutral) so baseline, improvement and',
    '  result are visually distinct — never all the same.',
    '- Keep text short and punchy (it must fit a slide). Prefer numbers already in the article. No brands.',
    '',
    `Article topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    `Article text:\n"""\n${postText}\n"""`,
    '',
    'Return JSON exactly: {"slides":[ {…}, {…}, {…} ]} with at most 3 slides.',
  ].join('\n');
  const text = await callClaude(settings, { system, user, maxTokens: 1600 });
  return extractJson(text);
}

