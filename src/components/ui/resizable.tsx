import { GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { GroupProps, SeparatorProps } from "react-resizable-panels";

import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({ className, ...props }: GroupProps) => (
  <Group className={cn("flex h-full w-full", className)} {...props} />
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: SeparatorProps & { withHandle?: boolean }) => (
  <Separator
    className={cn(
      "relative flex w-px items-center justify-center bg-nt-border outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-1.5 after:-translate-x-1/2 focus-visible:bg-nt-brand",
      className,
    )}
    {...props}
  >
    {withHandle ? (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-nt-border bg-nt-card">
        <GripVertical className="h-2.5 w-2.5 text-nt-muted" />
      </div>
    ) : null}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
