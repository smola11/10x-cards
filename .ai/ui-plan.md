# Architektura UI dla 10x-cards

## 1. Przegląd struktury UI

- **Główne widoki**: Logowanie (`/auth/login`), Generator AI (`/`), Moje fiszki (`/flashcards`).
- **Ochrona tras**: guard sprawdzający sesję; `401` → wylogowanie i redirect do `/auth/login?redirectTo=<current>`; po logowaniu redirect do `/`.
- **Integracja z API**: zgodna z planem REST (generations, accept, flashcards CRUD, auth). Wszystkie operacje uwierzytelnione (Bearer JWT – przygotowane w kliencie).
- **Stan aplikacji**: React hooks + Context.
  - Efemeryczne propozycje tylko w pamięci (brak utrwalenia po refreshu).
  - Optimistic UI dla `PATCH/DELETE` na fiszkach z rollbackiem; brak optimistic dla `POST /generations` ani `accept`.
- **Responsywność**:
  - Desktop: split view (wejście po lewej, propozycje po prawej).
- **Dostępność (a11y)**: pełna obsługa klawiatury, widoczne focus ringi, `aria-live` dla toastów, prawidłowe role dla tabel, dialogów i przycisków.
- **Mapowanie błędów**:
  - `400/422` – komunikaty inline przy polach + toast.
  - `401` – wyloguj i redirect.
  - `403` – komunikat o braku uprawnień.
  - `404` – komunikat „nie znaleziono”.
  - `409` – konflikt (np. limit akceptacji).
  - `429` – respektuj `Retry-After` i komunikuj blokadę.
  - `5xx/502` – toast + opcja ponowienia.
- **Bezpieczeństwo**: brak przechowywania wrażliwych danych w kliencie poza pamięcią procesu; brak local/sessionStorage dla propozycji; nagłówki i CORS po stronie serwera.

## 2. Lista widoków

### Widok: Logowanie

- **Ścieżka widoku**: `/auth/login`
- **Główny cel**: Uwierzytelnienie użytkownika i przekierowanie do generatora.
- **Kluczowe informacje do wyświetlenia**:
  - Formularz: e‑mail, hasło.
  - Komunikaty walidacji i błędów (np. błędne poświadczenia).
- **Kluczowe komponenty widoku**: `AuthForm`, `Button`, `Input`, `Card`, `Toast`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Walidacja wstępna po stronie klienta; czytelne błędy.
  - Blokada przycisku podczas requestu, wskaźnik ładowania.
  - Po sukcesie redirect do `redirectTo` lub `/`.
  - Nie wyświetlać szczegółów błędów serwera; minimalizować ujawnianie informacji.
  - Ochrona przed autofill injection; właściwe atrybuty `autocomplete`.
- **Powiązane endpointy API**: Supabase Auth w warstwie klienta.

### Widok: Generowanie Fiszek z AI

- **Ścieżka widoku**: `/`
- **Główny cel**: Wklejenie tekstu (1000–10000 znaków), wygenerowanie propozycji fiszek, przegląd/edycja/selekcja i masowa akceptacja.
- **Kluczowe informacje do wyświetlenia**:
  - Pole tekstowe z licznikiem znaków 1000–10000.
  - Panel propozycji: lista pozycji z polami `front` (1–200) i `back` (1–500), stan „Edited”, checkbox wyboru.
  - Akcje: „Zaznacz/odznacz wszystkie”, „Zapisz wszystkie”, „Zapisz zatwierdzone”.
  - Informacje o modelu i czasie generacji (z odpowiedzi API).
- **Kluczowe komponenty widoku**: `GenerationPanel`, `TextareaWithCounter`, `ProposalsList`, `ProposalItem` (inline edit + selekcja), `ProposalsToolbar`, `AcceptActionsBar`, `Badge`, `Toast`, `Skeleton`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Split view na desktopie.
  - Przycisk „Generuj” zablokowany podczas requestu; `AbortController` dla anulowania.
  - Walidacja długości pól inline; automatyczne oznaczanie „Edited” przy modyfikacji.
  - Błędy `422/409/5xx` pokazywane inline per pozycja + toast; brak częściowego „local commit” – pełny rollback UI.
  - CTA po sukcesie: link do `/flashcards?generationId=<id>`.
- **Powiązane endpointy API**:
  - `POST /api/generations` (tworzenie generacji i pobranie propozycji).
  - `POST /api/generations/{id}/accept` (akceptacja wybranych propozycji jako fiszki).

### Widok: Moje fiszki

- **Ścieżka widoku**: `/flashcards` (+ query: `page`, `limit`, `sort`, `order`, `origin`, `generationId`)
- **Główny cel**: Przeglądanie, filtrowanie, edycja inline i usuwanie zapisanych fiszek; ręczne dodawanie fiszki.
- **Kluczowe informacje do wyświetlenia**:
  - Tabela: kolumny Front, Back, Origin (badge), Generation (link), CreatedAt, Actions.
  - Filtry: `origin`, `generationId`; paginacja i sortowanie.
  - Stany: pusta lista, skeletony, błędy.
- **Kluczowe komponenty widoku**: `FlashcardsTable`, `RowExpanderEditor` (inline edit), `DeleteConfirmDialog`, `FiltersBar`, `Pagination`, `Badge`, `Toast`, `EmptyState`, `AddFlashcardDialog`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Edycja wiersza inline, blokada akcji podczas requestów, optimistic update z rollbackiem.
  - Usuwanie z potwierdzeniem w `Dialog`.
  - Synchronizacja parametrów listy z URL (back/forward działa intuicyjnie).
  - Link do generacji w kolumnie Generation (gdy funkcjonalność historii będzie dostępna – na razie link do filtrowania po `generationId`).
- **Powiązane endpointy API**:
  - `GET /api/flashcards` (lista z paginacją i filtrami).
  - `PATCH /api/flashcards/{id}` (edycja front/back).
  - `DELETE /api/flashcards/{id}` (usuwanie).
  - `POST /api/flashcards` (ręczne tworzenie).

### Widok: Szczegóły fiszki (opcjonalnie, pod deeplink)

- **Ścieżka widoku**: `/flashcards/:id`
- **Główny cel**: Podgląd/edytowanie jednej fiszki pod bezpośrednim linkiem (opcjonalne; alternatywa dla edycji inline).
- **Powiązane endpointy API**: `GET /api/flashcards/{id}`, `PATCH /api/flashcards/{id}`, `DELETE /api/flashcards/{id}`.

### Widoki systemowe

- **401**: wylogowanie + redirect do `/auth/login?redirectTo=<current>`.
- **403/404**: czytelny komunikat na stronie + przycisk powrotu.

### Widoki przyszłe (zgodne z PRD/API, poza MVP bieżącej iteracji)

- Historia generacji (`/generations` i `/generations/:id`).
- Sesja nauki (`/study`), endpointy `POST /api/study/session`, `POST /api/study/{sessionId}/review`.
- Statystyki (`/stats`), endpointy `GET /api/stats/generations`, `GET /api/stats/flashcards`.

## 3. Mapa podróży użytkownika

### Główny przepływ: Generowanie i akceptacja fiszek

1. Użytkownik trafia na `/auth/login` (jeśli brak sesji) i loguje się.
2. Redirect do `/`. Użytkownik wkleja tekst (1000–10000), widzi licznik znaków.
3. Klik „Generuj” → `POST /api/generations` → skeleton/loading; po sukcesie pojawia się panel propozycji z zaznaczonymi wszystkimi pozycjami.
4. Przegląd, edycja inline (ustawienie „Edited”), odznaczanie niechcianych propozycji; walidacje długości pól.
5. Klik „Zapisz zatwierdzone” lub „Zapisz wszystkie” → `POST /api/generations/{id}/accept`.
   - Błędy per‑pozycja: inline + toast; w razie błędu – pełny rollback UI.
6. Po sukcesie CTA/link do `/flashcards?generationId=<id>`; użytkownik przegląda nowo dodane fiszki.

### Przepływ: Ręczne tworzenie fiszki

1. Użytkownik wchodzi na `/flashcards`.
2. Klik „Dodaj fiszkę” → dialog z polami `front` (1–200) i `back` (1–500).
3. Submit → `POST /api/flashcards` → po sukcesie odświeżenie listy/optimistic insert; błędy 422 inline + toast.

### Przepływ: Edycja/Usuwanie fiszki

1. Na `/flashcards` użytkownik rozwija wiersz (row‑expander) i edytuje pola.
2. Zapis → `PATCH /api/flashcards/{id}` (optimistic, z rollbackiem przy błędzie).
3. Usuwanie → `DeleteConfirmDialog` → `DELETE /api/flashcards/{id}` (optimistic, z rollbackiem, toast).

### Obsługa błędów i stanów

- `401`: natychmiastowy logout i redirect do logowania z `redirectTo`.
- `429`: komunikat o limicie i timer wg `Retry-After`.
- `5xx/502`: toast i oferta ponowienia.
- Puste listy: „Brak fiszek” z linkiem do generatora lub dodania ręcznego.

### Mapowanie historyjek użytkownika (PRD → UI)

- **US‑001/US‑002**: Logowanie i dostęp – widok Logowanie + guard i redirect.
- **US‑003**: Generowanie fiszek – widok Generator AI, `POST /api/generations`.
- **US‑004**: Przegląd/akceptacja – panel propozycji + `POST /api/generations/{id}/accept`.
- **US‑005**: Edycja fiszek – `/flashcards` row‑expander + `PATCH /api/flashcards/{id}`.
- **US‑006**: Usuwanie fiszek – `/flashcards` + `DELETE /api/flashcards/{id}`.
- **US‑007**: Ręczne tworzenie – `/flashcards` + `POST /api/flashcards`.
- **US‑008**: Sesja nauki – planowany widok `/study` (poza bieżącym zakresem).
- **US‑009**: Bezpieczny dostęp – guard tras + RLS po stronie serwera.

## 4. Układ i struktura nawigacji

- **Layout główny**: stały nagłówek z nawigacją i obszarem treści.
  - Logo/nazwa aplikacji (link do `/`).
  - Linki: „Generator” (`/`), „Moje fiszki” (`/flashcards`), „Zaloguj/Wyloguj”.
- **Wewnątrz Generatora**:
  - Desktop: dwukolumnowy split (tekst wejściowy | propozycje).
- **Synchronizacja stanu z URL**: `/flashcards` używa query params do paginacji, sortu i filtrów; nawigacja wstecz zachowuje stan.
- **Strażnik tras**: przed renderem widoków chronionych sprawdza sesję; brak sesji → redirect do logowania.

## 5. Kluczowe komponenty

- **AppShell/Layout**: wspólny układ, nagłówek, kontener treści.
- **NavBar**: linki do głównych widoków, stan uwierzytelnienia, przycisk wylogowania.
- **RouteGuard**: ochrona tras, obsługa `401` i redirectów.
- **ToastSystem**: `aria-live` dla komunikatów, mapowanie błędów API.
- **AuthForm**: formularz logowania z walidacją i stanami ładowania/błędów.
- **TextareaWithCounter**: pole wejściowe z licznikiem 1000–10000 znaków.
- **GenerationPanel**: wrapper logiki generowania (ładowanie, błędy, CTA).
- **ProposalsList**: wirtualizowana lista propozycji z selekcją i walidacją.
- **ProposalItem**: edycja inline (front/back), znacznik „Edited”, checkbox.
- **ProposalsToolbar**: „Zaznacz/odznacz wszystkie”, licznik zaznaczonych, skróty klawiaturowe.
- **AcceptActionsBar**: „Zapisz wszystkie” / „Zapisz zatwierdzone”, blokady podczas requestu.
- **FlashcardsTable**: tabela z sortem, paginacją, stanami pustymi i skeletonami.
- **RowExpanderEditor**: edycja `front/back` w wierszu, optimistic update z rollbackiem.
- **FiltersBar**: filtry `origin`, `generationId`, reset filtrów.
- **Pagination**: kontrolki paginacji, informacja o stronach i pozycjach.
- **Badge**: oznaczenia `origin` (`manual`, `ai-full`, `ai-edited`).
- **DeleteConfirmDialog**: potwierdzenie usunięcia; blokada podczas requestu.
- **AddFlashcardDialog**: ręczne dodawanie fiszek z walidacją pól.
- **KeyboardShortcuts**: skróty dla generatora (zaznaczanie, edycja, zapisz), z opisem i możliwością wyłączenia.
