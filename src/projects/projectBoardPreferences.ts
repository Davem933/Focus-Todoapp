import type { Task, TaskPriority } from "../tasks/taskTypes";

const STORAGE_KEY_PREFIX = "focus-todo-board-prefs:";
const DUE_FILTERS = ["overdue", "today", "none"] as const;
const SORT_KEYS = ["manual", "priority", "dueDate", "title"] as const;
const PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high"];

export type ProjectBoardDueFilter = (typeof DUE_FILTERS)[number];
export type ProjectBoardSortKey = (typeof SORT_KEYS)[number];

export type ProjectBoardFilters = {
  assigneeIds: string[];
  priorities: TaskPriority[];
  dueStatuses: ProjectBoardDueFilter[];
  labelIds: string[];
};

export type ProjectBoardPreferences = {
  filters: ProjectBoardFilters;
  sort: ProjectBoardSortKey;
};

export function getDefaultProjectBoardPreferences(): ProjectBoardPreferences {
  return {
    filters: {
      assigneeIds: [],
      priorities: [],
      dueStatuses: [],
      labelIds: [],
    },
    sort: "manual",
  };
}

export function loadProjectBoardPreferences(projectId: string): ProjectBoardPreferences {
  const fallback = getDefaultProjectBoardPreferences();

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + projectId);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!isProjectBoardPreferences(parsed)) {
      return fallback;
    }

    return parsed;
  } catch {
    return fallback;
  }
}

export function saveProjectBoardPreferences(
  projectId: string,
  preferences: ProjectBoardPreferences,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY_PREFIX + projectId,
      JSON.stringify(preferences),
    );
  } catch {
    // Storage can fail in private browsing, quota errors, or locked-down contexts.
  }
}

function isProjectBoardPreferences(value: unknown): value is ProjectBoardPreferences {
  if (!isRecord(value) || !isRecord(value.filters)) {
    return false;
  }

  const filters = value.filters;

  return (
    isStringArray(filters.assigneeIds) &&
    isStringArray(filters.labelIds) &&
    Array.isArray(filters.priorities) &&
    filters.priorities.every((priority) => PRIORITIES.includes(priority as TaskPriority)) &&
    Array.isArray(filters.dueStatuses) &&
    filters.dueStatuses.every((status) =>
      DUE_FILTERS.includes(status as ProjectBoardDueFilter),
    ) &&
    typeof value.sort === "string" &&
    SORT_KEYS.includes(value.sort as ProjectBoardSortKey)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getTaskDueStatus(task: Task, today: string): ProjectBoardDueFilter | null {
  if (!task.dueDate) {
    return "none";
  }

  if (task.dueDate < today) {
    return "overdue";
  }

  if (task.dueDate === today) {
    return "today";
  }

  return null;
}

export function filterProjectTasks(
  tasks: Task[],
  filters: ProjectBoardFilters,
  today: string,
): Task[] {
  return tasks.filter((task) => {
    const { assigneeIds, priorities, dueStatuses, labelIds } = filters;

    if (assigneeIds.length > 0 && (!task.assigneeId || !assigneeIds.includes(task.assigneeId))) {
      return false;
    }

    if (priorities.length > 0 && !priorities.includes(task.priority)) {
      return false;
    }

    if (dueStatuses.length > 0) {
      const status = getTaskDueStatus(task, today);

      if (!status || !dueStatuses.includes(status)) {
        return false;
      }
    }

    if (labelIds.length > 0 && !task.labels.some((label) => labelIds.includes(label.id))) {
      return false;
    }

    return true;
  });
}

export function sortProjectTasks(tasks: Task[], sortKey: ProjectBoardSortKey): Task[] {
  if (sortKey === "manual") {
    return tasks;
  }

  const sorted = [...tasks];

  if (sortKey === "priority") {
    const priorityRank: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1, none: 0 };

    sorted.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);
  } else if (sortKey === "dueDate") {
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) {
        return 0;
      }

      if (!a.dueDate) {
        return 1;
      }

      if (!b.dueDate) {
        return -1;
      }

      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sortKey === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "cs"));
  }

  return sorted;
}

export function toggleFilterValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
