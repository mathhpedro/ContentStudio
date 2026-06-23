-- Pragma Content Studio — collaborative schema (Tier 0)
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- Model: a Workspace is shared by an Owner (you) and a Writer (your friend).
-- All content rows are scoped to a workspace and protected by Row Level Security.

create extension if not exists "pgcrypto";

-- ---------- tables ----------
create table if not exists workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'My Studio',
  owner       uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  email        text,
  role         text not null default 'writer' check (role in ('owner','writer','viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  date          date not null,
  topic         text not null,
  angle         text default '',
  format        text default 'opinion',
  status        text default 'Draft',
  priority      text default 'Medium',
  change        text,
  scheduled_for date,
  versions      jsonb not null default '[]'::jsonb,
  active_ver    int   not null default 0,
  brief         jsonb,
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists style_profiles (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  style        text not null default '',
  examples     jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

create table if not exists comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references posts (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  author       uuid references auth.users (id),
  author_email text,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists posts_ws_idx on posts (workspace_id);
create index if not exists comments_post_idx on comments (post_id);
create index if not exists members_user_idx on members (user_id);

-- ---------- membership helper ----------
create or replace function is_member(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

create or replace function is_owner(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from members m where m.workspace_id = ws and m.user_id = auth.uid() and m.role = 'owner');
$$;

-- ---------- row level security ----------
alter table workspaces     enable row level security;
alter table members        enable row level security;
alter table posts          enable row level security;
alter table style_profiles enable row level security;
alter table comments       enable row level security;

-- workspaces: members can read; any authed user can create (becomes owner); owner can update/delete
drop policy if exists ws_select on workspaces;
create policy ws_select on workspaces for select using (is_member(id));
drop policy if exists ws_insert on workspaces;
create policy ws_insert on workspaces for insert with check (owner = auth.uid());
drop policy if exists ws_update on workspaces;
create policy ws_update on workspaces for update using (is_owner(id));
drop policy if exists ws_delete on workspaces;
create policy ws_delete on workspaces for delete using (is_owner(id));

-- members: members can read the roster; owner manages it; a user may insert their own owner row
drop policy if exists mem_select on members;
create policy mem_select on members for select using (is_member(workspace_id));
drop policy if exists mem_insert on members;
create policy mem_insert on members for insert
  with check (is_owner(workspace_id) or (user_id = auth.uid() and role = 'owner'));
drop policy if exists mem_update on members;
create policy mem_update on members for update using (is_owner(workspace_id));
drop policy if exists mem_delete on members;
create policy mem_delete on members for delete using (is_owner(workspace_id) or user_id = auth.uid());

-- posts / style / comments: any workspace member can read+write (viewer tightening can come later)
drop policy if exists posts_all on posts;
create policy posts_all on posts for all using (is_member(workspace_id)) with check (is_member(workspace_id));
drop policy if exists style_all on style_profiles;
create policy style_all on style_profiles for all using (is_member(workspace_id)) with check (is_member(workspace_id));
drop policy if exists comments_all on comments;
create policy comments_all on comments for all using (is_member(workspace_id)) with check (is_member(workspace_id));

-- ---------- realtime ----------
-- so both people see live updates
alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table comments;
