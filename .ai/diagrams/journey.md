<user_journey_analysis>
- Ścieżki użytkownika (wg PRD i specyfikacji):
  - Rejestracja konta (US-001) z automatycznym zalogowaniem i przejściem do strony głównej.
  - Logowanie (US-002) z przekierowaniem do strony głównej po sukcesie.
  - Odzyskiwanie hasła: wysłanie maila resetującego → wejście z linku → ustawienie nowego hasła.
  - Dostęp do obszarów chronionych (US-009): niezalogowany → przekierowanie do logowania; zalogowany → dostęp do funkcji (generowanie fiszek, moje fiszki, sesja nauki).
  - Wylogowanie z głównego layoutu i powrót do logowania.

- Główne podróże i stany:
  - Niezalogowany: Strona logowania, Strona rejestracji, Odzyskiwanie hasła.
  - Zalogowany: Strona główna (generowanie), Moje fiszki, Sesja nauki, Wylogowanie.
  - Przejścia: próba wejścia w obszar chroniony, sukces/porażka logowania/rejestracji, poprawny/niepoprawny token resetu, wylogowanie.

- Punkty decyzyjne i alternatywne ścieżki:
  - Logowanie: poprawne vs błędne dane.
  - Rejestracja: udana (MVP bez potwierdzenia email) vs błąd (np. email zajęty, słabe hasło).
  - Reset hasła: token poprawny vs token błędny/wygasły.
  - Dostęp do chronionych zasobów: zalogowany vs niezalogowany (redirect do logowania z parametrem redirect).

- Cel stanów (krótkie opisy):
  - StronaLogowania: umożliwia uwierzytelnienie użytkownika.
  - StronaRejestracji: tworzy konto i (w MVP) loguje automatycznie.
  - OdzyskiwanieHasla: inicjuje i finalizuje reset hasła.
  - StronaGlowna/Zalogowany: dostęp do kluczowych funkcji aplikacji.
  - MojeFiszki/SesjaNauki: zarządzanie i nauka fiszek użytkownika.
  - Wylogowanie: kończy sesję i wraca do logowania.
</user_journey_analysis>

<mermaid_diagram>

```mermaid
stateDiagram-v2

[*] --> Wejscie

state "Użytkownik niezalogowany" as Niezalogowany {
  [*] --> StronaLogowania
  StronaLogowania: Formularz logowania (email, hasło)
  StronaLogowania --> StronaRejestracji: Przejdź do rejestracji
  StronaLogowania --> OdzyskiwanieHasla: Nie pamiętam hasła

  state if_login <<choice>>
  StronaLogowania --> if_login: Zaloguj
  if_login --> StronaGlowna: Dane poprawne
  if_login --> BladLogowania: Dane nieprawidłowe
  BladLogowania --> StronaLogowania: Spróbuj ponownie

  state "Proces rejestracji" as Rejestracja {
    [*] --> StronaRejestracji
    StronaRejestracji: Formularz rejestracji (email, hasło, potwierdzenie)

    state if_register <<choice>>
    StronaRejestracji --> if_register: Zarejestruj
    if_register --> RejestracjaUdana: Dane poprawne
    if_register --> RejestracjaNieudana: Błąd (email zajęty / słabe hasło)

    RejestracjaUdana --> [*]
    RejestracjaNieudana --> StronaRejestracji: Popraw dane i spróbuj
  }

  StronaRejestracji --> StronaLogowania: Mam już konto

  state "Odzyskiwanie hasła" as ResetHasla {
    [*] --> OdzyskiwanieHasla
    OdzyskiwanieHasla: Formularz wysłania maila resetującego
    OdzyskiwanieHasla --> LinkResetuWyslany: Email wysłany

    LinkResetuWyslany --> WeryfikacjaTokena: Wejście z linku w emailu

    state if_token <<choice>>
    WeryfikacjaTokena --> if_token
    if_token --> UstawNoweHaslo: Token poprawny
    if_token --> BladTokena: Token błędny / wygasły

    UstawNoweHaslo: Formularz nowego hasła
    UstawNoweHaslo --> SukcesResetu: Hasło zaktualizowane
    SukcesResetu --> [*]
    BladTokena --> OdzyskiwanieHasla: Poproś o nowy link
  }
}

Wejscie --> Niezalogowany: Wejście na stronę chronioną (brak sesji)
Wejscie --> StronaGlowna: Wejście na stronę chronioną (sesja aktywna)

state "Użytkownik zalogowany" as Zalogowany {
  [*] --> StronaGlowna
  StronaGlowna: Widok generowania fiszek
  StronaGlowna --> MojeFiszki: Przejdź do listy fiszek
  StronaGlowna --> SesjaNauki: Rozpocznij sesję nauki
  MojeFiszki --> StronaGlowna: Powrót
  SesjaNauki --> StronaGlowna: Zakończ sesję

  state if_logout <<choice>>
  StronaGlowna --> if_logout: Wyloguj
  MojeFiszki --> if_logout: Wyloguj
  SesjaNauki --> if_logout: Wyloguj
  if_logout --> StronaLogowania: Sesja zakończona
}

%% Przecięcia między stanami głównymi
Niezalogowany.Rejestracja.RejestracjaUdana --> StronaGlowna: Auto-logowanie (MVP)
ResetHasla.SukcesResetu --> StronaLogowania: Zaloguj się nowym hasłem

note right of StronaLogowania
Użytkownik może przejść do rejestracji lub odzyskiwania hasła.
Niepoprawne dane logowania wyświetlają komunikat błędu.
end note

note right of StronaGlowna
Dostęp do kluczowych funkcji: generowanie fiszek,
przegląd i edycja (Moje fiszki), sesja nauki.
end note
```

</mermaid_diagram>


