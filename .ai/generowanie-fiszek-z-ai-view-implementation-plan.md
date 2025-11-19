# Plan implementacji widoku Generowanie Fiszek z AI

## 1. Przegląd
Widok służy do wklejenia długiego tekstu (1000–10000 znaków), wysłania go do API generowania propozycji fiszek, a następnie przeglądu, edycji, selekcji i masowej akceptacji wybranych propozycji fiszek. Po akceptacji użytkownik może przejść do listy fiszek przefiltrowanej po `generationId`.

## 2. Routing widoku
- Ścieżka: `/`
- Plik strony: `src/pages/index.astro`
- Hydratacja komponentu React: `GenerationPanel` jako wyspa w Astro (`client:load` lub `client:visible`).

## 3. Struktura komponentów
- `src/pages/index.astro`
  - renderuje layout i umieszcza wyspę `GenerationPanel`
- `src/components/generation/GenerationPanel.tsx`
  - orkiestracja logiki i stanu widoku, layout „split view”
  - dzieci:
    - `TextareaWithCounter`
    - `ProposalsToolbar`
    - `ProposalsList`
    - `AcceptActionsBar`
    - `Toast` (portale / provider)
    - `Skeleton` (placeholdery)
- `src/components/generation/TextareaWithCounter.tsx`
- `src/components/generation/ProposalsToolbar.tsx`
- `src/components/generation/ProposalsList.tsx`
- `src/components/generation/ProposalItem.tsx`
- `src/components/generation/AcceptActionsBar.tsx`
- UI (Shadcn/ui lub lekkie odpowiedniki):
  - `src/components/ui/button.tsx` (istnieje)
  - `src/components/ui/card.tsx` (istnieje)
  - `src/components/ui/badge.tsx` (nowy)
  - `src/components/ui/skeleton.tsx` (nowy)
  - `src/components/ui/checkbox.tsx` (nowy, prosty wrapper)
  - `src/components/ui/textarea.tsx` (nowy, prosty wrapper)
  - `src/components/ui/toast.tsx` i `src/components/ui/use-toast.ts` (nowe, lekki system toastów)
- API klient:
  - `src/lib/api/generations.client.ts` (fetch do endpointów)
- Typy widoku:
  - `src/components/generation/types.ts` (ViewModel i lokalne typy UI)

## 4. Szczegóły komponentów
### GenerationPanel
- Opis: Kontener i orkiestrator stanu. Lewy panel: `TextareaWithCounter` + przycisk „Generuj” (z anulowaniem). Prawy panel: `ProposalsToolbar`, `ProposalsList` i `AcceptActionsBar`. Obsługuje cykle `idle → loading → ready`, anulowanie, walidację i wysyłkę do API.
- Główne elementy:
  - Layout siatki/flex (split view na desktopie, stack na mobile)
  - nagłówek z informacjami o modelu i czasie po wygenerowaniu (Badge)
- Obsługiwane interakcje:
  - `onGenerate(promptText)` (POST `/api/generations` z AbortController)
  - `onCancelGeneration()` (abort)
  - `onEditProposal(id, fields)` (inline edycja)
  - `onToggleSelect(id)` / `onToggleSelectAll()`
  - `onSaveAll()` / `onSaveSelected()` (POST `/api/generations/{id}/accept`)
- Obsługiwana walidacja:
  - `promptText` długość 1000–10000 (blokuje przycisk przed valid)
  - `front` 1–200, `back` 1–500 (inline; blokuje akcje zapisu i podświetla błędne elementy)
  - brak częściowego „local commit”: na błąd w akceptacji – wycofanie stanów pending i pokazanie błędów
- Typy: `CreateGenerationCommand`, `CreateGenerationResponse`, `AcceptGenerationProposalsCommand`, `AcceptGenerationProposalsResponse`, `GenerationViewModel`, `ProposalViewModel`
- Propsy: brak (komponent root); komunikacja z API wewnątrz

### TextareaWithCounter
- Opis: Pole wklejania tekstu z licznikiem i walidacją zakresu.
- Główne elementy: `textarea`, licznik znaków, wskaźnik błędu (jeśli <1000 lub >10000)
- Interakcje: `onChange(value)`, `onPaste`
- Walidacja: zakres znaków 1000–10000; sygnalizacja invalid; możliwość przekazania `aria-invalid` i `aria-describedby`
- Typy: `TextareaWithCounterProps { value, onChange, min, max, disabled, error }`
- Propsy: jw.

### ProposalsToolbar
- Opis: Akcje nad listą propozycji: zaznacz/odznacz wszystkie, filtr Edited/All, licznik zaznaczonych.
- Główne elementy: checkbox master, liczniki, przycisk wyczyść edycje
- Interakcje: `onToggleAll(checked)`, `onFilterChange(filter)`, `onClearEdits()`
- Walidacja: brak (logika w rodzicu)
- Typy: `ProposalsFilter = 'all' | 'edited' | 'unedited'`
- Propsy: `{ allSelected, someSelected, selectedCount, totalCount, filter, onToggleAll, onFilterChange, onClearEdits }`

### ProposalsList
- Opis: Lista kart z edytowalnymi polami `front`/`back`, wskaźnik Edited, checkbox selekcji, błędy inline.
- Główne elementy: grid/lista `Card`; wiersze `ProposalItem`
- Interakcje: deleguje do `ProposalItem`
- Walidacja: wyróżnia elementy z błędami i/lub disabled przy zapisie
- Typy: `{ items: ProposalViewModel[], onEdit, onToggleSelect }`
- Propsy: jw.

### ProposalItem
- Osobna karta jednej propozycji: edytowalne `input/textarea` dla `front`/`back`, checkbox, Badge „Edited”, błędy pod polami.
- Interakcje: `onEdit({front?, back?})`, `onToggleSelect(checked)`
- Walidacja: `front` 1–200, `back` 1–500; natychmiastowa (onChange) z komunikatem
- Typy: `{ item: ProposalViewModel, onEdit, onToggleSelect }`
- Propsy: jw.

### AcceptActionsBar
- Opis: Pasek akcji zapisu na dole prawego panelu (sticky/fixed w obrębie panelu).
- Główne elementy: przyciski „Zapisz wszystkie”, „Zapisz zatwierdzone”, licznik zaznaczonych, pomocnicze CTA po sukcesie (link do `/flashcards?generationId=...`).
- Interakcje: `onSaveAll()`, `onSaveSelected()`, na sukces pokazuje toast + CTA link
- Walidacja: blokada przycisków gdy brak valid pozycji lub brak zaznaczonych (dla „Zapisz zatwierdzone”)
- Typy: `{ selectedCount, totalCount, disabled, onSaveAll, onSaveSelected, ctaHref? }`
- Propsy: jw.

### Badge / Toast / Skeleton / Checkbox / Textarea (UI)
- Lekkie komponenty UI Shadcn-styled z Tailwind 4; bez zewnętrznych zależności runtime.
- Propsy: standardowe (className, children), dostępność: role/aria zgodnie z funkcją.

## 5. Typy
- DTO (z `src/types.ts`):
  - `CreateGenerationCommand { promptText: string }`
  - `CreateGenerationResponse { generation: GenerationSummaryDTO, proposals: {front, back}[] }`
  - `AcceptGenerationProposalsCommand { flashcards: { front: string; back: string; edited: boolean }[] }`
  - `AcceptGenerationProposalsResponse { created: FlashcardDTO[], generation: GenerationSummaryDTO }`
- ViewModel (nowe, `src/components/generation/types.ts`):
  - `ProposalId = string` (np. `"p-<index>"` dla stabilnej identyfikacji UI)
  - `FieldError = { message: string }`
  - `ProposalViewModel = {
      id: ProposalId;
      front: string;
      back: string;
      edited: boolean;        // true gdy front/back zmienione względem oryginału
      selected: boolean;      // stan selekcji
      errors?: { front?: FieldError; back?: FieldError };
    }`
  - `GenerationMeta = {
      id: number;
      model: string;
      generationDuration: number; // ms
      totalCount: number;
    }`
  - `GenerationViewModel = {
      status: 'idle' | 'loading' | 'ready' | 'error';
      promptText: string;
      meta?: GenerationMeta;
      proposals: ProposalViewModel[];
      filter: 'all' | 'edited' | 'unedited';
      pendingAction?: 'generate' | 'accept-all' | 'accept-selected';
      error?: string; // błąd globalny
    }`

## 6. Zarządzanie stanem
- Lokalny stan w `GenerationPanel` (React 19) z wydzieleniem pomocniczych hooków:
  - `useAbortableRequest()` – zarządza `AbortController`, zwraca `{ signal, abort, withAbort(fn) }`.
  - `useProposalsState(initial: ProposalViewModel[])` – aktualizacje atomowe elementów, selekcje, walidacja pól, filtry.
- Walidacja frontend:
  - Reużycie schematów z `src/lib/validation/generations.ts` (Zod) jeżeli możliwe w kliencie; alternatywnie lightweight walidacja długości bez zależności.
- Derived state: liczniki zaznaczonych, czy istnieją błędy, czy przyciski powinny być zablokowane.

## 7. Integracja API
- Klient: `src/lib/api/generations.client.ts`
  - `createGeneration(cmd: CreateGenerationCommand, signal?: AbortSignal): Promise<CreateGenerationResponse>`
    - POST `/api/generations`
    - Obsługa statusów: 201 → OK; 4xx/5xx → rzutuje błąd z `message` i `status`.
  - `acceptProposals(id: number, cmd: AcceptGenerationProposalsCommand): Promise<AcceptGenerationProposalsResponse>`
    - POST `/api/generations/{id}/accept`
    - Obsługa statusów: 201 → OK; 400/403/404/409/422/5xx → błąd.
- Nagłówki: `Content-Type: application/json`.
- Błędy mapowane do toastów i/lub inline:
  - 422 (walidacja) → oznacz pola z błędami; globalny toast.
  - 409 (limit) → toast + podpowiedź zmniejszenia selekcji.
  - 5xx → toast ogólny „spróbuj ponownie”.

## 8. Interakcje użytkownika
- Wklejenie/edycja tekstu → licznik aktualizuje się; przycisk „Generuj” aktywny tylko przy 1000–10000 znaków.
- Klik „Generuj” → request (disabled + spinner); można „Anuluj” (abort). Po sukcesie: pokazanie propozycji, badge z modelem i czasem.
- Edycja `front/back` w elementach → automatyczne ustawienie `edited=true`; walidacja i komunikaty inline.
- Zaznacz/odznacz wszystkie → aktualizacja selekcji; filtr Edited/All.
- „Zapisz wszystkie” → wysyła wszystkie valid propozycje; „Zapisz zatwierdzone” → wysyła tylko zaznaczone valid propozycje.
- Sukces akceptacji → toast sukcesu + CTA link do `/flashcards?generationId=<id>`.

## 9. Warunki i walidacja
- Wejście:
  - `promptText.length ∈ [1000, 10000]` – wymóg API (422 w razie naruszenia)
- Propozycje (przed akceptacją):
  - `front.length ∈ [1, 200]`, `back.length ∈ [1, 500]`
  - Zanim aktywujemy przyciski akcji, weryfikujemy, że wybrane pozycje są valid.
- API warunki:
  - `accept` odrzuci > `totalCount` (409) – UI powinno uniemożliwić wysłanie większej liczby niż `meta.totalCount`.
  - Brak częściowego commit – w razie błędu przywrócić stan `pendingAction` do `undefined`, pozostawić edycje i selekcje bez zmian.

## 10. Obsługa błędów
- 400/401/403/404: toast z komunikatem; w razie 404 wyczyścić `meta` i propozycje.
- 409: toast „Przekroczono limit generacji”; utrzymać UI w stanie przed akcją.
- 422: komunikaty pod polami + toast „Błędy walidacji”.
- 5xx/502: toast „Problem po stronie serwera”; umożliwić ponowienie.
- Anulowanie: po `abort` – informacja w pasku (np. badge „Anulowano”), brak toastu błędu.

## 11. Kroki implementacji
1. Strona i wyspa
   - Utwórz/uzupełnij `src/pages/index.astro` (layout, mount `GenerationPanel`).
2. UI bazowe
   - Dodaj `src/components/ui/{badge,checkbox,textarea,skeleton,toast.tsx,use-toast.ts}` zgodnie ze stylem istniejących komponentów.
3. Typy widoku
   - Dodaj `src/components/generation/types.ts` (VM i pomocnicze typy).
4. Klient API
   - Dodaj `src/lib/api/generations.client.ts` z funkcjami `createGeneration` i `acceptProposals` oraz mapowaniem błędów.
5. Komponent kontener
   - Zaimplementuj `src/components/generation/GenerationPanel.tsx`:
     - stan `GenerationViewModel`, integracja z API, AbortController, layout split view, badge modelu/czasu.
6. Komponenty podrzędne
   - `TextareaWithCounter`, `ProposalsToolbar`, `ProposalsList`, `ProposalItem`, `AcceptActionsBar` z opisanymi propsami i walidacją inline.
7. Hooki
   - `useAbortableRequest`, `useProposalsState` (aktualizacje, selekcje, filtry, walidacja).
8. Walidacja
   - Reużyj zod ze `src/lib/validation/generations.ts` lub dodaj lekką walidację długości; zablokuj przyciski akcji, oznacz pola.
9. Toasty i błędy
   - Dodaj provider toastów, standardowe warianty: success/error/info. Zaimplementuj mapowanie statusów do komunikatów.
10. Skeletony i stany
   - Dodaj `Skeleton` dla listy propozycji w trakcie `loading`; disabled dla elementów podczas `pendingAction`.
11. Testy manualne
   - Scenariusze: długości graniczne (999, 1000, 10000, 10001), edycje i selekcje, anulowanie requestu, błędy 409 i 422, sukces akceptacji i CTA.
