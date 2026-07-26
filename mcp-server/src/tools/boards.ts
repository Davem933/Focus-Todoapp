import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getUserId, supabase } from "../supabaseClient.js";
import { toToolResult, toToolError } from "./result.js";

const statusEnum = z.enum(["active", "completed", "archived"]);

const DEFAULT_BOARD_COLUMNS = [
  { key: "todo", title: "To do", position: 0 },
  { key: "doing", title: "Probiha", position: 1 },
  { key: "review", title: "Kontrola", position: 2 },
  { key: "done", title: "Hotovo", position: 3 },
] as const;

const PROJECT_SELECT = "id,team_id,created_by,name,description,start_date,end_date,status,created_at,updated_at";
const COLUMN_SELECT = "id,project_id,key,title,position,created_at,updated_at";

async function ensureDefaultColumns(projectId: string) {
  const { data, error } = await supabase
    .from("project_columns")
    .upsert(
      DEFAULT_BOARD_COLUMNS.map((column) => ({
        key: column.key,
        position: column.position,
        project_id: projectId,
        title: column.title,
      })),
      { onConflict: "project_id,key", ignoreDuplicates: true },
    )
    .select(COLUMN_SELECT)
    .order("position", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function registerBoardTools(server: McpServer): void {
  server.tool(
    "create_board",
    "Create a new board/project (nastenka) under a team, with default columns (To do/Probiha/Kontrola/Hotovo). Use list_teams to find a team_id first.",
    {
      name: z.string().min(1, "Name is required"),
      team_id: z.string().uuid(),
      description: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
    },
    async ({ name, team_id, description, start_date, end_date }) => {
      try {
        const userId = await getUserId();

        const { data, error } = await supabase
          .from("projects")
          .insert({
            created_by: userId,
            team_id,
            name: name.trim(),
            description: description?.trim() || null,
            start_date: start_date || null,
            end_date: end_date || null,
          })
          .select(PROJECT_SELECT)
          .single();

        if (error) throw error;

        const columns = await ensureDefaultColumns(data.id);
        return toToolResult({ board: data, columns });
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "list_boards",
    "List boards/projects (nastenky), optionally filtered by team_id.",
    { team_id: z.string().uuid().optional() },
    async ({ team_id }) => {
      try {
        let query = supabase.from("projects").select(PROJECT_SELECT).neq("status", "archived");
        if (team_id) {
          query = query.eq("team_id", team_id);
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
    "update_board",
    "Update a board/project's name, description, dates, or status.",
    {
      board_id: z.string().uuid(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      start_date: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
      status: statusEnum.optional(),
    },
    async ({ board_id, ...updates }) => {
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
          .from("projects")
          .update(payload)
          .eq("id", board_id)
          .select(PROJECT_SELECT)
          .single();

        if (error) throw error;
        return toToolResult(data);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "delete_board",
    "Permanently delete a board/project by id (also removes its columns).",
    { board_id: z.string().uuid() },
    async ({ board_id }) => {
      try {
        const { error } = await supabase.from("projects").delete().eq("id", board_id);
        if (error) throw error;
        return toToolResult({ deleted: true, board_id });
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "list_board_columns",
    "List the columns (sloupce) of a board/project.",
    { board_id: z.string().uuid() },
    async ({ board_id }) => {
      try {
        const { data, error } = await supabase
          .from("project_columns")
          .select(COLUMN_SELECT)
          .eq("project_id", board_id)
          .order("position", { ascending: true });

        if (error) throw error;

        if ((data ?? []).length === 0) {
          const columns = await ensureDefaultColumns(board_id);
          return toToolResult(columns);
        }

        return toToolResult(data);
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
