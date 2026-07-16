import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        count: "bg-nt-card text-nt-muted px-1.5 py-0.5 text-[0.68rem] border border-nt-border",
        tag: "bg-nt-brand-soft text-nt-brand px-2.5 py-1 gap-1",
        outline: "border border-nt-border text-nt-muted px-2 py-0.5",
      },
    },
    defaultVariants: {
      variant: "count",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
