<authentication_analysis>
- Przepływy autentykacji (na podstawie PRD i specyfikacji):
  1) Rejestracja (signUp) z automatycznym zalogowaniem i przekierowaniem do "/".
  2) Logowanie (signInWithPassword) i przekierowanie do "/".
  3) Wylogowanie (POST /api/auth/logout) i przekierowanie do "/auth/login".
  4) Odzyskiwanie hasła – wysłanie emaila (resetPasswordForEmail) i ustawienie 
     nowego hasła (updateUser) po wejściu w link z mailem.
  5) Dostęp do stron chronionych – middleware SSR sprawdza sesję i 
     przekierowuje niezalogowanych na "/auth/login?redirect=...".
  6) Dostęp do API chronionego – endpointy weryfikują użytkownika przez 
     supabase.auth.getUser(); brak sesji → 401.
  7) Odświeżanie sesji/tokenów – klient SSR (@supabase/ssr) wykorzystuje 
     cookies do odświeżenia; przy niepowodzeniu → redirect/401.
  8) DEV bypass (opcjonalny) – w DEV z AUTH_BYPASS_DEV=true API używa 
     DEFAULT_USER_ID zamiast wymagać sesji.

- Aktorzy i interakcje: Przeglądarka (UI/React), Middleware (Astro, SSR), 
  Strony/Router (Astro), API (Astro API routes), Supabase Auth.

- Weryfikacja i odświeżanie tokenów: SSR klient Supabase na podstawie cookies 
  wywołuje getSession/getUser; przy wygaśnięciu próbuje odświeżyć; w razie 
  niepowodzenia – 401 lub redirect do logowania.

- Krótkie opisy kroków:
  - Rejestracja/Logowanie: UI wywołuje Supabase Auth; po sukcesie cookies 
    sesji są ustawione; UI wykonuje pełny redirect.
  - Middleware (chronione strony): sprawdza sesję; jeśli brak → redirect do 
    logowania z parametrem redirect.
  - API (chronione): sprawdza użytkownika; jeśli brak → 401; w DEV opcjonalny 
    fallback do DEFAULT_USER_ID.
  - Odzyskiwanie hasła: email z linkiem do /auth/reset-password; po wejściu 
    updateUser ustawia nowe hasło i redirect do logowania.
  - Wylogowanie: POST /api/auth/logout, Supabase signOut, czyszczenie cookies, 
    redirect do logowania.
</authentication_analysis>

<mermaid_diagram>
```mermaid
sequenceDiagram
  autonumber

  participant B as Przeglądarka (React)
  participant M as Middleware (Astro, SSR)
  participant P as Strony/API (Astro)
  participant A as Supabase Auth

  Note over B,M: Wejście na stronę chronioną (np. "/")
  B->>M: Żądanie GET / (SSR)
  activate M
  M->>A: getSession()/getUser() na podstawie cookies
  alt Sesja aktywna
    A-->>M: Sesja prawidłowa
    M-->>B: Kontynuuj render SSR
  else Brak/Wygasła sesja
    A-->>M: Brak sesji
    M-->>B: 302 → /auth/login?redirect=/
  end
  deactivate M

  Note over B,A: Logowanie (signInWithPassword)
  B->>A: signInWithPassword(email, hasło)
  activate A
  alt Dane poprawne
    A-->>B: Ustawienie cookies sesji (JWT, refresh)
    B->>B: Redirect do docelowego (np. "/")
  else Błędne dane
    A-->>B: Błąd "Nieprawidłowy email lub hasło"
  end
  deactivate A

  Note over B,A: Rejestracja (signUp)
  B->>A: signUp(email, hasło)
  activate A
  alt Sukces (MVP bez potwierdzania email)
    A-->>B: Aktywna sesja, cookies ustawione
    B->>B: Redirect do "/"
  else Email zajęty / walidacja
    A-->>B: Komunikat błędu (np. konto istnieje)
  end
  deactivate A

  Note over B,A: Odzyskiwanie hasła – krok 1
  B->>A: resetPasswordForEmail(email, { redirectTo: /auth/reset-password })
  A-->>B: Potwierdzenie wysyłki email

  Note over B,A: Odzyskiwanie hasła – krok 2
  B->>B: Otwórz link z emaila (access_token)
  B->>A: updateUser({ password })
  A-->>B: Hasło zaktualizowane
  B->>B: Redirect do "/auth/login"

  Note over B,P: Wylogowanie (SSR endpoint)
  B->>P: POST /api/auth/logout
  activate P
  P->>A: auth.signOut()
  A-->>P: 204, cookies do usunięcia
  P-->>B: 204 No Content
  deactivate P
  B->>B: Redirect do "/auth/login"

  Note over B,P: Wywołanie API chronionego
  B->>P: Żądanie do /api/flashcards
  activate P
  P->>A: getUser() (SSR, cookies)
  alt Użytkownik uwierzytelniony
    A-->>P: userId
    P-->>B: 200 (dane użytkownika)
  else Brak sesji
    alt DEV i AUTH_BYPASS_DEV=true
      P-->>B: 200 (z DEFAULT_USER_ID)
    else PROD lub bypass wyłączony
      P-->>B: 401 Unauthorized
    end
  end
  deactivate P

  Note over M,P: Odświeżanie sesji/tokenów
  par Strony SSR
    M->>A: getSession() (auto refresh gdy możliwe)
    alt Refresh powiódł się
      A-->>M: Nowa sesja
    else Refresh nieudany
      A-->>M: Brak sesji → redirect do logowania
    end
  and API routes
    P->>A: getUser() (auto refresh gdy możliwe)
    alt Refresh powiódł się
      A-->>P: userId dostępny
    else Refresh nieudany
      A-->>P: Brak sesji → 401
    end
  end
```
</mermaid_diagram>

