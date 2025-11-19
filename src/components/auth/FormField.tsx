import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  htmlFor: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function FormField({ htmlFor, label, required, hint, error, children, action, className }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={htmlFor} isRequired={required}>
          {label}
        </Label>
        {action}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface FormMessageProps {
  title: string;
  description?: string;
  tone?: "error" | "info" | "success";
}

export function FormMessage({ title, description, tone = "info" }: FormMessageProps) {
  const toneStyles: Record<FormMessageProps["tone"], string> = {
    error: "border-destructive/60 bg-destructive/5 text-destructive",
    info: "border-muted border-dashed bg-muted/10 text-muted-foreground",
    success: "border-emerald-500/60 bg-emerald-500/5 text-emerald-600",
  };

  return (
    <div
      className={cn("rounded-lg border px-4 py-3 text-sm", toneStyles[tone])}
      role={tone === "error" ? "alert" : undefined}
    >
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 text-sm/relaxed">{description}</p> : null}
    </div>
  );
}
