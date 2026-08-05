import type { Task, TaskLabel } from "../tasks/taskTypes";

export type LabelBreakdownEntry = {
  labelId: string;
  name: string;
  color: string;
  count: number;
};

const UNLABELED_ID = "unlabeled";
const UNLABELED_NAME = "Bez štítku";
const UNLABELED_COLOR = "var(--color-text-secondary)";

export function getLabelBreakdown(tasks: Task[]): LabelBreakdownEntry[] {
  const activeTasks = tasks.filter((task) => !task.completed && !task.isArchived);
  const countById = new Map<string, { label: TaskLabel | null; count: number }>();

  for (const task of activeTasks) {
    if (task.labels.length === 0) {
      const existing = countById.get(UNLABELED_ID);
      countById.set(UNLABELED_ID, { label: null, count: (existing?.count ?? 0) + 1 });
      continue;
    }

    for (const label of task.labels) {
      const existing = countById.get(label.id);
      countById.set(label.id, { label, count: (existing?.count ?? 0) + 1 });
    }
  }

  return Array.from(countById.entries())
    .map(([labelId, { label, count }]) => ({
      labelId,
      name: label ? label.name : UNLABELED_NAME,
      color: label ? label.color : UNLABELED_COLOR,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
