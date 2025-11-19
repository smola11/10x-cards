import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listFlashcards } from "@/lib/api/flashcards.client";
import { ApiError } from "@/lib/api/generations.client";
import { cn } from "@/lib/utils";
import type { FlashcardDTO, FlashcardOrigin, FlashcardsListResponse, SortOrder } from "@/types";

type OriginFilter = "all" | FlashcardOrigin;

interface QueryState {
  page: number;
  origin: OriginFilter;
  generationId?: number;
  sort: "created_at" | "updated_at";
  order: SortOrder;
}

interface ViewState {
  status: "idle" | "loading" | "ready" | "error";
  data?: FlashcardsListResponse;
  error?: string;
}

const ORIGIN_OPTIONS: { value: OriginFilter; label: string }[] = [
  { value: "all", label: "Wszystkie źródła" },
  { value: "manual", label: "Dodane ręcznie" },
  { value: "ai-full", label: "AI – bez edycji" },
  { value: "ai-edited", label: "AI – po edycji" },
];

const DEFAULT_QUERY: QueryState = {
  page: 1,
  origin: "all",
  sort: "created_at",
  order: "desc",
};

const LIMIT = 20;

function parseInitialQuery(): QueryState {
  if (typeof window === "undefined") {
    return DEFAULT_QUERY;
  }

  const params = new URLSearchParams(window.location.search);
  const base: QueryState = { ...DEFAULT_QUERY };

  const pageParam = Number.parseInt(params.get("page") ?? "", 10);
  if (Number.isFinite(pageParam) && pageParam > 0) {
    base.page = pageParam;
  }

  const originParam = params.get("origin");
  if (originParam === "manual" || originParam === "ai-full" || originParam === "ai-edited") {
    base.origin = originParam;
  }

  const generationParam = Number.parseInt(params.get("generationId") ?? "", 10);
  if (Number.isFinite(generationParam) && generationParam > 0) {
    base.generationId = generationParam;
  }

  return base;
}

function formatDate(formatter: Intl.DateTimeFormat, value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "--";
  }

  return formatter.format(date);
}

function getOriginLabel(origin: FlashcardOrigin): string {
  switch (origin) {
    case "manual":
      return "Dodane ręcznie";
    case "ai-full":
      return "AI – bez edycji";
    case "ai-edited":
      return "AI – po edycji";
    default:
      return origin;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message || "Nie udało się pobrać fiszek.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Nie udało się pobrać fiszek.";
}

export default function FlashcardsListView() {
  const [query, setQuery] = useState<QueryState>(() => parseInitialQuery());
  const [viewState, setViewState] = useState<ViewState>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const [generationIdInput, setGenerationIdInput] = useState<string>(() =>
    typeof query.generationId === "number" ? String(query.generationId) : ""
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("pl-PL", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    []
  );

  useEffect(() => {
    const params = new URLSearchParams();

    if (query.page > 1) {
      params.set("page", String(query.page));
    }

    if (query.origin !== "all") {
      params.set("origin", query.origin);
    }

    if (typeof query.generationId === "number") {
      params.set("generationId", String(query.generationId));
    }

    const next = params.toString();
    const nextUrl = next.length > 0 ? `${window.location.pathname}?${next}` : window.location.pathname;

    window.history.replaceState({}, "", nextUrl);
  }, [query]);

  useEffect(() => {
    setGenerationIdInput(typeof query.generationId === "number" ? String(query.generationId) : "");
  }, [query.generationId]);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setViewState((prev) => ({ status: "loading", data: prev.data }));

    const fetchData = async () => {
      try {
        const response = await listFlashcards(
          {
            page: query.page,
            limit: LIMIT,
            sort: query.sort,
            order: query.order,
            origin: query.origin === "all" ? undefined : query.origin,
            generationId: query.generationId,
          },
          { signal: controller.signal }
        );

        if (!isActive) {
          return;
        }

        setViewState({ status: "ready", data: response });
      } catch (error) {
        if (!isActive || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        setViewState((prev) => ({ status: "error", error: getErrorMessage(error), data: prev.data }));
      }
    };

    void fetchData();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [query, reloadKey]);

  const isLoading = viewState.status === "loading" && !viewState.data;
  const disableControls = viewState.status === "loading";

  const handleChangeOrigin = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextOrigin = event.target.value as OriginFilter;
    setQuery((prev) => ({ ...prev, page: 1, origin: nextOrigin }));
  };

  const handleChangeGenerationInput = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (/^\d*$/.test(value)) {
      setGenerationIdInput(value);
    }
  };

  const handleApplyGeneration = () => {
    const parsed = Number.parseInt(generationIdInput, 10);
    setQuery((prev) => ({
      ...prev,
      page: 1,
      generationId: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    }));
  };

  const handleClearGeneration = () => {
    setGenerationIdInput("");
    setQuery((prev) => ({ ...prev, page: 1, generationId: undefined }));
  };

  const handleResetFilters = () => {
    setGenerationIdInput("");
    setQuery({ ...DEFAULT_QUERY });
  };

  const handleRetry = () => {
    setReloadKey((value) => value + 1);
  };

  const handleChangePage = (nextPage: number) => {
    setQuery((prev) => ({ ...prev, page: Math.max(1, nextPage) }));
  };

  const totalItems = viewState.data?.totalItems ?? 0;
  const itemsShown = viewState.data?.items.length ?? 0;
  const page = query.page;
  const totalPages = viewState.data?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card/40 p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Zapisane fiszki</h1>
          <p className="text-sm text-muted-foreground">
            Przeglądaj fiszki zaakceptowane z generacji AI lub dodane ręcznie. Użyj filtrów, aby zawęzić listę.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Łącznie: {totalItems}</Badge>
          {typeof query.generationId === "number" ? (
            <Badge variant="secondary">Generacja #{query.generationId}</Badge>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 rounded-lg border border-dashed border-border/60 bg-muted/10 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Źródło
            <select
              value={query.origin}
              onChange={handleChangeOrigin}
              disabled={disableControls}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {ORIGIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-sm font-medium text-foreground">
            <span>Id generacji</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                value={generationIdInput}
                onChange={handleChangeGenerationInput}
                disabled={disableControls}
                placeholder="np. 42"
                className="h-10 w-28 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyGeneration}
                disabled={disableControls}
              >
                Zastosuj
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearGeneration}
                disabled={disableControls || generationIdInput.length === 0}
              >
                Wyczyść
              </Button>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            disabled={disableControls}
            className="ml-auto"
          >
            Resetuj filtry
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            Strona {page} z {totalPages}
          </span>
          <span>Wyświetlane: {itemsShown}</span>
        </div>
      </section>

      <section className="min-h-[240px]">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : viewState.status === "error" ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-10 text-center">
            <h2 className="text-lg font-semibold text-destructive">Nie udało się pobrać fiszek</h2>
            <p className="max-w-lg text-sm text-muted-foreground">{viewState.error}</p>
            <Button type="button" onClick={handleRetry} size="sm">
              Spróbuj ponownie
            </Button>
          </div>
        ) : viewState.data && viewState.data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/5 p-10 text-center">
            <h2 className="text-base font-semibold text-foreground">Brak fiszek do wyświetlenia</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Nie znaleziono fiszek dla wybranych filtrów. Spróbuj zresetować filtry lub zaakceptuj nowe propozycje.
            </p>
          </div>
        ) : viewState.data ? (
          <ul className="grid gap-3">
            {viewState.data.items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-border/70 bg-background/90 p-5 shadow-xs transition hover:border-border hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Przód</span>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{item.front}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge variant="outline">{getOriginLabel(item.origin)}</Badge>
                    {typeof item.generationId === "number" ? (
                      <Badge variant="secondary">Generacja #{item.generationId}</Badge>
                    ) : (
                      <Badge variant="subtle">Brak generacji</Badge>
                    )}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tył</span>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{item.back}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Utworzono: {formatDate(dateFormatter, item.createdAt)}</span>
                  <span>Aktualizacja: {formatDate(dateFormatter, item.updatedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-sm text-muted-foreground">
        <span>
          {totalItems > 0 ? `Wyświetlono ${itemsShown} z ${totalItems} fiszek` : "Brak fiszek do wyświetlenia"}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disableControls || !(viewState.data?.hasPrevPage ?? false)}
            onClick={() => handleChangePage(page - 1)}
          >
            Poprzednia
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disableControls || !(viewState.data?.hasNextPage ?? false)}
            onClick={() => handleChangePage(page + 1)}
          >
            Następna
          </Button>
        </div>
      </footer>
    </div>
  );
}
