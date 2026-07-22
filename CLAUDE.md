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

Vercel: the workspace is linked via `.vercel/project.json` (project `jsemdavidminarik-3959s-projects/focus-todo-app`, prod alias `focus-todo-app-sigma.vercel.app`). The project is also connected to GitHub (`Davem933/Focus-Todoapp`) and auto-deploys production on push to `main` — `npm run deploy:vercel` is a manual/CLI alternative, not the only path.

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
