import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getUserId, supabase } from "../supabaseClient.js";
import { toToolResult, toToolError } from "./result.js";

type TeamRow = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  owner_id: string;
};

type MembershipRow = { team_id: string };

type TeamMemberRow = {
  created_at: string;
  email: string;
  nickname?: string | null;
  role: "admin" | "member";
  user_id: string;
};

export async function loadUserTeamIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("team_members").select("team_id").eq("user_id", userId);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => (row as MembershipRow).team_id)));
}

export function registerTeamTools(server: McpServer): void {
  server.tool(
    "list_teams",
    "List teams the signed-in user owns or is a member of. Needed to pick a team_id for create_board.",
    {},
    async () => {
      try {
        const userId = await getUserId();
        const memberTeamIds = await loadUserTeamIds(userId);

        let query = supabase.from("teams").select("id,name,color,description,owner_id");
        query =
          memberTeamIds.length > 0
            ? query.or(`owner_id.eq.${userId},id.in.(${memberTeamIds.join(",")})`)
            : query.eq("owner_id", userId);

        const { data, error } = await query.order("name", { ascending: true });
        if (error) throw error;
        return toToolResult(data ?? []);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.tool(
    "list_team_members",
    "List the members of a team (email, role, nickname). Use list_teams first to find a team_id.",
    { team_id: z.string().uuid() },
    async ({ team_id }) => {
      try {
        const { data, error } = await supabase.rpc("get_team_members", {
          check_team_id: team_id,
        });

        if (error) throw error;

        const members = ((data ?? []) as TeamMemberRow[]).map((row) => ({
          userId: row.user_id,
          email: row.email,
          role: row.role,
          nickname: row.nickname ?? null,
          createdAt: row.created_at,
        }));

        return toToolResult(members);
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}

export type { TeamRow };
