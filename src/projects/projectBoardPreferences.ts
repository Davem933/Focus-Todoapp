import type { TaskPriority } from "../tasks/taskTypes";

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
