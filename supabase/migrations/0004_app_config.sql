-- Server-only config: holds the team access code and the shared workspace id.
-- RLS is enabled with NO policies, so neither anon nor authenticated clients can
-- read it — only the service role (edge functions) bypasses RLS. The actual
-- values are inserted out-of-band (not in this migration) so the code stays out
-- of version control.

create table if not exists app_config (
  key   text primary key,
  value text not null
);
alter table app_config enable row level security;
revoke all on app_config from anon, authenticated;
