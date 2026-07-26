# DoNext MCP server

Lets Claude create, read, update, and delete your DoNext tasks and boards
via natural language ("vytvoř úkol...", "vytvoř nástěnku...").

Runs locally on your machine, signs in to Supabase as **you** using your own
DoNext email/password, and respects the same row-level-security rules the
app itself uses — it can only ever see and change your own data (or your
teams' data, for boards).

## Setup

1. Install dependencies and build:

   ```bash
   cd mcp-server
   npm install
   npm run build
   ```

2. Create your local config:

   ```bash
   cp .env.example .env
   ```

   Then edit `mcp-server/.env`:
   - `SUPABASE_URL` / `SUPABASE_ANON_KEY` — same values as the main app's
     `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
   - `MCP_USER_EMAIL` / `MCP_USER_PASSWORD` — your own DoNext login.

   `.env` is git-ignored; never commit it.

3. Register the server.

   **Claude Code users (recommended if you cloned this repo):** the server
   is already registered for the whole project via the committed
   [`.mcp.json`](../.mcp.json) at the repo root (`claude mcp add donext
   --scope project -- node mcp-server/dist/index.js`). You don't need to
   run that command again — just open this project in Claude Code and run
   `claude`; on first use it will show a one-time approval prompt for the
   project-scoped `donext` server (project MCP servers always require
   explicit approval, since anyone with write access to the repo could add
   one). Approve it once and you're done. You still need your own
   `mcp-server/.env` from step 2 — that file is git-ignored and never
   shared, so every teammate signs in as themselves.

   **Claude Desktop** — add to `claude_desktop_config.json` instead
   (Claude Desktop doesn't read `.mcp.json`):

   ```json
   {
     "mcpServers": {
       "donext": {
         "command": "node",
         "args": ["ABSOLUTE_PATH_TO_REPO/mcp-server/dist/index.js"]
       }
     }
   }
   ```

4. Try it:

   > vytvoř úkol Koupit mléko
   > vytvoř nástěnku Marketing kampaň pro tým X

## For every other DoNext user with Claude Code

You do **not** need to clone the whole app repo just to get Claude
integration. Grab the prebuilt package from the
[Releases page](https://github.com/Davem933/Focus-Todoapp/releases) instead
(look for the latest `mcp-server-vX.Y.Z` tag):

1. Download `donext-mcp-server.zip` from that release and extract it
   anywhere (e.g. `C:\Tools\donext-mcp-server`). It already contains the
   built `dist/` folder, so no compiler/build step is needed.
2. Open a terminal in the extracted folder and run `npm install --omit=dev`
   (installs just the 3 runtime dependencies — takes a few seconds).
3. `cp .env.example .env` and fill in **your own** values:
   - `SUPABASE_URL=https://ykldkglnrjcimpazkhto.supabase.co`
   - `SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrbGRrZ2xucmpjaW1wYXpraHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODQxODgsImV4cCI6MjA5NDM2MDE4OH0.xo1Hk_FUKb8wsezG2gsR-rjVhtJamREp54AHV4WUK38`
     (this is the same public anon key already shipped inside the deployed
     app's JS bundle — it's meaningless without a valid DoNext login, since
     Supabase row-level security is what actually protects the data, not
     this key).
   - `MCP_USER_EMAIL` / `MCP_USER_PASSWORD` — your own DoNext login.
4. Register it with Claude Code:

   ```bash
   claude mcp add donext -- node "C:\Tools\donext-mcp-server\dist\index.js"
   ```

   (Adjust the path to wherever you extracted the zip.) Or for Claude
   Desktop, add the same `command`/`args` to `claude_desktop_config.json`
   as shown above.
5. Restart/reopen Claude and try: *"vytvoř úkol Koupit mléko"*.

If you already have this repo cloned (e.g. you're a contributor), you can
skip the download and just build `mcp-server/` in place (step 1-2 under
**Setup** above) — the committed [`.mcp.json`](../.mcp.json) will offer it
to Claude Code automatically, you just approve the one-time prompt.

Either way, the MCP server always signs in as whoever's credentials are in
*their own* local `.env` — everyone only ever sees/changes their own tasks
(or their own teams' boards), enforced server-side by Supabase RLS. The MCP
server itself has no elevated access.

New versions get published as new `mcp-server-vX.Y.Z` releases/tags — since
this is a downloaded zip (not `npx`-style auto-fetching), nothing updates
itself silently; you re-download only when you choose to.

## Available tools

| Tool | Purpose |
|---|---|
| `create_task` | Create a plain to-do (optionally in a named list) **or** a kanban card on a board (pass `board_id`, optionally `board_column_key`/`assignee_id`). |
| `list_tasks` | List tasks — filter by list name (to-dos) or by `board_id`/`board_column_key` (kanban cards). |
| `update_task` | Change title, due date/time, priority, recurrence, note, or move a kanban card to another column / reassign it. |
| `complete_task` | Mark a task done/undone. |
| `delete_task` | Delete a task. |
| `list_task_lists` / `create_task_list` | Manage task lists (seznamy). |
| `list_teams` | List teams you belong to (needed to create a board). |
| `list_team_members` | List a team's members (email, role, nickname) — e.g. to find an `assignee_id`. |
| `create_board` | Create a board/project under a team, with default columns. |
| `list_boards` / `update_board` / `delete_board` | Manage boards. |
| `list_board_columns` | List a board's columns (use to find valid `board_column_key` values). |

## Notes

- This is a **local** MCP server (stdio transport) — each DoNext user who
  wants Claude integration installs and runs it on their own machine with
  their own credentials. There is no shared/hosted instance.
- Full CRUD is enabled, including deletes — Claude can delete tasks/boards
  if asked to. Review prompts before confirming destructive requests.
