import type { CSSProperties } from "react";
import { Flag } from "lucide-react";
import type { TaskPriority } from "../../../tasks/taskTypes";
import { TASK_PRIORITY_COLORS, BOARD_CARD_PRIORITY_LABELS } from "../../../tasks/taskPriorityColors";

export function PriorityFlag({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className="table-priority-flag"
      style={{ "--priority-color": TASK_PRIORITY_COLORS[priority] } as CSSProperties}
    >
      <Flag size={14} aria-hidden="true" />
      {BOARD_CARD_PRIORITY_LABELS[priority]}
    </span>
  );
}
