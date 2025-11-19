## API Endpoint Implementation Plan: POST /api/generations/{id}/accept

### 1. Przegląd punktu końcowego
- **Cel**: Przyjęcie wybranych propozycji fiszek wygenerowanych przez AI dla istniejącej generacji, trwałe zapisanie ich w tabeli `flashcards` oraz atomowa aktualizacja liczników akceptacji w `generations`.
- **Wymogi biznesowe**:
  - Każda zaakceptowana fiszka otrzymuje `origin` zależnie od pola `edited`: `ai-edited` jeśli `edited=true`, w przeciwnym razie `ai-full`.
  - Zachować spójność z ograniczeniami DB: dla `origin != 'manual'` pole `generation_id` musi być ustawione (CHECK w DB).
  - Nie można zaakceptować łącznie więcej fiszek niż `generations.total_count` (z uwzględnieniem już zaakceptowanych).
  - Cała operacja powinna być **atomowa**: wstawienia do `flashcards` oraz aktualizacja liczników akceptacji w `generations` w jednej transakcji.

### 2. Szczegóły żądania
- **Metoda HTTP**: POST
- **Struktura URL**: `/api/generations/{id}/accept`
- **Parametry**:
  - **Wymagane**:
    - `id` (path) — identyfikator generacji; liczba całkowita > 0
  - **Opcjonalne**: brak
- **Request Body (JSON)**:
```json
{
  "flashcards": [
    { "front": "string (1..200)", "back": "string (1..500)", "edited": false }
  ]
}
```
- **Walidacja**:
  - `flashcards` — tablica 1..N (zabronione puste)
  - `front` — string trimowany, długość 1..200
  - `back` — string trimowany, długość 1..500
  - `edited` — boolean

### 3. Wykorzystywane typy
- Z `src/types.ts`:
  - `AcceptGenerationProposalsCommand` — model wejściowy: `{ flashcards: { front; back; edited }[] }`
  - `AcceptGenerationProposalsResponse` — model wyjściowy: `{ created: FlashcardDTO[]; generation: GenerationSummaryDTO }`
  - `FlashcardDTO` — DTO fiszki (camelCase)
  - `GenerationSummaryDTO` — DTO podsumowania generacji (camelCase)
- Z DB (pośrednio przez `src/db/database.types.ts`): `flashcards`, `generations`, enum `flashcard_origin`.

### 4. Szczegóły odpowiedzi
- **Sukces (201 Created)**:
```json
{
  "created": [
    {
      "id": 789,
      "front": "string",
      "back": "string",
      "origin": "ai-full",
      "generationId": 456,
      "createdAt": "2025-10-14T13:20:00.000Z",
      "updatedAt": "2025-10-14T13:20:00.000Z"
    }
  ],
  "generation": {
    "id": 456,
    "totalCount": 10,
    "acceptedUneditedCount": 6,
    "acceptedEditedCount": 2,
    "model": "...",
    "generationDuration": 0,
    "createdAt": "2025-10-14T13:20:00.000Z",
    "updatedAt": "2025-10-14T13:25:12.000Z"
  }
}
```
- **Błędy**:
  - 400 Bad Request — pusta lista; niepoprawne pola w path/typy
  - 401 Unauthorized — brak użytkownika (w dev fallback do `DEFAULT_USER_ID`)
  - 403 Forbidden — generacja nie należy do użytkownika
  - 404 Not Found — generacja nie istnieje
  - 409 Conflict — suma akceptacji przekroczy `total_count`
  - 422 Unprocessable Entity — naruszenie ograniczeń długości/formatu
  - 500 Internal Server Error — pozostałe błędy serwera/DB

### 5. Przepływ danych
1. Klient wywołuje `POST /api/generations/{id}/accept` z listą wybranych propozycji.
2. Endpoint Astro (server route) odczytuje `id` z `context.params`, parsuje body, waliduje schematem Zod.
3. Ustalany jest `userId` (prod: z `context.locals.supabase.auth`, lokalnie `DEFAULT_USER_ID`).
4. Warstwa serwisowa wykonuje operację atomową w DB:
   - Waliduje istnienie generacji i własność (`generations.user_id = userId`).
   - Sprawdza konflikt ilościowy (czy akceptacje nie przekroczą `total_count`).
   - Wstawia rekordy do `flashcards` z `origin` z `edited` oraz `generation_id = id`.
   - Aktualizuje liczniki `accepted_unedited_count` i `accepted_edited_count` w `generations`.
   - Zwraca utworzone fiszki i zaktualizowany rekord generacji.
5. Endpoint mapuje rekordy DB do DTO camelCase i zwraca 201.

### 6. Względy bezpieczeństwa
- **Auth**: używać `context.locals.supabase`, `DEFAULT_USER_ID`.
- **Autoryzacja**: sprawdzić własność generacji (`generations.user_id = userId`).
- **Walidacja**: Zod na wejściu; dodatkowe CHECK/CONSTRAINT egzekwowane przez DB.

### 7. Obsługa błędów
- Mapowanie na kody HTTP:
  - Brak/niepoprawny JSON → 400
  - Walidacja Zod → 422 (szczegóły `error.flatten()`)
  - Generacja nie istnieje → 404
  - Brak własności → 403
  - Przekroczenie `total_count` → 409
  - Błędy DB/nieoczekiwane → 500
- **Logowanie**: `console.error` z kontekstem (endpoint, userId, generationId, liczba pozycji). Opcjonalnie osobna tabela `error_logs` (poza zakresem teraz).

### 9. Kroki implementacji
1. Walidacja wejścia (Zod)
   - Rozszerzyć `src/lib/validation/generations.ts` o:
     - `AcceptGenerationProposalsItemSchema = z.object({ front: z.string().trim().min(1).max(200), back: z.string().trim().min(1).max(500), edited: z.boolean() })`
     - `AcceptGenerationProposalsSchema = z.object({ flashcards: z.array(AcceptGenerationProposalsItemSchema).min(1) })`
   - Eksportować typ pochodny `AcceptGenerationProposalsInput`.

3. Warstwa serwisowa (`src/lib/services/generations.service.ts`)
   - Dodać:
     - `acceptProposals(supabase, params: { userId: string; generationId: number; items: { front; back; edited }[] }): Promise<{ created: Tables<'flashcards'>[]; generation: Tables<'generations'> }>`
   - Implementacja: najpierw pobrać generację (`from('generations').select().single()`), zweryfikować własność i limity, następnie wstawić fiszki (`from('flashcards').insert(...).select()`) i zaktualizować liczniki w `generations` (`update(...).select().single()`), zwracając utworzone rekordy oraz odświeżoną generację.
   - Helpery DB→DTO: `mapFlashcardRowToDTO`, `mapGenerationRowToSummaryDTO`.

4. Endpoint Astro (`src/pages/api/generations/[id]/accept.ts`)
   - `export const prerender = false;`
   - `export const POST: APIRoute`
   - Kroki:
     1. `supabase` z `context.locals.supabase`.
     2. `userId` (prod: z sesji; dev: `DEFAULT_USER_ID`).
     3. Parsowanie `id` z `context.params.id` (+ walidacja dodatniego integera).
     4. `request.json()` → walidacja `AcceptGenerationProposalsSchema`.
     5. Wywołanie serwisu `acceptProposals`.
     6. Budowa `AcceptGenerationProposalsResponse`, status 201.
     7. Mapowanie błędów: `NO_DATA_FOUND`→404, `42501`→403, `23505`→409, inne→500.

5. Mapowanie DTO
   - `FlashcardDTO`: `generationId`, `createdAt`, `updatedAt` (camelCase).
   - `GenerationSummaryDTO`: pola camelCase.

6. Testy ręczne
   - Happy path (1 i wiele pozycji).
   - Pusta tablica (`400/422`).
   - Przekroczenie `total_count` (`409`).
   - Zła własność (`403`).
   - Nieistniejąca generacja (`404`).
   - Naruszenie długości (`422`).


8. Zgodność z zasadami projektu
- Astro API Routes, `prerender = false`.
- Walidacja Zod w endpointzie.
- Logika domenowa w `src/lib/services`.
- `context.locals.supabase`; typy z `src/db/supabase.client.ts` i `src/db/database.types.ts`.
- Mapowania DB→DTO w camelCase.
