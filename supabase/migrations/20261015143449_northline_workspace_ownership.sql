-- Applied to project srwzgwodlpylezdaipce; live ownership and BHD restrictions verified.
create table public.northline_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"accounts":[],"transactions":[],"budgets":[],"goals":[],"currency":"BHD","region":"BH","timeZone":"Asia/Bahrain"}'::jsonb,
  constraint workspace_currency_is_bhd check (data @> '{"currency":"BHD"}'::jsonb),
  constraint workspace_data_is_object check (jsonb_typeof(data) = 'object')
);
alter table public.northline_workspaces enable row level security;
revoke all on public.northline_workspaces from anon;
grant select, insert, update, delete on public.northline_workspaces to authenticated;
create policy "Read own workspace" on public.northline_workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own workspace" on public.northline_workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own workspace" on public.northline_workspaces
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Delete own workspace" on public.northline_workspaces
  for delete to authenticated using ((select auth.uid()) = user_id);
