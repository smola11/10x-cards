import type {
  AcceptGenerationProposalsCommand,
  AcceptGenerationProposalsResponse,
  CreateGenerationCommand,
  CreateGenerationResponse,
  GenerationsListQuery,
  GenerationsListResponse,
  GetGenerationQuery,
  GetGenerationResponse,
} from "@/types";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface FetchOptions {
  signal?: AbortSignal;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  const isJson = contentType ? contentType.includes("application/json") : false;
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : response.statusText;
    throw new ApiError(response.status, message || "Request failed", payload);
  }

  return (payload ?? ({} as T)) as T;
}

export async function createGeneration(
  command: CreateGenerationCommand,
  options: FetchOptions = {}
): Promise<CreateGenerationResponse> {
  const response = await fetch("/api/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: options.signal,
  });

  return handleResponse<CreateGenerationResponse>(response);
}

export async function listGenerations(
  query: GenerationsListQuery = {},
  options: FetchOptions = {}
): Promise<GenerationsListResponse> {
  const searchParams = new URLSearchParams();

  if (typeof query.limit === "number") {
    searchParams.set("limit", String(query.limit));
  }

  if (typeof query.cursor === "string" && query.cursor.length > 0) {
    searchParams.set("cursor", query.cursor);
  }

  if (typeof query.sort === "string" && query.sort.length > 0) {
    searchParams.set("sort", query.sort);
  }

  const queryString = searchParams.toString();
  const url = queryString.length > 0 ? `/api/generations?${queryString}` : "/api/generations";

  const response = await fetch(url, {
    method: "GET",
    signal: options.signal,
  });

  return handleResponse<GenerationsListResponse>(response);
}

export async function getGeneration(
  id: number,
  query: GetGenerationQuery = {},
  options: FetchOptions = {}
): Promise<GetGenerationResponse> {
  const searchParams = new URLSearchParams();

  if (typeof query.includeFlashcards === "boolean") {
    searchParams.set("includeFlashcards", String(query.includeFlashcards));
  }

  const queryString = searchParams.toString();
  const url = queryString.length > 0 ? `/api/generations/${id}?${queryString}` : `/api/generations/${id}`;

  const response = await fetch(url, {
    method: "GET",
    signal: options.signal,
  });

  return handleResponse<GetGenerationResponse>(response);
}

export async function acceptProposals(
  generationId: number,
  command: AcceptGenerationProposalsCommand,
  options: FetchOptions = {}
): Promise<AcceptGenerationProposalsResponse> {
  const response = await fetch(`/api/generations/${generationId}/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: options.signal,
  });

  return handleResponse<AcceptGenerationProposalsResponse>(response);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
