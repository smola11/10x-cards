<conversation_summary>
<decisions>

1. Po zalogowaniu przekierowanie na widok generatora (`/`).
2. Panel propozycji na tej samej stronie co generator (split view); szczegóły układu responsywnego — bez preferencji.
3. Domyślnie wszystkie propozycje zaznaczone; edycja inline ustawia status „Edited”; dostępne „Zaznacz/odznacz wszystkie”, skróty klawiaturowe i walidacja (front 1–200, back 1–500).
4. Zachować „Zapisz wszystkie” oraz „Zapisz zatwierdzone”; jeden POST do `/api/generations/{id}/accept`; błędy 422/409/5xx pokazywać inline + toast; brak częściowego local-commit (rollback w UI).
5. Nie utrzymywać efemerycznego stanu propozycji po odświeżeniu/nawigacji (brak `sessionStorage`).
6. Lista fiszek: `page=1&limit=20&sort=created_at&order=desc`; filtry `origin`, `generationId` w query; tabela z kolumnami: Front, Back, Origin (badge), Generation (link), CreatedAt, Actions; paginacja i selektory filtrów.
7. Edycja zapisanych fiszek w row‑expander (inline); usuwanie z potwierdzeniem w `Dialog`; optymistyczne aktualizacje z rollbackiem; blokada akcji podczas requestów.
8. Brak widoku historii generacji na teraz.
9. Mapowanie błędów API: 400/422 inline + toast; 401 wyloguj i redirect; 403 komunikat o braku uprawnień; 404 „nie znaleziono”; 409 konflikt; 429 respektuj `Retry-After`; 5xx toast + ponów; skeletony/spinnery w stanach ładowania.
10. Zarządzanie stanem: React hooks + React Context; ewentualny Zustand później; JWT wdrażane później.
    </decisions>
    <matched_recommendations>
11. Ochrona tras i redirect po 401 do `/auth/login?redirectTo=<current>`; po logowaniu redirect do `/`.
12. Generator w układzie split view (desktop), z przełączeniem na zakładki na mobile; przycisk „Generuj” blokowany podczas requestu; licznik znaków 1000–10000.
13. Edycja propozycji inline z automatycznym „Edited”; kontrolki „Zaznacz/odznacz wszystkie” i skróty; walidacja długości pól.
14. Masowa akceptacja jednym POST; błędy per‑pozycja inline + toast; pełny rollback UI w razie błędu.
15. Brak trwałości efemerycznych propozycji; utrata po odświeżeniu akceptowalna.
16. Lista fiszek oparta o parametry w URL; paginacja, filtry, sort; skeletony i stany pustej listy.
17. Edycja/DELETE inline z dialogiem potwierdzenia.
18. Warstwa `apiClient` na `fetch` z obsługą 401/422/429 i `AbortController`.
19. Dostępność: pełna obsługa klawiatury, focus ringi, `aria-live` dla toastów, kontrast WCAG AA.
20. Bezpieczeństwo: przygotowanie pod JWT i strażnik tras; brak przechowywania wrażliwych danych w kliencie.
    </matched_recommendations>
    <ui_architecture_planning_summary>

- Główne wymagania:
  - Logowanie i redirect do generatora.
  - Generator AI: wklejanie tekstu (1000–10000), recenzja propozycji, edycja inline, masowa akceptacja („Zapisz wszystkie”/„Zapisz zatwierdzone”).
  - Lista „Moje fiszki” z paginacją, filtrami `origin`/`generationId`, edycją i usuwaniem.
  - Brak historii generacji i sesji nauki na teraz. JWT wdrożone później.

- Kluczowe widoki i przepływy:
  - Auth: `/auth/login` → po sukcesie redirect na `/`.
  - Generator `/`: textarea + „Generuj” (POST `/api/generations`), panel propozycji obok; edycja inline, selekcja, walidacja; zapis (POST `/api/generations/{id}/accept`); po sukcesie powrót/CTA do `/flashcards?generationId=<id>`.
  - Flashcards `/flashcards`: GET lista z `page/limit/sort/order/origin/generationId`; wiersze z badge `ai-full/ai-edited/manual`; akcje: edytuj (PATCH), usuń (DELETE) z dialogiem.
- Integracja z API i stan:
  - `fetch` + lekki `apiClient` z interceptorami (401 → logout/redirect; 422 → mapowanie błędów pól; 429 → `Retry-After`).
  - Brak trwałości efemerycznych propozycji; stan tylko w pamięci komponentów/kontekstu podczas bieżącej sesji strony.
  - Optimistic UI dla PATCH/DELETE; pełny rollback przy błędach; brak retry dla POST generacji, kontrolowany retry dla GET.
  - Parametry listy zsynchronizowane z URL (nawigacja wstecz współgra ze stanem).

- Responsywność, dostępność, bezpieczeństwo:
  - Responsywność: split view na desktopie; na mobile przełączanie zakładkami pomiędzy „Wejście” i „Propozycje”.
  - A11y: nawigacja klawiaturą po liście propozycji i tabeli; widoczne focusy; komunikaty walidacji przy polach; `aria-live` dla toastów.
  - Bezpieczeństwo: strażnik tras i obsługa 401; przygotowanie na JWT; brak przechowywania propozycji poza pamięcią przeglądarki bieżącej strony.

- Wzorce UI i komponenty:
  - shadcn/ui: `Textarea`, `Button`, `Badge`, `Card`, `Dialog`, `Table`, `Pagination`, `Select`, `Toast`.
  - Własne: `GenerationPanel`, `ProposalsList` (inline edit + select), `FlashcardsTable` (row‑expander), `DeleteConfirmDialog`.
    </ui_architecture_planning_summary>
    <unresolved_issues>

1. Dokładne zachowanie split view na różnych szerokościach (proporcje, breakpointy; czy na mobile użyć zakładek czy akordeonu).
2. Czy ostrzegać dialogiem przy próbie opuszczenia strony z niezapisanymi zmianami w propozycjach (mimo braku trwałości).
3. Szczegóły skrótów klawiaturowych (zaznaczanie, edycja, zapisz).
4. Format komunikatów błędów (język/ton, lokalizacja, agregacja błędów masowych).
5. Docelowe sortowania dodatkowe w liście fiszek (poza `created_at`) i ich dostępność w API.
6. Strategia sesji użytkownika do czasu wdrożenia JWT (tymczasowy guard oparty o stub czy całkowicie otwarte trasy).
   </unresolved_issues>
   </conversation_summary>
