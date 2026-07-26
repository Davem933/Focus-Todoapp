import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { signIn } from "./supabaseClient.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerBoardTools } from "./tools/boards.js";
import { registerTeamTools } from "./tools/teams.js";

async function main() {
  await signIn();

  const server = new McpServer({
    name: "donext",
    version: "0.1.0",
  });

  registerTaskTools(server);
  registerBoardTools(server);
  registerTeamTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error starting DoNext MCP server:", error);
  process.exit(1);
});
