import { TASK_PRIORITY_COLORS, BOARD_CARD_PRIORITY_LABELS } from "../tasks/taskPriorityColors";
import type { Task, TaskPriority } from "../tasks/taskTypes";

export type PriorityBreakdownEntry = {
  priority: TaskPriority;
  label: string;
  count: number;
  color: string;
};

const PRIORITY_ORDER: TaskPriority[] = ["none", "low", "medium", "high"];

export function getPriorityBreakdown(tasks: Task[]): PriorityBreakdownEntry[] {
  const activeTasks = tasks.filter((task) => !task.completed && !task.isArchived);

  return PRIORITY_ORDER.map((priority) => ({
    priority,
    label: BOARD_CARD_PRIORITY_LABELS[priority],
    count: activeTasks.filter((task) => task.priority === priority).length,
    color: TASK_PRIORITY_COLORS[priority],
  }));
}
