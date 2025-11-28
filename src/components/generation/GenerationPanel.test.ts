import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/ui/use-toast";
import { ApiError } from "@/lib/api/generations.client";
import type { GenerationSummaryDTO } from "@/types";

import {
  computeRemainingCapacity,
  formatDuration,
  handleAcceptError,
  mapGenerationToMeta,
  readableErrorMessage,
} from "./GenerationPanel";
import type { GenerationMeta } from "./types";

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
}));

describe("mapGenerationToMeta", () => {
  const makeSummary = (overrides: Partial<GenerationSummaryDTO> = {}): GenerationSummaryDTO => ({
    id: 42,
    totalCount: 10,
    acceptedEditedCount: null,
    acceptedUneditedCount: null,
    model: "gpt-4o",
    generationDuration: 1200,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  });

  it("maps DTO fields and normalizes undefined counts", () => {
    const summary = makeSummary({ acceptedEditedCount: null, acceptedUneditedCount: undefined });

    const meta = mapGenerationToMeta(summary);

    expect(meta).toEqual({
      id: 42,
      model: "gpt-4o",
      generationDuration: 1200,
      totalCount: 10,
      acceptedEditedCount: 0,
      acceptedUneditedCount: 0,
    });
  });

  it("preserves provided accepted counts", () => {
    const summary = makeSummary({ acceptedEditedCount: 3, acceptedUneditedCount: 5 });

    const meta = mapGenerationToMeta(summary);

    expect(meta.acceptedEditedCount).toBe(3);
    expect(meta.acceptedUneditedCount).toBe(5);
  });
});

describe("formatDuration", () => {
  it("returns placeholder for non-finite values", () => {
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("--");
    expect(formatDuration(Number.NaN)).toBe("--");
  });

  it("formats durations below one second in milliseconds", () => {
    expect(formatDuration(500)).toBe("500 ms");
  });

  it("formats durations of one second or more in seconds with one decimal", () => {
    expect(formatDuration(1500)).toBe("1.5 s");
  });
});

describe("computeRemainingCapacity", () => {
  const makeMeta = (overrides: Partial<GenerationMeta> = {}): GenerationMeta => ({
    id: 1,
    model: "gpt-4o",
    generationDuration: 1200,
    totalCount: 10,
    acceptedEditedCount: 2,
    acceptedUneditedCount: 3,
    ...overrides,
  });

  it("returns undefined when meta is undefined", () => {
    expect(computeRemainingCapacity(undefined)).toBeUndefined();
  });

  it("returns remaining slots when usage is below total", () => {
    const meta = makeMeta();

    expect(computeRemainingCapacity(meta)).toBe(5);
  });

  it("never returns negative values", () => {
    const meta = makeMeta({ totalCount: 3, acceptedEditedCount: 3, acceptedUneditedCount: 5 });

    expect(computeRemainingCapacity(meta)).toBe(0);
  });
});

describe("readableErrorMessage", () => {
  it("prefers explicit error messages", () => {
    expect(readableErrorMessage({ message: "Custom error" })).toBe("Custom error");
  });

  it("falls back to status code when message is missing", () => {
    expect(readableErrorMessage({ status: 503 })).toBe("Serwer zwrócił kod 503.");
  });

  it("returns fallback when no details are provided", () => {
    expect(readableErrorMessage(undefined as unknown as { status?: number; message?: string })).toBe("Wystąpił błąd.");
  });
});

describe("handleAcceptError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const toastMock = vi.mocked(toast);

  const assertToastCall = (status: number, expected: { title: string; description: string }) => {
    const error = new ApiError(status, "Server error");

    handleAcceptError(error);

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: expected.title,
        description: expected.description,
      })
    );
  };

  it("shows permission error for 403 responses", () => {
    assertToastCall(403, {
      title: "Brak uprawnień",
      description: "Nie możesz wykonać tej operacji.",
    });
  });

  it("shows missing generation message for 404 responses", () => {
    assertToastCall(404, {
      title: "Generacja nie znaleziona",
      description: "Odśwież widok i spróbuj ponownie.",
    });
  });

  it("shows limit error for 409 responses", () => {
    assertToastCall(409, {
      title: "Przekroczono limit",
      description: "Nie można zaakceptować większej liczby fiszek.",
    });
  });

  it("shows validation error for 422 responses", () => {
    assertToastCall(422, {
      title: "Błędy walidacji",
      description: "Popraw treści fiszek zanim je zapiszesz.",
    });
  });

  it("falls back to readable error message for other ApiError statuses", () => {
    const error = new ApiError(500, "Serwer zajęty");

    handleAcceptError(error);

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Serwer zajęty",
      })
    );
  });

  it("shows generic toast when error is not ApiError", () => {
    handleAcceptError(new Error("Unexpected"));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Nie udało się zapisać propozycji",
        description: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
      })
    );
  });
});
