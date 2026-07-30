# List View — Design

Status: approved, ready for implementation plan.

## Why

ClickUp-style "List View" — tasks grouped by board status into collapsible sections, spreadsheet-like rows (Name/Assignee/Due date/Priority/Status), sitting alongside the existing Table View as a new view tab. Mockup reference: user-supplied ClickUp screenshot (List/Board/Table switcher, Group: Status, IN PROGRESS/TO DO sections with counts and badges).

## Scope decisions (from brainstorming)

- **Data scope**: per-project, same as Table View — not a cross-app "all tasks" view. Grouping is fixed to the project's board columns (`ProjectColumn`), there is no group-by-assignee/priority option in v1.
- **Comments column**: omitted entirely — no comments/thread data model exists in this app.
- **Add Task**: opens the existing `ProjectCardComposerModal` (same as Table/Board), pre-filled with the target group's `boardColumnKey`. Not a true inline spreadsheet-style add row.
- **Toolbar**: fully functional in v1 — Group: Status (fixed), Subtasks toggle, Columns (custom column visibility), Filter, Closed toggle, Assignee filter, Search, Customize, + Add Task.
- **Subtasks toggle**: when on, each task with subtasks gets an expand arrow revealing nested subtask rows (name + completion checkbox) directly under it.

## Architecture

- New `ViewTabKind` value `"list"` added to `src/layout/AppShell.tsx` / `src/layout/ViewTabsBar.tsx` (`VIEW_TAB_CONFIG`, `VIEW_TAB_ORDER`), opened via the existing "+ Zobrazení" (+ View) menu — same mechanism as Table/Gantt/Dashboard tabs.
- `src/layout/panels/ListViewPanel.tsx` (new) — container, sibling of `TableViewPanel.tsx`. Loads the same project/columns/members/custom-columns data via the same Supabase loaders (`loadProjectsForTeams`, `loadProjectColumns`, `loadTeamMembers`) and filters `tasks` by `task.projectId === selectedProjectId`.
- `src/layout/panels/list/` (new folder):
  - `ListToolbar.tsx` — Group: Status / Subtasks / Columns toggles (left) + Filter / Closed / Assignee / Search / Customize / + Add Task (right).
  - `ListGroup.tsx` — one collapsible section: header (collapse arrow, `StatusBadge`, filtered task count), column header row, task rows, trailing "+ Add Task" row.
  - `ListRow.tsx` — one task row: status dot/checkbox, inline-editable name, `AssigneeAvatar`, due date, `PriorityFlag`, `StatusBadge` (click → dropdown of `ProjectColumn`s to change `boardColumnKey`), custom column cells. No Comments cell.
  - `ListSubtaskRow.tsx` — nested subtask row (title + completion checkbox), rendered only when the Subtasks toggle is on and the parent task has subtasks.
- Reused as-is from Table View: `StatusBadge`, `AssigneeAvatar`, `PriorityFlag`, `classifyColumnState` (status→todo/in-progress/done classification), `CustomColumnModal`, `ProjectCardComposerModal`.
- **Shared refactor**: filter/search/assignee-filter logic currently embedded in `TableToolbar.tsx`/`TaskTable.tsx` is extracted into a shared hook (e.g. `src/layout/panels/shared/useProjectViewFilters.ts`) so Table View and List View both consume it instead of duplicating filter state/logic. This is the only change to existing Table View code required by this work.
- All row edits go through the existing `onUpdateTask(taskId, patch: TaskUpdate)` callback already threaded through `AppShell` — no new mutation path.

## Grouping, ordering, and data flow

- **Groups**: one per `ProjectColumn`, ordered by `ProjectColumn.position`. Badge style/color from `classifyColumnState` (todo = dashed grey, in-progress = solid blue, done = green) — same palette as Table View, no new palette.
- **Row order within a group**: existing task order (same as Board/Table), no drag-to-reorder in v1.
- **Collapse state**: local `useState<Set<columnKey>>` in `ListViewPanel`, not persisted across reloads (matches Table View's current filter/grouping state handling).
- **Closed toggle**: hides/shows the group(s) where `classifyColumnState(columnKey, columns) === "done"` entirely (whole section, not just done rows).
- **Filter / Assignee / Search**: apply across all groups simultaneously; a row disappears from its group if it fails any active filter. Each group header's count reflects the **filtered** count, not the group's total.
- **Empty group** (0 tasks after filtering): still rendered, with count "0" and just the "+ Add Task" row — matches Board view's behavior of always showing all columns.
- **+ Add Task (per-group)**: opens `ProjectCardComposerModal` pre-filled with that group's `boardColumnKey`.
- **Inline name edit**: click-to-edit text input on the Name cell, Enter/blur commits via `onUpdateTask(id, {title})` — same interaction pattern as Table View's Name column.
- **Status change**: click `StatusBadge` in a row → dropdown of the project's `ProjectColumn`s → `onUpdateTask(id, {boardColumnKey})`, which moves the row to a different group.
- **Subtasks toggle**: when on, tasks with `subtasks.length > 0` show an expand arrow left of the status dot; expanding renders one `ListSubtaskRow` per `TaskSubtask`, checkbox toggles `subtask.completed` via the existing subtask update path.
- **Columns toggle**: popover checklist controlling visibility of custom columns (same custom-column model as Table View — reused, not duplicated).
- **Customize**: opens `CustomColumnModal` (reused from Table View) to add/edit custom columns, capped at 2 per project (existing cap from Table View).

## Error handling and empty states

- **Project with no columns**: same fallback as Table View — empty-state message, no group headers rendered.
- **Load error** (Supabase fetch failure): same loading/error state pattern as `TableViewPanel` — no new error-handling logic.
- **Real-time consistency**: List View reads from the same `tasks` state in `App.tsx`/cloud sync as every other view — no separate sync path, so edits from Board/Table/List reflect across views immediately.

## Styling

Plain semantic classes in `src/styles.css` (BEM-ish, e.g. `list-view__group`, `list-row__cell--due-date`), matching Table View's convention — no Tailwind utility classes, consistent with the rest of the codebase.

## Testing

No test framework is configured in this repo. Verification is manual via the dev server: open a project, add a List View tab, check grouping/collapsing/counts, filters (Filter/Closed/Assignee/Search), inline name edit, status-change dropdown, subtasks expand/collapse, per-group "+ Add Task" modal prefill, empty-group rendering, and Customize/Columns interplay with existing Table View custom columns.

## Out of scope for v1

- Group-by-Assignee / Group-by-Priority (fixed to Status only).
- True inline spreadsheet-style add-row (uses the existing modal instead).
- Comments column/functionality.
- Drag-to-reorder rows or groups.
- Persisting collapsed-group state across reloads.
