import {
  FALLBACK_LIST_ID,
  IMPORTANT_LIST_ID,
  PLANNED_LIST_ID,
  TODAY_LIST_ID,
} from "./mockData";
import { getTodayDateValue } from "./dateUtils";
import { getPrimaryTimeStatus } from "./taskRecommendation";
import type { Task, TaskList } from "./taskTypes";

export function getVisibleTasksForList(
  tasks: Task[],
  lists: TaskList[],
  activeListId: string,
) {
  const visibleTasks = tasks.filter((task) => !task.isArchived);

  return getTasksForListView(visibleTasks, lists, activeListId);
}

export function getArchivedTasksForList(
  tasks: Task[],
  lists: TaskList[],
  activeListId: string,
) {
  const archivedTasks = tasks.filter((task) => task.isArchived);

  return getTasksForListView(archivedTasks, lists, activeListId);
}

function getTasksForListView(
  tasks: Task[],
  lists: TaskList[],
  activeListId: string,
) {
  const activeList = lists.find((list) => list.id === activeListId);

  if (!activeList?.isSystem) {
    return tasks.filter((task) => task.listId === activeListId);
  }

  const today = getTodayDateValue();

  if (activeListId === FALLBACK_LIST_ID) {
    return tasks;
  }

  if (activeListId === TODAY_LIST_ID) {
    return tasks.filter((task) =>
      ["overdue", "today"].includes(getPrimaryTimeStatus(task, today)),
    );
  }

  if (activeListId === PLANNED_LIST_ID) {
    return tasks.filter((task) => task.dueDate !== null);
  }

  if (activeListId === IMPORTANT_LIST_ID) {
    return tasks.filter((task) => task.priority === "high");
  }

  return [];
}
