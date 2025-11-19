import { useId } from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface TextareaWithCounterProps {
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  id?: string;
  label?: string;
}

function TextareaWithCounter({
  value,
  onChange,
  min,
  max,
  disabled,
  error,
  placeholder,
  id,
  label,
}: TextareaWithCounterProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;
  const remaining = max - value.length;
  const overLimit = remaining < 0;
  const underLimit = value.length < min;

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label htmlFor={textareaId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <Textarea
          id={textareaId}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          minLength={min}
          maxLength={max}
          onChange={(event) => onChange(event.target.value)}
          className={cn("min-h-[240px] resize-y text-base leading-relaxed", disabled && "opacity-80")}
        />
        <div
          className={cn(
            "pointer-events-none absolute bottom-2 right-3 rounded-md px-2 py-1 text-xs font-medium",
            overLimit || underLimit ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {value.length.toLocaleString("pl-PL")} / {max.toLocaleString("pl-PL")}
        </div>
      </div>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default TextareaWithCounter;
