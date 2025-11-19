<!-- b542eb63-6bcc-43db-b138-057774f967b6 16823e41-d9a2-471a-aade-2826c3a4dbe4 -->
# Specyfikacja modułu autentykacji (Supabase Auth + Astro)

## Kontekst i założenia

- Zgodność z PRD: US-001 (Rejestracja), US-002 (Logowanie), US-009 (Bezpieczny dostęp i autoryzacja).
- Tech stack: Astro 5 (SSR, Node adapter), React 19 (formularze interaktywne), TypeScript 5, Tailwind 4, Shadcn/ui, Supabase Auth.
- Obecny stan:
- `src/middleware/index.ts` wstrzykuje `context.locals.supabase`, ale używa klienta przeglądarkowego (bez cookie-aware SSR).
- API (`src/pages/api/flashcards.ts`, `src/pages/api/generations.ts`) ma fallback na `DEFAULT_USER_ID` (bypass auth w DEV).
- Widok główny `/` renderuje `GenerationPanel` bez bramkowania.
- Cel: dodać pełny moduł auth bez łamania istniejących ścieżek; w DEV utrzymać opcjonalny bypass; w PROD egzekwować auth.
- Po akceptacji specyfikacja zostanie zapisana do pliku `.ai/auth-spec.md`.

## 1) Architektura interfejsu użytkownika

### Struktura stron (Astro)

- `src/pages/auth/login.astro`
- Zawiera `LoginForm` (React, `client:idle`).
- Obsługa `redirect` w query (np. po udanym logowaniu przejście do `/` lub wskazanej ścieżki).
- `src/pages/auth/register.astro`
- Zawiera `RegisterForm` (React, `client:idle`).
- Po udanej rejestracji — automatyczne zalogowanie i redirect do `/` (zgodnie z PRD). W MVP potwierdzenie email w Supabase jest wyłączone, aby zapewnić natychmiastową sesję.
- `src/pages/auth/forgot-password.astro`
- Zawiera `ForgotPasswordForm` (React, `client:idle`) do wysłania maila resetującego.
- `src/pages/auth/reset-password.astro`
- SSR sprawdza obecność tokenu (`access_token`/`type=recovery`) w URL po kliknięciu w mailu.
- Renderuje `ResetPasswordForm` (React) do ustawienia nowego hasła.

### Modyfikacje layoutu

- `src/layouts/Layout.astro`
- Dodanie górnego paska nawigacji z kontekstem sesji:
- Gdy brak sesji: przyciski `Zaloguj`/`Rejestracja` (linki do odpowiednich stron).
- Gdy jest sesja: avatar (Shadcn `avatar.tsx`) + menu (profil w przyszłości), `Wyloguj` (wywołuje `POST /api/auth/logout`).
- SSR pobiera `session` z `Astro.locals.session` (ustawiane w middleware) i renderuje stan warunkowo (bez migotania UI).

### Komponenty React (formularze)

- `src/components/auth/LoginForm.tsx`
- Pola: email, hasło, „Pokaż hasło”, link do „Nie pamiętam hasła”.
- Walidacja po stronie klienta (Zod) + mapa błędów z Supabase do przyjaznych komunikatów.
- Po sukcesie: toast sukcesu + `window.location.assign(redirect || "/")`.
- `src/components/auth/RegisterForm.tsx`
- Pola: email, hasło, potwierdzenie hasła.
- Walidacja: poprawny email, zgodność haseł, siła hasła.
- Po sukcesie: auto-login (jeśli Supabase zwraca sesję) i redirect do `/` lub komunikat o sprawdzeniu poczty (zależnie od konfiguracji potwierdzenia email).
- `src/components/auth/ForgotPasswordForm.tsx`
- Pole: email. Po sukcesie: komunikat o wysłaniu maila.
- `src/components/auth/ResetPasswordForm.tsx`
- Pola: nowe hasło, potwierdzenie. Po sukcesie: komunikat + redirect do `/auth/login`.

- Wykorzystanie istniejących Shadcn/ui: `button`, `card`, `checkbox`, `toast` oraz dodanie brakujących UI:
- Nowe: `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, ewentualnie prosty `form-field` wrapper.

### Rozdzielenie odpowiedzialności (Astro vs React)

- Astro strony odpowiadają za SSR, routing, redirect i dostęp do `locals.session`.
- React formularze odpowiadają za interakcję, walidację UI/UX, wywołania Supabase Auth w przeglądarce.
- Po udanych akcjach auth, React wykonuje pełny redirect (zachowanie prostoty i zgodności SSR/CSR).

### Walidacje i komunikaty błędów

- Klient (Zod): email (format), hasło (długość, siła), potwierdzenie hasła (równość), wymagane pola.
- Serwer (Supabase): przechwytywanie `AuthApiError` i mapowanie:
- `Invalid login credentials` → „Nieprawidłowy email lub hasło.”
- `User already registered` → „Konto z tym emailem już istnieje.”
- `Password should be at least ...` → „Hasło zbyt słabe.”
- Brak/wygaśnięcie tokenu resetu → „Link do resetu wygasł — poproś o nowy.”
- UI: błędy inline pod polami, topper alert dla błędów globalnych, toast dla sukcesów.

### Scenariusze kluczowe

- Logowanie po poprawnych danych → redirect do `/` (PRD US-002).
- Błędne dane logowania → jasny komunikat, bez ujawniania, czy konto istnieje.
- Rejestracja udana → sesja aktywna + redirect do `/`.
- Odzyskiwanie hasła → email wysłany; po kliknięciu linku formularz zmiany hasła.
- Odmowa dostępu do chronionych stron/API → redirect do `/auth/login?redirect=<docelowy>`, status 401/403 dla API.

## 2) Logika backendowa

### Middleware i SSR

- `src/middleware/index.ts` — aktualizacja do klienta SSR Supabase (cookie-aware) z `@supabase/ssr`:
- Tworzy `context.locals.supabase` (typ: `SupabaseClient`) na podstawie cookies.
- Ustawia `context.locals.session` z `supabase.auth.getSession()` dla SSR.
- Odpowiada za bramkowanie ścieżek chronionych (lista ścieżek, patrz Autoryzacja).
- `src/env.d.ts` — augmentacja `App.Locals` o `supabase` i `session` (typy TS) oraz `AuthUser` jeśli potrzebne.

### Endpointy API

- Nowe:
- `src/pages/api/auth/logout.ts` — `POST` (prerender=false): wywołuje `supabase.auth.signOut()`, zwraca 204, ustawia cookies.
- Istniejące (do korekty auth):
- `src/pages/api/flashcards.ts`
- Już używa `supabase.auth.getUser()`; w PROD brak fallbacku; w DEV możliwy fallback do `DEFAULT_USER_ID` (flaga ENV).
- `src/pages/api/generations.ts`
- Zmiana z wymuszonego `DEFAULT_USER_ID` na pobieranie z sesji (jak w `flashcards.ts`).

### Modele danych i typy

- Auth korzysta z wbudowanych tabel Supabase (`auth.users`). Brak zmian w `public` schemacie.
- Ujednolicenie sposobu ustalania `user_id` w insertach/selectach w usługach (`userId` z sesji SSR).
- Typy korzystają z `SupabaseClient` i `Database` już zdefiniowanych (`src/db/database.types.ts`).

### Walidacja wejścia

- API: Zod w istniejących trasach (`generations.ts`, `flashcards.ts`) — bez zmian koncepcyjnych.
- Formularze: Zod w React (mirroring reguł backendu i supabase constraints). 

### Obsługa wyjątków

- Spójne kody HTTP: 400 (zły input), 401 (brak sesji), 403 (zakaz), 422 (walidacja), 500 (błąd wewnętrzny).
- Logowanie serwerowe przez `console.error` z kontekstem (bez danych wrażliwych).
- Dla API auth (logout) — 204 bez ciała.

### SSR i renderowanie (Astro config)

- `output: "server"` i adapter Node — w pełni kompatybilne z SSR Supabase.
- Strony chronione (np. `/`, `/flashcards`) renderowane tylko przy aktywnej sesji; w przeciwnym razie redirect z middleware.

## 3) System autentykacji (Supabase Auth)

### Klient SSR (serwer)

- `@supabase/ssr#createServerClient` w middleware:
- Wstrzykiwanie `get/set/remove` cookies z/na `Astro.cookies`.
- `context.locals.supabase` + `context.locals.session` dla SSR.

### Klient przeglądarkowy

- `src/db/supabase.client.ts` pozostaje dla CSR (React formularze) — `createClient` z anon key.
- Komunikacja formularzy z Supabase:
- Rejestracja: `supabase.auth.signUp({ email, password })`.
- Logowanie: `supabase.auth.signInWithPassword({ email, password })`.
- Reset hasła (krok 1): `supabase.auth.resetPasswordForEmail(email, { redirectTo: <site>/auth/reset-password })`.
- Reset hasła (krok 2): po przyjściu `access_token` — `supabase.auth.updateUser({ password })`.

### Rejestracja, logowanie, wylogowanie, odzyskiwanie

- Rejestracja: auto-login po sukcesie (zgodnie z PRD US-001); w MVP weryfikacja email jest wyłączona, więc sesja powstaje natychmiast.
- Logowanie: po sukcesie redirect do `/` (PRD US-002).
- Wylogowanie: `POST /api/auth/logout` (SSR) + redirect do `/auth/login`.
- Odzyskiwanie hasła: dwustopniowy flow jak wyżej; obsługa wygasłego linku.

### Autoryzacja stron i API

- Chronione ścieżki (będą bramkowane w middleware):
- Strony: `/`, `/flashcards` i inne widoki użytkownika.
- API: `/api/flashcards*`, `/api/generations*`.
- Zachowanie:
- Brak sesji → redirect do `/auth/login?redirect=<docelowy>` (strony) lub 401 (API).
- DEV tryb: opcjonalny bypass (env `AUTH_BYPASS_DEV=true`) utrzymuje `DEFAULT_USER_ID` tylko lokalnie.

### Konfiguracja środowiska

- `.env`:
- `SUPABASE_URL`, `SUPABASE_KEY` (już użyte).
- `AUTH_BYPASS_DEV=true|false` (nowe) — tylko wpływa w `import.meta.env.DEV`.
- W Supabase Dashboard: `Site URL` ustawiony na URL aplikacji; `Redirect URL` dla resetu hasła na `<site>/auth/reset-password`.
 - W Supabase Dashboard (MVP): wyłączone potwierdzanie adresu email przy rejestracji, aby umożliwić auto-login zgodnie z PRD.

## Zmiany w istniejącym kodzie (wyszczególnienie)

- `src/middleware/index.ts`: migrować na SSR klienta Supabase, dodać `locals.session`, bramkowanie ścieżek.
- `src/env.d.ts`: augmentacja `App.Locals`.
- `src/layouts/Layout.astro`: pasek nawigacji zależny od sesji, akcja wylogowania.
- `src/pages/index.astro`: bez zmian UI; wymaga sesji (egzekwowane w middleware).
- `src/pages/api/generations.ts`: pobieranie `userId` z sesji (analogicznie do `flashcards.ts`).
- `src/pages/api/flashcards.ts`: zachować obecną logikę; wyłączyć fallback w PROD.
- Nowe pliki:
- `src/pages/auth/login.astro`, `register.astro`, `forgot-password.astro`, `reset-password.astro`.
- `src/components/auth/LoginForm.tsx`, `RegisterForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`.
- `src/pages/api/auth/logout.ts`.
- `src/components/ui/input.tsx`, `label.tsx` (jeśli będziemy spójni z Shadcn/ui).

## Kontrakty (bez implementacji)

- `POST /api/auth/logout`
- Request: brak ciała.
- Response: 204 No Content.
- Błędy: 500 (gdy Supabase signOut zgłosi błąd), JSON { error }.
- Autoryzacja API (`/api/flashcards`, `/api/generations`)
- Brak sesji → 401 { error: "Unauthorized" }.
- Dane użytkownika rozpoznawane z `supabase.auth.getUser()` (SSR klient w middleware zapewnia cookies).

## Bezpieczeństwo i zgodność (US-009)

- Dostęp do fiszek wyłącznie dla zalogowanego użytkownika (PK `user_id` egzekwowany w zapytaniach i politykach RLS — do rozważenia w kolejnych iteracjach, obecnie polityki wyłączone w migracji, ale architektura jest kompatybilna).
- Hasła nie trafiają do logów; błędy logujemy bez wrażliwych danych.
- Reset hasła wyłącznie przez link email; token nie jest eksponowany poza URL i przepływem Supabase.
- RODO: możliwość usunięcia konta w przyszłości (out of scope MVP); brak udostępniania danych.

## Wpływ na istniejące funkcje

- Widok `/` pozostaje bez zmian wizualnie; wymaga sesji.
- API generowania i fiszek: w PROD wymagają sesji; w DEV opcjonalny bypass zachowany.
- Brak zmian w modelach `public.flashcards`/`public.generations`.

---
Po akceptacji: zapiszę specyfikację do pliku `.ai/auth-spec.md` i przygotuję minimalne szkielety stron i komponentów bez wprowadzania zmian łamiących istniejące funkcje.