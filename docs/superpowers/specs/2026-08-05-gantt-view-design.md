# Gantt View (Gantt diagram) — Design

Status: approved, ready for implementation plan.

## Why

ClickUp-style interactive Gantt/timeline view — a fourth way to view/manage tasks alongside List, Kanban, Table, and Calendar. `ViewTabsBar` already has a wired-up "gantt" tab (`src/layout/ViewTabsBar.tsx:6-17`) and `AppShell.tsx` already tracks `isGanttOpen` state, but renders only a placeholder (`AppShell.tsx:1365-1369`, "Gantt zobrazení se připravuje"). This spec implements the real view behind that stub.

## Scope decisions (from brainstorming)

- **Data scope**: global, not per-project/board like Table — shows all of the current user's visible tasks (owned or assigned) across every project/list, including tasks with no `projectId`. Desktop web only, no mobile/Capacitor support.
- **Library**: `@svar-ui/react-gantt` (MIT-licensed open-source edition — confirmed distinct from the older, GPLv3-only `wx-react-gantt` package). Use its built-in integrated grid+chart widget as-is (not a custom left-side task list) — least risk, scroll-sync between list and chart comes for free.
- **Filtering**: only incomplete (`completed: false`), non-archived tasks with a `dueDate` set. Completed tasks are not shown (may revisit as a toggle later).
- **Missing `startDate`**: derived as `startDate ?? dueDate` at read time in the Gantt adapter only — never backfilled/persisted, so a task with no explicit start renders as a 1-day bar ending on its due date.
- **`progress`**: manual field (0–100), not derived from subtasks. Editable by dragging the bar's progress handle in the chart, or as a number field in the task detail panel.
- **`dependencies`**: array of predecessor task IDs (this task is blocked by those). No restriction to same project/list — any two tasks the user can see in the Gantt can be linked. End-to-start links only (SVAR supports other link types; not exposed in v1).
- **Task detail on click**: routes through the **existing** edit surfaces, split by `task.projectId` — `ProjectCardComposerModal` for project-owned tasks, `DetailPanel` for the rest — same routing rule already used elsewhere in the app (`handleOpenProjectCard` vs `handleSelectTask`). No third/duplicate editing UI.

## Data model

`Task` (`src/tasks/taskTypes.ts`) gains three fields:

```ts
startDate: string | null;   // ISO date, explicit start; null = derive from dueDate
progress: number;           // 0-100, manual
dependencies: string[];     // predecessor task IDs (blocked-by)
```

`TaskUpdate`'s `Pick<...>` union gains `"startDate" | "progress" | "dependencies"`.

Supabase `tasks` table (live schema confirmed via MCP — has none of these columns today): migration adds

```sql
alter table tasks
  add column start_date date,
  add column progress smallint not null default 0,
  add column dependencies uuid[] not null default '{}';
```

No backfill needed — existing rows get `null`/`0`/`{}` for free via the defaults.

## Sync (`src/supabase/cloudBackup.ts`)

Same upsert-by-id pattern as every other field — extend, don't reinvent:

- `CloudTaskRow` type: add `start_date: string | null`, `progress: number`, `dependencies: string[]`.
- Select list (currently `AppShell.tsx`-adjacent query at `cloudBackup.ts:198-201`): add `start_date,progress,dependencies`.
- Upsert payload (`cloudBackup.ts:442-456`): add `start_date: task.startDate`, `progress: task.progress`, `dependencies: task.dependencies`.
- Row→Task mapping (`cloudBackup.ts:686-701`): add `startDate: task.start_date`, `progress: task.progress ?? 0`, `dependencies: task.dependencies ?? []`.

## Component architecture

- New `src/layout/panels/GanttViewPanel.tsx`, same prop shape as `TableViewPanel` (`src/layout/panels/TableViewPanel.tsx:29-39`) so it drops into the existing `isGanttOpen` branch in `AppShell.tsx` with no new plumbing:
  ```ts
  { teams, activeTeamId, tasks, currentUserId, onUpdateTask, onUpdateTaskShareToken, onDeleteTask, canDeleteTask }
  ```
- `AppShell.tsx:1365-1369` placeholder replaced with `<GanttViewPanel ... />`.
- New adapter module `src/gantt/ganttAdapter.ts`:
  - `toGanttTasks(tasks: Task[]): SvarGanttTask[]` — filters per "Filtering" above, maps `id/text=title/start=startDate??dueDate/end=dueDate/progress`.
  - `toGanttLinks(tasks: Task[]): SvarGanttLink[]` — flattens each task's `dependencies` into SVAR link objects (`source=dependencyId, target=taskId, type="e2s"`).
  - `fromGanttUpdate(change): TaskUpdate` — reverse mapping for drag-move/resize/progress-drag events back to `{startDate, dueDate, progress}` patches.
- SVAR event wiring inside `GanttViewPanel`:
  - `on-update-task` (move/resize/progress drag) → `onUpdateTask(taskId, fromGanttUpdate(change))`.
  - `on-add-link` → `onUpdateTask(targetTaskId, { dependencies: [...existing, sourceTaskId] })`.
  - `on-delete-link` → `onUpdateTask(targetTaskId, { dependencies: existing.filter(id => id !== sourceTaskId) })`.
  - `on-click-task` (bar or grid row click) → resolve the `Task`, then call the existing `handleOpenProjectCard`/`handleSelectTask` routing (passed down from `AppShell` as a single `onOpenTask(taskId)` callback, mirroring how `DashboardPanel` already receives `onOpenTask`).
- Toolbar (new, top of `GanttViewPanel`): zoom segmented control (Dny/Týdny/Měsíce → SVAR `scales` presets) + "Dnes" button (scrolls/re-centers SVAR to `new Date()`, via SVAR's imperative API or by re-mounting with a `start` prop pointing at today). Today marker uses SVAR's built-in current-time marker.

## Styling

SVAR themes via CSS custom properties (documented theming API, not Tailwind-based like the rest of the app). Map SVAR's variables to this app's existing dark/light tokens in `styles.css`, following the same "one shared token source" convention used everywhere else (no per-component stylesheet). Bar color by state: overdue (`dueDate < today && !completed`) = red, in-progress = blue, done = green (shown only if the "completed tasks visible" follow-up ships later — v1 has no completed bars per the filtering rule above).

## Out of scope (v1)

- Mobile/Capacitor UI.
- Auto-scheduling, critical path, baselines, resource management, export (SVAR PRO-only features anyway).
- Backfilling `dependencies`/`startDate` for existing tasks.
- Showing completed tasks in the Gantt (filtered out entirely for now).
- Link types other than end-to-start.
