// Browser-side client for the Anthropic Messages API.
//
// This is a static site (GitHub Pages) with no backend, so the studio talks to
// Claude directly from the browser using the official
// `anthropic-dangerous-direct-browser-access` header and a user-supplied API key.
// The key lives only in this browser's localStorage — see store.ts.

import { NOW, type Post, type Version } from './data';

export interface Settings {
  apiKey: string;
  model: string;
}

export const MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — most capable' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — fast & balanced' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fastest' },
];

export const DEFAULT_MODEL = 'claude-opus-4-8';

const API_URL = 'https://api.anthropic.com/v1/messages';

// ---- low-level call ----
export async function callClaude(
  settings: Settings,
  opts: { system: string; user: string; maxTokens?: number },
): Promise<string> {
  if (!settings || !settings.apiKey) {
    throw new Error('Not connected — add your Anthropic API key in Settings.');
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model || DEFAULT_MODEL,
      max_tokens: opts.maxTokens || 4096,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    }),
  });
  if (!res.ok) {
    let msg = 'Request failed (HTTP ' + res.status + ')';
    try { const j = await res.json(); msg = (j && j.error && j.error.message) || msg; } catch { /* ignore */ }
    if (res.status === 401) msg = 'Invalid API key. Check it in Settings.';
    throw new Error(msg);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .trim();
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

function styleSystem(style: string): string {
  return [
    "You are Pragma's content engine. You write LinkedIn-style thought-leadership posts",
    'for a B2B consultancy focused on AI execution and operating models.',
    '',
    "Follow this writing-style profile precisely:",
    '"""',
    style,
    '"""',
    '',
    'Always return ONLY valid JSON — no prose, no markdown fences, no commentary.',
  ].join('\n');
}

// ---- 3 versions for a post ----
export async function generateVersions(
  settings: Settings,
  post: { topic: string; angle: string; format: string },
  style: string,
): Promise<Version[]> {
  const user = [
    'Create 3 distinct versions of a single post.',
    `Topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    `Format: ${post.format}`,
    '',
    'Each version must use a DIFFERENT rhetorical method (e.g. Pyramid Principle / answer-first,',
    'Storytelling / situation-complication-resolution, and Proof & specificity / numbered claims).',
    'Body is 110–200 words and ends with one sharp question. The hook is a single strong opening line.',
    '',
    'Return JSON exactly in this shape:',
    '{"versions":[{"label":"A","hook":"...","body":"...","method":"<short name> — <one line>","methodNote":"why this structure works","why":"why it drives engagement"},{"label":"B",...},{"label":"C",...}]}',
  ].join('\n');
  const text = await callClaude(settings, { system: styleSystem(style), user, maxTokens: 4096 });
  const parsed = extractJson(text);
  const arr = (parsed.versions || []).slice(0, 3);
  return arr.map((v: any, i: number) => ({
    label: v.label || ['A', 'B', 'C'][i] || String(i + 1),
    approved: false, editor: 'Pragma AI', ts: NOW(),
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
): Promise<{ hook: string; body: string; method: string; methodNote: string; why: string }> {
  const user = [
    `Write a FRESH alternative for version ${prev.label} of this post — clearly different from the previous take.`,
    `Topic: ${post.topic}`,
    `Angle: ${post.angle}`,
    `Format: ${post.format}`,
    `Previous hook (avoid repeating): ${prev.hook}`,
    '',
    'Body is 110–200 words and ends with one sharp question.',
    'Return JSON exactly: {"hook":"...","body":"...","method":"<short name> — <one line>","methodNote":"...","why":"..."}',
  ].join('\n');
  const text = await callClaude(settings, { system: styleSystem(style), user, maxTokens: 2048 });
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
    "You are Pragma's editorial strategist for a B2B AI-execution consultancy.",
    'Themes in rotation: the AI execution gap, accountability/ownership of AI outputs, operating models,',
    'forward-deployed engineering, outcome-based pricing, governance after the demo, and synthetic workforce economics.',
    'Always return ONLY valid JSON.',
  ].join('\n');
  const user = [
    `Propose a weekly editorial agenda of ${count} LinkedIn posts for the week of ${weekLabel}.`,
    'Spread them Monday–Friday. Vary the formats and priorities. Keep topics sharp and specific.',
    '',
    'Return JSON exactly:',
    '{"agenda":[{"topic":"...","angle":"...","format":"opinion|educational|technical|case study|trend","priority":"High|Medium|Low","dayOffset":0}]}',
    'dayOffset is 0–4 for Monday–Friday.',
  ].join('\n');
  const text = await callClaude(settings, { system, user, maxTokens: 2048 });
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
  const system = 'You explain B2B AI strategy topics in plain language for busy executives. Return ONLY valid JSON.';
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
