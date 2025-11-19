## API Endpoint Implementation Plan: Create a manual flashcard (POST /api/flashcards)

### 1. Przegląd punktu końcowego
Tworzy manualną fiszkę przypisaną do bieżącego użytkownika. Serwer ustawia `origin = 'manual'` i wymusza `generationId = null` (pole nie jest akceptowane w żądaniu). Zwraca nowo utworzoną fiszkę w formacie DTO. Sukces: 201 Created.

### 2. Szczegóły żądania
- **Metoda HTTP**: POST
- **Ścieżka**: `/api/flashcards`
- **Nagłówki**:
  - **Content-Type**: `application/json`
  - **Auth**: sesja Supabase w `context.locals.supabase` (cookies)
- **Parametry**:
  - **Wymagane (body)**:
    - `front`: string, długość 1..200
    - `back`: string, długość 1..500
  - **Zakazane**: wszelkie inne pola, w szczególności `generationId`, `origin`, `id`, `userId`, `createdAt`, `updatedAt`
- **Request Body (przykład)**:
```json
{
  "front": "What is TCP?",
  "back": "Transmission Control Protocol."
}
```

### 3. Wykorzystywane typy
- `CreateManualFlashcardCommand` (request): z `src/types.ts`
  - `{ front: string; back: string }`
- `CreateManualFlashcardResponse` (response): alias `FlashcardDTO` z `src/types.ts`
  - `{ id, front, back, origin, generationId, createdAt, updatedAt }`

### 4. Szczegóły odpowiedzi
- **201 Created** z JSON:
```json
{
  "id": 123,
  "front": "...",
  "back": "...",
  "origin": "manual",
  "generationId": null,
  "createdAt": "2025-10-14T13:20:00.000Z",
  "updatedAt": "2025-10-14T13:20:00.000Z"
}
```
- **Błędy**:
  - 400 Bad Request: nieprawidłowy JSON; obecne pola zabronione/nieznane (np. `generationId`, `origin`)
  - 401 Unauthorized: brak użytkownika w sesji (poza DEV fallback)
  - 422 Unprocessable Entity: walidacja długości `front`/`back`
  - 500 Internal Server Error: błąd serwera/DB

### 5. Przepływ danych
1. Klient wysyła POST `/api/flashcards` z JSON `{ front, back }`.
2. Astro API route (`src/pages/api/flashcards.ts`) pobiera `supabase` z `context.locals.supabase` i rozwiązuje `userId` z `supabase.auth.getUser()` (DEV fallback do `DEFAULT_USER_ID`).
3. Body jest parsowane i walidowane przez Zod schema (ścisła, `strict()` → odrzuca nieznane pola; reguły długości).
4. Serwis `createManualFlashcard` w `src/lib/services/flashcards.service.ts` wykonuje `insert` do `public.flashcards` z polami: `{ user_id, front, back, origin: 'manual', generation_id: null }`, a następnie `select` i mapuje wiersz do `FlashcardDTO` przez `mapFlashcardRowToDTO`.
5. API zwraca 201 z obiektem DTO.

Uwagi DB/RLS:
- DB model: `flashcards(origin enum, generation_id nullable)` z regułą spójności „manual ⇒ generation_id IS NULL”.
- Migrations w repo aktualnie wyłączają RLS (dev). Plan zakłada tryb owner-only po włączeniu RLS (produkcyjnie) – wymagane `user_id = auth.uid()`.

### 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: używaj `context.locals.supabase`. W produkcji zwracaj 401 przy braku sesji. W DEV dopuszczalny fallback do `DEFAULT_USER_ID` (jak w istniejącym GET).
- **Autoryzacja/RLS**: przy włączonym RLS polityka owner-only (insert/select ograniczone do właściciela). W treści INSERT przekaż właściwe `user_id` (z sesji) – zgodne z polityką `WITH CHECK`.
- **Walidacja/whitelisting**: schema Zod w trybie `strict()` (odrzuca nieznane pola). Nie ufaj polom pochodzącym z klienta (`origin`, `generationId`) – nadpisuj po stronie serwera.
- **Ochrona przed JSON injection**: defensywne parsowanie body, limit rozmiaru requestu (opcjonalnie w middleware), jasne kody błędów.
- **Logowanie błędów**: loguj kontekst (userId, payload skrócony) bez treści wrażliwych.

### 7. Obsługa błędów
- 400 Bad Request:
  - Niepoprawny JSON (`request.json()` rzuca wyjątek)
  - Nieznane/zabronione pola (`ZodError` z `unrecognized_keys`)
- 401 Unauthorized:
  - Brak użytkownika w sesji (poza DEV fallback)
- 422 Unprocessable Entity:
  - `front` długość poza 1..200
  - `back` długość poza 1..500
- 500 Internal Server Error:
  - Błąd Supabase (insert/select)
  - Naruszenie constraint (teoretycznie) – mapuj jako 500 z generycznym komunikatem

Strategia mapowania błędów Zod:
- Parsowanie JSON wyjątek → 400
- `ZodError`:
  - Jeśli zawiera `unrecognized_keys` → 400
  - W przeciwnym razie (reguły długości itp.) → 422

### 8. Rozważania dotyczące wydajności
- Pojedynczy insert i pojedynczy select – koszt minimalny.
- Zwracaj tylko jeden wiersz (`.select('*').single()`).
- Brak potrzeby transakcji.
- Indeksy nie są krytyczne dla pojedynczego insertu; istniejące indeksy wspierają późniejsze listowanie.

### 9. Etapy wdrożenia
1. Walidacja – dodanie schematu Zod
   - Plik: `src/lib/validation/flashcards.ts`
   - Dodaj:
     - `export const CreateManualFlashcardSchema = z.object({ front: z.string().min(1).max(200), back: z.string().min(1).max(500) }).strict();`
     - `export type CreateManualFlashcardBody = z.infer<typeof CreateManualFlashcardSchema>;`
   - (Opcjonalnie) helper do klasyfikacji błędów Zod (400 vs 422).

2. Serwis – utworzenie funkcji `createManualFlashcard`
   - Plik: `src/lib/services/flashcards.service.ts`
   - Dodaj eksport:
     - `export interface CreateManualFlashcardParams { userId: string; front: string; back: string; }`
     - `export async function createManualFlashcard(supabase: SupabaseClient, params: CreateManualFlashcardParams): Promise<FlashcardDTO>`
       - `insert` do `flashcards` z `{ user_id: params.userId, front, back, origin: 'manual', generation_id: null }`
       - `.select('*').single()`
       - mapuj przez `mapFlashcardRowToDTO`
       - błąd DB → throw (obsłuży go handler)

3. API Route – dodanie handlera POST
   - Plik: `src/pages/api/flashcards.ts`
   - Dodaj `export const POST: APIRoute = async (context) => { ... }`
     - Pobierz `supabase` z `context.locals`
     - Rozwiąż `userId` (jak w istniejącym `GET` – z DEV fallback)
     - Spróbuj sparsować `request.json()` → 400 na wyjątku
     - `CreateManualFlashcardSchema.safeParse(body)`
       - Jeśli `!success` → 400 gdy `unrecognized_keys`, w przeciwnym razie 422
     - Wywołaj `createManualFlashcard(supabase, { userId, front, back })`
     - Zwróć 201 z DTO
     - `catch` → `console.error('POST /api/flashcards failed', { error, userId })` i 500

4. E2E sprawdzenie (dev)
   - Dodaj plik `http_client/create_flashcard.http` z przykładowym POST.
   - Przetestuj warianty błędów: nieznane pola (400), zbyt długie pole (422), zły JSON (400).

5. (Opcjonalnie) Przywrócenie RLS (prod)
   - Włączyć RLS i polityki owner-only dla `public.flashcards` (select/insert/update/delete tylko `user_id = auth.uid()`).
   - Zweryfikować, że `insert` przechodzi z `user_id` z sesji.

6. Zgodność ze stackiem i regułami
- Astro API Route (`export const prerender = false`), `APIRoute`, `context.locals.supabase`.
- Zod do walidacji wejścia (schema w `src/lib/validation`).
- Logika w serwisie (`src/lib/services`), kontroler cienki.
- DTO/Command modele z `src/types.ts`.
- Supabase Client typ z `src/db/supabase.client.ts`.


