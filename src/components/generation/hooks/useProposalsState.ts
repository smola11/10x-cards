import { useCallback, useMemo, useRef, useState } from "react";

import type { ProposalFlashcardDTO } from "@/types";

import type { FieldError, ProposalId, ProposalViewModel, ProposalsFilter } from "../types";

interface UseProposalsStateConfig {
  frontMin: number;
  frontMax: number;
  backMin: number;
  backMax: number;
}

interface InitializePayload {
  generationId: number;
  proposals: ProposalFlashcardDTO[];
}

interface UseProposalsStateReturn {
  proposals: ProposalViewModel[];
  filteredProposals: ProposalViewModel[];
  filter: ProposalsFilter;
  setFilter: (filter: ProposalsFilter) => void;
  selectedCount: number;
  selectedInFilterCount: number;
  allSelectedInFilter: boolean;
  someSelectedInFilter: boolean;
  validProposals: ProposalViewModel[];
  validSelectedProposals: ProposalViewModel[];
  hasEdited: boolean;
  initialize(payload: InitializePayload): void;
  editProposal(id: ProposalId, updates: { front?: string; back?: string }): void;
  toggleSelect(id: ProposalId, selected: boolean): void;
  toggleAll(selected: boolean): void;
  clearEdits(): void;
  removeMany(ids: ProposalId[]): void;
}

export function useProposalsState({
  frontMin,
  frontMax,
  backMin,
  backMax,
}: UseProposalsStateConfig): UseProposalsStateReturn {
  const [proposals, setProposals] = useState<ProposalViewModel[]>([]);
  const [filter, setFilter] = useState<ProposalsFilter>("all");
  const originalsRef = useRef<Map<ProposalId, { front: string; back: string }>>(new Map());

  const validate = useCallback(
    (front: string, back: string): ProposalViewModel["errors"] => {
      const errors: { front?: FieldError; back?: FieldError } = {};
      const trimmedFront = front.trim();
      const trimmedBack = back.trim();

      if (trimmedFront.length < frontMin) {
        errors.front = { message: `Przód fiszki musi zawierać co najmniej ${frontMin} znak.` };
      } else if (trimmedFront.length > frontMax) {
        errors.front = { message: `Przód fiszki może mieć maksymalnie ${frontMax} znaków.` };
      }

      if (trimmedBack.length < backMin) {
        errors.back = { message: `Tył fiszki musi zawierać co najmniej ${backMin} znak.` };
      } else if (trimmedBack.length > backMax) {
        errors.back = { message: `Tył fiszki może mieć maksymalnie ${backMax} znaków.` };
      }

      return errors;
    },
    [frontMin, frontMax, backMin, backMax]
  );

  const initialize = useCallback(
    ({ generationId, proposals: incoming }: InitializePayload) => {
      originalsRef.current.clear();

      setProposals(
        incoming.map((proposal, index) => {
          const id: ProposalId = `p-${generationId}-${index}`;
          originalsRef.current.set(id, { front: proposal.front, back: proposal.back });
          const errors = validate(proposal.front, proposal.back);

          return {
            id,
            front: proposal.front,
            back: proposal.back,
            edited: false,
            selected: false,
            errors: hasErrors(errors) ? errors : undefined,
          } satisfies ProposalViewModel;
        })
      );

      setFilter("all");
    },
    [validate]
  );

  const editProposal = useCallback(
    (id: ProposalId, updates: { front?: string; back?: string }) => {
      setProposals((prev) =>
        prev.map((proposal) => {
          if (proposal.id !== id) {
            return proposal;
          }

          const nextFront = updates.front ?? proposal.front;
          const nextBack = updates.back ?? proposal.back;
          const errors = validate(nextFront, nextBack);
          const original = originalsRef.current.get(id) ?? { front: proposal.front, back: proposal.back };
          const edited = nextFront.trim() !== original.front.trim() || nextBack.trim() !== original.back.trim();

          return {
            ...proposal,
            front: nextFront,
            back: nextBack,
            edited,
            errors: hasErrors(errors) ? errors : undefined,
          };
        })
      );
    },
    [validate]
  );

  const toggleSelect = useCallback((id: ProposalId, selected: boolean) => {
    setProposals((prev) => prev.map((proposal) => (proposal.id === id ? { ...proposal, selected } : proposal)));
  }, []);

  const toggleAll = useCallback(
    (selected: boolean) => {
      setProposals((prev) =>
        prev.map((proposal) => (matchesFilter(proposal, filter) ? { ...proposal, selected } : proposal))
      );
    },
    [filter]
  );

  const clearEdits = useCallback(() => {
    setProposals((prev) =>
      prev.map((proposal) => {
        const original = originalsRef.current.get(proposal.id);
        if (!original) {
          return proposal;
        }

        const errors = validate(original.front, original.back);

        return {
          ...proposal,
          front: original.front,
          back: original.back,
          edited: false,
          errors: hasErrors(errors) ? errors : undefined,
        };
      })
    );
  }, [validate]);

  const removeMany = useCallback((ids: ProposalId[]) => {
    if (ids.length === 0) {
      return;
    }

    const removalSet = new Set(ids);
    ids.forEach((id) => originalsRef.current.delete(id));

    setProposals((prev) => prev.filter((proposal) => !removalSet.has(proposal.id)));
  }, []);

  const filteredProposals = useMemo(
    () => proposals.filter((proposal) => matchesFilter(proposal, filter)),
    [proposals, filter]
  );

  const selectedCount = useMemo(() => proposals.filter((proposal) => proposal.selected).length, [proposals]);

  const selectedInFilterCount = useMemo(
    () => filteredProposals.filter((proposal) => proposal.selected).length,
    [filteredProposals]
  );

  const allSelectedInFilter = useMemo(
    () => filteredProposals.length > 0 && selectedInFilterCount === filteredProposals.length,
    [filteredProposals, selectedInFilterCount]
  );

  const someSelectedInFilter = useMemo(
    () => selectedInFilterCount > 0 && selectedInFilterCount < filteredProposals.length,
    [filteredProposals.length, selectedInFilterCount]
  );

  const validProposals = useMemo(() => proposals.filter(isProposalValid), [proposals]);

  const validSelectedProposals = useMemo(
    () => proposals.filter((proposal) => proposal.selected && isProposalValid(proposal)),
    [proposals]
  );

  const hasEdited = useMemo(() => proposals.some((proposal) => proposal.edited), [proposals]);

  return {
    proposals,
    filteredProposals,
    filter,
    setFilter,
    selectedCount,
    selectedInFilterCount,
    allSelectedInFilter,
    someSelectedInFilter,
    validProposals,
    validSelectedProposals,
    hasEdited,
    initialize,
    editProposal,
    toggleSelect,
    toggleAll,
    clearEdits,
    removeMany,
  };
}

function matchesFilter(proposal: ProposalViewModel, filter: ProposalsFilter): boolean {
  if (filter === "edited") {
    return proposal.edited;
  }
  if (filter === "unedited") {
    return !proposal.edited;
  }
  return true;
}

function isProposalValid(proposal: ProposalViewModel): boolean {
  return !proposal.errors || (!proposal.errors.front && !proposal.errors.back);
}

function hasErrors(errors: ProposalViewModel["errors"]): boolean {
  return Boolean(errors?.front || errors?.back);
}

export type { UseProposalsStateReturn };
