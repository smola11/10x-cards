-- migration: create table public.flashcards with rls and policies
-- purpose: define flashcards table, enum for origin, trigger, indexes, and rls policies
-- affected objects: type public.flashcard_origin; table public.flashcards; trigger flashcards_set_updated_at
-- security: row level security enabled with granular policies for roles `authenticated` and `anon`

-- ensure enum type exists and includes required labels
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'flashcard_origin'
  ) then
    create type public.flashcard_origin as enum ('manual', 'ai-full', 'ai-edited');
  else
    -- add any missing labels (safe if already present)
    begin
      alter type public.flashcard_origin add value if not exists 'ai-full';
    exception when others then null;
    end;
    begin
      alter type public.flashcard_origin add value if not exists 'ai-edited';
    exception when others then null;
    end;
  end if;
end
$$;

-- table: flashcards
create table if not exists public.flashcards (
  id                     bigserial primary key,
  user_id                uuid not null references auth.users(id) on delete cascade,
  front                  text not null check (char_length(front) between 1 and 200),
  back                   text not null check (char_length(back) between 1 and 500),
  origin                 public.flashcard_origin not null,
  generation_id          bigint null references public.generations(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint flashcards_origin_generation_check
    check (
      (origin = 'manual' and generation_id is null) or
      (origin = 'ai-full' and generation_id is not null) or
      (origin = 'ai-edited' and generation_id is not null)
    )
);

-- trigger: maintain updated_at on update for flashcards
drop trigger if exists flashcards_set_updated_at on public.flashcards;
create trigger flashcards_set_updated_at
before update on public.flashcards
for each row execute function public.set_updated_at();

-- indexes to optimize common queries and joins
create index if not exists idx_flashcards_user_created_at
  on public.flashcards (user_id, created_at desc);

create index if not exists idx_flashcards_generation_id
  on public.flashcards (generation_id);

-- enable row level security (rls)
alter table public.flashcards enable row level security;

-- policies: flashcards (owner-only). explicit policies per role

-- authenticated: allow access only to own rows
drop policy if exists flashcards_select_own_authenticated on public.flashcards;
create policy flashcards_select_own_authenticated on public.flashcards
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists flashcards_insert_own_authenticated on public.flashcards;
create policy flashcards_insert_own_authenticated on public.flashcards
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists flashcards_update_own_authenticated on public.flashcards;
create policy flashcards_update_own_authenticated on public.flashcards
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists flashcards_delete_own_authenticated on public.flashcards;
create policy flashcards_delete_own_authenticated on public.flashcards
  for delete
  to authenticated
  using (user_id = auth.uid());

-- anon: explicitly deny all actions (defense-in-depth)
drop policy if exists flashcards_select_deny_anon on public.flashcards;
create policy flashcards_select_deny_anon on public.flashcards
  for select
  to anon
  using (false);

drop policy if exists flashcards_insert_deny_anon on public.flashcards;
create policy flashcards_insert_deny_anon on public.flashcards
  for insert
  to anon
  with check (false);

drop policy if exists flashcards_update_deny_anon on public.flashcards;
create policy flashcards_update_deny_anon on public.flashcards
  for update
  to anon
  using (false)
  with check (false);

drop policy if exists flashcards_delete_deny_anon on public.flashcards;
create policy flashcards_delete_deny_anon on public.flashcards
  for delete
  to anon
  using (false);

-- end of migration


