import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getUserId, supabase } from "../supabaseClient.js";
import { toToolResult, toToolError } from "./result.js";

const priorityEnum = z.enum(["none", "low", "medium", "high"]);
const recurrenceEnum = z.enum(["none", "daily", "weekly", "monthly"]);

type TaskListRow = {
  id: string;
  name: string;
  is_archived: boolean;
  color: string | null;
};

type TaskRow = {
  id: string;
  list_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  due_time: string | null;
  note: string;
  priority: "none" | "low" | "medium" | "high";
  recurrence: "none" | "daily" | "weekly" | "monthly";
  is_archived: boolean;
};

const TASK_LIST_SELECT = "id,name,is_archived,color";
const TASK_SELECT = "id,list_id,title,completed,due_date,due_time,note,priority,recurrence,is_archived";

async function findOrCreateListByName(name: string): Promise<TaskListRow> {
  const userId = await getUserId();
  const trimmedName = name.trim();

  const existing = await supabase
    .from("task_lists")
    .select(TASK_LIST_SELECT)
    .eq("owner_id", userId)
    .eq("name", trimmedName)
    .eq("is_archived", false)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return existing.data as TaskListRow;
  }

  const created = await supabase
    .from("task_lists")
    .insert({ owner_id: userId, name: trimmedName, is_archived: false })
    .select(TASK_LIST_SELECT)
    .single();

  if (created.error) {
    throw created.error;
  }

  return created.data as TaskListRow;
}

export function registerTaskTools(server: McpServer): void {
  server.tool(
    "list_task_lists",
    "List all task lists (seznamy) belonging to the signed-in user.",
    {},
    async () => {
      try {
        const userId = await getUserId();
        const { data, error } = await supabase
          .from("task_lists")
          .select(TASK_LIST_SELECT)
          .eq("owner_id", userId)
          .eq("is_archived", false)
          .order("name", { ascending: true });

        if (error) throw error;
        return toToolResult(data ?? []);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "create_task_list",
    "Create a new task list (seznam) for the signed-in user.",
    {
      name: z.string().min(1, "Name is required"),
      color: z.string().optional(),
    },
    async ({ name, color }) => {
      try {
        const userId = await getUserId();
        const { data, error } = await supabase
          .from("task_lists")
          .insert({ owner_id: userId, name: name.trim(), color: color ?? null, is_archived: false })
          .select(TASK_LIST_SELECT)
          .single();

        if (error) throw error;
        return toToolResult(data);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "create_task",
    "Create a new task (ukol). If list_name is omitted or does not exist yet, it is created (defaults to 'Inbox').",
    {
      title: z.string().min(1, "Title is required"),
      list_name: z.string().optional(),
      due_date: z.string().optional().describe("ISO date, e.g. 2026-07-25"),
      due_time: z.string().optional().describe("HH:MM"),
      priority: priorityEnum.optional(),
      recurrence: recurrenceEnum.optional(),
      note: z.string().optional(),
    },
    async ({ title, list_name, due_date, due_time, priority, recurrence, note }) => {
      try {
        const userId = await getUserId();
        const list = await findOrCreateListByName(list_name ?? "Inbox");

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            owner_id: userId,
            list_id: list.id,
            title: title.trim(),
            completed: false,
            due_date: due_date ?? null,
            due_time: due_time ?? null,
            note: note ?? "",
            priority: priority ?? "none",
            recurrence: recurrence ?? "none",
            is_archived: false,
          })
          .select(TASK_SELECT)
          .single();

        if (error) throw error;
        return toToolResult(data);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "list_tasks",
    "List tasks belonging to the signed-in user, optionally filtered by list name.",
    {
      list_name: z.string().optional(),
      include_completed: z.boolean().optional(),
    },
    async ({ list_name, include_completed }) => {
      try {
        const userId = await getUserId();
        let query = supabase
          .from("tasks")
          .select(`${TASK_SELECT},task_lists!inner(name)`)
          .eq("owner_id", userId)
          .eq("is_archived", false);

        if (!include_completed) {
          query = query.eq("completed", false);
        }

        if (list_name) {
          query = query.eq("task_lists.name", list_name);
        }

        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        return toToolResult(data ?? []);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "update_task",
    "Update fields on an existing task by id.",
    {
      task_id: z.string().uuid(),
      title: z.string().optional(),
      due_date: z.string().nullable().optional(),
      due_time: z.string().nullable().optional(),
      priority: priorityEnum.optional(),
      recurrence: recurrenceEnum.optional(),
      note: z.string().optional(),
    },
    async ({ task_id, ...updates }) => {
      try {
        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) {
            payload[key] = value;
          }
        }

        if (Object.keys(payload).length === 0) {
          return toToolResult({ message: "Nothing to update." });
        }

        const { data, error } = await supabase
          .from("tasks")
          .update(payload)
          .eq("id", task_id)
          .select(TASK_SELECT)
          .single();

        if (error) throw error;
        return toToolResult(data);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "complete_task",
    "Mark a task as completed or not completed.",
    {
      task_id: z.string().uuid(),
      completed: z.boolean(),
    },
    async ({ task_id, completed }) => {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .update({ completed })
          .eq("id", task_id)
          .select(TASK_SELECT)
          .single();

        if (error) throw error;
        return toToolResult(data);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "delete_task",
    "Permanently delete a task by id.",
    { task_id: z.string().uuid() },
    async ({ task_id }) => {
      try {
        const { error } = await supabase.from("tasks").delete().eq("id", task_id);
        if (error) throw error;
        return toToolResult({ deleted: true, task_id });
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}

export type { TaskRow, TaskListRow };
