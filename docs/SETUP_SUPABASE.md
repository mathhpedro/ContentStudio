# Tier 0 — Collaborative backend setup (Supabase)

This turns the studio from a single-browser tool into a shared workspace where
your **writer** drafts and you (the **owner**) review/approve — with your
Anthropic key kept on the server, not in the browser.

## What's already in the repo
- `supabase/migrations/0001_init.sql` — schema + Row Level Security (workspaces,
  members/roles, posts, comments, style) + realtime.
- `supabase/functions/generate/index.ts` — Edge Function that proxies Claude
  using a server-side key.
- `src/supabaseClient.ts` — app client, **inactive** until the env vars below are
  set (so the live app keeps working unchanged in the meantime).

## Steps

### 1. Create a Supabase project
At [supabase.com](https://supabase.com) → New project. Note the **Project URL**
and **anon public key** (Settings → API). The anon key is safe to ship in a
static site — Row Level Security is what protects the data.

### 2. Apply the schema
SQL Editor → paste `supabase/migrations/0001_init.sql` → Run.
(Or with the CLI: `supabase link` then `supabase db push`.)

### 3. Deploy the Claude proxy + set the key
```bash
supabase functions deploy generate
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key
```

### 4. Enable email login
Authentication → Providers → Email (magic link is fine). Add the site URL
(`https://mathhpedro.github.io/ContentStudio/`) to the allowed redirect URLs.

### 5. Wire the build (GitHub Pages)
Add two repo **Variables** (Settings → Secrets and variables → Actions →
Variables) and pass them in the deploy workflow as build env:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(I'll update `.github/workflows/deploy.yml` to inject these when we wire the app.)

### 6. Invite your friend
Once you sign in and a workspace is created, add her by email as a `writer`.

## What I need from you to finish wiring + testing
1. **Project URL + anon key** (or connect the Supabase integration so I can read them).
2. Confirm I can set the **ANTHROPIC_API_KEY** secret (your key).
3. **Your email + your friend's email** for login + invite.

With those, I'll wire the app side (auth gate, shared data + realtime, roles,
review/approval + comments, and switch generation to the proxy), test it, and
publish.
