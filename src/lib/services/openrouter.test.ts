import { describe, expect, it, vi } from "vitest";
import { OpenRouterService, OpenRouterTimeoutError, OpenRouterApiError } from "./openrouter";
import type { OpenRouterServiceConfig } from "./openrouter";

const BASE_CONFIG: OpenRouterServiceConfig = {
  apiKey: "test-key",
  defaultModel: "openai/gpt-oss-20b:free",
};

function createService(options?: Partial<OpenRouterServiceConfig>) {
  return new OpenRouterService({
    ...BASE_CONFIG,
    ...options,
  });
}

function createMockResponse<T>(status: number, body: T, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

describe("OpenRouterService", () => {
  it("retries on HTTP failures and resolves once a successful response arrives", async () => {
    const mockResponses = [
      createMockResponse(500, JSON.stringify({ message: "boom" })),
      createMockResponse(200, {
        id: "completion-1",
        model: "openai/gpt-oss-20b:free",
        choices: [
          {
            message: {
              content: JSON.stringify({
                flashcards: [{ front: "Term", back: "Definition" }],
              }),
            },
          },
        ],
      }),
    ];

    const fetchMock = vi.fn(() => {
      const response = mockResponses.shift();
      if (!response) {
        throw new Error("Missing mock response");
      }
      return Promise.resolve(response);
    });

    const service = createService({
      fetchImpl: fetchMock as unknown as typeof fetch,
      maxRetries: 1,
      timeoutMs: 1000,
    });

    const result = await service.createChatCompletion({
      promptText: "Explain retry behavior",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.proposals).toEqual([{ front: "Term", back: "Definition" }]);
    expect(result.usedModel).toBe("openai/gpt-oss-20b:free");
  });

  it("throws OpenRouterTimeoutError when the request exceeds the configured timeout", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const handler = () => {
            const abortError = new Error("fetch aborted");
            abortError.name = "AbortError";
            reject(abortError);
          };
          init?.signal?.addEventListener("abort", handler, { once: true });
        })
    );

    const service = createService({
      fetchImpl: fetchMock as unknown as typeof fetch,
      maxRetries: 0,
      timeoutMs: 5,
    });

    try {
      const promise = service.createChatCompletion({
        promptText: "timeout test",
        timeoutMs: 5,
      });

      vi.advanceTimersByTime(10);

      await expect(promise).rejects.toBeInstanceOf(OpenRouterTimeoutError);
    } finally {
      vi.useRealTimers();
    }
  });

  it("parses error as string code correctly", async () => {
    const mockResponse = createMockResponse(401, {
      error: "invalid_api_key",
    });

    const fetchMock = vi.fn(() => Promise.resolve(mockResponse));

    const service = createService({
      fetchImpl: fetchMock as unknown as typeof fetch,
      maxRetries: 0,
    });

    try {
      await service.createChatCompletion({
        promptText: "Test error parsing",
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(OpenRouterApiError);
      const apiError = error as OpenRouterApiError;
      expect(apiError.status).toBe(401);
      expect(apiError.code).toBe("invalid_api_key");
      // For 401 status, deriveErrorMessage provides a sensible default
      expect(apiError.message).toContain("unauthorized");
    }
  });

  it("parses error as structured object correctly", async () => {
    const mockResponse = createMockResponse(429, {
      error: {
        code: "rate_limit_exceeded",
        message: "Too many requests",
        details: "Please wait 60 seconds",
        metadata: { retry_after: 60 },
      },
    });

    const fetchMock = vi.fn(() => Promise.resolve(mockResponse));

    const service = createService({
      fetchImpl: fetchMock as unknown as typeof fetch,
      maxRetries: 0,
    });

    try {
      await service.createChatCompletion({
        promptText: "Test structured error parsing",
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(OpenRouterApiError);
      const apiError = error as OpenRouterApiError;
      expect(apiError.status).toBe(429);
      expect(apiError.code).toBe("rate_limit_exceeded");
      expect(apiError.message).toBe("Too many requests");
      expect(apiError.details).toBe("Please wait 60 seconds");
      expect(apiError.metadata).toEqual({ metadata: { retry_after: 60 } });
    }
  });

  it("handles error with type field instead of code", async () => {
    const mockResponse = createMockResponse(400, {
      error: {
        type: "invalid_request_error",
        message: "Invalid model specified",
      },
    });

    const fetchMock = vi.fn(() => Promise.resolve(mockResponse));

    const service = createService({
      fetchImpl: fetchMock as unknown as typeof fetch,
      maxRetries: 0,
    });

    try {
      await service.createChatCompletion({
        promptText: "Test type field parsing",
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(OpenRouterApiError);
      const apiError = error as OpenRouterApiError;
      expect(apiError.status).toBe(400);
      expect(apiError.code).toBe("invalid_request_error");
      expect(apiError.message).toBe("Invalid model specified");
    }
  });

  it("falls back to deriveErrorMessage when no structured error", async () => {
    const mockResponse = createMockResponse(404, {
      message: "Model not found",
    });

    const fetchMock = vi.fn(() => Promise.resolve(mockResponse));

    const service = createService({
      fetchImpl: fetchMock as unknown as typeof fetch,
      maxRetries: 0,
    });

    try {
      await service.createChatCompletion({
        promptText: "Test fallback parsing",
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(OpenRouterApiError);
      const apiError = error as OpenRouterApiError;
      expect(apiError.status).toBe(404);
      expect(apiError.message).toBe("Model not found");
      expect(apiError.code).toBeUndefined();
    }
  });
});
