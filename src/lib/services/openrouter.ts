const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1/";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RETRIES = 2;
const FRONT_LIMIT = 200;
const BACK_LIMIT = 500;
const MAX_PROPOSALS = 20;
const DEFAULT_SYSTEM_PROMPT =
  "You are an AI assistant specialized in creating high-quality flashcards from provided text. Your task is to extract key facts, concepts, and important information from the privided text and transform them into effective flashcards.\n\n" +
  "Guidelines:\n" +
  "- Create concise, clear questions (front) and accurate answers (back)\n" +
  "- Focus on one concept per flashcard\n" +
  "- Use simple, direct language\n" +
  "- Avoid ambiguous phrasing\n" +
  "- Ensure answers are complete but brief\n" +
  "- Prioritize the most important information\n\n" +
  "Return strictly valid JSON that matches the provided response schema. Do not add any commentary, explanations, or text outside the JSON structure.";

export interface ModelParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

export interface CreateChatInput {
  promptText: string;
  model?: string;
  systemPrompt?: string;
  params?: Partial<ModelParams>;
  schema?: JsonSchemaSpec;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface StructuredProposals {
  proposals: { front: string; back: string }[];
  usedModel: string;
  raw?: unknown;
}

export type CallOpenRouterParams = CreateChatInput;

export type CallOpenRouterResult = StructuredProposals;

export interface OpenRouterServiceConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultParams?: ModelParams;
  defaultSystemPrompt?: string;
  httpReferer?: string;
  appTitle?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

export interface OpenRouterDefaults {
  model?: string;
  params?: ModelParams;
  schema?: JsonSchemaSpec;
  systemPrompt?: string;
}

const DEFAULT_PROPOSALS_SCHEMA: JsonSchemaSpec = {
  name: "flashcards_response",
  strict: true,
  schema: {
    type: "object",
    required: ["proposals"],
    additionalProperties: false,
    properties: {
      proposals: {
        type: "array",
        minItems: 1,
        maxItems: MAX_PROPOSALS,
        items: {
          type: "object",
          required: ["front", "back"],
          additionalProperties: false,
          properties: {
            front: { type: "string", minLength: 1, maxLength: FRONT_LIMIT },
            back: { type: "string", minLength: 1, maxLength: BACK_LIMIT },
          },
        },
      },
    },
  },
};

export class OpenRouterError extends Error {
  override cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "OpenRouterError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class OpenRouterConfigurationError extends OpenRouterError {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterConfigurationError";
  }
}

export class OpenRouterApiError extends OpenRouterError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    options?: { cause?: unknown }
  ) {
    super(message, options?.cause);
    this.name = "OpenRouterApiError";
  }
}

export class OpenRouterTimeoutError extends OpenRouterError {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterTimeoutError";
  }
}

type FetchLike = typeof fetch;

interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface OpenRouterChatMessage {
  role: "system" | "user";
  content: string;
}

interface OpenRouterChatCompletionRequest extends ModelParams {
  model: string;
  messages: OpenRouterChatMessage[];
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      schema: Record<string, unknown>;
      strict?: boolean;
    };
  };
}

interface OpenRouterChoiceMessageContentPart {
  type: string;
  text?: string;
}

interface OpenRouterChoiceMessage {
  role: string;
  content?: string | OpenRouterChoiceMessageContentPart[];
}

interface OpenRouterChoice {
  index: number;
  message?: OpenRouterChoiceMessage;
  finish_reason?: string;
}

interface OpenRouterChatCompletionResponse {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage?: Record<string, unknown>;
}

export class OpenRouterService {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #httpReferer?: string;
  readonly #appTitle?: string;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #fetch: FetchLike;
  #defaults: OpenRouterDefaults;

  constructor(config: OpenRouterServiceConfig) {
    if (!config.apiKey || typeof config.apiKey !== "string") {
      throw new OpenRouterConfigurationError("OpenRouter API key is required");
    }

    this.#apiKey = config.apiKey;
    this.#baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL);
    this.#httpReferer = config.httpReferer;
    this.#appTitle = config.appTitle;
    this.#timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#fetch = config.fetchImpl ?? globalThis.fetch;
    this.#defaults = {
      model: config.defaultModel,
      params: config.defaultParams ? { ...config.defaultParams } : undefined,
      schema: undefined,
      systemPrompt: config.defaultSystemPrompt,
    };
  }

  getDefaultModel(): string | undefined {
    return this.#defaults.model;
  }

  setDefaults(partial: Partial<OpenRouterDefaults>): void {
    this.#defaults = {
      ...this.#defaults,
      ...partial,
      params: { ...this.#defaults.params, ...partial.params },
    };
  }

  async createChatCompletion(input: CreateChatInput): Promise<StructuredProposals> {
    if (!input.promptText || input.promptText.trim().length === 0) {
      throw new OpenRouterError("Prompt text must be a non-empty string");
    }

    const model = input.model ?? this.#defaults.model;
    if (!model) {
      throw new OpenRouterConfigurationError("No OpenRouter model configured");
    }

    const resolvedSystemPrompt = this.#resolveSystemPrompt(input.systemPrompt);
    const messages = this.#buildMessages(resolvedSystemPrompt, input.promptText);
    const schema = input.schema ?? this.#defaults.schema ?? DEFAULT_PROPOSALS_SCHEMA;
    const responseFormat = schema ? this.#buildResponseFormat(schema) : undefined;
    const params = this.#mergeParams(input.params);

    const payload: OpenRouterChatCompletionRequest = {
      model,
      messages,
      ...params,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    };

    const response = await this.#request<OpenRouterChatCompletionResponse>(payload, {
      signal: input.signal,
      timeoutMs: input.timeoutMs,
    });

    const choice = response.choices[0];
    if (!choice || !choice.message) {
      throw new OpenRouterApiError("OpenRouter response missing choices", 502, undefined, {
        cause: response,
      });
    }

    const rawContent = this.#extractMessageContent(choice.message.content);
    if (!rawContent) {
      throw new OpenRouterApiError("OpenRouter returned empty content", 502, undefined, {
        cause: response,
      });
    }

    const parsed = this.#parseStructured(rawContent);
    const proposals = this.#validateProposals(parsed);
    const sanitized = this.#coerceAndClamp(proposals);

    return {
      proposals: sanitized,
      usedModel: response.model ?? model,
      raw: response,
    };
  }

  async streamChatCompletion(
    input: CreateChatInput & { onDelta?: (text: string) => void }
  ): Promise<StructuredProposals> {
    void input;
    throw new OpenRouterError("streamChatCompletion is not implemented yet");
  }

  #mergeParams(override?: Partial<ModelParams>): ModelParams {
    return {
      ...this.#defaults.params,
      ...cleanUndefined(override ?? {}),
    };
  }

  #buildMessages(systemPrompt: string | undefined, userPrompt: string): OpenRouterChatMessage[] {
    const messages: OpenRouterChatMessage[] = [];
    if (systemPrompt && systemPrompt.trim().length > 0) {
      messages.push({ role: "system", content: systemPrompt.trim() });
    }
    messages.push({ role: "user", content: userPrompt });
    return messages;
  }

  #buildResponseFormat(schema: JsonSchemaSpec) {
    return {
      type: "json_schema" as const,
      json_schema: {
        name: schema.name,
        schema: schema.schema,
        ...(schema.strict === undefined ? {} : { strict: schema.strict }),
      },
    };
  }

  #resolveSystemPrompt(override?: string): string {
    if (override && override.trim().length > 0) {
      return override.trim();
    }
    if (this.#defaults.systemPrompt && this.#defaults.systemPrompt.trim().length > 0) {
      return this.#defaults.systemPrompt.trim();
    }
    return DEFAULT_SYSTEM_PROMPT;
  }

  async #request<T>(payload: OpenRouterChatCompletionRequest, options?: RequestOptions): Promise<T> {
    const url = new URL("chat/completions", this.#baseUrl).toString();
    const maxAttempts = this.#maxRetries + 1;
    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      attempt += 1;

      let shouldRetryRequest = false;
      let retryDelayMs: number | undefined;

      const controller = new AbortController();
      const abortCleanup = linkAbortSignals(controller, options?.signal);
      const timeoutMs = options?.timeoutMs ?? this.#timeoutMs;
      let timeoutError: OpenRouterTimeoutError | undefined;
      const timeoutId =
        timeoutMs > 0
          ? setTimeout(() => {
              timeoutError = new OpenRouterTimeoutError("Request timed out");
              controller.abort(timeoutError);
            }, timeoutMs)
          : undefined;

      try {
        const init: RequestInit = {
          method: "POST",
          headers: this.#headers(),
          body: JSON.stringify(cleanUndefined(payload)),
          signal: controller.signal,
        };

        const response = await this.#fetch(url, init);

        if (response.ok) {
          const data = (await response.json()) as T;
          cleanupTimer(timeoutId);
          abortCleanup();
          return data;
        }

        const bodyText = await safeReadBody(response);
        const parsedBody = parseMaybeJson(bodyText);
        const code =
          typeof parsedBody === "object" && parsedBody && "error" in parsedBody
            ? (parsedBody as Record<string, unknown>).error
            : undefined;
        const message =
          deriveErrorMessage(response.status, parsedBody) ?? `OpenRouter request failed with status ${response.status}`;
        const error = new OpenRouterApiError(message, response.status, typeof code === "string" ? code : undefined, {
          cause: parsedBody ?? bodyText,
        });
        lastError = error;

        const retryable = shouldRetry(response.status, attempt, maxAttempts);
        if (!retryable) {
          throw error;
        }

        shouldRetryRequest = true;
        retryDelayMs = parseRetryAfter(response.headers.get("retry-after")) ?? computeBackoff(attempt);
      } catch (error) {
        const reason = controller.signal.aborted
          ? (controller.signal as AbortSignal & { reason?: unknown }).reason
          : undefined;

        if (error instanceof OpenRouterTimeoutError || (timeoutError && reason === timeoutError)) {
          const effectiveError =
            error instanceof OpenRouterTimeoutError
              ? error
              : (timeoutError ?? new OpenRouterTimeoutError("Request timed out"));
          lastError = effectiveError;
          const retryable = shouldRetry(408, attempt, maxAttempts);
          if (!retryable) {
            throw effectiveError;
          }
          shouldRetryRequest = true;
          retryDelayMs = computeBackoff(attempt);
        } else if (isAbortError(error)) {
          cleanupTimer(timeoutId);
          abortCleanup();
          throw new OpenRouterError("Request aborted", error);
        } else if (error instanceof OpenRouterApiError) {
          lastError = error;
          const retryable = shouldRetry(error.status, attempt, maxAttempts);
          if (!retryable) {
            throw error;
          }
          shouldRetryRequest = true;
          retryDelayMs = retryDelayMs ?? computeBackoff(attempt);
        } else {
          lastError = error;
          const retryable = shouldRetry(500, attempt, maxAttempts);
          if (!retryable) {
            throw error as Error;
          }
          shouldRetryRequest = true;
          retryDelayMs = computeBackoff(attempt);
        }
      } finally {
        cleanupTimer(timeoutId);
        abortCleanup();
      }

      if (shouldRetryRequest) {
        await delay(retryDelayMs ?? computeBackoff(attempt));
        continue;
      }

      break;
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new OpenRouterError(`OpenRouter request failed after ${maxAttempts} attempts`, lastError);
  }

  #headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.#httpReferer) {
      headers["HTTP-Referer"] = this.#httpReferer;
    }
    if (this.#appTitle) {
      headers["X-Title"] = this.#appTitle;
    }
    return headers;
  }

  #extractMessageContent(content: OpenRouterChoiceMessage["content"]): string | undefined {
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }
          if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
            return part.text;
          }
          return "";
        })
        .join("");
    }
    return undefined;
  }

  #parseStructured(content: string): unknown {
    const direct = tryParseJson(content);
    if (direct.success) {
      return direct.value;
    }

    const extracted = extractJsonBlock(content);
    if (extracted) {
      const fallback = tryParseJson(extracted);
      if (fallback.success) {
        return fallback.value;
      }
    }

    throw new OpenRouterError(
      "Failed to parse OpenRouter response as JSON",
      direct.error ?? new Error("Unknown parse error")
    );
  }

  #validateProposals(parsed: unknown): { front: string; back: string }[] {
    if (!parsed || typeof parsed !== "object") {
      throw new OpenRouterError("Parsed response is not an object");
    }

    const proposals = (parsed as Record<string, unknown>).proposals;
    if (!Array.isArray(proposals)) {
      throw new OpenRouterError("Parsed response does not contain proposals array");
    }

    const validated = proposals.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new OpenRouterError(`Proposal at index ${index} is not an object`);
      }
      const front = (item as Record<string, unknown>).front;
      const back = (item as Record<string, unknown>).back;
      if (typeof front !== "string" || front.trim().length === 0) {
        throw new OpenRouterError(`Proposal at index ${index} has invalid front value`);
      }
      if (typeof back !== "string" || back.trim().length === 0) {
        throw new OpenRouterError(`Proposal at index ${index} has invalid back value`);
      }
      return { front, back };
    });

    if (validated.length === 0) {
      throw new OpenRouterError("No valid proposals returned by OpenRouter");
    }

    return validated;
  }

  #coerceAndClamp(proposals: { front: string; back: string }[]): { front: string; back: string }[] {
    return proposals
      .map((p) => ({
        front: p.front.trim().slice(0, FRONT_LIMIT),
        back: p.back.trim().slice(0, BACK_LIMIT),
      }))
      .filter((p) => p.front.length > 0 && p.back.length > 0)
      .slice(0, MAX_PROPOSALS);
  }
}

let cachedService: OpenRouterService | undefined;

export async function callOpenRouter(params: CallOpenRouterParams): Promise<CallOpenRouterResult> {
  const service = getServiceInstance();
  return service.createChatCompletion(params);
}

function getServiceInstance(): OpenRouterService {
  if (!cachedService) {
    const apiKey = import.meta.env?.OPENROUTER_API_KEY;
    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.warn("[OpenRouter] Missing OPENROUTER_API_KEY environment variable.");
      throw new OpenRouterConfigurationError("OPENROUTER_API_KEY is not configured");
    }

    cachedService = new OpenRouterService({
      apiKey,
      baseUrl: import.meta.env?.OPENROUTER_BASE_URL,
      defaultModel: "openai/gpt-oss-20b:free",
      defaultParams: undefined,
      httpReferer: import.meta.env?.OPENROUTER_HTTP_REFERER,
      appTitle: import.meta.env?.OPENROUTER_TITLE,
    });
  }

  return cachedService;
}

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl.endsWith("/")) {
    return `${baseUrl}/`;
  }
  return baseUrl;
}

function cleanUndefined<T extends object>(obj: T): T {
  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

function linkAbortSignals(controller: AbortController, external?: AbortSignal): () => void {
  if (!external) {
    return () => {
      /* noop */
    };
  }

  const abort = () => controller.abort(external.reason);
  if (external.aborted) {
    abort();
    return () => {
      /* noop */
    };
  }

  external.addEventListener("abort", abort, { once: true });
  return () => external.removeEventListener("abort", abort);
}

function cleanupTimer(timeoutId: ReturnType<typeof setTimeout> | undefined): void {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
}

function shouldRetry(status: number, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) {
    return false;
  }

  if (status === 408 || status === 429) {
    return true;
  }

  if (status >= 500 && status < 600) {
    return true;
  }

  return false;
}

function computeBackoff(attempt: number): number {
  const base = Math.min(1_000 * 2 ** (attempt - 1), 10_000);
  const jitter = Math.random() * 250;
  return base + jitter;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }

  const numeric = Number(header);
  if (!Number.isNaN(numeric)) {
    return Math.max(0, numeric * 1000);
  }

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    return delta > 0 ? delta : 0;
  }

  return undefined;
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `Failed to read body: ${(error as Error).message}`;
  }
}

function parseMaybeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function deriveErrorMessage(status: number, body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.detail ?? record.reason;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  if (status === 401 || status === 403) {
    return "OpenRouter request unauthorized. Check API key permissions.";
  }
  if (status === 429) {
    return "OpenRouter rate limit exceeded. Please retry later.";
  }
  if (status >= 500) {
    return "OpenRouter service is unavailable. Please retry.";
  }
  if (status === 404) {
    return "Requested OpenRouter model or resource was not found.";
  }
  if (status === 400) {
    return "OpenRouter rejected the request payload.";
  }

  return undefined;
}

function tryParseJson(text: string): { success: true; value: unknown } | { success: false; error: unknown } {
  try {
    return { success: true, value: JSON.parse(text) };
  } catch (error) {
    return { success: false, error };
  }
}

function extractJsonBlock(text: string): string | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : (error as { name?: string }).name === "AbortError";
}
