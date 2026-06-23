// Supabase client — only initialised when the project env vars are present.
// Until you add a Supabase project (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY),
// `supabase` is null and the studio runs in today's local single-user mode.
// Once they're set, the collaborative (multi-user, shared) mode activates.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabase = !!(url && anon);

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
