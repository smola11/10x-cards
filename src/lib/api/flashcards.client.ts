import type { FlashcardsListQuery, FlashcardsListResponse } from "@/types";

import { ApiError } from "./generations.client";

interface ListFlashcardsOptions {
  signal?: AbortSignal;
}

const DEFAULT_QUERY: Required<Pick<FlashcardsListQuery, "page" | "limit" | "sort" | "order">> = {
  page: 1,
  limit: 50,
  sort: "created_at",
  order: "desc",
};

export async function listFlashcards(
  query: FlashcardsListQuery = {},
  options: ListFlashcardsOptions = {}
): Promise<FlashcardsListResponse> {
  const finalQuery = { ...DEFAULT_QUERY, ...query } satisfies FlashcardsListQuery;
  const searchParams = new URLSearchParams();

  if (typeof finalQuery.page === "number" && Number.isFinite(finalQuery.page)) {
    searchParams.set("page", String(finalQuery.page));
  }

  if (typeof finalQuery.limit === "number" && Number.isFinite(finalQuery.limit)) {
    searchParams.set("limit", String(finalQuery.limit));
  }

  if (typeof finalQuery.sort === "string" && finalQuery.sort.length > 0) {
    searchParams.set("sort", finalQuery.sort);
  }

  if (typeof finalQuery.order === "string" && finalQuery.order.length > 0) {
    searchParams.set("order", finalQuery.order);
  }

  if (typeof finalQuery.origin === "string" && finalQuery.origin.length > 0) {
    searchParams.set("origin", finalQuery.origin);
  }

  if (typeof finalQuery.generationId === "number" && Number.isFinite(finalQuery.generationId)) {
    searchParams.set("generationId", String(finalQuery.generationId));
  }

  const queryString = searchParams.toString();
  const url = queryString.length > 0 ? `/api/flashcards?${queryString}` : "/api/flashcards";

  const response = await fetch(url, { signal: options.signal });

  return handleResponse<FlashcardsListResponse>(response);
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  const isJson = contentType ? contentType.includes("application/json") : false;
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : response.statusText;
    throw new ApiError(response.status, message || "Request failed", payload ?? undefined);
  }

  return (payload ?? ({} as T)) as T;
}
