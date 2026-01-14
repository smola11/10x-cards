# REST API Plan

## 1. Resources

- Flashcards — table: `public.flashcards`
- Generations — table: `public.generations`

Implementation notes:

- Runtime: Astro 5 API routes under `src/pages/api`.
- DB/Auth: Supabase with RLS enabled; all row access scoped to `auth.uid()`.
- JSON uses camelCase; DB columns mapped server-side.

## 2. Endpoints

### 2.1 Flashcards

#### List flashcards

- Method: GET
- Path: `/api/flashcards`
- Description: Paginated list of the caller’s flashcards, newest first.
- Query params:
  - `page` (number, 1+, default 1)
  - `limit` (number, 1–100, default 20)
  - `sort` (string, default `created_at`)
  - `order` (string, default `desc`, allowed: `asc|desc`)
  - `origin` (enum: `manual|ai-full|ai-edited`, optional)
  - `generationId` (number, optional; filter by generation)
- Request JSON: none
- Response JSON:

```json
{
  "items": [
    {
      "id": 123,
      "front": "string",
      "back": "string",
      "origin": "manual",
      "generationId": 456,
      "createdAt": "2025-10-14T13:20:00.000Z",
      "updatedAt": "2025-10-14T13:20:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "totalPages": 5,
  "totalItems": 100,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

- Success: 200 OK
- Errors:
  - 400 Bad Request: invalid query params
  - 401 Unauthorized

Notes:

- Backed by index `(user_id, created_at DESC)`.
- Cursor encodes `(created_at,id)` for stable pagination.

#### Get a flashcard

- Method: GET
- Path: `/api/flashcards/{id}`
- Description: Returns one flashcard owned by the caller.
- Response JSON:

```json
{
  "id": 123,
  "front": "string",
  "back": "string",
  "origin": "ai-full",
  "generationId": 456,
  "createdAt": "2025-10-14T13:20:00.000Z",
  "updatedAt": "2025-10-14T13:20:00.000Z"
}
```

- Success: 200 OK
- Errors:
  - 401 Unauthorized
  - 404 Not Found

#### Create a manual flashcard

- Method: POST
- Path: `/api/flashcards`
- Description: Creates a manual flashcard (no `generationId`).
- Request JSON:

```json
{
  "front": "string (1..200 chars)",
  "back": "string (1..500 chars)"
}
```

- Response JSON:

```json
{
  "id": 123,
  "front": "string",
  "back": "string",
  "origin": "manual",
  "generationId": null,
  "createdAt": "2025-10-14T13:20:00.000Z",
  "updatedAt": "2025-10-14T13:20:00.000Z"
}
```

- Success: 201 Created
- Errors:
  - 400 Bad Request: extra/forbidden fields (e.g., `generationId`), invalid JSON
  - 401 Unauthorized
  - 422 Unprocessable Entity: length validation fails

Notes:

- Server sets `origin = 'manual'`. `generationId` is rejected for manual creates.

#### Update a flashcard

- Method: PATCH
- Path: `/api/flashcards/{id}`
- Description: Updates `front` and/or `back`. `origin` is immutable post-creation.
- Request JSON:

```json
{
  "front": "string (1..200 chars, optional)",
  "back": "string (1..500 chars, optional)"
}
```

- Response JSON: same as GET one
- Success: 200 OK
- Errors:
  - 400 Bad Request: no updatable fields provided
  - 401 Unauthorized
  - 404 Not Found
  - 422 Unprocessable Entity: length validation fails

#### Delete a flashcard

- Method: DELETE
- Path: `/api/flashcards/{id}`
- Description: Deletes a flashcard.
- Request/Response JSON: none
- Success: 204 No Content
- Errors:
  - 401 Unauthorized
  - 404 Not Found

---

### 2.3 Generations (AI proposals + acceptance)

#### Create generation and get AI proposals

- Method: POST
- Path: `/api/generations`
- Description: Validates `promptText`, calls LLM via OpenRouter, measures duration, persists a `generations` row, and returns proposals without persisting them as flashcards yet.
- Request JSON:

```json
{
  "promptText": "string (1000..10000 chars)"
}
```

- Response JSON:

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
  "proposals": [{ "front": "string (1..200)", "back": "string (1..500)" }]
}
```

- Success: 201 Created
- Errors:
  - 400 Bad Request: invalid JSON
  - 401 Unauthorized
  - 422 Unprocessable Entity: `promptText` length out of range
  - 429 Too Many Requests: generation rate limit exceeded
  - 502 Bad Gateway: LLM upstream failure
  - 500 Internal Server Error

Notes:

- Persists: `user_id`, `total_count`, `model`, `generation_duration`, timestamps.
- Does NOT persist proposals; they are returned to the client for review.

#### Accept selected proposals and persist flashcards

- Method: POST
- Path: `/api/generations/{id}/accept`
- Description: Persists selected proposals as flashcards; sets `origin` per item; updates generation acceptance counters atomically.
- Request JSON:

```json
{
  "flashcards": [
    {
      "front": "string (1..200)",
      "back": "string (1..500)",
      "edited": false
    }
  ]
}
```

- Response JSON:

```json
{
  "created": [
    {
      "id": 789,
      "front": "string",
      "back": "string",
      "origin": "ai-full", // or "ai-edited" if edited=true
      "generationId": 456,
      "createdAt": "2025-10-14T13:20:00.000Z",
      "updatedAt": "2025-10-14T13:20:00.000Z"
    }
  ],
  "generation": {
    "id": 456,
    "totalCount": 10,
    "acceptedUneditedCount": 6,
    "acceptedEditedCount": 2,
    "createdAt": "2025-10-14T13:20:00.000Z",
    "updatedAt": "2025-10-14T13:25:12.000Z"
  }
}
```

- Success: 201 Created
- Errors:
  - 400 Bad Request: empty list; invalid fields
  - 401 Unauthorized
  - 403 Forbidden: generation not owned by caller
  - 404 Not Found: generation missing
  - 409 Conflict: accepting more than `totalCount`
  - 422 Unprocessable Entity: length validation fails
  - 500 Internal Server Error

Notes:

- For each item: `origin = 'ai-edited'` if `edited=true`, otherwise `'ai-full'`.
- Enforces DB CHECK: `origin != 'manual'` implies `generationId` present.

#### List generations

- Method: GET
- Path: `/api/generations`
- Description: Paginated list of the caller’s generations with acceptance counters.
- Query params:
  - `limit` (1–50, default 20)
  - `cursor` (opaque)
  - `sort` (default `created_at:desc`)
- Response JSON:

```json
{
  "items": [
    {
      "id": 456,
      "totalCount": 10,
      "acceptedUneditedCount": 6,
      "acceptedEditedCount": 2,
      "model": "provider/model",
      "generationDuration": 812,
      "createdAt": "2025-10-14T13:20:00.000Z",
      "updatedAt": "2025-10-14T13:25:12.000Z"
    }
  ],
  "nextCursor": "opaque-or-null"
}
```

- Success: 200 OK
- Errors:
  - 400 Bad Request
  - 401 Unauthorized

#### Get a generation

- Method: GET
- Path: `/api/generations/{id}`
- Description: Returns one generation; optionally include associated flashcards for convenience.
- Query params:
  - `includeFlashcards` (boolean, default false)
- Response JSON (when `includeFlashcards=true`):

```json
{
  "generation": {
    "id": 456,
    "totalCount": 10,
    "acceptedUneditedCount": 6,
    "acceptedEditedCount": 2,
    "model": "provider/model",
    "generationDuration": 812,
    "createdAt": "2025-10-14T13:20:00.000Z",
    "updatedAt": "2025-10-14T13:25:12.000Z"
  },
  "flashcards": [
    {
      "id": 789,
      "front": "string",
      "back": "string",
      "origin": "ai-full",
      "generationId": 456,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

- Success: 200 OK
- Errors:
  - 401 Unauthorized
  - 404 Not Found

Notes:

- Joins leverage index on `flashcards(generation_id)`.

---

### 2.5 Stats

#### Generation acceptance summary

- Method: GET
- Path: `/api/stats/generations`
- Description: Aggregates per-user generation acceptance metrics.
- Query params:
  - `since` (ISO timestamp, optional)
- Response JSON:

```json
{
  "totalGenerations": 12,
  "totalProposed": 120,
  "totalAcceptedUnedited": 70,
  "totalAcceptedEdited": 15,
  "acceptanceRate": 0.7083
}
```

- Success: 200 OK
- Errors:
  - 401 Unauthorized
  - 400 Bad Request

#### Flashcards breakdown

- Method: GET
- Path: `/api/stats/flashcards`
- Description: Count flashcards by origin.
- Response JSON:

```json
{
  "total": 250,
  "byOrigin": {
    "manual": 80,
    "ai-full": 120,
    "ai-edited": 50
  }
}
```

- Success: 200 OK
- Errors:
  - 401 Unauthorized

---

## 3. Authentication and Authorization

- Mechanism: Supabase Auth (JWT) via `Authorization: Bearer <token>`.
- Server behavior:
  - Extract and verify token using Supabase SDK.
  - Determine `userId = auth.uid()` for all operations.
  - Write operations set `user_id` columns server-side; read operations filter by `user_id`.
- Database RLS:
  - Enabled for `public.flashcards` and `public.generations`.
  - Policies enforce owner-only access for SELECT/INSERT/UPDATE/DELETE.
- Client integration:
  - Use Supabase JS SDK in React for sign up/sign in/password flows.
  - This API assumes authenticated requests for protected endpoints.

Security headers:

- CORS: restrict origins to deployment domains.
- Content-Type: enforce `application/json` for JSON endpoints.
- Cache: no-store for auth-protected data.

Rate limiting (recommended defaults):

- `/api/generations` POST: 10 requests per 10 minutes per user (LLM cost control).
- Other endpoints: 5 requests/sec burst, 1000/day per user.
- 429 with `Retry-After` when exceeded.

Secrets:

- Store OpenRouter API key and Supabase service role in server env; never expose to client.

---

## 4. Validation and Business Logic

### 4.1 Validation rules

Flashcards (`public.flashcards`):

- `front`: required, 1..200 chars (trimmed).
- `back`: required, 1..500 chars (trimmed).
- `origin`: server-controlled:
  - Manual create: `'manual'`, must not include `generationId`.
  - AI acceptance: `'ai-full'` if `edited=false`, `'ai-edited'` if `edited=true`, must include `generationId`.
- `generationId`:
  - Required for AI origins; forbidden for manual.
- Timestamps:
  - `createdAt` default now; `updatedAt` updated by DB trigger on UPDATE.

Generations (`public.generations`):

- `promptText`: required, 1000..10000 chars.
- `model`: required; allow server default override if missing.
- `generationDuration`: non-negative (ms).
- Counters:
  - `totalCount` = proposals returned by LLM.
  - `acceptedUneditedCount`/`acceptedEditedCount` updated on acceptance.
  - Reject acceptance if `acceptedUneditedCount + acceptedEditedCount + newAccepted > totalCount`.

Common:

- Reject unknown fields.
- Enforce JSON schema per endpoint; respond with 422 on validation errors; include per-field messages.

### 4.2 Business logic mapping

- AI proposals:
  - On POST `/api/generations`, call OpenRouter with `promptText`, measure duration, persist generation with `total_count` and metadata, return proposals only in response.
- Acceptance flow:
  - On POST `/api/generations/{id}/accept`, verify ownership; insert flashcards in a transaction:
    - Set `user_id` from token.
    - Set `origin` per `edited` flag.
    - Set `generation_id = {id}`.
  - Update acceptance counters atomically; reject if exceeding `total_count`.
- Manual CRUD:
  - `POST /api/flashcards` always creates `origin = 'manual'`.
  - `PATCH` only allows `front`/`back` changes; `origin` immutable to preserve provenance.
- Study:
  - No persistence; session is ephemeral. Next-card selection delegated to external SRS library; server maintains transient state or stateless token.
- Stats:
  - Aggregate user-owned rows only; use appropriate indexes for performance.

### 4.3 Error model

- 400: malformed query/body, unsupported parameters.
- 401: missing or invalid JWT.
- 403: resource not owned by caller (ownership check preempting 404 when resource exists).
- 404: resource not found.
- 409: acceptance count would exceed `totalCount`.
- 422: schema/length validation errors; response includes `errors` array with `{path, message}`.
- 429: rate limit exceeded.
- 500/502: server/upstream errors; redact sensitive details.

### 4.6 Implementation scaffolding (Astro + TS)

- Route placement:
  - `src/pages/api/auth/session.ts`
  - `src/pages/api/flashcards/index.ts` (GET, POST)
  - `src/pages/api/flashcards/[id].ts` (GET, PATCH, DELETE)
  - `src/pages/api/generations/index.ts` (POST, GET)
  - `src/pages/api/generations/[id].ts` (GET)
  - `src/pages/api/generations/[id]/accept.ts` (POST)
  - `src/pages/api/study/session.ts` (POST)
  - `src/pages/api/study/[sessionId]/review.ts` (POST)
  - `src/pages/api/stats/generations.ts` (GET)
  - `src/pages/api/stats/flashcards.ts` (GET)
- Shared types in `src/types.ts` for DTOs.
- Supabase client in `src/db/supabase.client.ts` (existing).
- Env: `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (service role only on server).
- Middleware (`src/middleware/index.ts`) to extract/validate JWT once and attach user to request.

This document defines the REST API surface for the 10x-cards MVP, aligned with the database schema, PRD requirements, and the Astro + Supabase stack.
