import { DEFAULT_TASK_LIST_ID } from "./mockData";
import type { TaskList } from "./taskTypes";

export function getDefaultTaskList(lists: TaskList[]) {
  return (
    lists.find((list) => list.id === DEFAULT_TASK_LIST_ID) ??
    lists.find((list) => !list.isSystem && !list.isArchived) ??
    null
  );
}

export function getTaskTargetListId(lists: TaskList[], activeListId: string) {
  const activeList = lists.find((list) => list.id === activeListId);

  if (activeList && !activeList.isSystem && !activeList.isArchived) {
    return activeList.id;
  }

  return getDefaultTaskList(lists)?.id ?? DEFAULT_TASK_LIST_ID;
}
