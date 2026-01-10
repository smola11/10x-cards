// Shared DTO and Command Model types for the API layer.
// These types are derived from the database entities defined in `src/db/database.types.ts`
// and use camelCase field names for JSON responses.

import type { Tables, Enums } from "./db/database.types";

// Aliases to DB rows/enums for stronger coupling to persisted entities
type FlashcardRow = Tables<"flashcards">;
type GenerationRow = Tables<"generations">;
export type FlashcardOrigin = Enums<"flashcard_origin">;

// --------------------
// Utility Type Helpers
// --------------------

/**
 * Require at least one of the provided Keys to be present on type T.
 * Useful for update commands where at least one field must be supplied.
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type SortOrder = "asc" | "desc";

// --------------------
// Flashcards - DTOs
// --------------------

/**
 * Flashcard JSON representation.
 * Maps DB snake_case to API camelCase while preserving column types.
 */
export interface FlashcardDTO {
  id: FlashcardRow["id"];
  front: FlashcardRow["front"];
  back: FlashcardRow["back"];
  origin: FlashcardOrigin;
  generationId: FlashcardRow["generation_id"]; // number | null
  createdAt: FlashcardRow["created_at"];
  updatedAt: FlashcardRow["updated_at"];
}

/**
 * Flashcards index pagination metadata.
 */
export interface PageMeta {
  page: number;
  limit: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export type FlashcardsListResponse = {
  items: FlashcardDTO[];
} & PageMeta;

export type GetFlashcardResponse = FlashcardDTO;
export type CreateManualFlashcardResponse = FlashcardDTO;
export type UpdateFlashcardResponse = FlashcardDTO;

// --------------------
// Generations - DTOs
// --------------------

/**
 * Generation summary returned by the API.
 * Excludes server-internal/user-bound fields like user_id and prompt_text by design.
 */
export interface GenerationSummaryDTO {
  id: GenerationRow["id"];
  totalCount: GenerationRow["total_count"];
  acceptedUneditedCount: GenerationRow["accepted_unedited_count"];
  acceptedEditedCount: GenerationRow["accepted_edited_count"];
  model: GenerationRow["model"];
  generationDuration: GenerationRow["generation_duration"];
  createdAt: GenerationRow["created_at"];
  updatedAt: GenerationRow["updated_at"];
}

/**
 * An AI-proposed flashcard (not persisted).
 */
export interface ProposalFlashcardDTO {
  front: FlashcardRow["front"];
  back: FlashcardRow["back"];
}

export interface CreateGenerationResponse {
  generation: GenerationSummaryDTO;
  proposals: ProposalFlashcardDTO[];
}

export interface AcceptGenerationProposalsResponse {
  created: FlashcardDTO[];
  generation: GenerationSummaryDTO;
}

export interface GenerationsListResponse {
  items: GenerationSummaryDTO[];
  nextCursor: string | null;
}

export interface GetGenerationResponse {
  generation: GenerationSummaryDTO;
  // Present when includeFlashcards=true
  flashcards?: FlashcardDTO[];
}

// --------------------
// Stats - DTOs
// --------------------

export interface GenerationsStatsResponse {
  totalGenerations: number;
  totalProposed: number;
  totalAcceptedUnedited: number;
  totalAcceptedEdited: number;
  acceptanceRate: number; // 0..1
}

export interface FlashcardsStatsResponse {
  total: number;
  byOrigin: Record<FlashcardOrigin, number>;
}

// --------------------
// Commands (request bodies)
// --------------------

/**
 * POST /api/flashcards
 * Server sets origin = 'manual' and rejects generationId.
 */
export interface CreateManualFlashcardCommand {
  front: FlashcardRow["front"];
  back: FlashcardRow["back"];
}

/**
 * PATCH /api/flashcards/{id}
 * At least one of front/back must be provided.
 */
type FlashcardUpdateFields = Pick<FlashcardRow, "front" | "back">;
export type UpdateFlashcardCommand = RequireAtLeastOne<Partial<FlashcardUpdateFields>, "front" | "back">;

/**
 * POST /api/generations
 */
export interface CreateGenerationCommand {
  // String length validated at runtime (1000..10000)
  promptText: string;
}

/**
 * POST /api/generations/{id}/accept
 */
export interface AcceptGenerationProposalsItem {
  front: FlashcardRow["front"];
  back: FlashcardRow["back"];
  edited: boolean;
}

export interface AcceptGenerationProposalsCommand {
  flashcards: AcceptGenerationProposalsItem[];
}

// --------------------
// Query parameter models
// --------------------

export interface FlashcardsListQuery {
  page?: number; // 1+
  limit?: number; // 1..100
  sort?: "created_at" | "updated_at"; // field names reflect DB columns
  order?: SortOrder; // default 'desc'
  origin?: FlashcardOrigin;
  generationId?: FlashcardRow["generation_id"]; // filter by generation
}

export interface GenerationsListQuery {
  limit?: number; // 1..50
  cursor?: string; // opaque
  sort?: string; // e.g., "created_at:desc"
}

export interface GetGenerationQuery {
  includeFlashcards?: boolean;
}
