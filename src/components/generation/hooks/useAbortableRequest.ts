import { useCallback, useRef } from "react";

interface UseAbortableRequestReturn {
  withAbort<T>(executor: (signal: AbortSignal) => Promise<T>): Promise<T>;
  abort(): void;
  getSignal(): AbortSignal | null;
  isActive: boolean;
}

export function useAbortableRequest(): UseAbortableRequestReturn {
  const controllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  const withAbort = useCallback(
    async <T>(executor: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      abort();

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        return await executor(controller.signal);
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    },
    [abort]
  );

  const getSignal = useCallback(() => controllerRef.current?.signal ?? null, []);

  return {
    withAbort,
    abort,
    getSignal,
    isActive: controllerRef.current !== null,
  };
}

export function isAbortError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (error instanceof Error) {
    return error.name === "AbortError" || ("code" in error && (error as { code?: number }).code === 20);
  }

  if (typeof error === "object" && "name" in (error as Record<string, unknown>)) {
    return (error as { name?: unknown }).name === "AbortError";
  }

  return false;
}
