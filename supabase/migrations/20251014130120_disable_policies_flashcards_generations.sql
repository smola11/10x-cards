-- migration: disable RLS and drop policies for public.flashcards and public.generations
-- purpose: turn off all previously defined row level policies and disable RLS enforcement
-- affected objects: table public.flashcards; table public.generations; their RLS policies

-- flashcards: drop policies (if present) and disable RLS
drop policy if exists flashcards_select_own_authenticated on public.flashcards;
drop policy if exists flashcards_insert_own_authenticated on public.flashcards;
drop policy if exists flashcards_update_own_authenticated on public.flashcards;
drop policy if exists flashcards_delete_own_authenticated on public.flashcards;
drop policy if exists flashcards_select_deny_anon on public.flashcards;
drop policy if exists flashcards_insert_deny_anon on public.flashcards;
drop policy if exists flashcards_update_deny_anon on public.flashcards;
drop policy if exists flashcards_delete_deny_anon on public.flashcards;

alter table public.flashcards disable row level security;

-- generations: drop policies (if present) and disable RLS
drop policy if exists generations_select_own_authenticated on public.generations;
drop policy if exists generations_insert_own_authenticated on public.generations;
drop policy if exists generations_update_own_authenticated on public.generations;
drop policy if exists generations_delete_own_authenticated on public.generations;
drop policy if exists generations_select_deny_anon on public.generations;
drop policy if exists generations_insert_deny_anon on public.generations;
drop policy if exists generations_update_deny_anon on public.generations;
drop policy if exists generations_delete_deny_anon on public.generations;

alter table public.generations disable row level security;

-- end of migration


