# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Commands

```bash
npm install              # install deps
npm run dev               # Vite dev server
npx tsc --noEmit           # typecheck (build also runs this) — there is no separate lint script
npm run build              # tsc && vite build
npm run preview             # preview a production build locally
npm run deploy:vercel        # npx vercel deploy --prod --yes --scope jsemdavidminarik-3959s-projects
npm run android:sync          # npm run build && cap sync android
npm run android:open           # cap open android
```

There is no test suite/framework configured in this repo (no test script, no `*.test.*`/`*.spec.*` files) — do not assume Jest/Vitest exists.

Vercel: the workspace is linked via `.vercel/project.json` (project `jsemdavidminarik-3959s-projects/focus-todo-app`, prod alias `focus-todo-app-sigma.vercel.app`). The project is also connected to GitHub (`Davem933/Focus-Todoapp`) and does auto-deploy production on push to `main` — confirmed working in practice — but `README.md` explicitly says not to rely on the Git integration as the *primary* deploy path and to prefer `npm run build && npm run deploy:vercel` (direct CLI deploy) instead. Either path deploys the same `main`, but env vars only apply to what Vercel already has configured for the project (see below) — pushing/deploying doesn't add them.

Env vars: local dev needs `.env.local` (git-ignored) with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` and `VITE_GROQ_API_KEY` (see `.env.example`). Vite bakes `VITE_*` vars into the client bundle at build time, so adding/changing one in Vercel's dashboard requires a redeploy (not just a push) to take effect, and — since there's no backend — these values are always readable in the shipped JS.

## Architecture

**State orchestration is centralized, not per-feature.** `src/App.tsx` is the root: it owns all task/list/team/auth state, localStorage persistence, URL route sync (`pushListRoute`/`pushTaskRoute`/etc.), and the Supabase cloud-sync effects. It passes data and callbacks down into `src/layout/AppShell.tsx`, which is the largest file in the app and handles almost all UI orchestration — panel switching, the Teams/Projects/Notes overview screens, the project board + drag-and-drop, and the card composer modal. Most "where does X live" questions resolve to one of these two files before anything else.

Panel components (`src/layout/panels/*`) are the visible surfaces: `SidebarPanel` (workspace/team nav), `ListPanel` (day/list task view), `DetailPanel` (legacy, non-project-aware task editor — still used for tasks with no `projectId`), `WorkspaceHomePanel` (team dashboard), `NotesPanel`, `ProfilePanel`. Project-board tasks are edited through `ProjectCardComposerModal`, defined inline inside `AppShell.tsx`, not through `DetailPanel` — when wiring up a new way to open a task, route project-owned tasks (`task.projectId` set) to the board flow (see `handleOpenProjectsOverview`/`handleOpenProjectCard` in AppShell) rather than the plain task-selection path (`handleSelectTask`), which only opens `DetailPanel`.

Domain/data layers:
- `src/tasks/*` — task types (`taskTypes.ts`), local persistence/sanitization (`taskStorage.ts`), focus/recommendation scoring (`taskRecommendation.ts`), dashboard aggregation (`taskDailyOverview.ts`), view filtering (`taskViews.ts`), stable id generation (`idUtils.ts`).
- `src/supabase/*` — `cloudBackup.ts` is the sync engine between local state and Postgres (see below); `teamApi.ts`, `projectApi.ts`, `noteApi.ts`, `notificationsApi.ts`, `adminApi.ts` are per-domain CRUD; `AuthWidget.tsx` is the auth UI.
- `src/notes/*` — Obsidian-style notes: folders, wiki-links/backlinks, fuzzy search, quick switcher, and a force-directed graph view (`NoteGraphView.tsx`/`noteGraphLayout.ts`).
- `src/projects/*`, `src/teams/*` — board/kanban and team domain types (most of the actual project/team *UI* logic lives in `AppShell.tsx`, not these folders).
- `src/focus/FocusView.tsx` — single-task focus mode.
- `src/notifications/taskNotifications.ts` — local/scheduled task reminders (separate from the Supabase realtime `notifications` table in `supabase/notificationsApi.ts`).
- `src/styles.css` — nearly all styling; there is no CSS-in-JS or per-component stylesheet convention.

### Smart Quick Capture (`src/layout/quickCapture/*`, `src/tasks/{groqService,quickCaptureResolve,assigneeMatch}.ts`)

A floating mic button (rendered globally from `AppShell.tsx`) opens a modal that turns dictated/typed Czech text into a structured task. The pipeline is split so the AI dependency is fully isolated and swappable:
- `groqService.ts` — the only file that knows about the AI provider (Groq's OpenAI-compatible `chat/completions`, model `llama-3.1-8b-instant`, requires `VITE_GROQ_API_KEY`). Despite the filename pattern, this is **not** Gemini or Grok/x.ai — both were tried first and rejected (Gemini: free-tier quota was 0 for every key tested, account/region-level; Grok/x.ai: requires prepaid credit, no free calls at all). Swapping providers again means only touching this file.
- `quickCaptureResolve.ts` — orchestrates the fallback: if Groq isn't configured or the call fails for any reason, it silently falls back to the existing offline `naturalLanguageTaskParser.ts` (same parser the plain composer uses) rather than blocking task creation. Never surface a hard AI error to the user; this fallback path is the intended behavior, not a bug.
- `assigneeMatch.ts` — fuzzy-matches an AI-extracted name against the active team's members (diacritics-insensitive substring match) to pre-fill (never auto-confirm) the assignee dropdown.
- The modal also loads project boards for the active team (`loadProjectsForTeams`/`loadProjectColumns`) so a captured task can be filed directly onto a board's first column instead of only the plain list.

### mcp-server/ — separate local MCP server, not part of the Vite app

`mcp-server/` is an independent Node/TypeScript package (own `package.json`, `tsconfig.json`, build step) that lets Claude create/read/update/delete the signed-in user's own tasks and boards via natural language, using the DoNext user's own Supabase email/password (RLS-enforced, same as the app itself). It is registered project-wide via the root `.mcp.json`. Building/typechecking the main app (`npm run build` / `npx tsc --noEmit` at repo root) does **not** build or typecheck this package — run `npm run build` inside `mcp-server/` separately when touching `mcp-server/src/**`. Its tools live in `mcp-server/src/tools/{tasks,boards,teams,result}.ts`.

### Cloud sync model (`src/supabase/cloudBackup.ts`)

Sync is **upsert-by-id**, not the delete-and-reinsert-everything pattern it used to be: tasks/lists/subtasks get stable client-generated ids (`crypto.randomUUID()` via `idUtils.ts`) so they survive across syncs, and each save upserts the current local array by id, then deletes only rows actually missing from local state (scoped to `owner_id`). This matters because Supabase RLS is **asymmetric across tables** and easy to get wrong:
- `tasks` UPDATE allows the owner *or any team member* — any teammate can freely edit a shared task.
- `task_lists` UPDATE only allows the owner *or a team admin* (not any member).
- `subtasks`/`task_labels` UPDATE only allow the **owner** (no team-member or team-admin exception at all).

Also, `with_check` on `tasks`/`task_lists` UPDATE requires the resulting row's `owner_id = auth.uid()` for non-admins — there is no way to "preserve" another user's ownership on a row you touch; the DB itself forces ownership to flip to whoever last successfully writes a row. Any change to sync logic needs to check current RLS policies (`pg_policies`) rather than assume `schema.sql` is current — it is **stale**: several live columns (`team_id`, `assignee_id`, `project_id`, `board_column_key`, `created_by` on `tasks`; `team_id` on `task_lists`) and all RLS policies were added directly against the live Supabase project and are not reflected in the committed `supabase/*.sql` files. Use the Supabase MCP tools (`list_tables`, `execute_sql`) against the live project to check real schema/policies before changing sync or permission logic.

## Known gotchas

- `src/layout/AppShell.tsx` has pre-existing mojibake (broken Czech characters, e.g. `Otev??t`, `Nem?`) from a past encoding mismatch. Don't "fix" unrelated strings incidentally while editing nearby code — check encoding carefully if you touch Czech UI text in this file, since parts are already corrupted and re-saving with the wrong encoding can spread the damage.
- Board column "Archivovat" and "Smazat" currently behave the same (both remove the column) — `ProjectColumn` has no separate archived state yet.
- `vite build` warns about a >500kB main chunk; no code-splitting has been set up.
- Overlay backdrops (`.quick-capture-overlay__backdrop`, `.dashboard-overlay__backdrop`, etc.) are `<button>` elements, so the app-wide `button:hover` rule in `styles.css` (higher specificity than a single class selector) overrides a backdrop's overlay color on hover/focus unless you also add `:hover`/`:focus-visible`/`:active` overrides re-asserting it — follow the existing `.dashboard-overlay__backdrop:hover` pattern for any new overlay.
