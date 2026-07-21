import {
  DEFAULT_TASK_LIST_ID,
  FALLBACK_LIST_ID,
  MOCK_LISTS,
  MOCK_TASKS,
  SYSTEM_LISTS,
} from "./mockData";
import type { BoardColumnKey, Task, TaskLabel, TaskList, TaskRecurrence } from "./taskTypes";

const STORAGE_KEY = "focus-todo-state";
const PRIORITIES = ["none", "low", "medium", "high"];
const RECURRENCES: TaskRecurrence[] = ["none", "daily", "weekly", "monthly"];
export type StoredTaskState = {
  lists: TaskList[];
  tasks: Task[];
  activeListId: string;
  selectedTaskId: string | null;
};

export function loadTaskState(): StoredTaskState {
  const fallbackState = getFallbackState();

  if (typeof window === "undefined") {
    return fallbackState;
  }

  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);

    if (!rawState) {
      return fallbackState;
    }

    const parsedState = JSON.parse(rawState) as unknown;

    if (!isStoredTaskState(parsedState)) {
      return fallbackState;
    }

    return sanitizeTaskState(parsedState);
  } catch {
    return fallbackState;
  }
}

export function saveTaskState(state: StoredTaskState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const stateToSave = sanitizeTaskState(state);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch {
    // Storage can fail in private browsing, quota errors, or locked-down contexts.
  }
}

function getFallbackState(): StoredTaskState {
  return {
    lists: MOCK_LISTS,
    tasks: MOCK_TASKS,
    activeListId: MOCK_LISTS[0]?.id ?? "",
    selectedTaskId: null,
  };
}

function sanitizeTaskState(state: StoredTaskState): StoredTaskState {
  const lists = ensureDefaultTaskList(
    ensureSystemLists(state.lists.map(normalizeTaskList).filter(isTaskListValue)),
  );
  const activeListExists = lists.some(
    (list) => list.id === state.activeListId && !list.isArchived,
  );
  const activeListId = activeListExists ? state.activeListId : lists[0]?.id ?? "";
  const selectedTaskExists =
    state.selectedTaskId !== null &&
    state.tasks.some((task) => task.id === state.selectedTaskId);
  const taskListIds = new Set(
    lists.filter((list) => !list.isSystem).map((list) => list.id),
  );

  return {
    lists,
    tasks: state.tasks
      .map(normalizeTask)
      .map((task) => normalizeTaskListId(task, taskListIds)),
    activeListId,
    selectedTaskId: selectedTaskExists ? state.selectedTaskId : null,
  };
}

function normalizeTask(task: Task): Task {
  const dueDate = task.dueDate ?? null;

  return {
    ...task,
    dueDate,
    dueTime: dueDate ? task.dueTime ?? null : null,
    isArchived: task.isArchived ?? false,
    recurrence: isTaskRecurrence(task.recurrence) ? task.recurrence : "none",
    projectId:
      typeof task.projectId === "string" || task.projectId === null
        ? task.projectId
        : null,
    assigneeId:
      typeof task.assigneeId === "string" || task.assigneeId === null
        ? task.assigneeId
        : null,
    ownerId:
      typeof task.ownerId === "string" || task.ownerId === null
        ? task.ownerId
        : null,
    boardColumnKey: isBoardColumnKey(task.boardColumnKey) ? task.boardColumnKey : "todo",
    labels: Array.isArray(task.labels) ? task.labels.filter(isTaskLabel) : [],
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.filter(isTaskSubtask)
      : [],
  };
}

function normalizeTaskListId(task: Task, taskListIds: Set<string>): Task {
  if (taskListIds.has(task.listId)) {
    return task;
  }

  return {
    ...task,
    listId: DEFAULT_TASK_LIST_ID,
  };
}

function ensureSystemLists(lists: TaskList[]): TaskList[] {
  const missingSystemLists = SYSTEM_LISTS.filter(
    (systemList) => !lists.some((list) => list.id === systemList.id),
  );

  return [...missingSystemLists, ...lists];
}

function ensureDefaultTaskList(lists: TaskList[]): TaskList[] {
  if (lists.some((list) => list.id === DEFAULT_TASK_LIST_ID)) {
    return lists;
  }

  const defaultList = MOCK_LISTS.find((list) => list.id === DEFAULT_TASK_LIST_ID);

  if (!defaultList) {
    return lists;
  }

  return [...lists, defaultList];
}

function normalizeTaskList(list: TaskList): TaskList | null {
  const systemList = SYSTEM_LISTS.find((currentList) => currentList.id === list.id);

  if (systemList) {
    return {
      id: systemList.id,
      name: systemList.name,
      isArchived: false,
      isSystem: true,
      teamId: null,
      color: systemList.color ?? null,
    };
  }

  if (list.id === DEFAULT_TASK_LIST_ID) {
    return {
      id: DEFAULT_TASK_LIST_ID,
      name: "Doru�en�",
      isArchived: false,
      isSystem: false,
      teamId: null,
      color:
        typeof list.color === "string" || list.color === null
          ? list.color
          : MOCK_LISTS.find((currentList) => currentList.id === DEFAULT_TASK_LIST_ID)
              ?.color ?? null,
    };
  }

  const isSystem = list.isSystem ?? false;

  if (isSystem || list.id === FALLBACK_LIST_ID) {
    return null;
  }

  return {
    id: list.id,
    name: list.name,
    isArchived: isSystem ? false : list.isArchived ?? false,
    isSystem,
    teamId:
      typeof list.teamId === "string" && !isSystem ? list.teamId : null,
    color:
      typeof list.color === "string" || list.color === null ? list.color : null,
  };
}

function isTaskListValue(list: TaskList | null): list is TaskList {
  return list !== null;
}

function isStoredTaskState(value: unknown): value is StoredTaskState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.lists) &&
    value.lists.length > 0 &&
    value.lists.every(isTaskList) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTask) &&
    typeof value.activeListId === "string" &&
    (typeof value.selectedTaskId === "string" || value.selectedTaskId === null)
  );
}

function isTaskList(value: unknown): value is TaskList {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (typeof value.color === "string" ||
      value.color === null ||
      typeof value.color === "undefined") &&
    (typeof value.isArchived === "boolean" ||
      typeof value.isArchived === "undefined") &&
    (typeof value.isSystem === "boolean" || typeof value.isSystem === "undefined") &&
    (typeof value.teamId === "string" ||
      value.teamId === null ||
      typeof value.teamId === "undefined")
  );
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.listId === "string" &&
    typeof value.title === "string" &&
    typeof value.completed === "boolean" &&
    (typeof value.dueDate === "string" || value.dueDate === null) &&
    (typeof value.dueTime === "string" ||
      typeof value.dueTime === "undefined" ||
      value.dueTime === null) &&
    (typeof value.isArchived === "boolean" ||
      typeof value.isArchived === "undefined") &&
    typeof value.note === "string" &&
    typeof value.priority === "string" &&
    PRIORITIES.includes(value.priority) &&
    (typeof value.recurrence === "undefined" ||
      isTaskRecurrence(value.recurrence)) &&
    (typeof value.teamId === "string" ||
      value.teamId === null ||
      typeof value.teamId === "undefined") &&
    (typeof value.assigneeId === "string" ||
      value.assigneeId === null ||
      typeof value.assigneeId === "undefined") &&
    (typeof value.ownerId === "string" ||
      value.ownerId === null ||
      typeof value.ownerId === "undefined") &&
    (typeof value.projectId === "string" ||
      value.projectId === null ||
      typeof value.projectId === "undefined") &&
    (typeof value.boardColumnKey === "undefined" ||
      isBoardColumnKey(value.boardColumnKey)) &&
    (typeof value.labels === "undefined" ||
      (Array.isArray(value.labels) && value.labels.every(isTaskLabel))) &&
    (typeof value.subtasks === "undefined" ||
      (Array.isArray(value.subtasks) && value.subtasks.every(isTaskSubtask)))
  );
}

function isTaskRecurrence(value: unknown): value is TaskRecurrence {
  return typeof value === "string" && RECURRENCES.includes(value as TaskRecurrence);
}

function isBoardColumnKey(value: unknown): value is BoardColumnKey {
  return typeof value === "string" && value.trim().length > 0;
}

function isTaskLabel(value: unknown): value is TaskLabel {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.color === "string"
  );
}

function isTaskSubtask(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.completed === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

