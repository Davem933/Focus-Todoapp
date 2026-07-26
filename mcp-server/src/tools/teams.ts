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
}

export type { TeamRow };
