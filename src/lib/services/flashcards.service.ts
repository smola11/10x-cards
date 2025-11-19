import type { Tables } from "../../db/database.types";
import type { SupabaseClient } from "../../db/supabase.client";
import type { FlashcardDTO, FlashcardOrigin, SortOrder } from "../../types";

export interface ListFlashcardsParams {
  userId: string;
  page: number;
  limit: number;
  sort: "created_at" | "updated_at";
  order: SortOrder;
  origin?: FlashcardOrigin;
  generationId?: number;
}

export interface ListFlashcardsResult {
  items: FlashcardDTO[];
  totalItems: number;
}

export function mapFlashcardRowToDTO(row: Tables<"flashcards">): FlashcardDTO {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    origin: row.origin,
    generationId: row.generation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateManualFlashcardParams {
  userId: string;
  front: string;
  back: string;
}

export async function createManualFlashcard(
  supabase: SupabaseClient,
  { userId, front, back }: CreateManualFlashcardParams
): Promise<FlashcardDTO> {
  const { data, error } = await supabase
    .from("flashcards")
    .insert({
      user_id: userId,
      front,
      back,
      origin: "manual",
      generation_id: null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Failed to create flashcard");
  }

  return mapFlashcardRowToDTO(data);
}

export async function listFlashcards(
  supabase: SupabaseClient,
  { userId, page, limit, sort, order, origin, generationId }: ListFlashcardsParams
): Promise<ListFlashcardsResult> {
  const offset = (page - 1) * limit;
  const ascending = order === "asc";

  let query = supabase.from("flashcards").select("*", { count: "exact" }).eq("user_id", userId);

  if (origin) {
    query = query.eq("origin", origin);
  }

  if (typeof generationId === "number") {
    query = query.eq("generation_id", generationId);
  }

  const { data, error, count } = await query
    .order(sort, { ascending, nullsFirst: !ascending })
    .order("id", { ascending })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  const items = (data ?? []).map(mapFlashcardRowToDTO);

  return {
    items,
    totalItems: typeof count === "number" ? count : 0,
  };
}
