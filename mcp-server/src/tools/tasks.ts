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
  team_id: string | null;
  assignee_id: string | null;
  project_id: string | null;
  board_column_key: string | null;
};

const TASK_LIST_SELECT = "id,name,is_archived,color";
const TASK_SELECT =
  "id,list_id,title,completed,due_date,due_time,note,priority,recurrence,is_archived,team_id,assignee_id,project_id,board_column_key";

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

/**
 * Board/kanban tasks still need a list_id (NOT NULL in the DB), even though
 * the board UI groups by project_id/board_column_key, not by list. Mirrors
 * the app's own fallback: reuse any existing list for that team, or create
 * one, rather than surfacing this DB implementation detail as a required
 * MCP parameter.
 */
async function findOrCreateTeamList(teamId: string): Promise<TaskListRow> {
  const userId = await getUserId();

  const existing = await supabase
    .from("task_lists")
    .select(TASK_LIST_SELECT)
    .eq("owner_id", userId)
    .eq("team_id", teamId)
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return existing.data as TaskListRow;
  }

  const created = await supabase
    .from("task_lists")
    .insert({ owner_id: userId, name: "Nastenka", team_id: teamId, is_archived: false })
    .select(TASK_LIST_SELECT)
    .single();

  if (created.error) {
    throw created.error;
  }

  return created.data as TaskListRow;
}

async function getBoardTeamId(boardId: string): Promise<string> {
  const { data, error } = await supabase.from("projects").select("team_id").eq("id", boardId).single();
  if (error) throw error;
  return (data as { team_id: string }).team_id;
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
    "Create a new task (ukol). Either a plain to-do (optionally in a named list, created if missing, defaults to 'Inbox'), or a kanban card on a board (pass board_id, and optionally board_column_key/assignee_id) — use list_boards/list_board_columns to find those ids first.",
    {
      title: z.string().min(1, "Title is required"),
      list_name: z.string().optional().describe("For plain to-do tasks; ignored if board_id is set."),
      board_id: z.string().uuid().optional().describe("Put this task on a board/kanban column instead of a list."),
      board_column_key: z.string().optional().describe("Column key from list_board_columns; defaults to 'todo'."),
      assignee_id: z.string().uuid().optional().describe("Team member user_id to assign the card to."),
      due_date: z.string().optional().describe("ISO date, e.g. 2026-07-25"),
      due_time: z.string().optional().describe("HH:MM"),
      priority: priorityEnum.optional(),
      recurrence: recurrenceEnum.optional(),
      note: z.string().optional(),
    },
    async ({ title, list_name, board_id, board_column_key, assignee_id, due_date, due_time, priority, recurrence, note }) => {
      try {
        const userId = await getUserId();

        let listId: string;
        let teamId: string | null = null;

        if (board_id) {
          teamId = await getBoardTeamId(board_id);
          const list = await findOrCreateTeamList(teamId);
          listId = list.id;
        } else {
          const list = await findOrCreateListByName(list_name ?? "Inbox");
          listId = list.id;
        }

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            owner_id: userId,
            list_id: listId,
            title: title.trim(),
            completed: false,
            due_date: due_date ?? null,
            due_time: due_time ?? null,
            note: note ?? "",
            priority: priority ?? "none",
            recurrence: recurrence ?? "none",
            is_archived: false,
            team_id: teamId,
            assignee_id: assignee_id ?? null,
            project_id: board_id ?? null,
            board_column_key: board_id ? board_column_key ?? "todo" : null,
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
    "List tasks belonging to the signed-in user. Filter by list_name for plain to-dos, or by board_id (optionally + board_column_key) for kanban cards on a board.",
    {
      list_name: z.string().optional(),
      board_id: z.string().uuid().optional(),
      board_column_key: z.string().optional(),
      include_completed: z.boolean().optional(),
    },
    async ({ list_name, board_id, board_column_key, include_completed }) => {
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

        if (board_id) {
          query = query.eq("project_id", board_id);
        } else if (list_name) {
          query = query.eq("task_lists.name", list_name);
        }

        if (board_column_key) {
          query = query.eq("board_column_key", board_column_key);
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
    "list_today_tasks",
    "List tasks due today or overdue (not completed) — mirrors the app's 'Today' view.",
    {},
    async () => {
      try {
        const userId = await getUserId();
        const today = new Date().toISOString().slice(0, 10);

        const { data, error } = await supabase
          .from("tasks")
          .select(`${TASK_SELECT},task_lists!inner(name)`)
          .eq("owner_id", userId)
          .eq("is_archived", false)
          .eq("completed", false)
          .not("due_date", "is", null)
          .lte("due_date", today)
          .order("due_date", { ascending: true });

        if (error) throw error;
        return toToolResult(data ?? []);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "update_task",
    "Update fields on an existing task by id, including moving a kanban card to a different board column or reassigning it.",
    {
      task_id: z.string().uuid(),
      title: z.string().optional(),
      due_date: z.string().nullable().optional(),
      due_time: z.string().nullable().optional(),
      priority: priorityEnum.optional(),
      recurrence: recurrenceEnum.optional(),
      note: z.string().optional(),
      board_column_key: z.string().optional().describe("Move a kanban card to this column."),
      assignee_id: z.string().uuid().nullable().optional(),
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
