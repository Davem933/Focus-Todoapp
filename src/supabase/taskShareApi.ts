import { supabase } from "./supabaseClient";

export type SharedTaskSubtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type SharedTaskPreview = {
  id: string;
  title: string;
  note: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  completed: boolean;
  projectName: string | null;
  teamName: string | null;
  assigneeName: string | null;
  subtasks: SharedTaskSubtask[];
};

export async function generateShareToken(taskId: string): Promise<string> {
  if (!supabase) {
    throw new Error("Cloud sync není nakonfigurovaný.");
  }

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("tasks")
    .update({ share_token: token })
    .eq("id", taskId);

  if (error) {
    throw error;
  }

  return token;
}

export async function revokeShareToken(taskId: string): Promise<void> {
  if (!supabase) {
    throw new Error("Cloud sync není nakonfigurovaný.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({ share_token: null })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}

function isSharedTaskSubtask(value: unknown): value is SharedTaskSubtask {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.completed === "boolean"
  );
}

export async function fetchSharedTask(token: string): Promise<SharedTaskPreview | null> {
  if (!supabase) {
    throw new Error("Cloud sync není nakonfigurovaný.");
  }

  const { data, error } = await supabase.rpc("get_shared_task", { p_token: token });

  if (error) {
    throw error;
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as Record<string, unknown>;

  if (typeof row.id !== "string" || typeof row.title !== "string") {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    note: typeof row.note === "string" ? row.note : "",
    dueDate: typeof row.dueDate === "string" ? row.dueDate : null,
    dueTime: typeof row.dueTime === "string" ? row.dueTime : null,
    priority: typeof row.priority === "string" ? row.priority : "none",
    completed: row.completed === true,
    projectName: typeof row.projectName === "string" ? row.projectName : null,
    teamName: typeof row.teamName === "string" ? row.teamName : null,
    assigneeName: typeof row.assigneeName === "string" ? row.assigneeName : null,
    subtasks: Array.isArray(row.subtasks) ? row.subtasks.filter(isSharedTaskSubtask) : [],
  };
}
