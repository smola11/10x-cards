-- migration: create table public.generations with rls and policies
-- purpose: define generations table, timestamps, trigger, index, and rls policies
-- affected objects: table public.generations; function public.set_updated_at; trigger generations_set_updated_at
-- security: row level security enabled with granular policies for roles `authenticated` and `anon`

-- function: update updated_at on row changes (shared)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- table: generations (ai generation metadata and metrics)
create table if not exists public.generations (
  id                   bigserial primary key,
  user_id              uuid not null references auth.users(id) on delete cascade,
  total_count          integer not null,
  accepted_unedited_count integer,
  accepted_edited_count   integer,
  prompt_text          text not null check (char_length(prompt_text) between 1000 and 10000),
  model                text not null,
  generation_duration  integer not null check (generation_duration >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- trigger: maintain updated_at on update for generations
drop trigger if exists generations_set_updated_at on public.generations;
create trigger generations_set_updated_at
before update on public.generations
for each row execute function public.set_updated_at();

-- index to optimize list/sort by time per user
create index if not exists idx_generations_user_created_at
  on public.generations (user_id, created_at desc);

-- enable row level security (rls)
alter table public.generations enable row level security;

-- policies: generations (owner-only). explicit policies per role

-- authenticated: allow access only to own rows
drop policy if exists generations_select_own_authenticated on public.generations;
create policy generations_select_own_authenticated on public.generations
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists generations_insert_own_authenticated on public.generations;
create policy generations_insert_own_authenticated on public.generations
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists generations_update_own_authenticated on public.generations;
create policy generations_update_own_authenticated on public.generations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists generations_delete_own_authenticated on public.generations;
create policy generations_delete_own_authenticated on public.generations
  for delete
  to authenticated
  using (user_id = auth.uid());

-- anon: explicitly deny all actions (defense-in-depth)
drop policy if exists generations_select_deny_anon on public.generations;
create policy generations_select_deny_anon on public.generations
  for select
  to anon
  using (false);

drop policy if exists generations_insert_deny_anon on public.generations;
create policy generations_insert_deny_anon on public.generations
  for insert
  to anon
  with check (false);

drop policy if exists generations_update_deny_anon on public.generations;
create policy generations_update_deny_anon on public.generations
  for update
  to anon
  using (false)
  with check (false);

drop policy if exists generations_delete_deny_anon on public.generations;
create policy generations_delete_deny_anon on public.generations
  for delete
  to anon
  using (false);

-- end of migration


