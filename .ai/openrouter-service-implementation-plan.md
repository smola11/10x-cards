## Usługa OpenRouter – plan implementacji

### 1. Opis usługi
Usługa zawiera integrację z `OpenRouter Chat Completions API` w celu generowania ustrukturyzowanych propozycji fiszek (front/back) z długiego tekstu źródłowego. Zapewnia spójną konfigurację (model, parametry, nagłówki, timeouts), walidację odpowiedzi względem schematu JSON oraz obsługę błędów. Usługa ma być używana na serwerze (Astro API routes) i nie ujawnia klucza w kliencie.

Powiązania w aktualnym kodzie:
- `src/lib/services/generations.service.ts` – wywołuje `callOpenRouter` (obecnie mock) i porządkuje wynik.
- `src/pages/api/generations.ts` – endpoint POST, wywołuje `generateProposals` i zapisuje metadane generacji.


### 2. Opis konstruktora
Proponowana klasa: `OpenRouterService` w `src/lib/services/openrouter.ts` (zastąpi istniejący mock lub będzie używana warunkowo przez flagę środowiskową).

Konstruktor przyjmuje konfigurację:
- `apiKey: string` – klucz API OpenRouter (wymagany, tylko na serwerze)
- `baseUrl?: string` – baza URL, domyślnie `https://openrouter.ai/api/v1`
- `defaultModel?: string` – nazwa domyślnego modelu (np. `openrouter/anthropic/claude-3.5-sonnet`)
- `defaultParams?: ModelParams` – domyślne parametry modelu (temperature, max_tokens, top_p, top_k, presence_penalty, frequency_penalty)
- `httpReferer?: string` – wartość nagłówka `HTTP-Referer` zgodnie z zaleceniami OpenRouter
- `appTitle?: string` – wartość nagłówka `X-Title`
- `timeoutMs?: number` – timeout żądania (np. 60_000)


### 3. Publiczne metody i pola
- `async createChatCompletion(input: CreateChatInput): Promise<StructuredProposals>`
  - Wysyła żądanie do `POST {baseUrl}/chat/completions` z wiadomościami (system + user), `response_format` ze schematem JSON i parametrami modelu. Zwraca ustrukturyzowane propozycje po walidacji.

- `async streamChatCompletion(input: CreateChatInput & { onDelta?: (text: string) => void }): Promise<StructuredProposals>`
  - (Opcjonalne) Wersja strumieniowa ze wsparciem SSE; dopina `stream: true` i łączy delty, finalnie waliduje JSON (wymagane modele z deterministycznym formatowaniem przy `response_format`).

- `getDefaultModel(): string` – zwraca wybrany model (z inputu lub domyślny)

- `setDefaults(partial: Partial<OpenRouterDefaults>): void` – pozwala zaktualizować domyślne parametry/model bez rekonstrukcji serwisu

Typy (przykładowe):
- `CreateChatInput` – `{ promptText: string; model?: string; systemPrompt?: string; params?: Partial<ModelParams>; schema?: JsonSchemaSpec; }`
- `StructuredProposals` – `{ proposals: { front: string; back: string }[]; usedModel: string; raw?: unknown }`
- `ModelParams` – `{ temperature?: number; max_tokens?: number; top_p?: number; top_k?: number; presence_penalty?: number; frequency_penalty?: number }`
- `JsonSchemaSpec` – `{ name: string; schema: object; strict?: boolean }`


### 4. Prywatne metody i pola
- `#headers(): Record<string,string>` – buduje nagłówki: `Authorization`, `HTTP-Referer`, `X-Title`, `Content-Type`
- `#buildMessages(systemPrompt: string | undefined, userPrompt: string)` – zwraca tablicę wiadomości `{ role: 'system' | 'user', content: string }[]`
- `#buildResponseFormat(schema: JsonSchemaSpec)` – zwraca obiekt `response_format` w formacie zgodnym z OpenRouter
- `#request<T>(payload: unknown, options?: { signal?: AbortSignal }): Promise<T>` – opakowanie `fetch` z timeoutem, obsługą błędów i retry (opcjonalnie)
- `#parseStructured(content: unknown): unknown` – bezpieczny parse JSON z fallbackiem
- `#validateProposals(obj: unknown): { front: string; back: string }[]` – waliduje wynik względem lokalnego schematu (np. Zod lub manualnie)
- `#coerceAndClamp(proposals)` – przycina długości pól i usuwa puste wpisy (spójne z `generations.service.ts`)
- Pola prywatne na konfigurację: `#apiKey`, `#baseUrl`, `#defaults`, `#timeoutMs`


### 5. Obsługa błędów
Potencjalne scenariusze i reakcje:
1. Brak `apiKey`/sekretów po stronie serwera – zwróć błąd konfiguracyjny (500) i loguj ostrzeżenie (bez ujawniania sekretów).
2. 401/403 z OpenRouter – rzuć kontrolowany błąd z komunikatem „Unauthorized/Forbidden”, zalecaj rotację klucza.
3. 404/400 – błąd modelu lub złego payloadu; skoryguj model/parametry i zwróć 502 do klienta z bezpiecznym komunikatem.
4. 429 (rate limit) – retry z `Retry-After` (exponential backoff + jitter); po wyczerpaniu zwróć 503.
5. 5xx (OpenRouter) – do 2-3 prób z backoff; potem 502.
6. Timeout po naszej stronie – przerwij żądanie, zwróć 504; daj możliwość anulowania (AbortController).
7. Odpowiedź niespełniająca `response_format` – walidacja lokalna zwraca 502 i wskazuje, że model zwrócił nieprawidłowy format.
8. Błędy JSON parse – 502, spróbuj dodatkowo usunąć „kosmetyczny” tekst spoza nawiasów JSON, ale zachowaj ostrożność.
9. Sieć/przerwanie połączenia – 503, opcjonalny retry.
10. Streaming przerwany – zachowaj częściową treść, jeśli możliwa walidacja; inaczej 499 (client closed) lub 502.


### 6. Kwestie bezpieczeństwa
- Klucz `OPENROUTER_API_KEY` tylko po stronie serwera (Astro API routes). Nigdy nie w bundlu klienta.
- Redakcja logów: maskuj `Authorization` i fragmenty payloadu. Loguj `requestId`, `model`, `status`, `durationMs`.
- Walidacja wyjścia: lokalny schemat + twarde przycinanie długości.
- Timebox i anulowanie: `AbortController` i `timeoutMs` aby uniknąć wiszących połączeń.
- Konfiguracja modeli i parametrów z `.env`/runtime – nie koduj na stałe.

### 7. Plan wdrożenia krok po kroku

1) Zmienne środowiskowe (server-only)
- Dodaj do `.env.local` (nie commituj):
  - `OPENROUTER_API_KEY=...`
  - `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1` (opcjonalnie)
  - `OPENROUTER_MODEL_DEFAULT=openrouter/anthropic/claude-3.5-sonnet` (lub inny)
  - `OPENROUTER_HTTP_REFERER=https://twoja-domena.dev` (zalecane przez OpenRouter)
  - `OPENROUTER_TITLE=10x-cards`

2) Implementacja serwisu (`src/lib/services/openrouter.ts`)
- Zamień obecny mock `callOpenRouter` na klasę `OpenRouterService` i funkcję fasadową `callOpenRouter`:

3) Włączenie w istniejące flows
- `src/lib/services/generations.service.ts` – pozostaje bez zmian (już przycina długości i normalizuje), bo `callOpenRouter` zachowuje podpis.
- `src/pages/api/generations.ts` – opcjonalnie przekaż `model` z body do `generateProposals` (już wspierane). Dodaj telemetry (czas trwania jest już mierzony).

4) Przykłady konfiguracji elementów zgodnych z OpenRouter
1. Komunikat systemowy:
```ts
const systemPrompt = 'Jesteś ekspertem od tworzenia fiszek. Zwracaj wyłącznie JSON.';
svc.createChatCompletion({ promptText, systemPrompt });
```

2. Komunikat użytkownika:
```ts
svc.createChatCompletion({ promptText: 'Tekst źródłowy (1000–10000 znaków)...' });
```

3. Ustrukturyzowane odpowiedzi (response_format):
```ts
const schema = {
  name: 'flashcards_response',
  strict: true,
  schema: {
    type: 'object',
    required: ['proposals'],
    additionalProperties: false,
    properties: {
      proposals: {
        type: 'array',
        minItems: 3,
        maxItems: 20,
        items: {
          type: 'object',
          required: ['front', 'back'],
          additionalProperties: false,
          properties: {
            front: { type: 'string', minLength: 1, maxLength: 200 },
            back: { type: 'string', minLength: 1, maxLength: 500 },
          },
        },
      },
    },
  },
} as const;

svc.createChatCompletion({ promptText, schema });
```

4. Nazwa modelu:
```ts
svc.createChatCompletion({ promptText, model: 'openrouter/openai/gpt-4o-mini' });
```

5. Parametry modelu:
```ts
svc.createChatCompletion({
  promptText,
  params: { temperature: 0.2, max_tokens: 1800, top_p: 0.9 },
});
```

#### Załącznik A: Minimalny kształt żądania do OpenRouter (dla odniesienia)
```json
{
  "model": "openrouter/anthropic/claude-3.5-sonnet",
  "messages": [
    { "role": "system", "content": "Jesteś asystentem..." },
    { "role": "user",   "content": "Długi tekst źródłowy..." }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "flashcards_response",
      "strict": true,
      "schema": { "type": "object", "properties": { "proposals": { "type": "array" } }, "required": ["proposals"], "additionalProperties": false }
    }
  },
  "temperature": 0.2,
  "max_tokens": 2000
}
```


