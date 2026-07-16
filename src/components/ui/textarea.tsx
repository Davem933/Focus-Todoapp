import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex w-full rounded-md border border-nt-border bg-nt-card px-3 py-2.5 text-sm leading-relaxed text-nt-fg outline-none placeholder:text-nt-muted focus-visible:border-nt-brand focus-visible:ring-2 focus-visible:ring-nt-brand-soft disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
