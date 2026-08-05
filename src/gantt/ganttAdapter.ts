import type { Task, TaskUpdate } from "../tasks/taskTypes";
import { getTodayDateValue } from "../tasks/dateUtils";

export type SvarGanttTask = {
  id: string;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  progress: number;
  type: "task";
  css: string;
};

export type SvarGanttLink = {
  id: string;
  source: string;
  target: string;
  type: "e2s";
};

export function isTaskGanttEligible(task: Task): boolean {
  return !task.completed && !task.isArchived && Boolean(task.dueDate);
}

function toDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay) + 1);
}

export function getGanttBarStatusClass(task: Task): "gantt-bar--overdue" | "gantt-bar--in-progress" {
  const today = getTodayDateValue();
  return task.dueDate && task.dueDate < today ? "gantt-bar--overdue" : "gantt-bar--in-progress";
}

export function toGanttTasks(tasks: Task[]): SvarGanttTask[] {
  return tasks.filter(isTaskGanttEligible).map((task) => {
    const end = toDate(task.dueDate as string);
    const start = toDate(task.startDate ?? (task.dueDate as string));

    return {
      id: task.id,
      text: task.title,
      start,
      end,
      duration: daysBetween(start, end),
      progress: task.progress,
      type: "task",
      css: getGanttBarStatusClass(task),
    };
  });
}

export function toGanttLinks(tasks: Task[]): SvarGanttLink[] {
  const eligibleIds = new Set(tasks.filter(isTaskGanttEligible).map((task) => task.id));
  const links: SvarGanttLink[] = [];

  for (const task of tasks) {
    if (!eligibleIds.has(task.id)) {
      continue;
    }

    for (const dependencyId of task.dependencies) {
      if (eligibleIds.has(dependencyId)) {
        links.push({
          id: `${dependencyId}->${task.id}`,
          source: dependencyId,
          target: task.id,
          type: "e2s",
        });
      }
    }
  }

  return links;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDragUpdate(startDate: Date, endDate: Date): Pick<TaskUpdate, "startDate" | "dueDate"> {
  return {
    startDate: toIsoDate(startDate),
    dueDate: toIsoDate(endDate),
  };
}

export function fromProgressUpdate(progress: number): Pick<TaskUpdate, "progress"> {
  return { progress: Math.max(0, Math.min(100, Math.round(progress))) };
}
