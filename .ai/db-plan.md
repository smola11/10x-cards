## 1. Lista tabel (kolumny, typy, ograniczenia)

Poniżej kompletny plan schematu PostgreSQL (Supabase) dla MVP. Zawiera typy, tabele, ograniczenia, triggery oraz polityki RLS.

```sql
-- Typy domen/enum
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'flashcard_origin'
  ) THEN
    CREATE TYPE public.flashcard_origin AS ENUM ('manual', 'ai');
  END IF;
END $$;

-- Funkcja i trigger do aktualizacji updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela: generations (metryki i metadane generowania)
CREATE TABLE IF NOT EXISTS public.generations (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_count   integer NOT NULL CHECK (total_count >= 0),
  accepted_count integer NOT NULL CHECK (accepted_count >= 0 AND accepted_count <= total_count),
  prompt_text   text NOT NULL CHECK (char_length(prompt_text) BETWEEN 1000 AND 10000),
  model         text NOT NULL CHECK (char_length(model) BETWEEN 1 AND 255),
  generation_duration integer NOT NULL CHECK (generation_duration >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Tabela: flashcards (zaakceptowane fiszki)
CREATE TABLE IF NOT EXISTS public.flashcards (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  front         text NOT NULL CHECK (char_length(front) BETWEEN 1 AND 2000),
  back          text NOT NULL CHECK (char_length(back) BETWEEN 1 AND 2000),
  origin        public.flashcard_origin NOT NULL,
  generation_id bigint NULL REFERENCES public.generations(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Spójność: ai => generation_id IS NOT NULL; manual => generation_id IS NULL
  CONSTRAINT flashcards_origin_generation_check
    CHECK (
      (origin = 'ai' AND generation_id IS NOT NULL) OR
      (origin = 'manual' AND generation_id IS NULL)
    )
);

-- Trigger aktualizujący updated_at na UPDATE
DROP TRIGGER IF EXISTS flashcards_set_updated_at ON public.flashcards;
CREATE TRIGGER flashcards_set_updated_at
BEFORE UPDATE ON public.flashcards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Kolumny i ograniczenia (opis)
- public.generations
  - id: bigserial PK
  - user_id: uuid NOT NULL → FK do `auth.users(id)` ON DELETE CASCADE
  - total_count: integer NOT NULL, CHECK total_count ≥ 0
  - accepted_count: integer
  - prompt_text: text NOT NULL, CHECK długość 1000–10000 znaków
  - model: text NOT NULL, CHECK długość 1–255 znaków
  - generation_duration: integer NOT NULL, czas generowania (ms), CHECK ≥ 0
  - created_at: timestamptz NOT NULL, DEFAULT now()

- public.flashcards
  - id: bigserial PK
  - user_id: uuid NOT NULL → FK do `auth.users(id)` ON DELETE CASCADE
  - front: text NOT NULL, CHECK długość 1–2000 znaków
  - back: text NOT NULL, CHECK długość 1–2000 znaków
  - origin: enum `flashcard_origin` NOT NULL (brak wartości domyślnej)
  - generation_id: bigint NULL → FK do `public.generations(id)` ON DELETE SET NULL
  - created_at: timestamptz NOT NULL, DEFAULT now()
  - updated_at: timestamptz NOT NULL, DEFAULT now() (utrzymywane triggerem na UPDATE)
  - CHECK spójności origin ↔ generation_id (jak w DDL powyżej)


## 2. Relacje między tabelami
- auth.users 1:N public.generations
  - Klucz obcy: `generations.user_id` → `auth.users.id` (ON DELETE CASCADE)

- auth.users 1:N public.flashcards
  - Klucz obcy: `flashcards.user_id` → `auth.users.id` (ON DELETE CASCADE)

- public.generations 1:N public.flashcards (opcjonalna)
  - Klucz obcy: `flashcards.generation_id` → `generations.id` (ON DELETE SET NULL)
  - Kardynalność: jedna generacja może mieć wiele fiszek; fiszka może (ale nie musi) wskazywać generację


## 3. Indeksy
```sql
-- Pod listowanie fiszek i sortowanie po czasie
CREATE INDEX IF NOT EXISTS idx_flashcards_user_created_at
  ON public.flashcards (user_id, created_at DESC);

-- Pod szybkie łączenie fiszek z generacjami
CREATE INDEX IF NOT EXISTS idx_flashcards_generation_id
  ON public.flashcards (generation_id);

-- Pod listowanie generacji i sortowanie po czasie
CREATE INDEX IF NOT EXISTS idx_generations_user_created_at
  ON public.generations (user_id, created_at DESC);
```


## 4. Zasady PostgreSQL (RLS)
RLS w modelu "owner-only" opartym o `auth.uid()` Supabase.

```sql
-- Włączenie RLS
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Polityki dla flashcards
DROP POLICY IF EXISTS flashcards_select_own ON public.flashcards;
CREATE POLICY flashcards_select_own ON public.flashcards
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS flashcards_insert_own ON public.flashcards;
CREATE POLICY flashcards_insert_own ON public.flashcards
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS flashcards_update_own ON public.flashcards;
CREATE POLICY flashcards_update_own ON public.flashcards
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS flashcards_delete_own ON public.flashcards;
CREATE POLICY flashcards_delete_own ON public.flashcards
  FOR DELETE USING (user_id = auth.uid());

-- Polityki dla generations
DROP POLICY IF EXISTS generations_select_own ON public.generations;
CREATE POLICY generations_select_own ON public.generations
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS generations_insert_own ON public.generations;
CREATE POLICY generations_insert_own ON public.generations
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS generations_update_own ON public.generations;
CREATE POLICY generations_update_own ON public.generations
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS generations_delete_own ON public.generations;
CREATE POLICY generations_delete_own ON public.generations
  FOR DELETE USING (user_id = auth.uid());
```


## 5. Dodatkowe uwagi i uzasadnienia
- **Spójność origin ↔ generation_id**: wymuszona CHECK w `flashcards` (ai ⇒ wymagane powiązanie z `generations`, manual ⇒ brak powiązania).
- **Domyślne znaczniki czasu**: `created_at` i `updated_at` (w `flashcards`) mają DEFAULT now(); `updated_at` aktualizowane triggerem na UPDATE.