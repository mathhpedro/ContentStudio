-- Collaborative "team by invite" model: a user may self-join a workspace as a
-- writer (the workspace UUID acts as the invite secret). Owners can still manage
-- the roster; the owner self-insert path remains for first-run workspace creation.

drop policy if exists mem_insert on members;
create policy mem_insert on members for insert
  with check (
    is_owner(workspace_id)
    or (user_id = auth.uid() and role in ('owner', 'writer'))
  );
