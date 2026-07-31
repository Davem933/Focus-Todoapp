import type { TaskPriority } from "../../tasks/taskTypes";

export type QuickCapturePreviewState = {
  title: string;
  dueDate: string;
  dueTime: string;
  priority: TaskPriority;
  assigneeId: string;
};

export type QuickCaptureCreateOptions = {
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: TaskPriority;
  assigneeId?: string | null;
  teamId?: string | null;
};
