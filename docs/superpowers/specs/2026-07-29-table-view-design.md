# Table View (Tabulka) — Design

Status: approved, ready for implementation plan.

## Why

ClickUp/Monday-style table view of a board's tasks — third way to view/manage tasks alongside Kanban and Calendar. Mockup reference: `C:\Users\David\screeny\table.jpg`. Supersedes the paused spec in memory `table_view_feature_spec.md` (2026-07-23); this version resolves both open questions from that spec: row interaction is inline editing (not a modal), and custom columns ship in v1 (capped at 2 per board).

## Scope decisions (from brainstorming)

- **Data scope**: per-board, via a new board-selector dropdown (not "all tasks" like Calendar).
- **Toolbar**: fully functional in v1 — Group, Shown columns, Filter, Closed toggle, Assignee filter, Search, Add Task.
- **Custom columns**: text or select type, capped at 2 per board, persisted to Supabase (new tables), synced across team members/devices.
- **Group by**: Status, Assignee, or Priority.

## Architecture

- `src/layout/panels/TableViewPanel.tsx` (new) renders when `isTableOpen` is true, replacing the current placeholder at `AppShell.tsx:1137-1141`.
- Board selector: `CustomDropdown` populated via `loadProjectsForTeams(activeTeamId)` (same source `ProjectsOverviewPanel` uses). Selecting a board loads its `ProjectColumn[]` via `loadProjectColumns(projectId)` for the Status options, and filters tasks to `task.projectId === selectedBoardId`.
- `TableToolbar` (new, `src/layout/panels/TableToolbar.tsx` or colocated) renders Group/Shown/Filter/Closed/Assignee/Search/Add Task controls.
- `TaskTable` (new) renders sticky-header rows (or grouped sections when Group ≠ None), built from reusable cell components:
  - `StatusBadge`, `PriorityFlag`, `AssigneeAvatar` (new, in `src/layout/panels/table/` or similar) — modular, independently usable.
  - Inline editors for Name (text), Due Date (date input popover).
- Built-in field edits go through the existing `onUpdateTask(taskId, patch: TaskUpdate)` callback already threaded through `AppShell` — no new mutation path for Name/Assignee/Status/Due Date/Priority.
- Priority color mapping is currently duplicated in `AppShell.tsx:89-93` and `ListPanel.tsx:45-49`; extract to one shared helper (e.g. `src/tasks/priorityColors.ts`) and use it in all three places (both existing call sites plus the new `PriorityFlag`).
- Status dot color (index column: dotted = To Do, filled blue = In Progress) reuses the same status-color logic already used for Kanban `ProjectColumn`s — no separate palette.
- "+ Add Task" opens the existing `ProjectCardComposerModal` flow (used by Kanban), pre-set to the selected board.
- Row hover actions (open full card, delete) reuse existing icons/handlers from the Kanban card component.

## Data model (new Supabase tables)

Two new tables, RLS modeled on `project_columns`/`tasks` (verify exact policies live via Supabase MCP at implementation time — `schema.sql` is stale per project CLAUDE.md):

- **`project_custom_columns`**: `id uuid PK`, `project_id uuid FK->projects`, `key text`, `title text`, `field_type text check in ('text','select')`, `options jsonb` (array of `{value, label, color}`, used only when `field_type='select'`), `position int`.
  - Cap of 2 custom columns per project is enforced **app-side** (the "+" add-column control disables/hides once the board already has 2), not via a DB trigger.
- **`task_custom_field_values`**: `task_id uuid FK->tasks`, `column_id uuid FK->project_custom_columns`, `value text nullable`. One row per task×column with a value; absence = empty. Composite PK `(task_id, column_id)`.
- New client module `src/supabase/projectCustomColumnApi.ts`: `loadCustomColumns(projectId)`, `createCustomColumn(projectId, title, fieldType, options?)`, `deleteCustomColumn(columnId)`, `loadCustomFieldValues(projectId)` (or per-task), `setCustomFieldValue(taskId, columnId, value)`.
- Custom column values are **not** added to the core `Task`/`TaskUpdate` type in `taskTypes.ts` — kept separate from `cloudBackup.ts`'s upsert-by-id sync engine, fetched/written per board.

## Toolbar behavior

- **Group: None ▾** — `None | Status | Assignee | Priority`. When set, rows render under collapsible section headers with counts.
- **Shown** — popover checklist to show/hide built-in columns (Assignee/Status/Due Date/Priority) and any custom columns. Name is always shown.
- **Filter** — popover for Priority/Due-date filtering.
- **Closed** toggle — show/hide tasks where `boardColumnKey === "done"`.
- **Assignee filter** — multi-select of the board's team members.
- **Search** — live substring filter on `title`.
- **+ Add Task** — opens `ProjectCardComposerModal` for the selected board.

## Columns & inline editing

1. **Index** — row number + status dot (color from board's column state).
2. **Name** — click-to-edit text input, Enter/blur commits `onUpdateTask(id, {title})`; hover reveals row actions.
3. **Assignee** — avatar badge (initial + full name via existing `getMemberInitials()`); click → dropdown of team members → `onUpdateTask(id, {assigneeId})`.
4. **Status** — badge (dashed outline for non-terminal columns, solid blue-style for "in progress"-like columns); click → dropdown of the board's `ProjectColumn`s → `onUpdateTask(id, {boardColumnKey})`.
5. **Due Date** — formatted date or relative ("6 days ago"), red when overdue and not completed; click → `<input type="date">` popover → `onUpdateTask(id, {dueDate})`.
6. **Priority** — flag icon + label, color via shared `priorityColors` helper; click → dropdown of `none/low/medium/high` → `onUpdateTask(id, {priority})`.
7. **Custom columns** (0–2) — text columns edit as a plain text input; select columns edit via a dropdown of that column's `options`. Edits call `setCustomFieldValue`.
8. **"+" trailing header** — opens a small modal to name a new column and choose Text or Select (+ define options for Select); hidden/disabled once the board already has 2 custom columns.

## Styling

Dark theme, compact spreadsheet-style rows, rounded badges, sticky header on scroll, high contrast — matching `src/styles.css` conventions (no CSS-in-JS in this codebase; new rules go in `styles.css` alongside existing panel styles).

## Out of scope for v1

- Gantt and Dashboard view tabs (remain placeholders — untouched by this work).
- Drag-to-reorder rows/columns.
- Bulk row selection/actions.
