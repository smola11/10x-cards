import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProposalsFilter } from "./types";

interface ProposalsToolbarProps {
  allSelected: boolean;
  someSelected: boolean;
  selectedCount: number;
  totalCount: number;
  filter: ProposalsFilter;
  onToggleAll: (checked: boolean) => void;
  onFilterChange: (filter: ProposalsFilter) => void;
  onClearEdits: () => void;
  hasEdited: boolean;
  disabled?: boolean;
}

const filters: { value: ProposalsFilter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "edited", label: "Edytowane" },
  { value: "unedited", label: "Nieedytowane" },
];

function ProposalsToolbar({
  allSelected,
  someSelected,
  selectedCount,
  totalCount,
  filter,
  onToggleAll,
  onFilterChange,
  onClearEdits,
  hasEdited,
  disabled,
}: ProposalsToolbarProps) {
  const masterState = allSelected ? true : someSelected ? "indeterminate" : false;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={masterState}
            onCheckedChange={(checked) => onToggleAll(checked === true || checked === "indeterminate")}
            disabled={disabled || totalCount === 0}
            aria-label={allSelected ? "Odznacz wszystkie propozycje" : "Zaznacz wszystkie propozycje"}
          />
          <span className="text-sm font-medium text-foreground">Zaznacz wszystkie</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {selectedCount} / {totalCount}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-background p-1 shadow-inner">
          {filters.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "default" : "ghost"}
              onClick={() => onFilterChange(item.value)}
              disabled={disabled}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <Button type="button" size="sm" variant="outline" onClick={onClearEdits} disabled={!hasEdited || disabled}>
          Wyczyść edycje
        </Button>
      </div>
    </div>
  );
}

export default ProposalsToolbar;
