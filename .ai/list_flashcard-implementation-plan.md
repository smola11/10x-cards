## API Endpoint Implementation Plan: GET /api/flashcards

### 1. Przegląd punktu końcowego

Paginated list of the authenticated user’s flashcards, sorted newest first. Supports filtering by `origin` and `generationId`, configurable `page`, `limit`, `sort`, and `order`.

### 2. Szczegóły żądania

- **Metoda HTTP**: GET
- **URL**: `/api/flashcards`
- **Parametry zapytania**:
  - **Wymagane**: brak
  - **Opcjonalne**:
    - `page`: number, 1+, default 1
    - `limit`: number, 1–100, default 20
    - `sort`: one of `created_at` | `updated_at`, default `created_at`
    - `order`: `asc` | `desc`, default `desc`
    - `origin`: `manual` | `ai-full` | `ai-edited`
    - `generationId`: number (positive integer)
- **Request Body**: none

### 3. Wykorzystywane typy

- `FlashcardDTO`, `FlashcardsListResponse`, `FlashcardOrigin`, `FlashcardsListQuery` from `src/types.ts`.
  - `FlashcardsListResponse` response shape matches the route spec: `{ items: FlashcardDTO[], page, limit, totalPages, totalItems, hasNextPage, hasPrevPage }`.

### 4. Szczegóły odpowiedzi

- **Sukces (200 OK)**: `FlashcardsListResponse`
- **Błędy**:
  - 400 Bad Request: nieprawidłowe parametry zapytania (walidacja)
  - 401 Unauthorized: brak uwierzytelnienia (poza DEV)
  - 500 Internal Server Error: niespodziewany błąd serwera/DB

### 5. Przepływ danych

1. Middleware (`src/middleware/index.ts`) udostępnia `locals.supabase`.
2. Handler API (`src/pages/api/flashcards.ts`):
   - Odczytaj `locals.supabase` i rozstrzygnij `userId` przez `supabase.auth.getUser()`; w DEV fallback do `DEFAULT_USER_ID` z `src/db/supabase.client.ts` (spójne z istniejącymi endpointami).
   - Zweryfikuj i znormalizuj query parametry przez Zod schema (domyślne wartości, zakresy, dozwolone wartości enum).
   - Złóż zapytanie do Supabase/Postgrest:
     - Filtry: `.eq('user_id', userId)`, opcjonalnie `.eq('origin', origin)`, `.eq('generation_id', generationId)`.
     - Sortowanie stabilne: `order(sortField, { ascending })` następnie `order('id', { ascending })` jako tie-breaker.
     - Paginacja: `range(offset, offset + limit - 1)` z `offset = (page-1) * limit`.
     - Licznik: użyj `select('*', { count: 'exact' })` aby otrzymać `count` bez osobnego zapytania.
   - Zamapuj wiersze do `FlashcardDTO` (mapowanie 1:1 kolumn snake_case → camelCase fields).
   - Wylicz metadane: `totalItems = count ?? 0`, `totalPages = Math.max(1, Math.ceil(totalItems/limit))`, `hasNextPage = page < totalPages`, `hasPrevPage = page > 1`.
   - Zwróć JSON 200.

### 6. Względy bezpieczeństwa

- **Autoryzacja/RLS**: Wszystkie zapytania ograniczone do `user_id = auth.uid()` przez RLS. Dodatkowo filtr w zapytaniu `.eq('user_id', userId)` dla defense-in-depth.
- **Uwierzytelnianie**: Produkcyjnie wymagaj poprawnego `supabase.auth.getUser()`. W DEV dopuszczaj `DEFAULT_USER_ID` (jak w istniejącym kodzie), aby ułatwić lokalny development.
- **Walidacja danych wejściowych**: Zod schema dla query (typy, zakresy, enumy). Odmowa 400 dla niepoprawnych wartości.
- **Stabilne sortowanie**: `ORDER BY created_at|updated_at, id` — zapobiega dublowaniu/omijaniu rekordów przy identycznych timestampach.
- **Bezpieczne domyślne wartości**: `limit` cap na 100, `page` min 1, `order` default `desc`.
- **Brak ujawniania danych innych użytkowników**: wymuszone przez RLS i filtr `user_id`.

### 7. Obsługa błędów

- 400: Zwracaj `{"error":"Validation failed","details":...}` dla nieprawidłowych parametrów zapytania.
- 401: `{"error":"Unauthorized"}` jeśli `userId` nie do wykrycia (w prod).
- 500: `{"error":"Internal server error"}` dla nieoczekiwanych błędów bazy/SDK.
- Logowanie: `console.error` z kontekstem (userId, page, limit, sort, order, origin, generationId). Brak dedykowanej tabeli błędów w projekcie — można rozważyć później.

### 8. Rozważania dotyczące wydajności

- **Indeksy**: Zapytanie oparte o indeks `(user_id, created_at DESC)`; przy `sort=updated_at` rozważyć dodatkowy indeks `(user_id, updated_at DESC)` jeśli profilowanie pokaże potrzebę.
- **Licznik**: `count: 'exact'` bywa kosztowny — dla bardzo dużych zbiorów można dodać tryb „approximate” w przyszłości. Na teraz zwracamy `totalItems/totalPages` zgodnie ze spec.
- **Selekt**: Pobieraj tylko potrzebne kolumny, jeśli profilowanie pokaże wąskie gardła (na start `select('*')` jest akceptowalne ze względu na wąski DTO).
- **Stabilne sortowanie**: Drugi klucz `id` eliminuje fluktuacje kolejności.
- **Limit cap**: do 100, aby ograniczyć presję na DB i sieć.

### 9. Etapy wdrożenia

1. Utwórz walidację zapytań
   - Plik: `src/lib/validation/flashcards.ts`
   - Zdefiniuj `FlashcardsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['created_at','updated_at']).default('created_at'),
  order: z.enum(['asc','desc']).default('desc'),
  origin: z.enum(['manual','ai-full','ai-edited']).optional(),
  generationId: z.coerce.number().int().positive().optional(),
})`.
   - Eksportuj typ wywnioskowany jako `FlashcardsListQueryParams`.

2. Utwórz serwis listowania fiszek
   - Plik: `src/lib/services/flashcards.service.ts`
   - Eksportuj:
     - `mapFlashcardRowToDTO(row: Tables<'flashcards'>): FlashcardDTO` (można przenieść z `generations.service.ts` dla spójności, lub na start zduplikować i potem wydzielić do wspólnego modułu `mappers`).
     - `listFlashcards(supabase, { userId, page, limit, sort, order, origin, generationId })`:
       - Oblicz `offset`.
       - Złóż zapytanie z `.select('*', { count: 'exact' })`, filtrami, sortowaniem (dwa klucze), `range`.
       - Zwróć `{ items: FlashcardDTO[], totalItems }`.

3. Dodaj endpoint API
   - Plik: `src/pages/api/flashcards.ts`
   - `export const prerender = false`.
   - W handlerze `GET`:
     - Pobierz `locals.supabase` i rozstrzygnij `userId` (z fallbackiem DEV jak w `accept.ts`).
     - Zparsuj query (`new URL(context.request.url).searchParams` → plain object) i zweryfikuj `FlashcardsListQuerySchema`.
     - Wywołaj `listFlashcards(...)`.
     - Wylicz metadane paginacji na podstawie `page`, `limit`, `totalItems`.
     - Zwróć `FlashcardsListResponse` 200.
   - Spójne util `json(body, status)` jak w istniejących endpointach.

4. Test ręczny i klient HTTP
   - Dodaj plik: `http_client/flashcards_list.http` z przykładami zapytań (`?page=1&limit=20`, z filtrami `origin`, `generationId`).
   - Zweryfikuj błędy walidacji (np. `limit=0`, `order=foo`).

5. Profilowanie i indeksy (opcjonalnie po wdrożeniu MVP)
   - Jeśli `sort=updated_at` dominuje, dodać indeks `CREATE INDEX IF NOT EXISTS idx_flashcards_user_updated_at ON public.flashcards (user_id, updated_at DESC);`.

6. Zgodność ze stackiem i zasadami

- Astro API route w `src/pages/api/flashcards.ts`, `export const prerender = false`.
- Walidacja Zod w `src/lib/validation/flashcards.ts`.
- Logika bazodanowa w serwisie `src/lib/services/flashcards.service.ts`.
- Supabase client z `locals.supabase`; typ `SupabaseClient` z `src/db/supabase.client.ts`.
- DTO/Response z `src/types.ts`.
