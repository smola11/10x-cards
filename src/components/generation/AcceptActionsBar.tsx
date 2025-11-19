import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingAction } from "./types";
import { Loader2 } from "lucide-react";

interface AcceptActionsBarProps {
  selectedCount: number;
  totalCount: number;
  validSelectedCount: number;
  validTotalCount: number;
  disabled?: boolean;
  pendingAction?: PendingAction;
  onSaveAll: () => void;
  onSaveSelected: () => void;
  ctaHref?: string | null;
}

function AcceptActionsBar({
  selectedCount,
  totalCount,
  validSelectedCount,
  validTotalCount,
  disabled,
  pendingAction,
  onSaveAll,
  onSaveSelected,
  ctaHref,
}: AcceptActionsBarProps) {
  const savingAll = pendingAction === "accept-all";
  const savingSelected = pendingAction === "accept-selected";

  return (
    <div className="sticky bottom-0 mt-auto flex flex-col gap-3 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="font-medium text-foreground">
          Zaznaczone: {selectedCount} / {totalCount}
        </div>
        <div>
          Gotowe do zapisu: {validTotalCount}
          {selectedCount > 0 ? ` • Wybrane poprawne: ${validSelectedCount}` : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={onSaveAll}
            disabled={disabled || validTotalCount === 0 || savingSelected}
            className={cn("min-w-[160px]", savingAll && "pointer-events-none")}
          >
            {savingAll ? <Loader2 className="size-4 animate-spin" /> : null}
            Zapisz wszystkie
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onSaveSelected}
            disabled={disabled || selectedCount === 0 || validSelectedCount === 0 || savingAll}
            className={cn("min-w-[180px]", savingSelected && "pointer-events-none")}
          >
            {savingSelected ? <Loader2 className="size-4 animate-spin" /> : null}
            Zapisz zaznaczone
          </Button>
        </div>

        {ctaHref ? (
          <Button type="button" variant="link" size="sm" asChild>
            <a href={ctaHref} className="font-medium">
              Otwórz zapisane fiszki
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default AcceptActionsBar;
