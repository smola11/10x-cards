import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listGenerations } from "@/lib/api/generations.client";
import type { GenerationSummaryDTO, GenerationsListResponse } from "@/types";

type Status = "idle" | "loading" | "ready" | "error";

interface ViewState {
  status: Status;
  data?: GenerationsListResponse;
  error?: string;
}

interface Props {
  onSelectGeneration?: (generation: GenerationSummaryDTO) => void;
}

const PAGE_LIMIT = 10;

export default function GenerationsList({ onSelectGeneration }: Props) {
  const [viewState, setViewState] = useState<ViewState>({ status: "idle" });
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setViewState((prev) => ({ ...prev, status: "loading" }));

      try {
        const response = await listGenerations({ limit: PAGE_LIMIT });
        if (!isActive) {
          return;
        }

        setViewState({ status: "ready", data: response });
        setCursor(response.nextCursor);
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message =
          error instanceof Error && error.message ? error.message : "Nie udało się pobrać listy generacji.";

        setViewState({ status: "error", error: message });
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  const handleLoadMore = async () => {
    if (!cursor) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const response = await listGenerations({ limit: PAGE_LIMIT, cursor });

      setViewState((prev) => {
        if (!prev.data) {
          return { status: "ready", data: response };
        }

        return {
          status: "ready",
          data: {
            items: [...prev.data.items, ...response.items],
            nextCursor: response.nextCursor,
          },
        };
      });

      setCursor(response.nextCursor);
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Nie udało się pobrać kolejnych generacji.";

      setViewState((prev) => ({
        ...prev,
        status: "error",
        error: message,
      }));
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (viewState.status === "loading" && !viewState.data) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Twoje generacje</h2>
            <p className="text-xs text-muted-foreground">
              Ładujemy historię generacji, aby ułatwić filtrowanie fiszek.
            </p>
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  if (viewState.status === "error" && !viewState.data) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="text-sm font-semibold text-destructive">Nie udało się pobrać generacji</h2>
        <p className="text-xs text-muted-foreground">{viewState.error}</p>
      </div>
    );
  }

  const items = viewState.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/60 bg-muted/10 p-4">
        <h2 className="text-sm font-semibold text-foreground">Brak zapisanych generacji</h2>
        <p className="text-xs text-muted-foreground">
          Wygeneruj fiszki z pomocą AI, aby zobaczyć tutaj historię generacji i łatwo filtrować fiszki.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Twoje generacje</h2>
          <p className="text-xs text-muted-foreground">
            Kliknij generację, aby wyświetlić powiązane fiszki we widoku „Zapisane fiszki”.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Łącznie: {items.length}
        </Badge>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((generation) => {
          const accepted = (generation.acceptedEditedCount ?? 0) + (generation.acceptedUneditedCount ?? 0);

          return (
            <li key={generation.id}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-left text-xs shadow-xs transition hover:border-border hover:bg-background"
                onClick={() => onSelectGeneration?.(generation)}
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-medium text-foreground">Generacja #{generation.id}</span>
                    <span className="text-[11px] text-muted-foreground">• {generation.model}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>
                      Fiszki: {accepted} / {generation.totalCount}
                    </span>
                    <span>• Czas: {formatDuration(generation.generationDuration)}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="self-center text-[11px]">
                  Pokaż fiszki
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>

      {cursor ? (
        <div className="mt-1 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Ładowanie..." : "Załaduj więcej"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs)) {
    return "--";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  const seconds = durationMs / 1000;
  return `${seconds.toFixed(1)} s`;
}
