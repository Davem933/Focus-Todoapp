import { getTodayDateValue } from "./dateUtils";
import { getPrimaryTimeStatus } from "./taskRecommendation";
import type { Task, TaskPriority } from "./taskTypes";

const MAX_BRIEFING_TASKS = 20;

export type DailyBriefingTaskSummary = {
  title: string;
  priority: TaskPriority;
  dueLabel: string;
};

export function getDailyBriefingTasks(tasks: Task[]): Task[] {
  const today = getTodayDateValue();
  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const importantNoDate: Task[] = [];

  for (const task of tasks) {
    if (task.completed) {
      continue;
    }

    const status = getPrimaryTimeStatus(task, today);

    if (status === "overdue") {
      overdue.push(task);
    } else if (status === "today") {
      dueToday.push(task);
    } else if (status === "no_due_date" && task.priority === "high") {
      importantNoDate.push(task);
    }
  }

  return [...overdue, ...dueToday, ...importantNoDate].slice(0, MAX_BRIEFING_TASKS);
}

export function summarizeDailyBriefingTasks(tasks: Task[]): DailyBriefingTaskSummary[] {
  const today = getTodayDateValue();

  return getDailyBriefingTasks(tasks).map((task) => ({
    title: task.title,
    priority: task.priority,
    dueLabel: getDueLabel(task, today),
  }));
}

function getDueLabel(task: Task, today: string): string {
  const status = getPrimaryTimeStatus(task, today);

  if (status === "overdue") {
    return "po termínu";
  }

  if (status === "today") {
    return task.dueTime ? `dnes v ${task.dueTime}` : "dnes";
  }

  return "bez termínu";
}
