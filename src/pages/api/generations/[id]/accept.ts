export const prerender = false;

import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { DEFAULT_USER_ID } from "../../../../db/supabase.client";
import { AcceptGenerationProposalsSchema } from "../../../../lib/validation/generations";
import { acceptProposals, mapGenerationRowToSummaryDTO } from "../../../../lib/services/generations.service";
import { mapFlashcardRowToDTO } from "../../../../lib/services/flashcards.service";
import type { AcceptGenerationProposalsResponse } from "../../../../types";

export const POST: APIRoute = async (context) => {
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

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = AcceptGenerationProposalsSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
  }

  const { flashcards } = parsed.data;

  try {
    const result = await acceptProposals(supabase, {
      userId,
      generationId,
      items: flashcards,
    });

    const response: AcceptGenerationProposalsResponse = {
      created: result.created.map(mapFlashcardRowToDTO),
      generation: mapGenerationRowToSummaryDTO(result.generation),
    };

    return json(response, 201);
  } catch (error) {
    console.error("POST /api/generations/:id/accept failed", {
      error,
      userId,
      generationId,
      flashcardsCount: flashcards.length,
    });

    return handleServiceError(error);
  }
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

function handleServiceError(error: unknown): Response {
  if (isPostgrestError(error)) {
    switch (error.code) {
      case "P0002":
        return json({ error: "Generation not found" }, 404);
      case "42501":
        return json({ error: "Forbidden" }, 403);
      case "23505":
      case "23514":
      case "P0001":
        return json({ error: "Accepting proposals would exceed generation limits" }, 409);
      default:
        break;
    }
  }

  return json({ error: "Internal server error" }, 500);
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return Boolean(
    error && typeof error === "object" && "code" in error && typeof (error as PostgrestError).code === "string"
  );
}

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}
