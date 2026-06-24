-- Per-account (per-workspace) Gemini text key, so each account uses its own
-- quota. RLS-locked: only the service role (edge functions) can read it.
create table if not exists workspace_keys (
  workspace_id    uuid primary key references workspaces (id) on delete cascade,
  gemini_text_key text,
  updated_at      timestamptz not null default now()
);
alter table workspace_keys enable row level security;
revoke all on workspace_keys from anon, authenticated;
