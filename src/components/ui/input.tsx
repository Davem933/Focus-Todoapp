import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-nt-border bg-nt-card px-3 py-1 text-sm text-nt-fg outline-none placeholder:text-nt-muted focus-visible:border-nt-brand focus-visible:ring-2 focus-visible:ring-nt-brand-soft disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
