export const prerender = false;

import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../db/supabase.client";
import { createManualFlashcard, listFlashcards } from "../../lib/services/flashcards.service";
import { CreateManualFlashcardSchema, FlashcardsListQuerySchema } from "../../lib/validation/flashcards";
import type { FlashcardsListResponse } from "../../types";

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

  const parsed = FlashcardsListQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { page, limit, sort, order, origin, generationId } = parsed.data;

  try {
    const { items, totalItems } = await listFlashcards(supabase, {
      userId,
      page,
      limit,
      sort,
      order,
      origin,
      generationId,
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const response: FlashcardsListResponse = {
      items,
      page,
      limit,
      totalPages,
      totalItems,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return json(response, 200);
  } catch (error) {
    console.error("GET /api/flashcards failed", {
      error,
      userId,
      page,
      limit,
      sort,
      order,
      origin,
      generationId,
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

  let body: unknown;
  try {
    body = await context.request.json();
  } catch (error) {
    console.error("POST /api/flashcards failed to parse JSON", { error, userId });
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = CreateManualFlashcardSchema.safeParse(body);
  if (!parsed.success) {
    const hasUnrecognizedKeys = parsed.error.issues.some((issue) => issue.code === "unrecognized_keys");
    const status = hasUnrecognizedKeys ? 400 : 422;

    return json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      status
    );
  }

  const { front, back } = parsed.data;
  const payloadMeta = {
    frontLength: front.length,
    backLength: back.length,
  };

  try {
    const flashcard = await createManualFlashcard(supabase, {
      userId,
      front,
      back,
    });

    return json(flashcard, 201);
  } catch (error) {
    console.error("POST /api/flashcards failed", {
      error,
      userId,
      payloadMeta,
    });

    return json({ error: "Internal server error" }, 500);
  }
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
