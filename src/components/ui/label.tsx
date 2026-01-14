import * as React from "react";

import { cn } from "@/lib/utils";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  isRequired?: boolean;
};

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, isRequired = false, children, ...props },
  ref
) {
  return (
    <label
      ref={ref}
      className={cn("flex items-center gap-1 text-sm font-medium text-foreground", className)}
      {...props}
    >
      {children}
      {isRequired ? (
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
});
