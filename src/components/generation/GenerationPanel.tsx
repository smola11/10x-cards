import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "@/components/ui/use-toast";
import { acceptProposals, createGeneration, isApiError } from "@/lib/api/generations.client";
import type { AcceptGenerationProposalsCommand, GenerationSummaryDTO } from "@/types";
import AcceptActionsBar from "./AcceptActionsBar";
import ProposalsList from "./ProposalsList";
import ProposalsToolbar from "./ProposalsToolbar";
import TextareaWithCounter from "./TextareaWithCounter";
import type {
  GenerationMeta,
  GenerationViewModel,
  PendingAction,
  ProposalId,
  ProposalViewModel,
  ProposalsFilter,
} from "./types";
import { useAbortableRequest, isAbortError } from "./hooks/useAbortableRequest";
import { useProposalsState } from "./hooks/useProposalsState";

const PROMPT_MIN = 1000;
const PROMPT_MAX = 10000;
const FRONT_MIN = 1;
const FRONT_MAX = 200;
const BACK_MIN = 1;
const BACK_MAX = 500;

const INITIAL_STATE: GenerationViewModel = {
  status: "idle",
  promptText: "",
};

function GenerationPanel() {
  const [state, setState] = useState<GenerationViewModel>(INITIAL_STATE);
  const [ctaHref, setCtaHref] = useState<string | null>(null);

  const { withAbort, abort } = useAbortableRequest();
  const {
    proposals,
    filteredProposals,
    filter,
    setFilter,
    selectedCount,
    allSelectedInFilter,
    someSelectedInFilter,
    validProposals,
    validSelectedProposals,
    hasEdited,
    initialize: initializeProposals,
    editProposal,
    toggleSelect,
    toggleAll,
    clearEdits,
    removeMany,
  } = useProposalsState({
    frontMin: FRONT_MIN,
    frontMax: FRONT_MAX,
    backMin: BACK_MIN,
    backMax: BACK_MAX,
  });

  const promptLength = state.promptText.length;
  const promptInvalid = promptLength > 0 && (promptLength < PROMPT_MIN || promptLength > PROMPT_MAX);
  const promptError = promptInvalid
    ? `Tekst musi zawierać od ${PROMPT_MIN.toLocaleString("pl-PL")} do ${PROMPT_MAX.toLocaleString("pl-PL")} znaków.`
    : undefined;
  const canGenerate = state.pendingAction === undefined && promptLength >= PROMPT_MIN && promptLength <= PROMPT_MAX;

  const isAccepting = state.pendingAction === "accept-all" || state.pendingAction === "accept-selected";

  const remainingCapacity = computeRemainingCapacity(state.meta);

  const handlePromptChange = useCallback((value: string) => {
    setState((prev) => ({ ...prev, promptText: value, error: undefined }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      return;
    }

    setCtaHref(null);

    setState((prev) => ({
      ...prev,
      status: "loading",
      pendingAction: "generate",
      error: undefined,
      wasAborted: false,
    }));

    try {
      const response = await withAbort((signal) => createGeneration({ promptText: state.promptText }, { signal }));

      initializeProposals({ generationId: response.generation.id, proposals: response.proposals });

      setState((prev) => ({
        ...prev,
        status: "ready",
        pendingAction: undefined,
        error: undefined,
        wasAborted: false,
        meta: mapGenerationToMeta(response.generation),
      }));

      if (response.proposals.length === 0) {
        toast({
          variant: "info",
          title: "Brak propozycji",
          description: "Model nie zwrócił żadnych propozycji. Spróbuj zmodyfikować tekst.",
        });
      }
    } catch (error) {
      if (isAbortError(error)) {
        setState((prev) => ({
          ...prev,
          status: "idle",
          pendingAction: undefined,
          wasAborted: true,
        }));
        return;
      }

      if (isApiError(error)) {
        if (error.status === 422) {
          setState((prev) => ({
            ...prev,
            pendingAction: undefined,
            status: "idle",
            error: "Walidacja nie powiodła się. Upewnij się, że tekst ma prawidłową długość.",
          }));
          return;
        }

        toast({
          variant: "destructive",
          title: "Nie udało się wygenerować propozycji",
          description: readableErrorMessage(error),
        });
      } else {
        toast({
          variant: "destructive",
          title: "Nie udało się wygenerować propozycji",
          description: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
        });
      }

      setState((prev) => ({
        ...prev,
        status: "error",
        pendingAction: undefined,
      }));
    }
  }, [canGenerate, withAbort, state.promptText, initializeProposals]);

  const handleCancelGeneration = useCallback(() => {
    abort();
    setState((prev) => ({
      ...prev,
      pendingAction: undefined,
      status: "idle",
      wasAborted: true,
    }));
  }, [abort]);

  const handleEditProposal = useCallback(
    (id: ProposalId, updates: { front?: string; back?: string }) => {
      editProposal(id, updates);
    },
    [editProposal]
  );

  const handleToggleSelect = useCallback(
    (id: ProposalId, selected: boolean) => {
      toggleSelect(id, selected);
    },
    [toggleSelect]
  );

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      toggleAll(checked);
    },
    [toggleAll]
  );

  const handleFilterChange = useCallback(
    (nextFilter: ProposalsFilter) => {
      setFilter(nextFilter);
    },
    [setFilter]
  );

  const handleClearEdits = useCallback(() => {
    clearEdits();
  }, [clearEdits]);

  const runAcceptMutation = useCallback(
    async (pendingAction: PendingAction, proposalsToSave: ProposalViewModel[]) => {
      if (!state.meta) {
        return;
      }

      const command: AcceptGenerationProposalsCommand = {
        flashcards: proposalsToSave.map((proposal) => ({
          front: proposal.front.trim(),
          back: proposal.back.trim(),
          edited: proposal.edited,
        })),
      };

      setState((prev) => ({ ...prev, pendingAction, error: undefined }));

      try {
        const response = await acceptProposals(state.meta.id, command);

        removeMany(proposalsToSave.map((proposal) => proposal.id));

        setState((prev) => ({
          ...prev,
          pendingAction: undefined,
          meta: mapGenerationToMeta(response.generation),
        }));

        setCtaHref(`/flashcards?generationId=${response.generation.id}`);

        toast({
          variant: "success",
          title: "Propozycje zapisane",
          description: `Dodano ${proposalsToSave.length} fiszek do Twojej kolekcji.`,
        });
      } catch (error) {
        handleAcceptError(error);
        setState((prev) => ({ ...prev, pendingAction: undefined }));
      }
    },
    [removeMany, state.meta]
  );

  const handleSaveAll = useCallback(() => {
    const proposalsToSave = validProposals;
    if (proposalsToSave.length === 0) {
      toast({
        variant: "info",
        title: "Brak gotowych propozycji",
        description: "Upewnij się, że wszystkie pola mają poprawną długość.",
      });
      return;
    }

    if (typeof remainingCapacity === "number" && proposalsToSave.length > remainingCapacity) {
      toast({
        variant: "destructive",
        title: "Przekroczony limit",
        description: "Nie możesz zaakceptować większej liczby fiszek niż wygenerowano.",
      });
      return;
    }

    void runAcceptMutation("accept-all", proposalsToSave);
  }, [remainingCapacity, runAcceptMutation, validProposals]);

  const handleSaveSelected = useCallback(() => {
    const proposalsToSave = validSelectedProposals;
    if (proposalsToSave.length === 0) {
      toast({
        variant: "info",
        title: "Brak zaznaczonych propozycji",
        description: "Zaznacz co najmniej jedną poprawną propozycję, aby kontynuować.",
      });
      return;
    }

    if (typeof remainingCapacity === "number" && proposalsToSave.length > remainingCapacity) {
      toast({
        variant: "destructive",
        title: "Przekroczony limit",
        description: "Zrezygnuj z części fiszek lub zaakceptuj mniejszą liczbę.",
      });
      return;
    }

    void runAcceptMutation("accept-selected", proposalsToSave);
  }, [remainingCapacity, runAcceptMutation, validSelectedProposals]);

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.45fr)_1fr]">
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Tekst źródłowy</h2>
                <p className="text-sm text-muted-foreground">
                  Wklej treść, z której chcesz wygenerować propozycje fiszek.
                </p>
              </div>
              {state.meta ? (
                <Badge variant="secondary" className="whitespace-nowrap">
                  {state.meta.model} • {formatDuration(state.meta.generationDuration)}
                </Badge>
              ) : null}
            </div>

            <TextareaWithCounter
              value={state.promptText}
              onChange={handlePromptChange}
              min={PROMPT_MIN}
              max={PROMPT_MAX}
              disabled={state.pendingAction === "generate"}
              error={promptError ?? state.error}
              placeholder="Wklej lub wpisz tekst źródłowy (1000–10000 znaków)"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              {state.wasAborted ? (
                <span className="text-sm font-medium text-muted-foreground">Generowanie zostało anulowane.</span>
              ) : null}

              <div className="flex gap-3">
                {state.pendingAction === "generate" ? (
                  <Button type="button" variant="outline" onClick={handleCancelGeneration}>
                    Anuluj
                  </Button>
                ) : null}

                <Button type="button" onClick={handleGenerate} disabled={!canGenerate} data-testid="generate-button">
                  {state.pendingAction === "generate" ? "Generowanie..." : "Generuj propozycje"}
                </Button>
              </div>
            </div>
          </div>

          {state.meta ? (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">Id generacji:</span>
                <code className="rounded bg-background px-2 py-1 text-xs">{state.meta.id}</code>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">Dostępne sloty:</span>
                <span>
                  {typeof remainingCapacity === "number" ? remainingCapacity : state.meta.totalCount} /{" "}
                  {state.meta.totalCount}
                </span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="flex min-h-[320px] flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-foreground">Propozycje fiszek</h2>
            <p className="text-sm text-muted-foreground">
              Przejrzyj, edytuj i zaznacz propozycje, które chcesz zaakceptować.
            </p>
          </header>

          {state.status === "loading" ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          ) : proposals.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">Brak propozycji</h3>
                <p className="text-sm text-muted-foreground">
                  Wygeneruj propozycje, aby rozpocząć proces akceptacji fiszek.
                </p>
              </div>
              {ctaHref ? (
                <Button type="button" variant="link" size="sm" asChild className="mt-2">
                  <a href={ctaHref} className="font-medium">
                    Otwórz zapisane fiszki
                  </a>
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <ProposalsToolbar
                allSelected={allSelectedInFilter}
                someSelected={someSelectedInFilter}
                selectedCount={selectedCount}
                totalCount={proposals.length}
                filter={filter}
                onToggleAll={handleToggleAll}
                onFilterChange={handleFilterChange}
                onClearEdits={handleClearEdits}
                hasEdited={hasEdited}
                disabled={isAccepting}
              />

              <ProposalsList
                items={filteredProposals}
                onEdit={handleEditProposal}
                onToggleSelect={handleToggleSelect}
                disabled={isAccepting}
              />

              <AcceptActionsBar
                selectedCount={selectedCount}
                totalCount={proposals.length}
                validSelectedCount={validSelectedProposals.length}
                validTotalCount={validProposals.length}
                disabled={isAccepting || proposals.length === 0}
                pendingAction={state.pendingAction}
                onSaveAll={handleSaveAll}
                onSaveSelected={handleSaveSelected}
                ctaHref={ctaHref}
              />
            </>
          )}
        </section>
      </div>

      <Toaster />
    </>
  );
}

export default GenerationPanel;

function mapGenerationToMeta(generation: GenerationSummaryDTO): GenerationMeta {
  return {
    id: generation.id,
    model: generation.model,
    generationDuration: generation.generationDuration,
    totalCount: generation.totalCount,
    acceptedEditedCount: generation.acceptedEditedCount ?? 0,
    acceptedUneditedCount: generation.acceptedUneditedCount ?? 0,
  };
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

function computeRemainingCapacity(meta: GenerationMeta | undefined): number | undefined {
  if (!meta) {
    return undefined;
  }

  const used = (meta.acceptedEditedCount ?? 0) + (meta.acceptedUneditedCount ?? 0);
  return Math.max(meta.totalCount - used, 0);
}

function handleAcceptError(error: unknown) {
  if (isApiError(error)) {
    switch (error.status) {
      case 403:
        toast({ variant: "destructive", title: "Brak uprawnień", description: "Nie możesz wykonać tej operacji." });
        return;
      case 404:
        toast({
          variant: "destructive",
          title: "Generacja nie znaleziona",
          description: "Odśwież widok i spróbuj ponownie.",
        });
        return;
      case 409:
        toast({
          variant: "destructive",
          title: "Przekroczono limit",
          description: "Nie można zaakceptować większej liczby fiszek.",
        });
        return;
      case 422:
        toast({
          variant: "destructive",
          title: "Błędy walidacji",
          description: "Popraw treści fiszek zanim je zapiszesz.",
        });
        return;
      default:
        break;
    }

    toast({
      variant: "destructive",
      title: "Nie udało się zapisać propozycji",
      description: readableErrorMessage(error),
    });
    return;
  }

  toast({
    variant: "destructive",
    title: "Nie udało się zapisać propozycji",
    description: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
  });
}

function readableErrorMessage(error: { status?: number; message?: string }): string {
  if (!error) {
    return "Wystąpił błąd.";
  }

  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error.status === "number") {
    return `Serwer zwrócił kod ${error.status}.`;
  }

  return "Wystąpił błąd.";
}

export { mapGenerationToMeta, formatDuration, computeRemainingCapacity, handleAcceptError, readableErrorMessage };
