// Supabase client. The project URL + anon key are public by design (Row Level
// Security protects the data), so they're baked in as defaults and can be
// overridden via env. When present, the studio runs in collaborative mode.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  || 'https://vatcigpbnguebjoqivab.supabase.co';
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdGNpZ3Bibmd1ZWJqb3FpdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxOTQyNzEsImV4cCI6MjA5Nzc3MDI3MX0.DQcl5KEndBZMhrDh3IXVnYbH7cUSDHftBKSq2yW5hGA';

export const hasSupabase = !!(url && anon);

export const supabase: SupabaseClient = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});
