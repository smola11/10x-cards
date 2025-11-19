import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { ProposalId, ProposalViewModel } from "./types";

interface ProposalItemProps {
  item: ProposalViewModel;
  onEdit: (id: ProposalId, updates: { front?: string; back?: string }) => void;
  onToggleSelect: (id: ProposalId, selected: boolean) => void;
  disabled?: boolean;
}

function ProposalItem({ item, onEdit, onToggleSelect, disabled }: ProposalItemProps) {
  const frontId = useId();
  const backId = useId();

  const frontInvalid = Boolean(item.errors?.front);
  const backInvalid = Boolean(item.errors?.back);

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm transition focus-within:ring-2 focus-within:ring-ring/40">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <CardTitle className="text-base font-semibold text-foreground">Propozycja</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>ID: {item.id}</span>
            {item.edited ? <Badge variant="secondary">Edytowano</Badge> : <Badge variant="outline">Oryginalna</Badge>}
          </div>
        </div>
        <Checkbox
          checked={item.selected}
          onCheckedChange={(checked) => onToggleSelect(item.id, checked === true)}
          disabled={disabled}
          aria-label={item.selected ? "Odznacz propozycję" : "Zaznacz propozycję"}
          className="mt-1"
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground" htmlFor={frontId}>
            Przód fiszki
          </label>
          <Textarea
            id={frontId}
            value={item.front}
            onChange={(event) => onEdit(item.id, { front: event.target.value })}
            disabled={disabled}
            aria-invalid={frontInvalid}
            aria-describedby={frontInvalid ? `${frontId}-error` : undefined}
            className="min-h-[96px] resize-y"
          />
          {frontInvalid ? (
            <p id={`${frontId}-error`} className="text-sm font-medium text-destructive">
              {item.errors?.front?.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground" htmlFor={backId}>
            Tył fiszki
          </label>
          <Textarea
            id={backId}
            value={item.back}
            onChange={(event) => onEdit(item.id, { back: event.target.value })}
            disabled={disabled}
            aria-invalid={backInvalid}
            aria-describedby={backInvalid ? `${backId}-error` : undefined}
            className="min-h-[144px] resize-y"
          />
          {backInvalid ? (
            <p id={`${backId}-error`} className="text-sm font-medium text-destructive">
              {item.errors?.back?.message}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default ProposalItem;
