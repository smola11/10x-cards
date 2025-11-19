export const prerender = false;

import type { APIRoute } from "astro";
import type { Tables } from "../../db/database.types";
import { CreateGenerationSchema, GenerationsListQuerySchema } from "../../lib/validation/generations";
import {
  generateProposals,
  mapGenerationInsert,
  listGenerations,
  mapGenerationRowToSummaryDTO,
} from "../../lib/services/generations.service";
import { DEFAULT_USER_ID } from "../../db/supabase.client";
import type { CreateGenerationResponse, GenerationSummaryDTO, GenerationsListResponse } from "../../types";

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return json({ error: "Supabase client not available" }, 500);
  }

  const userId = await resolveUserId(supabase);
  if (!userId) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(context.request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());

  const parsed = GenerationsListQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { limit, cursor, sort } = parsed.data;
  const [sortColumn, sortOrder] = sort.split(":") as ["created_at" | "updated_at", "asc" | "desc"];

  try {
    const result = await listGenerations(supabase, {
      userId,
      limit,
      cursor,
      sortColumn,
      order: sortOrder,
    });

    const response: GenerationsListResponse = {
      items: result.items.map(mapGenerationRowToSummaryDTO),
      nextCursor: result.nextCursor,
    };

    return json(response, 200);
  } catch (error) {
    console.error("GET /api/generations failed", {
      error,
      userId,
      limit,
      cursor,
      sort,
    });

    return json({ error: "Internal server error" }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return json({ error: "Supabase client not available" }, 500);
  }

  const userId = await resolveUserId(supabase);
  if (!userId) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Parse & validate body
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parse = CreateGenerationSchema.safeParse(body);
  if (!parse.success) {
    return json({ error: "Validation failed", details: parse.error.flatten() }, 422);
  }
  const { promptText, model } = parse.data;

  // Call LLM and measure duration
  let proposals: { front: string; back: string }[] = [];
  let usedModel = model ?? "unknown";
  let durationMs = 0;
  console.log("Generating proposals for prompt:");
  try {
    const res = await generateProposals({ promptText, model });
    proposals = res.proposals;
    usedModel = res.usedModel;
    durationMs = res.durationMs;
  } catch {
    return json({ error: "Generation failed" }, 500);
  }

  // Insert generation record
  const insert = mapGenerationInsert({
    userId,
    promptText,
    totalCount: proposals.length,
    model: usedModel,
    generationDuration: durationMs,
  });

  const { data: inserted, error: dbError } = await supabase
    .from("generations")
    .insert(insert)
    .select()
    .single<Tables<"generations">>();

  if (dbError || !inserted) {
    console.error("Database insert failed", dbError);
    return json({ error: "Database insert failed" }, 500);
  }

  // Map DB row -> DTO
  const generation: GenerationSummaryDTO = {
    id: inserted.id,
    totalCount: inserted.total_count,
    acceptedUneditedCount: inserted.accepted_unedited_count,
    acceptedEditedCount: inserted.accepted_edited_count,
    model: inserted.model,
    generationDuration: inserted.generation_duration,
    createdAt: inserted.created_at,
    updatedAt: inserted.updated_at,
  };

  const response: CreateGenerationResponse = {
    generation,
    proposals,
  };

  return json(response, 201);
};

async function resolveUserId(supabase: App.Locals["supabase"]): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return import.meta.env.DEV ? DEFAULT_USER_ID : null;
  }
  const id = data?.user?.id;
  if (id) {
    return id;
  }

  return import.meta.env.DEV ? DEFAULT_USER_ID : null;
}

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}
