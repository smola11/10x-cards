<conversation_summary>
<decisions>

1. Brak grupowania w decki; fiszki są płaską listą per użytkownik.
2. Brak przechowywania stanu algorytmu powtórek w MVP.
3. Sesje nauki odłożone na później.
4. Przechowujemy tylko zaakceptowane fiszki; propozycje AI nie są zapisywane.
5. Tabela `flashcards`: `id bigserial PK`, `user_id uuid` → `auth.users(id)` `ON DELETE CASCADE`, `front text`, `back text`, `origin enum` (bez domyślnej), `generation_id bigint NULL` → `generations(id)`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`.
6. Ograniczenia długości: `front` 1–200 znaków, `back` 1–500 znaków; `generations.prompt_text` 1000–10000 znaków.
7. CHECK: jeśli `origin='manual'` to `generation_id IS NULL`, jeśli `origin IN ('ai-full','ai-edited')` to `generation_id IS NOT NULL`.
8. FK `flashcards(generation_id)` z `ON DELETE SET NULL`.
9. Tabela `generations`: `id uuid`, `user_id uuid` (FK), `total_count int >= 0`, `accepted_count int >= 0 AND <= total_count`, `prompt_text text` (1000–10000), `model text`, `created_at timestamptz DEFAULT now()`.
10. RLS: włączone; polityki owner-only (`user_id = auth.uid()`) dla SELECT/INSERT/UPDATE/DELETE; bez dodatkowych triggerów (brak blokady UPDATE `user_id`, brak wymuszania zgodności właściciela między `flashcards` i `generations`).
11. Indeksy: `flashcards(user_id, created_at)`, `flashcards(generation_id)`, `generations(user_id, created_at)`.
12. Trigger `BEFORE UPDATE` aktualizujący `flashcards.updated_at = now()`.
13. Usuwanie: twarde; bez `deleted_at`; FKs z `ON DELETE CASCADE` dla powiązań użytkownika.
14. Brak deduplikacji fiszek (unikalności) na tym etapie.
    </decisions>

<matched_recommendations>

1. Enum `origin` bez wartości domyślnej — przyjęto; (wartości: 'manual', 'ai-full', 'ai-edited').
2. CHECK spójności `origin` ↔ `generation_id` — przyjęto.
3. `flashcards.generation_id` `ON DELETE SET NULL` — przyjęto.
4. `generations` z licznikami i metadanymi (`prompt_text`, `model`), czasem generowania i walidacją długości — przyjęto.
5. Nullability kolumn w `flashcards` (NOT NULL dla kluczowych pól; `generation_id` NULL) — przyjęto.
6. Indeksy na `flashcards(user_id, created_at DESC)`, `flashcards(generation_id)`, `generations(user_id, created_at DESC)` — przyjęto.
7. Klucze główne: `bigserial` — przyjęto.
8. Triggery `updated_at` na obu tabelach — przyjęto.
9. RLS: obecnie wyłączone — przyjęto.
10. Rezygnacja z deduplikacji oraz automatyki liczników — przyjęto.
    </matched_recommendations>

<database_planning_summary>
a. Główne wymagania schematu:

- Dwie tabele: `flashcards` (zaakceptowane fiszki) i `generations` (metryki i kontekst wejściowy AI).
- Walidacje długości: `flashcards.front` 1–200; `flashcards.back` 1–500; `generations.prompt_text` 1000–10000.
- Spójność biznesowa: CHECK łączący `origin` i `generation_id`.
- Klucze główne `bigserial`, znaczniki czasu, triggery `updated_at` na obu tabelach.

b. Kluczowe encje i relacje:

- `flashcards` N:1 `generations` (opcjonalne; `generation_id` może być NULL).
- `flashcards.user_id` i `generations.user_id` wskazują użytkownika; brak twardego wymuszenia zgodności właściciela między tabelami.
- Kaskady: usunięcie `generations` nie usuwa fiszek (SET NULL); usunięcie użytkownika usuwa powiązane rekordy.

c. Bezpieczeństwo i skalowalność:

- RLS owner-only na obu tabelach, oparte o `auth.uid()`.
- Indeksy pod listowanie i filtrowanie po użytkowniku oraz łączenie po `generation_id`.
- Minimalny zakres danych (brak propozycji AI per-item), co upraszcza schemat i poprawia wydajność.

d. Nierozwiązane/ryzyka:

- Brak automatycznego utrzymania `accepted_count` względem `flashcards`; spójność liczników zależna od warstwy aplikacyjnej.
- Brak wymuszenia zgodności `user_id` między `flashcards` i `generations` może pozwolić na przypadkowe powiązania między użytkownikami (częściowo łagodzone przez RLS).
  </database_planning_summary>

<unresolved_issues>

1. Wartości enum `origin` — czy przyjmujemy dokładnie {'manual','ai'}?
2. Domyślne wartości dla `flashcards.created_at`/`updated_at` (np. `DEFAULT now()`) — potwierdzić.
3. Dokładne definicje polityk RLS (USING/WITH CHECK) dla obu tabel — do doprecyzowania.
4. Ewentualne limity długości dla `model` (np. CHECK/constraint) — do ustalenia.
   </unresolved_issues>
   </conversation_summary>
