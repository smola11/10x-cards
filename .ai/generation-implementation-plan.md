## API Endpoint Implementation Plan: POST /api/generations

### 1. Przegląd punktu końcowego
- Tworzy rekord `generations` na podstawie `promptText`, wywołuje LLM przez OpenRouter, mierzy czas generowania i zwraca propozycje fiszek bez ich utrwalania.
- Autoryzacja wymagana (powiązanie z `auth.users`).
- Zgodność z Supabase i regułami Astro (middleware, server endpoints, zod walidacja, services w `src/lib`).

### 2. Szczegóły żądania
- **Metoda HTTP**: POST
- **URL**: `/api/generations`
- **Nagłówki**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <access_token>` (sesja Supabase; pozyskana przez SDK na kliencie)
- **Parametry**:
  - **Wymagane**: `promptText: string` (długość 1000..10000)
- **Body (JSON)**:
```json
{
  "promptText": "string (1000..10000)"
}
```

### 3. Wykorzystywane typy
- Z `src/types.ts`:
  - `CreateGenerationCommand` (wejście): `{ promptText: string }`
  - `ProposalFlashcardDTO` (element odpowiedzi): `{ front: string; back: string }`
  - `GenerationSummaryDTO` (część odpowiedzi)
  - `CreateGenerationResponse` (wyjście): `{ generation: GenerationSummaryDTO; proposals: ProposalFlashcardDTO[] }`
- Z `src/db/database.types.ts` (typy kolumn tabeli `generations`).

### 4. Szczegóły odpowiedzi
- **Status**: 201 Created
- **Body (JSON)** zgodnie z `CreateGenerationResponse`:
```json
{
  "generation": {
    "id": 456,
    "totalCount": 10,
    "acceptedUneditedCount": null,
    "acceptedEditedCount": null,
    "model": "provider/model",
    "generationDuration": 812,
    "createdAt": "2025-10-14T13:20:00.000Z",
    "updatedAt": "2025-10-14T13:20:00.000Z"
  },
  "proposals": [
    { "front": "string (1..200)", "back": "string (1..500)" }
  ]
}
```
- **Błędy**:
  - 400: nieprawidłowy JSON
  - 401: brak autoryzacji
  - 422: `promptText` spoza zakresu (1000..10000)
  - 429: przekroczony limit generacji
  - 502: błąd upstream LLM
  - 500: błąd serwera

### 5. Przepływ danych
1. Middleware `src/middleware/index.ts` wstrzykuje `supabase` do `context.locals`.
2. Endpoint `src/pages/api/generations.ts` (server endpoint Astro):
   - Parsuje JSON i waliduje Zod-em (`CreateGenerationCommand` + pole `model?`).
   - Weryfikuje użytkownika przez `context.locals.supabase.auth.getUser()` (lub sesję z ciastek/Authorization) i pobiera `user.id`.
   - Uruchamia timer i woła `GenerationsService.generateProposals()` z `promptText`, `model`.
   - Odbiera propozycje oraz metadane (czas, użyty model, liczba propozycji).
   - Wstawia rekord do `generations` z: `user_id`, `total_count`, `model`, `generation_duration`, `prompt_text` oraz timestamps (DB ustawi domyślnie `created_at`, `updated_at`).
   - Mapuje rekord na `GenerationSummaryDTO` (camelCase) i zwraca `201` z `CreateGenerationResponse`.
3. Brak utrwalenia propozycji fiszek na tym etapie.

### 6. Względy bezpieczeństwa
- Wymagana autentykacja (401 gdy brak/niepoprawna).
- Spójność z RLS (chociaż tabela może mieć wyłączone polityki – nadal zapisujemy `user_id`).
- Walidacja rozmiaru `promptText` przed wywołaniem LLM, aby unikać kosztów i ataków DoS.
- Limitacja częstotliwości (429) per użytkownik, np. token bucket/okienko czasowe.
- Ochrona przed prompt injection w prezentacji wyników (escape w UI; tu tylko pass-through).
- Konfiguracja po stronie serwera: bezpieczne odczyty `OPENROUTER_API_KEY` (zmienne środowiskowe, nigdy do klienta).
- Sanitizacja i logowanie błędów bez ujawniania kluczy/sekretów.

### 7. Obsługa błędów
- 400: JSON.parse/Zod parse fail -> zwrot komunikatu walidacyjnego.
- 401: brak sesji/`user.id`.
- 422: `promptText` <1000 lub >10000; także gdy `model` nieobsługiwany.
- 429: przekroczony limit – komunikat zawiera okno/limit.
- 502: błąd OpenRouter (timeout, 5xx, niepoprawny format) – mapowanie na 502.
- 500: niespodziewane wyjątki – log szczegółowy serwerowy, komunikat ogólny w odpowiedzi.
- Rejestrowanie w tabeli błędów (jeśli istnieje) lub w logach aplikacyjnych (z korelacją request-id).

### 8. Rozważania dotyczące wydajności
- timeout do OpenRouter 60 sekund.
- Strumieniowanie nie jest wymagane – pełna odpowiedź po zakończeniu generacji.
- Minimalizacja payloadu (`promptText` nie jest zwracany w odpowiedzi).
- Agregacje liczb propozycji wykonywane po stronie serwisu, a do DB trafia tylko liczba.

### 9. Etapy wdrożenia (kroki implementacji)
1. Typy i walidacja
   - Dodaj Zod schemat: `CreateGenerationSchema = z.object({ promptText: z.string().min(1000).max(10000), model: z.string().optional() })` w `src/lib/validation/generations.ts`.
   - Potwierdź dopasowanie do `CreateGenerationCommand` i typów DTO z `src/types.ts`.
2. Serwis LLM i generacji
   - Stwórz `src/lib/services/openrouter.ts` z funkcją `callOpenRouter(promptText, model?)` (obsługa klucza `OPENROUTER_API_KEY`, timeout, mapowanie outputu na `ProposalFlashcardDTO[]`).
   - Stwórz `src/lib/services/generations.service.ts` z `generateProposals({ promptText, model })` zwracającą `{ proposals, usedModel, durationMs }`.
   - Zaimplementuj ograniczenie długości `front` (1..200) i `back` (1..500) na poziomie mapowania wyników LLM (przytnij i odfiltruj puste).
3. Endpoint API
   - Utwórz `src/pages/api/generations.ts`:
     - `export const prerender = false;`
     - Handler `export async function POST(context) { ... }`.
     - Pobierz `supabase` z `context.locals` i użytkownika; gdy brak -> 401.
     - Parsuj body, waliduj Zod; gdy fail -> 400/422.
     - Sprawdź rate limit (np. prosta kontrola w `generations.service` lub osobny `rate-limit.ts`).
     - Wywołaj serwis, zmierz czas.
     - Wstaw do `generations` (kolumny: `user_id`, `prompt_text`, `total_count`, `model`, `generation_duration`).
     - Zmapuj rekord na `GenerationSummaryDTO` i zwróć `201` z `CreateGenerationResponse`.
     - Błędy z OpenRouter -> 502; inne -> 500.
4. Konfiguracja środowiska
   - Dodaj `OPENROUTER_API_KEY` do `.env` i `import.meta.env` (Astro). Upewnij się, że nie jest eksponowany do klienta.
   - Ewentualnie dodaj `DEFAULT_LLM_MODEL` do konfiguracji serwera.
5. Testy i linter
   - Pokryj testami serwis mapujący i walidację Zod (graniczne długości 999/1000/10000/10001).
   - Testuj błąd upstream (symulacja 5xx), przekroczenie limitu i brak autoryzacji.
6. Obserwowalność i logowanie
   - Dodaj jednolity logger w `src/lib/logger.ts` i użyj w endpointach/serwisach.
   - Loguj `requestId`, `userId`, `model`, `durationMs`, `totalCount`, błędy.

### 10. Mapowanie DB -> DTO (camelCase)
- `id` -> `id`
- `total_count` -> `totalCount`
- `accepted_unedited_count` -> `acceptedUneditedCount`
- `accepted_edited_count` -> `acceptedEditedCount`
- `model` -> `model`
- `generation_duration` -> `generationDuration`
- `created_at` -> `createdAt`
- `updated_at` -> `updatedAt`

### 11. Potencjalne pułapki
- Brak użytkownika w kontekście – konieczna obsługa 401.
- Zbyt długi/krótki `promptText` – walidacja przed wywołaniem LLM.
- Niestabilny format odpowiedzi LLM – defensywne mapowanie + odrzucanie niepoprawnych elementów.
- Przekroczenie czasu – ustaw timeout i mapuj na 502.
- Różnice stref czasowych – używaj timestamptz, zwracaj w ISO 8601.
