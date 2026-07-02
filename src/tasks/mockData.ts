import type { Task, TaskList } from "./taskTypes";

export const FALLBACK_LIST_ID = "list-all";
export const DEFAULT_TASK_LIST_ID = "list-inbox";
export const TODAY_LIST_ID = "list-today";
export const IMPORTANT_LIST_ID = "list-important";
export const PLANNED_LIST_ID = "list-planned";

export const SYSTEM_LISTS: TaskList[] = [
  {
    id: TODAY_LIST_ID,
    name: "Dnes",
    isArchived: false,
    isSystem: true,
    teamId: null,
    color: "#6d5dfc",
  },
  {
    id: IMPORTANT_LIST_ID,
    name: "Důležité",
    isArchived: false,
    isSystem: true,
    teamId: null,
    color: "#f59e0b",
  },
  {
    id: PLANNED_LIST_ID,
    name: "Plánované",
    isArchived: false,
    isSystem: true,
    teamId: null,
    color: "#38bdf8",
  },
  {
    id: FALLBACK_LIST_ID,
    name: "Vše",
    isArchived: false,
    isSystem: true,
    teamId: null,
    color: "#94a3b8",
  },
];

export const MOCK_LISTS: TaskList[] = [
  ...SYSTEM_LISTS,
  {
    id: DEFAULT_TASK_LIST_ID,
    name: "Doručené",
    isArchived: false,
    isSystem: false,
    teamId: null,
    color: "#6d5dfc",
  },
];

export const MOCK_TASKS: Task[] = [];

