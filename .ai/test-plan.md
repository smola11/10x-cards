# Plan Testów - 10x-cards

## 1. Wprowadzenie i cele testowania

### 1.1. Cel dokumentu

Niniejszy dokument definiuje kompleksową strategię testowania aplikacji **10x-cards** – systemu do szybkiego tworzenia i zarządzania zestawami fiszek edukacyjnych. Plan testów obejmuje weryfikację kluczowych funkcjonalności MVP, w tym generowanie fiszek przy użyciu AI, ręczne zarządzanie fiszkami, autentykację użytkowników oraz integracje z zewnętrznymi serwisami (Supabase, OpenRouter.ai).

## 2. Zakres testów

### 2.1. W zakresie testów

#### Funkcjonalności MVP:

1. **Autentykacja użytkowników**
   - Rejestracja nowych użytkowników
   - Logowanie i wylogowanie
   - Resetowanie hasła
   - Middleware do ochrony tras

2. **Generowanie fiszek przez AI**
   - Tworzenie propozycji fiszek z tekstu (POST /api/generations)
   - Akceptacja propozycji (edytowanych i nieedytowanych)
   - Zarządzanie limitami akceptacji
   - Obsługa błędów i timeout'ów OpenRouter API
   - Walidacja długości tekstu wejściowego (1000-10000 znaków)

3. **Zarządzanie fiszkami**
   - Tworzenie fiszek ręcznie (POST /api/flashcards)
   - Listowanie fiszek z paginacją i filtrowaniem (GET /api/flashcards)
   - Walidacja pól `front` (1-200 znaków) i `back` (1-500 znaków)
   - Filtrowanie według origin (manual, ai-full, ai-edited)

4. **Baza danych i bezpieczeństwo**
   - Row Level Security (RLS) dla tabel flashcards i generations
   - Walidacja constraint'ów bazy danych
   - Trigger'y aktualizacji `updated_at`
   - Relacje między tabelami (generations ↔ flashcards)

5. **Interfejs użytkownika**
   - Formularz generowania propozycji
   - Lista propozycji z możliwością edycji
   - Zaznaczanie i akceptacja propozycji
   - Widok listy zapisanych fiszek
   - Responsywność (desktop, tablet, mobile)

6. **Analityka generacji**
   - Liczniki: total_count, accepted_unedited_count, accepted_edited_count
   - Czas generacji (generation_duration)
   - Model użyty do generacji

### 2.2. Poza zakresem testów

- Własny algorytm spaced-repetition (poza MVP)
- Gamifikacja
- Aplikacje mobilne natywne
- Import z PDF/DOCX
- Publiczne API
- Udostępnianie fiszek między użytkownikami
- Zaawansowane wyszukiwanie i notyfikacje
- Testy wydajnościowe pod dużym obciążeniem (stress testing)
- Penetration testing (security audit)

## 3. Typy testów do przeprowadzenia

### 3.1. Testy jednostkowe (Unit Tests)

**Framework**: Vitest

**Zakres**:

- Funkcje serwisowe (`flashcards.service.ts`, `generations.service.ts`)
- Funkcje walidacyjne (Zod schemas)
- Funkcje pomocnicze (`utils.ts`)
- Klasa `OpenRouterService` i jej metody
- Komponenty React (logika hooków: `useProposalsState`, `useAbortableRequest`)

**Priorytetowe obszary**:

```typescript
// Przykładowe testy dla flashcards.service.ts
- mapFlashcardRowToDTO() - transformacja danych z DB do DTO
- Walidacja schemas (FlashcardsListQuerySchema, CreateManualFlashcardSchema)
- Logika filtrowania i sortowania
```

### 3.2. Testy integracyjne (Integration Tests)

**Framework**: Vitest + Supertest (dla API)

**Zakres**:

- Endpointy API (`/api/flashcards`, `/api/generations`, `/api/auth/*`)
- Integracja z Supabase (CRUD operations)
- Integracja z OpenRouter.ai (mockowanie odpowiedzi)
- Middleware Astro (auth guards, session management)
- Flow: generowanie → akceptacja → zapis do bazy

**Priorytetowe scenariusze**:

1. Pełny flow generowania fiszek: POST /api/generations → POST /api/generations/:id/accept → GET /api/flashcards
2. Weryfikacja RLS policies (próba dostępu do cudzych danych)
3. Walidacja błędów API (422, 400, 401, 404)
4. Zachowanie się przy timeout'ach OpenRouter
5. Logika limitów akceptacji (nie można zaakceptować więcej niż wygenerowano)

### 3.3. Testy E2E (End-to-End Tests)

**Framework**: Playwright

**Zakres**:

- Pełne user journey od rejestracji do utworzenia pierwszej fiszki
- Interakcje z formularzami React
- Nawigacja między stronami
- Responsywność interfejsu
- Accessibility (A11y) podstawowe sprawdzenia

**Kluczowe scenariusze**:

1. **Rejestracja i logowanie**:
   - Rejestracja nowego użytkownika
   - Logowanie z poprawnymi danymi
   - Wylogowanie
   - Obsługa błędów (nieprawidłowe hasło)

2. **Generowanie fiszek**:
   - Wprowadzenie tekstu (1000-10000 znaków)
   - Kliknięcie "Generuj propozycje"
   - Oczekiwanie na załadowanie propozycji
   - Edycja propozycji
   - Zaznaczanie propozycji
   - Akceptacja zaznaczonych/wszystkich propozycji
   - Przekierowanie do listy fiszek

3. **Zarządzanie fiszkami**:
   - Wyświetlenie listy fiszek
   - Filtrowanie według origin
   - Filtrowanie według generationId
   - Paginacja
   - Weryfikacja wyświetlania danych

4. **Edge cases**:
   - Anulowanie generowania
   - Przekroczenie limitu akceptacji
   - Próba wygenerowania z tekstem poniżej 1000 znaków
   - Próba wygenerowania z tekstem powyżej 10000 znaków

### 3.4. Testy wydajnościowe (Performance Tests)

**Narzędzie**: Lighthouse (CI), k6 (opcjonalnie)

**Zakres**:

- Czas ładowania strony głównej
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Czas odpowiedzi API dla typowych zapytań

**Kryteria**:

- LCP < 2.5s
- FCP < 1.8s
- TTI < 3.8s
- CLS < 0.1
- API response time < 1s (dla lokalnych operacji)

### 3.5. Testy bezpieczeństwa (Security Tests)

**Zakres**:

- Weryfikacja RLS policies w Supabase
- Próby SQL injection (poprzez Zod validation)
- XSS attacks (weryfikacja sanityzacji)
- CSRF protection (poprzez middleware)
- Weryfikacja auth guards (dostęp do chronionych tras)
- Sprawdzenie braku wrażliwych danych w odpowiedziach API

**Priorytetowe scenariusze**:

1. Próba dostępu do /api/flashcards bez autoryzacji (oczekiwane: 401)
2. Próba dostępu do fiszek innego użytkownika (oczekiwane: pusta lista)
3. Próba akceptacji propozycji dla generacji innego użytkownika (oczekiwane: 403 lub 404)
4. Walidacja długości pól front/back (weryfikacja constraint'ów DB)

## 4. Scenariusze testowe dla kluczowych funkcjonalności

### 4.1. Autentykacja

#### TC-AUTH-001: Rejestracja nowego użytkownika (Happy Path)

**Priorytet**: Wysoki  
**Warunki wstępne**: Brak  
**Kroki**:

1. Przejdź do `/auth/register`
2. Wprowadź prawidłowy email (np. `test@example.com`)
3. Wprowadź hasło (min. 6 znaków)
4. Kliknij "Zarejestruj się"

**Oczekiwany rezultat**:

- Użytkownik zostaje przekierowany do `/` (główna strona aplikacji)
- Sesja użytkownika jest aktywna
- W bazie danych w `auth.users` pojawia się nowy rekord

#### TC-AUTH-002: Logowanie z poprawnymi danymi

**Priorytet**: Wysoki  
**Warunki wstępne**: Użytkownik jest zarejestrowany  
**Kroki**:

1. Przejdź do `/auth/login`
2. Wprowadź prawidłowy email i hasło
3. Kliknij "Zaloguj się"

**Oczekiwany rezultat**:

- Przekierowanie do `/`
- Sesja użytkownika jest aktywna
- Cookies zawierają token sesji Supabase

#### TC-AUTH-003: Logowanie z nieprawidłowym hasłem

**Priorytet**: Średni  
**Warunki wstępne**: Użytkownik jest zarejestrowany  
**Kroki**:

1. Przejdź do `/auth/login`
2. Wprowadź prawidłowy email
3. Wprowadź nieprawidłowe hasło
4. Kliknij "Zaloguj się"

**Oczekiwany rezultat**:

- Wyświetlenie komunikatu błędu
- Brak przekierowania
- Brak aktywnej sesji

#### TC-AUTH-004: Wylogowanie

**Priorytet**: Średni  
**Warunki wstępne**: Użytkownik jest zalogowany  
**Kroki**:

1. Kliknij "Wyloguj"
2. Spróbuj odwiedzić `/` (chronioną trasę)

**Oczekiwany rezultat**:

- Sesja zostaje zakończona
- Przekierowanie do `/auth/login?redirect=/`
- Cookies sesji są usuwane

#### TC-AUTH-005: Auth guard dla chronionych tras

**Priorytet**: Wysoki  
**Warunki wstępne**: Użytkownik jest wylogowany  
**Kroki**:

1. Spróbuj bezpośrednio odwiedzić `/`
2. Spróbuj bezpośrednio odwiedzić `/flashcards`

**Oczekiwany rezultat**:

- Przekierowanie do `/auth/login?redirect={original_path}`
- Brak dostępu do chronionej zawartości

### 4.2. Generowanie fiszek przez AI

#### TC-GEN-001: Generowanie propozycji (Happy Path)

**Priorytet**: Krytyczny  
**Warunki wstępne**: Użytkownik jest zalogowany  
**Kroki**:

1. Przejdź do `/`
2. Wprowadź tekst o długości 1500 znaków w pole "Tekst źródłowy"
3. Kliknij "Generuj propozycje"
4. Poczekaj na odpowiedź

**Oczekiwany rezultat**:

- Wyświetlenie propozycji (1-20 fiszek)
- Każda propozycja ma pole `front` i `back`
- Zapisanie rekordu w tabeli `generations` z danymi:
  - `total_count` = liczba propozycji
  - `accepted_unedited_count` = 0
  - `accepted_edited_count` = 0
  - `model` = nazwa modelu (np. "openai/gpt-oss-20b:free")
  - `generation_duration` > 0

#### TC-GEN-002: Walidacja długości tekstu (poniżej minimum)

**Priorytet**: Wysoki  
**Warunki wstępne**: Użytkownik jest zalogowany  
**Kroki**:

1. Przejdź do `/`
2. Wprowadź tekst o długości 500 znaków
3. Kliknij "Generuj propozycje"

**Oczekiwany rezultat**:

- Przycisk "Generuj propozycje" jest zablokowany
- Wyświetlenie komunikatu błędu: "Tekst musi zawierać od 1 000 do 10 000 znaków"
- Brak wywołania API

#### TC-GEN-003: Walidacja długości tekstu (powyżej maksimum)

**Priorytet**: Wysoki  
**Warunki wstępne**: Użytkownik jest zalogowany  
**Kroki**:

1. Przejdź do `/`
2. Wprowadź tekst o długości 11000 znaków
3. Kliknij "Generuj propozycje"

**Oczekiwany rezultat**:

- Przycisk "Generuj propozycje" jest zablokowany
- Wyświetlenie komunikatu błędu
- Brak wywołania API

#### TC-GEN-004: Anulowanie generowania

**Priorytet**: Średni  
**Warunki wstępne**: Użytkownik jest zalogowany  
**Kroki**:

1. Przejdź do `/`
2. Wprowadź prawidłowy tekst (1500 znaków)
3. Kliknij "Generuj propozycje"
4. Przed zakończeniem generowania kliknij "Anuluj"

**Oczekiwany rezultat**:

- Request do OpenRouter.ai zostaje przerwany (AbortController)
- Wyświetlenie komunikatu "Generowanie zostało anulowane"
- Brak zapisu w tabeli `generations`
- Brak propozycji na ekranie

#### TC-GEN-005: Edycja propozycji

**Priorytet**: Średni  
**Warunki wstępne**: Wygenerowano propozycje  
**Kroki**:

1. Kliknij w pole `front` jednej z propozycji
2. Zmień tekst
3. Kliknij poza polem (blur)

**Oczekiwany rezultat**:

- Propozycja jest oznaczona jako edytowana (`edited: true`)
- Walidacja długości (1-200 znaków dla front)
- Licznik "edited" w UI jest aktualizowany

#### TC-GEN-006: Akceptacja wszystkich propozycji

**Priorytet**: Krytyczny  
**Warunki wstępne**: Wygenerowano 5 propozycji, wszystkie są prawidłowe  
**Kroki**:

1. Kliknij "Zaakceptuj wszystkie"
2. Poczekaj na odpowiedź

**Oczekiwany rezultat**:

- POST do `/api/generations/:id/accept` z 5 fiszkami
- 5 rekordów w tabeli `flashcards` z:
  - `origin` = 'ai-full' (jeśli nieedytowane) lub 'ai-edited' (jeśli edytowane)
  - `generation_id` = id generacji
- Aktualizacja `accepted_unedited_count` i `accepted_edited_count` w tabeli `generations`
- Toast: "Propozycje zapisane: Dodano 5 fiszek do Twojej kolekcji"
- Link CTA do `/flashcards?generationId={id}`

#### TC-GEN-007: Akceptacja zaznaczonych propozycji

**Priorytet**: Wysoki  
**Warunki wstępne**: Wygenerowano 5 propozycji  
**Kroki**:

1. Zaznacz checkbox przy 2 propozycjach
2. Kliknij "Zaakceptuj zaznaczone"

**Oczekiwany rezultat**:

- POST do `/api/generations/:id/accept` z 2 fiszkami
- 2 rekordy w tabeli `flashcards`
- Aktualizacja liczników w `generations`
- Toast z informacją o dodaniu 2 fiszek
- 3 propozycje pozostają na ekranie (nieusunięte)

#### TC-GEN-008: Przekroczenie limitu akceptacji

**Priorytet**: Wysoki  
**Warunki wstępne**: Wygenerowano 5 propozycji, zaakceptowano już 5  
**Kroki**:

1. Spróbuj ponownie zaakceptować dowolną propozycję

**Oczekiwany rezultat**:

- Wyświetlenie komunikatu błędu: "Przekroczony limit"
- Brak zapisu w bazie
- API zwraca 409 Conflict

#### TC-GEN-009: OpenRouter API timeout

**Priorytet**: Średni  
**Warunki wstępne**: Mock timeout'u OpenRouter API (120s)  
**Kroki**:

1. Wprowadź prawidłowy tekst
2. Kliknij "Generuj propozycje"
3. Poczekaj na timeout

**Oczekiwany rezultat**:

- Wyświetlenie komunikatu błędu
- Status: "error"
- Możliwość ponownej próby

### 4.3. Zarządzanie fiszkami

#### TC-FLASH-001: Ręczne tworzenie fiszki

**Priorytet**: Wysoki  
**Warunki wstępne**: Użytkownik jest zalogowany  
**Kroki**:

1. POST do `/api/flashcards` z body:
   ```json
   {
     "front": "Pytanie testowe",
     "back": "Odpowiedź testowa"
   }
   ```

**Oczekiwany rezultat**:

- Status 201 Created
- Zwrócenie FlashcardDTO
- Rekord w tabeli `flashcards` z:
  - `origin` = 'manual'
  - `generation_id` = null
  - `user_id` = ID zalogowanego użytkownika

#### TC-FLASH-002: Walidacja pola front (za długie)

**Priorytet**: Średni  
**Kroki**:

1. POST do `/api/flashcards` z `front` o długości 201 znaków

**Oczekiwany rezultat**:

- Status 422 Unprocessable Entity
- Błąd walidacji Zod
- Brak zapisu w bazie

#### TC-FLASH-003: Walidacja pola back (puste)

**Priorytet**: Średni  
**Kroki**:

1. POST do `/api/flashcards` z `back` = ""

**Oczekiwany rezultat**:

- Status 422 Unprocessable Entity
- Błąd walidacji
- Brak zapisu w bazie

#### TC-FLASH-004: Listowanie fiszek z paginacją

**Priorytet**: Wysoki  
**Warunki wstępne**: Użytkownik ma 25 fiszek  
**Kroki**:

1. GET `/api/flashcards?page=1&limit=20`
2. GET `/api/flashcards?page=2&limit=20`

**Oczekiwany rezultat**:

- Strona 1: 20 fiszek, `hasNextPage: true`, `hasPrevPage: false`
- Strona 2: 5 fiszek, `hasNextPage: false`, `hasPrevPage: true`
- `totalItems: 25`, `totalPages: 2`

#### TC-FLASH-005: Filtrowanie według origin

**Priorytet**: Średni  
**Warunki wstępne**: Użytkownik ma fiszki różnych origin  
**Kroki**:

1. GET `/api/flashcards?origin=manual`

**Oczekiwany rezultat**:

- Zwrócenie tylko fiszek z `origin` = 'manual'
- Poprawna paginacja dla odfiltrowanych wyników

#### TC-FLASH-006: Filtrowanie według generationId

**Priorytet**: Średni  
**Warunki wstępne**: Użytkownik ma fiszki z różnych generacji  
**Kroki**:

1. GET `/api/flashcards?generationId=42`

**Oczekiwany rezultat**:

- Zwrócenie tylko fiszek z `generation_id` = 42
- Poprawna paginacja

#### TC-FLASH-007: Sortowanie według created_at desc

**Priorytet**: Średni  
**Kroki**:

1. GET `/api/flashcards?sort=created_at&order=desc`

**Oczekiwany rezultat**:

- Fiszki posortowane od najnowszej do najstarszej
- Poprawne zastosowanie `order by created_at desc, id asc`

#### TC-FLASH-008: RLS - izolacja danych użytkowników

**Priorytet**: Krytyczny  
**Warunki wstępne**: Dwóch użytkowników (A i B), każdy ma fiszki  
**Kroki**:

1. Zaloguj się jako użytkownik A
2. GET `/api/flashcards`

**Oczekiwany rezultat**:

- Zwrócenie TYLKO fiszek użytkownika A
- Fiszki użytkownika B są niewidoczne
- Brak możliwości dostępu do fiszek B przez manipulację parametrów

### 4.4. Interfejs użytkownika

#### TC-UI-001: Responsywność widoku generowania

**Priorytet**: Średni  
**Kroki**:

1. Otwórz `/` na desktopie (1920x1080)
2. Otwórz `/` na tablecie (768x1024)
3. Otwórz `/` na mobile (375x667)

**Oczekiwany rezultat**:

- Layout dostosowuje się do szerokości ekranu
- Grid zmienia się z 2 kolumn na 1 kolumnę
- Wszystkie elementy są czytelne i dostępne
- Brak poziomego przewijania

#### TC-UI-002: Toast notifications

**Priorytet**: Niski  
**Kroki**:

1. Wykonaj akcję wywołującą toast (np. zaakceptuj propozycje)

**Oczekiwany rezultat**:

- Toast pojawia się w prawym górnym rogu
- Toast znika automatycznie po 5s
- Toast można zamknąć ręcznie

#### TC-UI-003: Loading states

**Priorytet**: Średni  
**Kroki**:

1. Rozpocznij generowanie propozycji
2. Zaobserwuj skeleton loadery

**Oczekiwany rezultat**:

- Skeleton loadery wyświetlają się podczas ładowania
- Przycisk "Generuj propozycje" zmienia tekst na "Generowanie..."
- Przycisk jest zablokowany podczas generowania

#### TC-UI-004: Walidacja formularzy w czasie rzeczywistym

**Priorytet**: Średni  
**Kroki**:

1. Wprowadź 500 znaków w pole tekstowe
2. Zaobserwuj licznik i komunikat błędu

**Oczekiwany rezultat**:

- Licznik pokazuje 500/1000 (min)
- Komunikat błędu: "Tekst musi zawierać od 1 000 do 10 000 znaków"
- Przycisk jest zablokowany

#### TC-UI-005: Accessibility - nawigacja klawiaturą

**Priorytet**: Średni  
**Kroki**:

1. Użyj klawisza Tab do nawigacji przez formularz
2. Użyj Enter do aktywacji przycisków
3. Użyj Space do zaznaczenia checkboxów

**Oczekiwany rezultat**:

- Wszystkie interaktywne elementy są dostępne przez klawiaturę
- Focus jest widoczny (outline)
- Kolejność focus jest logiczna

## 5. Środowisko testowe

### 5.1. Środowiska

#### Lokalne środowisko deweloperskie

- **OS**: Windows 10/11, macOS, Linux
- **Node.js**: v22.14.0 (zgodnie z `.nvmrc`)
- **npm**: wersja bundlowana z Node.js
- **Supabase**: Local instance (Supabase CLI) lub projekt dev w chmurze
- **OpenRouter API**: Test API key z limitami

#### Środowisko CI/CD

- **Platforma**: GitHub Actions
- **Node.js**: v22.14.0
- **Supabase**: Projekt testowy (izolowany od produkcji)
- **OpenRouter API**: Test API key z automatycznymi limitami

#### Środowisko staging (opcjonalnie)

- **Hosting**: DigitalOcean (Docker)
- **Database**: Supabase (projekt staging)
- **URL**: `https://staging.10xcards.app` (przykładowy)

### 5.2. Dane testowe

#### Użytkownicy testowi

```
User A (podstawowy):
- Email: test.user.a@example.com
- Password: Test123!

User B (drugi użytkownik dla testów RLS):
- Email: test.user.b@example.com
- Password: Test123!

Admin (opcjonalnie):
- Email: admin@example.com
- Password: Admin123!
```

#### Fixture'y dla testów

```typescript
// Przykładowy tekst do generowania (1500 znaków)
const SAMPLE_PROMPT_TEXT = `
Astro is a modern web framework designed for building fast, content-focused websites. 
It uses a unique approach called "Islands Architecture" that allows you to use 
any UI framework (React, Vue, Svelte) while shipping less JavaScript to the browser.
[... dalszy tekst do 1500 znaków ...]
`;

// Przykładowa propozycja
const SAMPLE_PROPOSAL = {
  front: "What is Astro?",
  back: "Astro is a modern web framework for building fast, content-focused websites.",
};

// Przykładowa fiszka
const SAMPLE_FLASHCARD = {
  front: "What is TypeScript?",
  back: "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.",
  origin: "manual",
};
```

### 5.3. Mock'i i stub'y

#### OpenRouter API Mock

```typescript
// Mock dla testów jednostkowych i integracyjnych
const mockOpenRouterResponse = {
  id: "chatcmpl-123",
  model: "openai/gpt-oss-20b:free",
  choices: [
    {
      message: {
        role: "assistant",
        content: JSON.stringify({
          proposals: [
            { front: "Question 1", back: "Answer 1" },
            { front: "Question 2", back: "Answer 2" },
          ],
        }),
      },
    },
  ],
};
```

#### Supabase Mock (dla testów jednostkowych)

```typescript
// Mock dla operacji CRUD
const mockSupabaseClient = {
  from: vi.fn(() => ({
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  })),
  auth: {
    getUser: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
};
```

## 6. Narzędzia do testowania

### 6.1. Frameworki i biblioteki

#### Testy jednostkowe i integracyjne

- **Vitest** (v2.x): Framework testowy kompatybilny z Vite
- **@vitest/ui**: UI do przeglądania wyników testów
- **c8**: Code coverage tool
- **Supertest**: Testowanie API endpoints
- **MSW (Mock Service Worker)**: Mockowanie HTTP requests

#### Testy E2E

- **Playwright** (v1.48+): Nowoczesne narzędzie do testów E2E
- **@axe-core/playwright**: Plugin do testów accessibility

#### Linting i formatowanie

- **ESLint** (v9.23): Już skonfigurowane w projekcie
- **Prettier**: Już skonfigurowane w projekcie
- **TypeScript**: Statyczna analiza typów

#### Code coverage

- **c8**: Do generowania raportów code coverage
- **Codecov** lub **Coveralls**: Do wizualizacji coverage (opcjonalnie)

### 6.2. Konfiguracja narzędzi

#### Vitest Configuration (`vitest.config.ts`)

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "c8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/test/", "**/*.d.ts", "**/*.config.*", "**/mockData"],
      all: true,
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
```

#### Playwright Configuration (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html"], ["junit", { outputFile: "test-results/junit.xml" }]],
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
  },
});
```

### 6.3. Struktura katalogów testowych

```
10x-cards/
├── src/
│   ├── __tests__/              # Testy jednostkowe i integracyjne
│   │   ├── unit/
│   │   │   ├── services/
│   │   │   │   ├── flashcards.service.test.ts
│   │   │   │   ├── generations.service.test.ts
│   │   │   │   └── openrouter.test.ts
│   │   │   ├── validation/
│   │   │   │   ├── flashcards.test.ts
│   │   │   │   └── generations.test.ts
│   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useProposalsState.test.ts
│   │   │   │   │   └── useAbortableRequest.test.ts
│   │   │   └── utils.test.ts
│   │   ├── integration/
│   │   │   ├── api/
│   │   │   │   ├── flashcards.test.ts
│   │   │   │   ├── generations.test.ts
│   │   │   │   └── auth.test.ts
│   │   │   └── middleware.test.ts
│   │   └── fixtures/
│   │       ├── flashcards.ts
│   │       ├── generations.ts
│   │       └── users.ts
│   └── test/
│       ├── setup.ts             # Setup file dla Vitest
│       ├── mocks/
│       │   ├── supabase.ts
│       │   └── openrouter.ts
│       └── utils/
│           └── testHelpers.ts
├── e2e/                         # Testy E2E Playwright
│   ├── auth.spec.ts
│   ├── generations.spec.ts
│   ├── flashcards.spec.ts
│   ├── accessibility.spec.ts
│   └── fixtures/
│       └── testData.ts
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

## 7. Harmonogram testów

### 7.1. Faza 1: Setup i konfiguracja (Tydzień 1)

- **Dzień 1-2**: Instalacja i konfiguracja narzędzi (Vitest, Playwright)
- **Dzień 3-4**: Stworzenie mock'ów i fixture'ów
- **Dzień 5**: Konfiguracja CI/CD pipeline (GitHub Actions)

### 7.2. Faza 2: Testy jednostkowe (Tydzień 2)

- **Dzień 1-2**: Testy serwisów (flashcards, generations, openrouter)
- **Dzień 3**: Testy walidacji (Zod schemas)
- **Dzień 4**: Testy hooków React
- **Dzień 5**: Testy funkcji pomocniczych, code review

### 7.3. Faza 3: Testy integracyjne (Tydzień 3)

- **Dzień 1-2**: Testy API endpoints (/api/flashcards, /api/generations)
- **Dzień 3**: Testy autentykacji (/api/auth/\*)
- **Dzień 4**: Testy middleware i RLS policies
- **Dzień 5**: Testy flow: generowanie → akceptacja → zapis

### 7.4. Faza 4: Testy E2E (Tydzień 4)

- **Dzień 1**: Testy autentykacji (rejestracja, logowanie)
- **Dzień 2-3**: Testy generowania fiszek (happy path + edge cases)
- **Dzień 4**: Testy zarządzania fiszkami (listowanie, filtrowanie)
- **Dzień 5**: Testy accessibility i responsywności

### 7.5. Faza 5: Testy bezpieczeństwa i wydajności (Tydzień 5)

- **Dzień 1-2**: Testy bezpieczeństwa (RLS, SQL injection, XSS)
- **Dzień 3**: Testy wydajności (Lighthouse, k6)
- **Dzień 4**: Analiza wyników i optymalizacja
- **Dzień 5**: Finalizacja dokumentacji testowej

### 7.6. Faza 6: Regression testing i raportowanie (Tydzień 6)

- **Dzień 1-2**: Uruchomienie pełnego suite'u testów
- **Dzień 3**: Analiza code coverage i wypełnianie luk
- **Dzień 4**: Regression testing po naprawieniu defektów
- **Dzień 5**: Finalizacja raportów i przekazanie do stakeholders

## 8. Kryteria akceptacji testów

### 8.1. Code Coverage

- **Linie kodu (Lines)**: ≥ 80%
- **Funkcje (Functions)**: ≥ 80%
- **Gałęzie (Branches)**: ≥ 75%
- **Statements**: ≥ 80%

### 8.2. Testy jednostkowe

- ✅ Wszystkie funkcje serwisowe pokryte testami
- ✅ Wszystkie schematy walidacyjne przetestowane (happy path + edge cases)
- ✅ Wszystkie hooki React przetestowane z różnymi scenariuszami

### 8.3. Testy integracyjne

- ✅ Wszystkie endpointy API przetestowane (2xx, 4xx, 5xx)
- ✅ RLS policies zweryfikowane dla każdego użytkownika
- ✅ Flow generowania → akceptacji działa end-to-end

### 8.4. Testy E2E

- ✅ Co najmniej 1 test dla każdego krytycznego user flow
- ✅ Testy przechodzą na 3 przeglądarkach (Chrome, Firefox, Safari)
- ✅ Testy przechodzą na mobile i desktop

### 8.5. Testy bezpieczeństwa

- ✅ Brak możliwości dostępu do danych innych użytkowników
- ✅ Walidacja input'ów zapobiega SQL injection
- ✅ Brak wrażliwych danych w odpowiedziach API

### 8.6. Testy wydajności

- ✅ Lighthouse score: ≥ 90 (Performance)
- ✅ LCP < 2.5s
- ✅ TTI < 3.8s
- ✅ API response time < 1s (dla lokalnych operacji)

### 8.7. Testy accessibility

- ✅ axe-core: 0 critical issues
- ✅ Nawigacja klawiaturą działa dla wszystkich interaktywnych elementów
- ✅ ARIA attributes poprawnie zastosowane

## 9. Role i odpowiedzialności w procesie testowania

### 9.1. QA Engineer (Inżynier Testów)

**Odpowiedzialności**:

- Tworzenie i utrzymanie testów jednostkowych, integracyjnych i E2E
- Konfiguracja narzędzi testowych (Vitest, Playwright)
- Analiza wyników testów i code coverage
- Identyfikacja i dokumentacja defektów
- Współpraca z developerami przy naprawie błędów
- Utrzymanie dokumentacji testowej

### 9.2. Frontend Developer

**Odpowiedzialności**:

- Pisanie testów jednostkowych dla komponentów React
- Testowanie hooków i funkcji pomocniczych
- Implementacja poprawek wynikających z testów
- Code review testów napisanych przez QA
- Zapewnienie accessibility w komponentach

### 9.3. Backend Developer

**Odpowiedzialności**:

- Pisanie testów jednostkowych dla serwisów
- Testowanie walidacji Zod
- Implementacja poprawek w API
- Zapewnienie bezpieczeństwa (RLS policies)
- Współpraca z QA przy testach integracyjnych

### 9.4. DevOps Engineer

**Odpowiedzialności**:

- Konfiguracja CI/CD pipeline dla automatycznych testów
- Setup środowiska testowego (Supabase test instance)
- Monitoring wydajności w staging
- Deployment do środowiska staging
- Automatyzacja raportowania (np. Codecov)

### 9.5. Product Owner

**Odpowiedzialności**:

- Akceptacja kryteriów testów
- Priorytetyzacja naprawy defektów
- Decyzje o gotowości do release'u
- Feedback na temat user flow w testach E2E

### 9.6. Tech Lead

**Odpowiedzialności**:

- Architektura strategii testowej
- Code review kompleksowych testów
- Decyzje o threshold'ach code coverage
- Mentoring zespołu w zakresie best practices testowania
- Eskalacja blokujących defektów

## 10. Procedury raportowania błędów

### 10.1. Szablon zgłoszenia błędu

```markdown
# BUG-{ID}: {Tytuł błędu}

## Priorytet

[ ] Krytyczny (blocker)
[ ] Wysoki (major)
[ ] Średni (minor)
[ ] Niski (trivial)

## Severity

[ ] Krytyczny (aplikacja nie działa)
[ ] Wysoki (kluczowa funkcjonalność nie działa)
[ ] Średni (funkcjonalność częściowo nie działa)
[ ] Niski (kosmetyczny lub edge case)

## Środowisko

- **OS**: Windows 10 / macOS / Linux
- **Przeglądarka**: Chrome 120 / Firefox 121 / Safari 17
- **Node.js**: v22.14.0
- **Branch**: main / develop / feature/xyz

## Kroki reprodukcji

1. Przejdź do ...
2. Kliknij ...
3. Wprowadź ...
4. Zaobserwuj ...

## Oczekiwany rezultat

Opisz, co powinno się stać.

## Aktualny rezultat

Opisz, co się faktycznie stało.

## Screenshoty/Video

(załącz screenshoty lub recording jeśli to możliwe)

## Logi/Błędy konsoli
```

(wklej relevantne logi z console lub serwera)

```

## Dodatkowe informacje
- Czy błąd jest powtarzalny? Tak / Nie
- Czy występuje tylko w określonych warunkach?
- Czy istnieje workaround?

## Przypisanie
- **Znalezione przez**: {Imię QA}
- **Data znalezienia**: {YYYY-MM-DD}
- **Przypisane do**: {Imię Developer}
```

### 10.2. Klasyfikacja priorytetów

#### Krytyczny (P0)

- Aplikacja nie uruchamia się
- Utrata danych użytkownika
- Luka bezpieczeństwa (RLS bypass)
- **SLA**: Naprawa w ciągu 24h

#### Wysoki (P1)

- Kluczowa funkcjonalność nie działa (np. generowanie fiszek)
- Brak możliwości zalogowania
- API zwraca 500 dla poprawnych requestów
- **SLA**: Naprawa w ciągu 3 dni roboczych

#### Średni (P2)

- Funkcjonalność działa częściowo
- Błędy walidacji nie są wyświetlane
- Problemy z responsywnością
- **SLA**: Naprawa w ciągu 1 tygodnia

#### Niski (P3)

- Błędy kosmetyczne (CSS)
- Typo w tekstach
- Minor UX issues
- **SLA**: Naprawa w następnym sprincie

### 10.3. Workflow zgłoszenia

```
Znaleziono błąd
    ↓
Weryfikacja (czy to faktyczny bug?)
    ↓
Stworzenie ticket'u (GitHub Issues / Jira)
    ↓
Przypisanie priorytetu i severity
    ↓
Przypisanie do odpowiedniego developera
    ↓
Developer implementuje fix
    ↓
Code review + merge
    ↓
QA weryfikuje poprawkę (regression test)
    ↓
Zamknięcie ticket'u
```

### 10.4. Narzędzia do śledzenia błędów

#### GitHub Issues (rekomendowane dla MVP)

- **Labels**: `bug`, `P0-critical`, `P1-high`, `P2-medium`, `P3-low`
- **Assignees**: Developer odpowiedzialny za naprawę
- **Milestones**: Sprint 1, Sprint 2, MVP Release
- **Projects**: Kanban board (To Do, In Progress, In Review, Done)

#### Jira (opcjonalnie dla większych projektów)

- **Issue Type**: Bug
- **Priority**: Blocker, Critical, Major, Minor, Trivial
- **Custom Fields**: Środowisko, Kroki reprodukcji, Screenshoty
- **Workflow**: Open → In Progress → Code Review → Testing → Done

### 10.5. Metryki jakości

#### KPI do monitorowania

- **Defect Density**: liczba defektów / 1000 linii kodu (target: < 2)
- **Defect Leakage**: % defektów znalezionych w produkcji (target: < 5%)
- **Test Pass Rate**: % testów przechodzących (target: > 95%)
- **Code Coverage**: % pokrycia testami (target: > 80%)
- **Mean Time To Resolve (MTTR)**: średni czas naprawy defektu (target: < 3 dni dla P1)
- **Regression Rate**: % defektów powracających (target: < 2%)

#### Raportowanie tygodniowe

```markdown
## Test Report - Tydzień {X}

### Podsumowanie

- Testy wykonane: 150
- Testy przeszły: 145 (96.7%)
- Testy nie przeszły: 5 (3.3%)
- Nowe defekty: 3
- Naprawione defekty: 7
- Pozostałe defekty: 12

### Defekty wg priorytetu

- P0: 0
- P1: 2
- P2: 7
- P3: 3

### Code Coverage

- Lines: 82% (+2% od poprzedniego tygodnia)
- Functions: 85%
- Branches: 78%

### Ryzyka

- {Opis potencjalnego ryzyka 1}
- {Opis potencjalnego ryzyka 2}

### Planowane akcje

- {Akcja 1}
- {Akcja 2}
```

## 11. Automatyzacja testów w CI/CD

### 11.1. GitHub Actions Workflow

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22.14.0"
          cache: "npm"
      - run: npm ci
      - run: npm run lint

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22.14.0"
          cache: "npm"
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:latest
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22.14.0"
          cache: "npm"
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22.14.0"
          cache: "npm"
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  build:
    runs-on: ubuntu-latest
    needs: [lint, unit-tests, integration-tests, e2e-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22.14.0"
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/
```
