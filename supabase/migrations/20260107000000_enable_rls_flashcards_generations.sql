-- migration: enable RLS and restore policies for public.flashcards and public.generations
-- purpose: re-enable row level security with comprehensive CRUD policies for both tables
-- affected objects: table public.flashcards; table public.generations; RLS policies for all operations
-- security: row level security enabled with granular policies for roles `authenticated` and `anon`
--
-- rationale:
-- this migration restores security by ensuring users can only access their own data.
-- each table has separate policies for select, insert, update, and delete operations,
-- with distinct policies for authenticated and anonymous users for defense-in-depth.

-- ============================================================================
-- table: public.generations
-- ============================================================================

-- enable row level security on generations table
-- this ensures all queries are filtered through the policies defined below
alter table public.generations enable row level security;

-- ============================================================================
-- authenticated user policies for generations
-- rationale: authenticated users should only access their own generation records
-- ============================================================================

-- policy: allow authenticated users to select only their own generations
-- rationale: users should only view generation records they created
drop policy if exists generations_select_own_authenticated on public.generations;
create policy generations_select_own_authenticated on public.generations
  for select
  to authenticated
  using (user_id = auth.uid());

-- policy: allow authenticated users to insert generations for themselves
-- rationale: users can create new generation records, but only for their own user_id
drop policy if exists generations_insert_own_authenticated on public.generations;
create policy generations_insert_own_authenticated on public.generations
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- policy: allow authenticated users to update only their own generations
-- rationale: users can modify their generation records, but cannot change ownership
drop policy if exists generations_update_own_authenticated on public.generations;
create policy generations_update_own_authenticated on public.generations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- policy: allow authenticated users to delete only their own generations
-- rationale: users can remove their own generation records
drop policy if exists generations_delete_own_authenticated on public.generations;
create policy generations_delete_own_authenticated on public.generations
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- anonymous user policies for generations
-- rationale: anonymous users should have no access to generation data
-- these policies explicitly deny all operations for defense-in-depth
-- ============================================================================

-- policy: deny anonymous users from selecting generations
-- rationale: generation data is private and requires authentication
drop policy if exists generations_select_deny_anon on public.generations;
create policy generations_select_deny_anon on public.generations
  for select
  to anon
  using (false);

-- policy: deny anonymous users from inserting generations
-- rationale: only authenticated users can create generation records
drop policy if exists generations_insert_deny_anon on public.generations;
create policy generations_insert_deny_anon on public.generations
  for insert
  to anon
  with check (false);

-- policy: deny anonymous users from updating generations
-- rationale: anonymous users have no access to modify any data
drop policy if exists generations_update_deny_anon on public.generations;
create policy generations_update_deny_anon on public.generations
  for update
  to anon
  using (false)
  with check (false);

-- policy: deny anonymous users from deleting generations
-- rationale: anonymous users cannot delete any records
drop policy if exists generations_delete_deny_anon on public.generations;
create policy generations_delete_deny_anon on public.generations
  for delete
  to anon
  using (false);

-- ============================================================================
-- table: public.flashcards
-- ============================================================================

-- enable row level security on flashcards table
-- this ensures all queries are filtered through the policies defined below
alter table public.flashcards enable row level security;

-- ============================================================================
-- authenticated user policies for flashcards
-- rationale: authenticated users should only access their own flashcard records
-- ============================================================================

-- policy: allow authenticated users to select only their own flashcards
-- rationale: users should only view flashcards they created
drop policy if exists flashcards_select_own_authenticated on public.flashcards;
create policy flashcards_select_own_authenticated on public.flashcards
  for select
  to authenticated
  using (user_id = auth.uid());

-- policy: allow authenticated users to insert flashcards for themselves
-- rationale: users can create new flashcards, but only for their own user_id
drop policy if exists flashcards_insert_own_authenticated on public.flashcards;
create policy flashcards_insert_own_authenticated on public.flashcards
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- policy: allow authenticated users to update only their own flashcards
-- rationale: users can modify their flashcard records, but cannot change ownership
drop policy if exists flashcards_update_own_authenticated on public.flashcards;
create policy flashcards_update_own_authenticated on public.flashcards
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- policy: allow authenticated users to delete only their own flashcards
-- rationale: users can remove their own flashcard records
drop policy if exists flashcards_delete_own_authenticated on public.flashcards;
create policy flashcards_delete_own_authenticated on public.flashcards
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- anonymous user policies for flashcards
-- rationale: anonymous users should have no access to flashcard data
-- these policies explicitly deny all operations for defense-in-depth
-- ============================================================================

-- policy: deny anonymous users from selecting flashcards
-- rationale: flashcard data is private and requires authentication
drop policy if exists flashcards_select_deny_anon on public.flashcards;
create policy flashcards_select_deny_anon on public.flashcards
  for select
  to anon
  using (false);

-- policy: deny anonymous users from inserting flashcards
-- rationale: only authenticated users can create flashcard records
drop policy if exists flashcards_insert_deny_anon on public.flashcards;
create policy flashcards_insert_deny_anon on public.flashcards
  for insert
  to anon
  with check (false);

-- policy: deny anonymous users from updating flashcards
-- rationale: anonymous users have no access to modify any data
drop policy if exists flashcards_update_deny_anon on public.flashcards;
create policy flashcards_update_deny_anon on public.flashcards
  for update
  to anon
  using (false)
  with check (false);

-- policy: deny anonymous users from deleting flashcards
-- rationale: anonymous users cannot delete any records
drop policy if exists flashcards_delete_deny_anon on public.flashcards;
create policy flashcards_delete_deny_anon on public.flashcards
  for delete
  to anon
  using (false);

-- end of migration

