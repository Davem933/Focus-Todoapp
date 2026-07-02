import { getTodayDateValue } from "./dateUtils";
import {
  getFocusScopeTasks,
  getPrimaryTimeStatus,
  type FocusScope,
} from "./taskRecommendation";
import type { Task } from "./taskTypes";

export type DailyTaskStats = {
  todayActiveCount: number;
  importantActiveCount: number;
  overdueActiveCount: number;
  activeCount: number;
};

export type DailyAttentionTask = {
  task: Task;
  reason: "overdue" | "important";
};

export type DailyAttentionOverview = {
  tasks: DailyAttentionTask[];
  hiddenCount: number;
};

export function getDailyTaskStats(tasks: Task[], scope: FocusScope) {
  const today = getTodayDateValue();
  const scopedTasks = getFocusScopeTasks(tasks, scope);

  return {
    todayActiveCount: scopedTasks.filter(
      (task) => getPrimaryTimeStatus(task, today) === "today",
    ).length,
    importantActiveCount: scopedTasks.filter((task) => task.priority === "high")
      .length,
    overdueActiveCount: scopedTasks.filter(
      (task) => getPrimaryTimeStatus(task, today) === "overdue",
    ).length,
    activeCount: scopedTasks.length,
  };
}

export function getDailyAttentionTasks(
  tasks: Task[],
  scope: FocusScope,
): DailyAttentionOverview {
  const today = getTodayDateValue();
  const scopedTasks = getFocusScopeTasks(tasks, scope);
  const allOverdueTasks: DailyAttentionTask[] = scopedTasks
    .filter((task) => getPrimaryTimeStatus(task, today) === "overdue")
    .sort((left, right) => compareDueDateTimes(left, right))
    .map((task) => ({ task, reason: "overdue" }));
  const overdueTaskIds = new Set(allOverdueTasks.map(({ task }) => task.id));
  const allImportantTasks: DailyAttentionTask[] = scopedTasks
    .filter((task) => task.priority === "high" && !overdueTaskIds.has(task.id))
    .sort((left, right) => compareDueDateTimes(left, right))
    .map((task) => ({ task, reason: "important" }));
  const allAttentionTasks = [...allOverdueTasks, ...allImportantTasks];
  const previewTasks = [
    ...allOverdueTasks.slice(0, 2),
    ...allImportantTasks.slice(0, 2),
  ].slice(0, 3);

  return {
    tasks: previewTasks,
    hiddenCount: Math.max(0, allAttentionTasks.length - previewTasks.length),
  };
}

function compareDueDateTimes(left: Task, right: Task) {
  if (!left.dueDate) {
    return 1;
  }

  if (!right.dueDate) {
    return -1;
  }

  const dateDifference = left.dueDate.localeCompare(right.dueDate);

  if (dateDifference !== 0) {
    return dateDifference;
  }

  return (left.dueTime ?? "23:59").localeCompare(right.dueTime ?? "23:59");
}
