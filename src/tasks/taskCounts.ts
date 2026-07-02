import {
  FALLBACK_LIST_ID,
  IMPORTANT_LIST_ID,
  PLANNED_LIST_ID,
  TODAY_LIST_ID,
} from "./mockData";
import { getTodayDateValue } from "./dateUtils";
import { getPrimaryTimeStatus } from "./taskRecommendation";
import type { Task, TaskList } from "./taskTypes";

export type CountsByListId = Record<string, number>;

export function buildCountsByListId(tasks: Task[], lists: TaskList[]): CountsByListId {
  const activeTasks = tasks.filter((task) => !task.completed && !task.isArchived);
  const today = getTodayDateValue();
  const countsByListId: CountsByListId = {};

  for (const list of lists) {
    if (list.isSystem) {
      countsByListId[list.id] = getSystemListCount(list.id, activeTasks, today);
      continue;
    }

    countsByListId[list.id] = activeTasks.filter(
      (task) => task.listId === list.id,
    ).length;
  }

  return countsByListId;
}

function getSystemListCount(listId: string, activeTasks: Task[], today: string) {
  if (listId === FALLBACK_LIST_ID) {
    return activeTasks.length;
  }

  if (listId === TODAY_LIST_ID) {
    return activeTasks.filter(
      (task) =>
        getPrimaryTimeStatus(task, today) === "overdue" ||
        getPrimaryTimeStatus(task, today) === "today",
    ).length;
  }

  if (listId === PLANNED_LIST_ID) {
    return activeTasks.filter((task) => task.dueDate !== null).length;
  }

  if (listId === IMPORTANT_LIST_ID) {
    return activeTasks.filter((task) => task.priority === "high").length;
  }

  return 0;
}
