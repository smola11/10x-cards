export type ProposalId = string;

export interface FieldError {
  message: string;
}

export type ProposalsFilter = "all" | "edited" | "unedited";

export interface ProposalViewModel {
  id: ProposalId;
  front: string;
  back: string;
  edited: boolean;
  selected: boolean;
  errors?: {
    front?: FieldError;
    back?: FieldError;
  };
}

export interface GenerationMeta {
  id: number;
  model: string;
  generationDuration: number;
  totalCount: number;
  acceptedEditedCount: number;
  acceptedUneditedCount: number;
}

export type GenerationStatus = "idle" | "loading" | "ready" | "error";

export type PendingAction = "generate" | "accept-all" | "accept-selected";

export interface GenerationViewModel {
  status: GenerationStatus;
  promptText: string;
  meta?: GenerationMeta;
  pendingAction?: PendingAction;
  error?: string;
  wasAborted?: boolean;
}
