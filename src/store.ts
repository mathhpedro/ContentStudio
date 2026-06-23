// localStorage persistence for the studio: settings (API key + model), posts, and writing style.
// Everything stays in the user's browser — nothing is sent anywhere except the Anthropic API.

import { DEFAULT_STYLE, type Post } from './data';
import { DEFAULT_MODEL, type Settings } from './anthropic';

const K_SETTINGS = 'pragma.settings.v1';
const K_POSTS = 'pragma.posts.v1';
const K_STYLE = 'pragma.style.v1';

function read(key: string): any {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function write(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private mode — ignore */ }
}

export function loadSettings(): Settings {
  const s = read(K_SETTINGS) || {};
  return { apiKey: s.apiKey || '', model: s.model || DEFAULT_MODEL };
}
export function saveSettings(s: Settings) { write(K_SETTINGS, s); }

export function loadPosts(): Post[] | null {
  const p = read(K_POSTS);
  return Array.isArray(p) ? p : null;
}
export function savePosts(posts: Post[]) { write(K_POSTS, posts); }

export function loadStyle(): string {
  const s = read(K_STYLE);
  return typeof s === 'string' && s.length ? s : DEFAULT_STYLE;
}
export function saveStyle(style: string) { write(K_STYLE, style); }
