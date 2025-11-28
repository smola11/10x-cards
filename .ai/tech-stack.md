Frontend - Astro z React dla komponentów interaktywnych:

- Astro 5 pozwala na tworzenie szybkich, wydajnych stron i aplikacji z minimalną ilością JavaScript
- React 19 zapewni interaktywność tam, gdzie jest potrzebna
- TypeScript 5 dla statycznego typowania kodu i lepszego wsparcia IDE
- Tailwind 4 pozwala na wygodne stylowanie aplikacji
- Shadcn/ui zapewnia bibliotekę dostępnych komponentów React, na których oprzemy UI

Backend - Supabase jako kompleksowe rozwiązanie backendowe:

- Zapewnia bazę danych PostgreSQL
- Zapewnia SDK w wielu językach, które posłużą jako Backend-as-a-Service
- Jest rozwiązaniem open source, które można hostować lokalnie lub na własnym serwerze
- Posiada wbudowaną autentykację użytkowników

AI - Komunikacja z modelami przez usługę Openrouter.ai:

- Dostęp do szerokiej gamy modeli (OpenAI, Anthropic, Google i wiele innych), które pozwolą nam znaleźć rozwiązanie zapewniające wysoką efektywność i niskie koszta
- Pozwala na ustawianie limitów finansowych na klucze API

Testy i jakość:

- Testy jednostkowe i integracyjne:
  - Vitest jako główny framework testowy (z środowiskiem JSDOM dla testów frontendowych)
  - @vitest/ui do podglądu wyników testów w przeglądarce
  - Supertest do testowania endpointów API
  - MSW (Mock Service Worker) do mockowania zapytań HTTP
  - c8 do generowania raportów code coverage
- Testy E2E:
  - Playwright do end-to-end testów w wielu przeglądarkach (desktop i mobile)
  - @axe-core/playwright do automatycznego sprawdzania accessibility (A11y)
- Linting i formatowanie:
  - ESLint (z pluginami dla Astro, React, a11y i TypeScript) do utrzymania jakości kodu
  - Prettier (z pluginem dla Astro) do formatowania kodu
  - TypeScript jako dodatkowa warstwa statycznej analizy

CI/CD i Hosting:

- Github Actions do tworzenia pipeline’ów CI/CD
- DigitalOcean do hostowania aplikacji za pośrednictwem obrazu docker
