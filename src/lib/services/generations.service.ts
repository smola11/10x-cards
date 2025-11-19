import type { Tables, TablesInsert } from "../../db/database.types";
import type { SupabaseClient } from "../../db/supabase.client";
import type { AcceptGenerationProposalsItem, GenerationSummaryDTO, ProposalFlashcardDTO, SortOrder } from "../../types";
import { callOpenRouter } from "./openrouter";

export interface GenerateProposalsParams {
  promptText: string;
  model?: string;
}

export interface GenerateProposalsResult {
  proposals: ProposalFlashcardDTO[];
  usedModel: string;
  durationMs: number;
}

// Rate limiting intentionally disabled for local development per requirements

export async function generateProposals({
  promptText,
  model,
}: GenerateProposalsParams): Promise<GenerateProposalsResult> {
  const start = performance.now();
  const { proposals, usedModel } = await callOpenRouter({ promptText, model });

  // Defensive normalization: trim, enforce limits, remove empties
  const normalized: ProposalFlashcardDTO[] = proposals
    .map((p) => ({
      front: typeof p.front === "string" ? p.front.trim() : "",
      back: typeof p.back === "string" ? p.back.trim() : "",
    }))
    .filter((p) => p.front.length > 0 && p.back.length > 0)
    .map((p) => ({
      front: p.front.slice(0, 200),
      back: p.back.slice(0, 500),
    }));

  const durationMs = Math.round(performance.now() - start);
  return { proposals: normalized, usedModel, durationMs };
}

export function mapGenerationInsert(params: {
  userId: string;
  promptText: string;
  totalCount: number;
  model: string;
  generationDuration: number;
}): TablesInsert<"generations"> {
  return {
    user_id: params.userId,
    prompt_text: params.promptText,
    total_count: params.totalCount,
    model: params.model,
    generation_duration: params.generationDuration,
  };
}

// ----------------------------
// Listing generations
// ----------------------------

export interface ListGenerationsParams {
  userId: string;
  limit: number;
  cursor?: string;
  sortColumn: "created_at" | "updated_at";
  order: SortOrder;
}

export interface ListGenerationsResult {
  items: Tables<"generations">[];
  nextCursor: string | null;
}

export async function listGenerations(
  supabase: SupabaseClient,
  { userId, limit, cursor, sortColumn, order }: ListGenerationsParams
): Promise<ListGenerationsResult> {
  const ascending = order === "asc";
  const comparisonOperator = ascending ? "gt" : "lt";

  let query = supabase.from("generations").select("*").eq("user_id", userId);

  if (cursor) {
    query = query[comparisonOperator](sortColumn, cursor);
  }

  const { data, error } = await query
    .order(sortColumn, { ascending, nullsFirst: false })
    .order("id", { ascending })
    .limit(limit + 1);

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && last ? last[sortColumn] : null,
  };
}

export interface AcceptProposalsParams {
  userId: string;
  generationId: number;
  items: AcceptGenerationProposalsItem[];
}

export interface AcceptProposalsResult {
  created: Tables<"flashcards">[];
  generation: Tables<"generations">;
}

export async function acceptProposals(
  supabase: SupabaseClient,
  { userId, generationId, items }: AcceptProposalsParams
): Promise<AcceptProposalsResult> {
  const { data: generation, error: generationError } = await supabase
    .from("generations")
    .select()
    .eq("id", generationId)
    .single<Tables<"generations">>();

  if (generationError) {
    if (generationError.code === "PGRST116") {
      throw createPostgrestError("P0002", "Generation not found");
    }

    throw generationError;
  }

  if (!generation) {
    throw createPostgrestError("P0002", "Generation not found");
  }

  if (generation.user_id !== userId) {
    throw createPostgrestError("42501", "Forbidden");
  }

  const editedCount = items.filter((item) => item.edited).length;
  const uneditedCount = items.length - editedCount;

  const currentEdited = generation.accepted_edited_count ?? 0;
  const currentUnedited = generation.accepted_unedited_count ?? 0;

  const nextEdited = currentEdited + editedCount;
  const nextUnedited = currentUnedited + uneditedCount;
  const nextTotal = nextEdited + nextUnedited;

  if (nextTotal > generation.total_count) {
    throw createPostgrestError("P0001", "Accepting proposals would exceed generation limits");
  }

  const flashcardsInsert: TablesInsert<"flashcards">[] = items.map((item) => ({
    front: item.front,
    back: item.back,
    origin: item.edited ? "ai-edited" : "ai-full",
    generation_id: generationId,
    user_id: userId,
  }));

  const flashcardsMutation = supabase.from("flashcards").insert(flashcardsInsert).select();
  const { data: created, error: insertError } = await flashcardsMutation;

  if (insertError) {
    throw insertError;
  }

  if (!created) {
    throw new Error("Failed to insert flashcards");
  }

  const { data: updatedGeneration, error: updateError } = await supabase
    .from("generations")
    .update({
      accepted_edited_count: nextEdited,
      accepted_unedited_count: nextUnedited,
      updated_at: new Date().toISOString(),
    })
    .eq("id", generationId)
    .select()
    .single<Tables<"generations">>();

  if (updateError) {
    if (created.length > 0) {
      await supabase
        .from("flashcards")
        .delete()
        .in(
          "id",
          created.map((row) => row.id)
        );
    }

    if (updateError.code === "23514" || updateError.code === "23505") {
      throw createPostgrestError(updateError.code, "Accepting proposals would exceed generation limits");
    }

    throw updateError;
  }

  if (!updatedGeneration) {
    throw new Error("Failed to update generation");
  }

  return {
    created,
    generation: updatedGeneration,
  };
}

export function mapGenerationRowToSummaryDTO(row: Tables<"generations">): GenerationSummaryDTO {
  return {
    id: row.id,
    totalCount: row.total_count,
    acceptedUneditedCount: row.accepted_unedited_count,
    acceptedEditedCount: row.accepted_edited_count,
    model: row.model,
    generationDuration: row.generation_duration,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface PostgrestErrorLike {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

function createPostgrestError(code: string, message: string, details?: string): PostgrestErrorLike {
  return {
    code,
    message,
    details,
  };
}
