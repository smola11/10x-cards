export const prerender = false;

import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../../../db/supabase.client";
import { GetGenerationQuerySchema } from "../../../../lib/validation/generations";
import { mapGenerationRowToSummaryDTO } from "../../../../lib/services/generations.service";
import { listFlashcards } from "../../../../lib/services/flashcards.service";
import type { GetGenerationResponse } from "../../../../types";

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return json({ error: "Supabase client not available" }, 500);
  }

  const generationId = parseGenerationId(context.params.id);
  if (!generationId) {
    return json({ error: "Invalid generation id" }, 400);
  }

  const userId = await resolveUserId(supabase);
  if (!userId) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(context.request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());

  const parsed = GetGenerationQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const includeFlashcards = parsed.data.includeFlashcards ?? false;

  const { data: generation, error: generationError } = await supabase
    .from("generations")
    .select()
    .eq("id", generationId)
    .single();

  if (generationError || !generation) {
    return json({ error: "Generation not found" }, 404);
  }

  if (generation.user_id !== userId) {
    return json({ error: "Forbidden" }, 403);
  }

  const response: GetGenerationResponse = {
    generation: mapGenerationRowToSummaryDTO(generation),
  };

  if (includeFlashcards) {
    try {
      const { items } = await listFlashcards(supabase, {
        userId,
        page: 1,
        limit: 100,
        sort: "created_at",
        order: "desc",
        origin: undefined,
        generationId,
      });

      response.flashcards = items;
    } catch (error) {
      console.error("GET /api/generations/:id failed to load flashcards", {
        error,
        userId,
        generationId,
      });
    }
  }

  return json(response, 200);
};

function parseGenerationId(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

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
