# Gantt View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the interactive Gantt/timeline view behind the existing `isGanttOpen` placeholder in `AppShell.tsx`, using `@svar-ui/react-gantt` (MIT), with drag move/resize, drag-to-link dependencies, day/week/month zoom, a "today" jump, and edits that flow through the existing task-mutation pipeline.

**Architecture:** A new `GanttViewPanel` component wraps SVAR's `<Gantt>` widget, converting between this app's `Task[]`/`TaskUpdate` shapes and SVAR's task/link shapes in a small pure-function adapter module. All edits (drag, resize, progress drag, link add/remove) call the existing `onUpdateTask(taskId, patch)` callback already threaded through every other view, so Supabase cloud sync (`cloudBackup.ts`) picks them up with no new sync path. Clicking a bar reuses the existing `handleSelectCommandPaletteTask` routing (already used by `DashboardPanel`) to open the right edit surface (`ProjectCardComposerModal` or `DetailPanel`) based on `task.projectId`.

**Tech Stack:** React 19, TypeScript, `@svar-ui/react-gantt`, Supabase (Postgres), Vite. No unit-test framework exists in this repo (confirmed in `CLAUDE.md`) — verification is `npx tsc --noEmit`, `npm run build`, and manual browser verification via the dev-server preview, matching how every other view in this codebase was built and verified.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-08-05-gantt-view-design.md`.
- Global (not per-project) Gantt: shows the current user's incomplete, non-archived, `dueDate`-having tasks across all projects/lists, including tasks with no `projectId`.
- Desktop web only — no mobile/Capacitor-specific work.
- `@svar-ui/react-gantt` only (MIT open-source edition) — not `wx-react-gantt` (GPLv3).
- `startDate` fallback (`startDate ?? dueDate`) is computed at read time only, never persisted as a copy.
- `progress` is a manual 0–100 field, never derived from subtasks.
- `dependencies` links are unrestricted (any two visible tasks), end-to-start only.
- All mutations go through the existing `onUpdateTask(taskId, patch: TaskUpdate)` callback — no new mutation/sync path.
- Task detail editing reuses existing `ProjectCardComposerModal` (project tasks) / `DetailPanel` (non-project tasks) — no third editing UI.
- Keep files focused; this repo's convention (per `CLAUDE.md`) is large orchestration files (`AppShell.tsx`) with feature logic pulled into `src/<domain>/*` — follow that pattern for the new Gantt code (`src/gantt/`).
- Live Supabase project id for MCP tools: `ykldkglnrjcimpazkhto`. `supabase/schema.sql` is stale/unmaintained (per `CLAUDE.md`) — do not edit it; apply the migration directly via the Supabase MCP `apply_migration` tool, which is how this project's live schema already diverges from the committed SQL.

---

### Task 1: Data model — `Task`/`TaskUpdate` types

**Files:**
- Modify: `src/tasks/taskTypes.ts`

**Interfaces:**
- Produces: `Task.startDate: string | null`, `Task.progress: number`, `Task.dependencies: string[]`; `TaskUpdate` now allows patching those three keys.

- [ ] **Step 1: Add the three fields to `Task`**

In `src/tasks/taskTypes.ts`, in the `Task` type (currently lines 22-41), add after `shareToken: string | null;`:

```ts
  startDate: string | null;
  progress: number;
  dependencies: string[];
```

- [ ] **Step 2: Extend `TaskUpdate`'s allowed keys**

In the same file, in the `Pick<Task, ...>` union inside `TaskUpdate` (currently lines 49-68), add `"startDate" | "progress" | "dependencies"` to the list of picked keys (alongside the existing `"labels" | "subtasks"`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: New errors appear at every place that constructs a `Task` object literal without the three new fields (default task factories, mock data, `cloudBackup.ts` mapping). Do not fix them yet — Task 2 and Task 3 fix the real call sites. Note down the file list from the error output for reference.

- [ ] **Step 4: Commit**

```bash
git add src/tasks/taskTypes.ts
git commit -m "feat(gantt): add startDate/progress/dependencies fields to Task type"
```

---

### Task 2: Supabase schema migration

**Files:**
- None in-repo (schema is managed live via Supabase MCP; `supabase/schema.sql` is intentionally not touched — see Global Constraints).

**Interfaces:**
- Produces: `tasks.start_date date`, `tasks.progress smallint not null default 0`, `tasks.dependencies uuid[] not null default '{}'` columns on the live `tasks` table.

- [ ] **Step 1: Apply the migration**

Use the Supabase MCP `apply_migration` tool with `project_id: "ykldkglnrjcimpazkhto"` and:

```sql
alter table tasks
  add column start_date date,
  add column progress smallint not null default 0,
  add column dependencies uuid[] not null default '{}';
```

- [ ] **Step 2: Verify the columns exist**

Use the Supabase MCP `execute_sql` tool with `project_id: "ykldkglnrjcimpazkhto"`:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'tasks' and column_name in ('start_date', 'progress', 'dependencies');
```

Expected: 3 rows returned, matching the types above.

- [ ] **Step 3: Check advisors for new issues**

Use the Supabase MCP `get_advisors` tool with `project_id: "ykldkglnrjcimpazkhto"` and `type: "security"`. Confirm no new advisory was introduced by the migration (existing RLS policies on `tasks` already cover all columns via row-level, not column-level, rules — this migration should not need new policies).

No commit — this task has no repo file changes.

---

### Task 3: Cloud sync — `cloudBackup.ts`

**Files:**
- Modify: `src/supabase/cloudBackup.ts`

**Interfaces:**
- Consumes: `Task.startDate/progress/dependencies` (Task 1).
- Produces: round-trip sync of the three new fields through the existing upsert-by-id pipeline.

- [ ] **Step 1: Extend `CloudTaskRow`**

In `src/supabase/cloudBackup.ts`, in the `CloudTaskRow` type (currently lines 42-58), add:

```ts
  start_date: string | null;
  progress: number;
  dependencies: string[];
```

- [ ] **Step 2: Extend the select list**

At `cloudBackup.ts:198-201`, the `.select(...)` call currently reads:

```ts
.select(
  "id,list_id,title,completed,due_date,due_time,is_archived,note,priority,recurrence,team_id,assignee_id,owner_id,project_id,board_column_key,share_token",
)
```

Change to:

```ts
.select(
  "id,list_id,title,completed,due_date,due_time,is_archived,note,priority,recurrence,team_id,assignee_id,owner_id,project_id,board_column_key,share_token,start_date,progress,dependencies",
)
```

- [ ] **Step 3: Extend the upsert payload**

At `cloudBackup.ts:442-456`, the upsert object currently includes fields like `board_column_key: task.boardColumnKey,`. Add:

```ts
        start_date: task.startDate,
        progress: task.progress,
        dependencies: task.dependencies,
```

- [ ] **Step 4: Extend the row→Task mapping**

At `cloudBackup.ts:686-701`, the mapping back to `Task` currently includes lines like `boardColumnKey: normalizeBoardColumnKey(task.board_column_key),`. Add:

```ts
    startDate: task.start_date,
    progress: task.progress ?? 0,
    dependencies: task.dependencies ?? [],
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: The `cloudBackup.ts` errors from Task 1 Step 3 are gone. Remaining errors (if any) point to other `Task`-literal construction sites — proceed to Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/supabase/cloudBackup.ts
git commit -m "feat(gantt): sync startDate/progress/dependencies through cloudBackup"
```

---

### Task 4: Fix remaining `Task`-literal construction sites

**Files:**
- Modify: whatever files `npx tsc --noEmit` still flags after Task 3 (expected: local task-creation helpers such as `src/tasks/taskStorage.ts` default-task factories, and any mock/seed data in `src/tasks/mockData.ts`).

**Interfaces:**
- Consumes: `Task` type from Task 1.

- [ ] **Step 1: Run typecheck and list remaining errors**

Run: `npx tsc --noEmit`
Expected: A list of `Task`-shaped object literals missing `startDate`/`progress`/`dependencies`.

- [ ] **Step 2: Fix each site with the field's neutral default**

For each flagged object literal, add:

```ts
startDate: null,
progress: 0,
dependencies: [],
```

- [ ] **Step 3: Typecheck clean**

Run: `npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(gantt): backfill startDate/progress/dependencies defaults in task factories"
```

---

### Task 5: Install `@svar-ui/react-gantt`

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install @svar-ui/react-gantt`

- [ ] **Step 2: Verify it landed as a direct dependency**

Run: `npx tsc --noEmit` (confirms the package resolves and ships its own types — SVAR React Gantt has "full TypeScript support" per its README).
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(gantt): add @svar-ui/react-gantt dependency"
```

---

### Task 6: Gantt adapter — pure conversion functions

**Files:**
- Create: `src/gantt/ganttAdapter.ts`

**Interfaces:**
- Consumes: `Task`, `TaskUpdate` from `src/tasks/taskTypes.ts`; `getTodayDateValue` from `src/tasks/dateUtils.ts` (existing helper, confirmed via graphify query — used elsewhere for "today" comparisons).
- Produces (consumed by Task 7's `GanttViewPanel`):
  - `type SvarGanttTask = { id: string; text: string; start: Date; end: Date; duration: number; progress: number; type: "task"; parent: number }`
  - `type SvarGanttLink = { id: string; source: string; target: string; type: "e2s" }`
  - `isTaskGanttEligible(task: Task): boolean`
  - `toGanttTasks(tasks: Task[]): SvarGanttTask[]`
  - `toGanttLinks(tasks: Task[]): SvarGanttLink[]`
  - `fromDragUpdate(startDate: Date, endDate: Date): Pick<TaskUpdate, "startDate" | "dueDate">`
  - `fromProgressUpdate(progress: number): Pick<TaskUpdate, "progress">`
  - `getGanttBarStatusClass(task: Task): "gantt-bar--overdue" | "gantt-bar--in-progress"`

- [ ] **Step 1: Write `isTaskGanttEligible` and `toGanttTasks`**

```ts
import type { Task, TaskUpdate } from "../tasks/taskTypes";
import { getTodayDateValue } from "../tasks/dateUtils";

export type SvarGanttTask = {
  id: string;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  progress: number;
  type: "task";
  parent: number;
  css: string;
};

export type SvarGanttLink = {
  id: string;
  source: string;
  target: string;
  type: "e2s";
};

export function isTaskGanttEligible(task: Task): boolean {
  return !task.completed && !task.isArchived && Boolean(task.dueDate);
}

function toDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay) + 1);
}

export function toGanttTasks(tasks: Task[]): SvarGanttTask[] {
  return tasks.filter(isTaskGanttEligible).map((task) => {
    const end = toDate(task.dueDate as string);
    const start = toDate(task.startDate ?? (task.dueDate as string));

    return {
      id: task.id,
      text: task.title,
      start,
      end,
      duration: daysBetween(start, end),
      progress: task.progress,
      type: "task",
      parent: 0,
      css: getGanttBarStatusClass(task),
    };
  });
}
```

- [ ] **Step 2: Write `toGanttLinks`**

```ts
export function toGanttLinks(tasks: Task[]): SvarGanttLink[] {
  const eligibleIds = new Set(tasks.filter(isTaskGanttEligible).map((task) => task.id));
  const links: SvarGanttLink[] = [];

  for (const task of tasks) {
    if (!eligibleIds.has(task.id)) {
      continue;
    }

    for (const dependencyId of task.dependencies) {
      if (eligibleIds.has(dependencyId)) {
        links.push({
          id: `${dependencyId}->${task.id}`,
          source: dependencyId,
          target: task.id,
          type: "e2s",
        });
      }
    }
  }

  return links;
}
```

- [ ] **Step 3: Write the reverse-mapping helpers and the status-class helper**

```ts
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDragUpdate(startDate: Date, endDate: Date): Pick<TaskUpdate, "startDate" | "dueDate"> {
  return {
    startDate: toIsoDate(startDate),
    dueDate: toIsoDate(endDate),
  };
}

export function fromProgressUpdate(progress: number): Pick<TaskUpdate, "progress"> {
  return { progress: Math.max(0, Math.min(100, Math.round(progress))) };
}

export function getGanttBarStatusClass(task: Task): "gantt-bar--overdue" | "gantt-bar--in-progress" {
  const today = getTodayDateValue();
  return task.dueDate && task.dueDate < today ? "gantt-bar--overdue" : "gantt-bar--in-progress";
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Sanity-check the pure functions manually**

There is no unit-test framework in this repo (per `CLAUDE.md`). Verify by temporarily adding a throwaway `console.log` in `src/App.tsx` (or via `node --experimental-strip-types` on a scratch script) calling `toGanttTasks` and `toGanttLinks` with 2-3 sample `Task` objects (one with `startDate: null`, one with `dependencies: ["x"]`), confirming the shapes match. Remove the throwaway code before committing — do not leave debug logging in.

- [ ] **Step 6: Commit**

```bash
git add src/gantt/ganttAdapter.ts
git commit -m "feat(gantt): add pure adapter functions between Task and SVAR Gantt shapes"
```

---

### Task 7: `GanttViewPanel` component

**Files:**
- Create: `src/layout/panels/GanttViewPanel.tsx`

**Interfaces:**
- Consumes: `toGanttTasks`, `toGanttLinks`, `fromDragUpdate`, `fromProgressUpdate`, `getGanttBarStatusClass` from `src/gantt/ganttAdapter.ts` (Task 6); `Task`, `TaskUpdate` from `src/tasks/taskTypes.ts`.
- Produces: `GanttViewPanel` component with props matching `TableViewPanel`'s shape (see Task 8):
  ```ts
  type GanttViewPanelProps = {
    tasks: Task[];
    currentUserId: string | null;
    onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
    onOpenTask: (taskId: string) => void;
  };
  ```

- [ ] **Step 1: Scaffold the component with the toolbar and SVAR `<Gantt>` render**

```tsx
import { useMemo, useRef, useState } from "react";
import { Gantt } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import type { Task, TaskUpdate } from "../../tasks/taskTypes";
import { getTodayDateValue } from "../../tasks/dateUtils";
import {
  toGanttLinks,
  toGanttTasks,
  fromDragUpdate,
  fromProgressUpdate,
  getGanttBarStatusClass,
} from "../../gantt/ganttAdapter";

type GanttZoomMode = "day" | "week" | "month";

const ZOOM_SCALES: Record<GanttZoomMode, { unit: string; step: number; format: string }[]> = {
  day: [
    { unit: "month", step: 1, format: "%F %Y" },
    { unit: "day", step: 1, format: "%j" },
  ],
  week: [
    { unit: "month", step: 1, format: "%F %Y" },
    { unit: "week", step: 1, format: "'týden' %W" },
  ],
  month: [{ unit: "month", step: 1, format: "%F %Y" }],
};

type GanttViewPanelProps = {
  tasks: Task[];
  currentUserId: string | null;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onOpenTask: (taskId: string) => void;
};

export function GanttViewPanel({ tasks, currentUserId, onUpdateTask, onOpenTask }: GanttViewPanelProps) {
  const [zoomMode, setZoomMode] = useState<GanttZoomMode>("day");
  const [todayToken, setTodayToken] = useState(0);
  const apiRef = useRef<{ exec: (action: string, payload: unknown) => void; on: (event: string, handler: (payload: unknown) => void) => void } | null>(null);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.assigneeId === currentUserId || task.ownerId === currentUserId),
    [tasks, currentUserId],
  );

  const ganttTasks = useMemo(() => toGanttTasks(visibleTasks), [visibleTasks]);
  const ganttLinks = useMemo(() => toGanttLinks(visibleTasks), [visibleTasks]);

  return (
    <div className="app-panel gantt-view-panel">
      <div className="gantt-view-panel__toolbar">
        <div className="gantt-view-panel__zoom" role="group" aria-label="Měřítko">
          <button type="button" data-active={zoomMode === "day"} onClick={() => setZoomMode("day")}>
            Dny
          </button>
          <button type="button" data-active={zoomMode === "week"} onClick={() => setZoomMode("week")}>
            Týdny
          </button>
          <button type="button" data-active={zoomMode === "month"} onClick={() => setZoomMode("month")}>
            Měsíce
          </button>
        </div>
        <button
          type="button"
          className="gantt-view-panel__today-button"
          onClick={() => setTodayToken((token) => token + 1)}
        >
          Dnes
        </button>
      </div>
      <div className="gantt-view-panel__chart">
        <Gantt
          key={`${zoomMode}-${todayToken}`}
          tasks={ganttTasks}
          links={ganttLinks}
          scales={ZOOM_SCALES[zoomMode]}
          start={todayToken > 0 || zoomMode ? undefined : undefined}
          init={(api: { exec: (action: string, payload: unknown) => void; on: (event: string, handler: (payload: unknown) => void) => void }) => {
            apiRef.current = api;

            api.on("update-task", (payload: unknown) => {
              const change = payload as { id: string; task: { start: Date; end: Date; progress: number } };
              const ganttTask = ganttTasks.find((entry) => entry.id === change.id);

              if (!ganttTask) {
                return;
              }

              onUpdateTask(change.id, {
                ...fromDragUpdate(change.task.start, change.task.end),
                ...fromProgressUpdate(change.task.progress),
              });
            });

            api.on("add-link", (payload: unknown) => {
              const { link } = payload as { link: { source: string; target: string } };
              const targetTask = visibleTasks.find((task) => task.id === link.target);

              if (!targetTask || targetTask.dependencies.includes(link.source)) {
                return;
              }

              onUpdateTask(link.target, {
                dependencies: [...targetTask.dependencies, link.source],
              });
            });

            api.on("delete-link", (payload: unknown) => {
              const { id } = payload as { id: string };
              const [sourceId, targetId] = id.split("->");
              const targetTask = visibleTasks.find((task) => task.id === targetId);

              if (!targetTask) {
                return;
              }

              onUpdateTask(targetId, {
                dependencies: targetTask.dependencies.filter((dependencyId) => dependencyId !== sourceId),
              });
            });

            api.on("click-task", (payload: unknown) => {
              const { id } = payload as { id: string };
              onOpenTask(id);
            });
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. If `@svar-ui/react-gantt`'s shipped types name props/events differently than guessed above (`init`, `scales`, event names `update-task`/`add-link`/`delete-link`/`click-task`), TypeScript will surface the mismatch here — fix names to match the installed package's `.d.ts` (inspect via `node_modules/@svar-ui/react-gantt/dist/*.d.ts` or your editor's hover-info) before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/layout/panels/GanttViewPanel.tsx
git commit -m "feat(gantt): add GanttViewPanel wrapping SVAR react-gantt"
```

---

### Task 8: Wire `GanttViewPanel` into `AppShell.tsx`

**Files:**
- Modify: `src/layout/AppShell.tsx`

**Interfaces:**
- Consumes: `GanttViewPanel` (Task 7), existing `handleSelectCommandPaletteTask` (already defined at `AppShell.tsx:628-637`), existing `allTasks`, `currentUserId`, `onUpdateTask`.

- [ ] **Step 1: Import `GanttViewPanel`**

Add near the existing `import { TableViewPanel } from "./panels/TableViewPanel";` (line 100):

```ts
import { GanttViewPanel } from "./panels/GanttViewPanel";
```

- [ ] **Step 2: Replace the placeholder branch**

At `AppShell.tsx:1365-1369`, replace:

```tsx
          ) : isGanttOpen ? (
            <div className="app-panel view-placeholder">
              <h2>Gantt diagram</h2>
              <p>Gantt zobrazení se připravuje.</p>
            </div>
```

with:

```tsx
          ) : isGanttOpen ? (
            <GanttViewPanel
              tasks={allTasks}
              currentUserId={currentUserId}
              onUpdateTask={onUpdateTask}
              onOpenTask={handleSelectCommandPaletteTask}
            />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS (build runs `tsc && vite build`).

- [ ] **Step 5: Manual browser verification**

Start the dev server (`npm run dev` via the project's preview tooling), sign in, open a team with at least 2-3 incomplete tasks that have due dates, click "+ Zobrazení" → "Gantt diagram". Confirm:
- Bars render for eligible tasks (incomplete, non-archived, has `dueDate`).
- Dragging a bar moves it; dragging its right edge resizes it; both persist after a page reload (confirms the `onUpdateTask` round-trip through Supabase).
- Dragging from one bar's edge to another creates a dependency link; it persists after reload.
- Zoom buttons (Dny/Týdny/Měsíce) change the scale.
- "Dnes" button re-centers/re-renders the chart.
- Clicking a bar opens the correct existing detail surface (`ProjectCardComposerModal` for a project task, `DetailPanel` for a non-project task).

If any SVAR prop/event name from Task 7 doesn't match what the library actually does at runtime (check the browser console for errors, and `console.log` the `init` callback's `api` object to inspect its real shape), fix `GanttViewPanel.tsx` accordingly and re-verify.

- [ ] **Step 6: Commit**

```bash
git add src/layout/AppShell.tsx
git commit -m "feat(gantt): wire GanttViewPanel into the gantt view tab"
```

---

### Task 9: Gantt styling — theme the SVAR component

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing `:root`/`[data-theme="light"]` custom properties (e.g. `--color-background-card`, `--color-text-primary`, `--color-border`, `--color-accent`) already defined at the top of `styles.css`.

- [ ] **Step 1: Add SVAR theme variable overrides and toolbar/status styles**

Append to `src/styles.css`:

```css
.gantt-view-panel {
  display: flex;
  flex-direction: column;
  height: 100%;

  --wx-background: var(--color-background-card);
  --wx-color-primary: var(--color-text-primary);
  --wx-color-secondary: var(--color-text-secondary);
  --wx-border-color: var(--color-border);
  --wx-gantt-selected-bar-color: var(--color-accent);
}

.gantt-view-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.gantt-view-panel__zoom {
  display: flex;
  gap: 4px;
}

.gantt-view-panel__zoom button,
.gantt-view-panel__today-button {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-background-card);
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.gantt-view-panel__zoom button[data-active="true"] {
  background: var(--color-accent-soft);
  color: var(--color-text-primary);
  border-color: var(--color-accent);
}

.gantt-view-panel__chart {
  flex: 1;
  min-height: 0;
}

.gantt-bar--overdue {
  background: #ef4444 !important;
}

.gantt-bar--in-progress {
  background: #38bdf8 !important;
}
```

**Note:** `--wx-*` variable names above are best-effort guesses at SVAR's actual CSS custom-property names (their docs confirm "Styling with CSS variables" exists but the fetched pages did not list exact names). During Step 2, inspect the rendered `.wx-gantt` DOM in devtools to find the real variable names and correct them if they differ — do not leave guessed names that visibly don't apply.

- [ ] **Step 2: Manual verification in both themes**

With the dev server running and Gantt view open, toggle light/dark theme (existing app toggle) and visually confirm the Gantt's background/text/border colors follow the app theme rather than SVAR's own default light theme. Adjust the `--wx-*` variable names from Step 1 if they don't take effect (check devtools computed styles on the SVAR root element for its actual variable names).

Also confirm status coloring: create/edit one task so its due date is in the past (should render red, `.gantt-bar--overdue`) and one with a future due date (should render blue, `.gantt-bar--in-progress`). This depends on SVAR applying each task's `css` field (set in Task 6/7) as a class on its bar element — inspect the bar's DOM in devtools to confirm the class landed. If SVAR instead expects the per-task style hook under a different field name (e.g. `barCss` or a template function), adjust `SvarGanttTask`/`toGanttTasks` in `src/gantt/ganttAdapter.ts` (Task 6) to match and re-verify here.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style(gantt): theme SVAR Gantt to match app dark/light design tokens"
```

---

### Task 10: `DetailPanel` — start date, progress, dependencies fields

**Files:**
- Modify: `src/layout/panels/DetailPanel.tsx`

**Interfaces:**
- Consumes: `task.startDate`, `task.progress`, `task.dependencies` (Task 1); existing `onUpdateTask` prop, existing `CustomDropdown` component, existing `allTasks`-equivalent prop if present (see Step 3 — if `DetailPanel` doesn't already receive the full task list, this step adds a minimal prop for it).

- [ ] **Step 1: Add a "Start Date" field next to the existing "Termín" field**

In `src/layout/panels/DetailPanel.tsx`, after the `dueDate` field's closing `</label>` (currently ending at line 936, inside the `date-time-fields` div), add a new field:

```tsx
              <label className="field date-time-field" data-has-value={Boolean(task.startDate)}>
                <span className="detail-row-icon detail-row-icon--date" aria-hidden="true">
                  <CalendarDays size={16} strokeWidth={1.9} />
                </span>
                <span>Začátek</span>
                <input
                  aria-label="Datum začátku"
                  className="date-time-field__input"
                  type="date"
                  value={task.startDate ?? ""}
                  onClick={handleNativePickerClick}
                  onChange={(event) =>
                    onUpdateTask(task.id, {
                      startDate: event.currentTarget.value || null,
                    })
                  }
                />
              </label>
```

- [ ] **Step 2: Add a "Progress" field after the Priority field**

After the priority `</label>` block (currently ending at line 1015), add:

```tsx
            <label className="field" data-has-value={task.progress > 0}>
              <span className="detail-row-icon detail-row-icon--priority" aria-hidden="true">
                <TrendingUp size={16} strokeWidth={1.9} />
              </span>
              <span>Postup ({task.progress}%)</span>
              <input
                aria-label="Postup v procentech"
                type="range"
                min={0}
                max={100}
                step={5}
                value={task.progress}
                onChange={(event) =>
                  onUpdateTask(task.id, { progress: Number(event.currentTarget.value) })
                }
              />
            </label>
```

Add `TrendingUp` to the existing `lucide-react` import at the top of the file (alongside `CalendarDays`, `Star`, etc.).

- [ ] **Step 3: Check whether `DetailPanel` already receives the full task list; add a minimal prop if not**

Search `DetailPanelProps` (line 36) for an existing `Task[]` prop (e.g. `allTasks`, `tasks`). If one exists, reuse it for Step 4. If not, add:

```ts
  allTasksForDependencies: Task[];
```

to `DetailPanelProps`, and thread it from `AppShell.tsx`'s `<DetailPanel ... />` call site as `allTasksForDependencies={allTasks}` (find the call site via `grep -n "<DetailPanel" src/layout/AppShell.tsx`).

- [ ] **Step 4: Add a "Dependencies" multi-select field**

After the Progress field from Step 2, add:

```tsx
            <div className="field field--column" data-has-value={task.dependencies.length > 0}>
              <span className="detail-row-icon detail-row-icon--priority" aria-hidden="true">
                <Link2 size={16} strokeWidth={1.9} />
              </span>
              <span>Závisí na</span>
              <div className="detail-panel__dependency-list">
                {task.dependencies.map((dependencyId) => {
                  const dependencyTask = allTasksForDependencies.find((entry) => entry.id === dependencyId);

                  return (
                    <span key={dependencyId} className="detail-panel__dependency-chip">
                      {dependencyTask?.title ?? "Neznámý úkol"}
                      <button
                        type="button"
                        aria-label="Odebrat závislost"
                        onClick={() =>
                          onUpdateTask(task.id, {
                            dependencies: task.dependencies.filter((id) => id !== dependencyId),
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
              <CustomDropdown
                ariaLabel="Přidat závislost"
                options={allTasksForDependencies
                  .filter((entry) => entry.id !== task.id && !task.dependencies.includes(entry.id))
                  .map((entry) => ({ value: entry.id, label: entry.title }))}
                value=""
                onChange={(nextValue) =>
                  nextValue &&
                  onUpdateTask(task.id, {
                    dependencies: [...task.dependencies, nextValue],
                  })
                }
              />
            </div>
```

Add `Link2` to the `lucide-react` import.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Manual browser verification**

Open a non-project task's detail panel. Set a start date, drag the progress slider, add and remove a dependency. Confirm each change persists (reload the page, re-open the same task, values are retained).

- [ ] **Step 7: Commit**

```bash
git add src/layout/panels/DetailPanel.tsx
git commit -m "feat(gantt): add start date, progress, and dependencies fields to DetailPanel"
```

---

### Task 11: `ProjectCardComposerModal` — start date, progress, dependencies fields

**Files:**
- Modify: `src/layout/ProjectCardComposerModal.tsx`
- Modify: `src/layout/AppShell.tsx`
- Modify: `src/layout/panels/TableViewPanel.tsx`

**Interfaces:**
- Consumes: `Task`, `TaskUpdate` (Task 1).
- Produces: three new controlled props on `ProjectCardComposerModal`:
  ```ts
  startDate: string;
  progress: number;
  dependencies: string[];
  allTasksForDependencies: Task[];
  currentTaskId: string | null;
  onStartDateChange: (value: string) => void;
  onProgressChange: (value: number) => void;
  onDependencyAdd: (taskId: string) => void;
  onDependencyRemove: (taskId: string) => void;
  ```

- [ ] **Step 1: Add the new props to `ProjectCardComposerModal`**

In `src/layout/ProjectCardComposerModal.tsx`, add to both the destructured parameter list (after `dueDate,` at line 21) and the inline type (after `dueDate: string;` at line 54):

```ts
  startDate,
  progress,
  dependencies,
  allTasksForDependencies,
  currentTaskId,
```

```ts
  startDate: string;
  progress: number;
  dependencies: string[];
  allTasksForDependencies: Task[];
  currentTaskId: string | null;
```

and to the handler lists (after `onDueDateChange,` at line 38 / `onDueDateChange: (value: string) => void;` at line 71):

```ts
  onStartDateChange,
  onProgressChange,
  onDependencyAdd,
  onDependencyRemove,
```

```ts
  onStartDateChange: (value: string) => void;
  onProgressChange: (value: number) => void;
  onDependencyAdd: (taskId: string) => void;
  onDependencyRemove: (taskId: string) => void;
```

Add `import type { Task } from "../tasks/taskTypes";` at the top (the file currently only imports `TaskPriority`/`TaskSubtask` from that module — extend that import line instead of adding a new one).

- [ ] **Step 2: Render the new fields in the JSX**

Find the existing due-date `<input type="date" value={dueDate} onChange={...} />` at line 235. Immediately after its enclosing field wrapper, add:

```tsx
              <input
                type="date"
                aria-label="Datum začátku"
                value={startDate}
                onChange={(event) => onStartDateChange(event.currentTarget.value)}
              />
              <input
                type="range"
                aria-label="Postup v procentech"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(event) => onProgressChange(Number(event.currentTarget.value))}
              />
              <div className="board-card-modal__dependencies">
                {dependencies.map((dependencyId) => {
                  const dependencyTask = allTasksForDependencies.find((entry) => entry.id === dependencyId);

                  return (
                    <span key={dependencyId} className="board-card-modal__dependency-chip">
                      {dependencyTask?.title ?? "Neznámý úkol"}
                      <button type="button" aria-label="Odebrat závislost" onClick={() => onDependencyRemove(dependencyId)}>
                        ×
                      </button>
                    </span>
                  );
                })}
                <CustomDropdown
                  ariaLabel="Přidat závislost"
                  options={allTasksForDependencies
                    .filter((entry) => entry.id !== currentTaskId && !dependencies.includes(entry.id))
                    .map((entry) => ({ value: entry.id, label: entry.title }))}
                  value=""
                  onChange={(nextValue) => nextValue && onDependencyAdd(nextValue)}
                />
              </div>
```

- [ ] **Step 3: Wire the new props at the `AppShell.tsx` call site**

Add new state near the existing `cardComposerDueDate` state (line 2663):

```ts
  const [cardComposerStartDate, setCardComposerStartDate] = useState("");
  const [cardComposerProgress, setCardComposerProgress] = useState(0);
  const [cardComposerDependencies, setCardComposerDependencies] = useState<string[]>([]);
```

In `handleSubmitProjectCard` (line 3083), add to the `update` object (alongside `dueDate: cardComposerDueDate || null,` at line 3093):

```ts
      startDate: cardComposerStartDate || null,
      progress: cardComposerProgress,
      dependencies: cardComposerDependencies,
```

At the `<ProjectCardComposerModal ... />` JSX (line 3513), add the new props alongside the existing `dueDate={cardComposerDueDate}` (line 3517):

```tsx
            startDate={cardComposerStartDate}
            progress={cardComposerProgress}
            dependencies={cardComposerDependencies}
            allTasksForDependencies={allTasks}
            currentTaskId={cardComposerTaskId}
            onStartDateChange={setCardComposerStartDate}
            onProgressChange={setCardComposerProgress}
            onDependencyAdd={(taskId) => setCardComposerDependencies((current) => [...current, taskId])}
            onDependencyRemove={(taskId) =>
              setCardComposerDependencies((current) => current.filter((id) => id !== taskId))
            }
```

Find the function that resets composer state when opening/closing the modal (search for where `setCardComposerDueDate` is called with an existing task's value, and where `resetCardComposer` clears it) and add matching `setCardComposerStartDate`/`setCardComposerProgress`/`setCardComposerDependencies` calls (populate from the task being edited, or `""`/`0`/`[]` for a new card / on reset).

- [ ] **Step 4: Repeat the same wiring in `TableViewPanel.tsx`**

`TableViewPanel.tsx` has its own independent copy of this same composer state (confirmed at `TableViewPanel.tsx:70-82`, e.g. `cardComposerDueDate` at line 75). Apply the identical state/handler/prop changes from Step 3 to this file's own `cardComposer*` state and its own `<ProjectCardComposerModal ... />` render.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Manual browser verification**

Open a project board (Kanban), click a card to edit it. Set a start date, drag progress, add/remove a dependency, save. Reopen the card and confirm the values persisted. Repeat from the Table view's "+ Add Task" / row-open flow.

- [ ] **Step 7: Commit**

```bash
git add src/layout/ProjectCardComposerModal.tsx src/layout/AppShell.tsx src/layout/panels/TableViewPanel.tsx
git commit -m "feat(gantt): add start date, progress, and dependencies fields to ProjectCardComposerModal"
```

---

### Task 12: End-to-end verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS, no errors, no new warnings beyond the pre-existing >500kB chunk warning noted in `CLAUDE.md`.

- [ ] **Step 2: Full manual walkthrough in the browser**

With the dev server running:
1. Create/open a team with a mix of: a project-owned task and a plain (non-project) task, both incomplete with due dates.
2. Open Gantt view. Confirm both tasks render as bars.
3. Drag-move one bar, resize the other, drag-create a dependency link between them, drag a progress handle.
4. Reload the page — confirm all four changes persisted (cloud sync round-trip).
5. Click each bar — confirm the project task opens `ProjectCardComposerModal` and the plain task opens `DetailPanel`, both showing the correct start date/progress/dependencies values.
6. Switch zoom Dny → Týdny → Měsíce and back; click "Dnes".
7. Toggle light/dark theme; confirm the Gantt follows.
8. Mark one of the two tasks completed elsewhere (List view) and confirm it disappears from the Gantt on next load (filtering rule).

- [ ] **Step 3: Report results to the user**

Summarize pass/fail for each item in Step 2. Do not claim the feature complete if any item fails — fix and re-verify first.
