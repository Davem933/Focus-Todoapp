export type TaskPriority = "none" | "low" | "medium" | "high";

export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly";

export type BoardColumnKey = string;

export type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

export type TaskList = {
  id: string;
  name: string;
  isArchived: boolean;
  isSystem: boolean;
  teamId: string | null;
  color?: string | null;
};

export type Task = {
  id: string;
  listId: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
  dueTime: string | null;
  isArchived: boolean;
  note: string;
  priority: TaskPriority;
  recurrence: TaskRecurrence;
  teamId: string | null;
  assigneeId: string | null;
  ownerId: string | null;
  projectId: string | null;
  boardColumnKey: BoardColumnKey;
  labels: TaskLabel[];
  subtasks: TaskSubtask[];
};

export type TaskSubtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type TaskUpdate = Partial<
  Pick<
    Task,
    | "title"
    | "completed"
    | "dueDate"
    | "dueTime"
    | "isArchived"
    | "note"
    | "priority"
    | "recurrence"
    | "teamId"
    | "assigneeId"
    | "projectId"
    | "boardColumnKey"
    | "listId"
    | "labels"
    | "subtasks"
  >
>;
