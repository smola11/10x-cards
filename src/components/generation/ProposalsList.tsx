import ProposalItem from "./ProposalItem";
import type { ProposalId, ProposalViewModel } from "./types";

interface ProposalsListProps {
  items: ProposalViewModel[];
  onEdit: (id: ProposalId, updates: { front?: string; back?: string }) => void;
  onToggleSelect: (id: ProposalId, selected: boolean) => void;
  disabled?: boolean;
}

function ProposalsList({ items, onEdit, onToggleSelect, disabled }: ProposalsListProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/10 p-10 text-center">
        <h3 className="text-base font-semibold text-foreground">Brak propozycji do wyświetlenia</h3>
        <p className="text-sm text-muted-foreground">
          Wygeneruj nowe propozycje lub zmień filtr, aby zobaczyć dostępne fiszki.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <ProposalItem key={item.id} item={item} onEdit={onEdit} onToggleSelect={onToggleSelect} disabled={disabled} />
      ))}
    </div>
  );
}

export default ProposalsList;
