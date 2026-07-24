# Table View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Tabulka" sidebar entry that lets the user pick a board ("nástěnka") and see its tasks as a table (fixed columns: Name, Assignee, Status, Due date, Priority), reusing the board's Filtr/Řadit toolbar and opening the existing card modal on row click.

**Architecture:** Three small shared utility modules are extracted from `AppShell.tsx`/`ListPanel.tsx` so the new panel and the existing Kanban board can both use them without a circular import (panels never import from `AppShell.tsx`): a member-display utility, a task-priority-colors module, and pure sort/filter functions added to the existing `projectBoardPreferences.ts`. The just-shipped board-detail Filtr/Řadit toolbar JSX is extracted out of `ProjectDetailView` (inside `AppShell.tsx`) into a standalone `ProjectBoardToolbar` component so both the Kanban board and the new `TableViewPanel` render the identical toolbar bound to the same per-board `localStorage` preferences. `TableViewPanel` (new, same shape as `CalendarPanel`) owns its own board-loading state, renders the toolbar + a custom lightweight `<table>`, and on row click reuses the app's existing "open a project-owned task from outside the board view" mechanism (`handleOpenProjectsOverview(projectId, taskId)`) rather than duplicating the card-composer modal's state. `AppShell.tsx` wires the new panel in following the exact `isXOpen` boolean-flag pattern already used for `isCalendarOpen`. `SidebarPanel.tsx` gets one new nav button.

**Tech Stack:** React 19 + TypeScript, no test framework in this repo (confirmed via `CLAUDE.md` — no test script, no `*.test.*`/`*.spec.*` files). Verification of pure logic uses Node 22's built-in TypeScript stripping (`node --experimental-strip-types`) via a throwaway script deleted before committing. Verification of UI is manual, in the running dev server.

## Global Constraints

- Keep every file under 500 lines (project `CLAUDE.md` rule).
- Never create files unless necessary; never save working/test files to repo root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts` (project `CLAUDE.md` rule).
- No `Co-Authored-By` trailer on commits (project `CLAUDE.md` rule).
- No automated test framework exists in this repo — do not add Jest/Vitest. Verify manually as described per task.
- Follow existing Czech-language UI copy conventions (all user-facing strings in this app are Czech), except where a task explicitly says to move existing English/mojibake text verbatim (do not "fix" it).
- Do not touch `src/layout/AppShell.tsx` mojibake / mangled Czech strings unrelated to this feature (documented gotcha in project `CLAUDE.md`).
- Panels in `src/layout/panels/` never import from `src/layout/AppShell.tsx` (would create a circular import, since `AppShell.tsx` imports and renders every panel). Shared code that both `AppShell.tsx` and a panel need must live in a third module neither one owns exclusively.
- Row click in the table view must reuse the existing `handleOpenProjectsOverview(projectId, taskId)` flow in `AppShell.tsx:640` (already used for this exact "open a project task from outside the board view" scenario at `AppShell.tsx:575` and `AppShell.tsx:940`) — do not build a second card-composer modal.

---

### Task 1: Shared member-display utility

**Files:**
- Create: `src/teams/teamMemberDisplay.ts`
- Modify: `src/layout/AppShell.tsx:4246-4263` (remove local definitions, add import)

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces (used by Task 4 and Task 5): `getMemberDisplayName(member: { email: string; nickname?: string | null }): string`, `getMemberInitials(member: { email: string; nickname?: string | null }): string`.

- [ ] **Step 1: Write `src/teams/teamMemberDisplay.ts`**

```typescript
export function getMemberDisplayName(member: { email: string; nickname?: string | null }) {
  const nickname = member.nickname?.trim();

  if (nickname) {
    return nickname;
  }

  return member.email.split("@")[0] || member.email;
}

export function getMemberInitials(member: { email: string; nickname?: string | null }) {
  const name = getMemberDisplayName(member);
  const parts = name.split(/[._\-\s]+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}
```

- [ ] **Step 2: Write the throwaway verification script**

Create `tests/verify-team-member-display.mjs`:

```javascript
import assert from "node:assert/strict";
import { getMemberDisplayName, getMemberInitials } from "../src/teams/teamMemberDisplay.ts";

assert.equal(getMemberDisplayName({ email: "jana.novakova@example.com" }), "jana.novakova");
assert.equal(getMemberDisplayName({ email: "x@example.com", nickname: "  Jana  " }), "Jana");
assert.equal(getMemberInitials({ email: "jana.novakova@example.com" }), "JN");
assert.equal(getMemberInitials({ email: "x@example.com", nickname: "Bob" }), "BO");

console.log("All teamMemberDisplay checks passed.");
```

- [ ] **Step 3: Run the verification script**

Run: `node --experimental-strip-types tests/verify-team-member-display.mjs`
Expected output: `All teamMemberDisplay checks passed.` with no assertion errors.

- [ ] **Step 4: Delete the throwaway script (not committed)**

```bash
rm tests/verify-team-member-display.mjs
```

- [ ] **Step 5: Remove the duplicate definitions from `AppShell.tsx` and import instead**

In `src/layout/AppShell.tsx`, find:

```typescript
function getMemberDisplayName(member: { email: string; nickname?: string | null }) {
  const nickname = member.nickname?.trim();
  if (nickname) {
    return nickname;
  }
  return member.email.split("@")[0] || member.email;
}

function getMemberInitials(member: { email: string; nickname?: string | null }) {
  const name = getMemberDisplayName(member);
  const parts = name.split(/[._\-\s]+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}
```

Delete this whole block (all call sites elsewhere in the file keep working unchanged since the function names stay identical, now coming from an import).

- [ ] **Step 6: Add the import**

Find (near the top of `src/layout/AppShell.tsx`):

```typescript
import { buildCountsByTeamId } from "../teams/teamCounts";
```

Replace with:

```typescript
import { buildCountsByTeamId } from "../teams/teamCounts";
import { getMemberDisplayName, getMemberInitials } from "../teams/teamMemberDisplay";
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/teams/teamMemberDisplay.ts src/layout/AppShell.tsx
git commit -m "Extract getMemberDisplayName/getMemberInitials into a shared module"
```

---

### Task 2: Shared task-priority-colors module

**Files:**
- Create: `src/tasks/taskPriorityColors.ts`
- Modify: `src/layout/AppShell.tsx:97-113` (import instead of define)
- Modify: `src/layout/panels/ListPanel.tsx:45-50` and `:337,347` (import instead of define)

**Interfaces:**
- Consumes: `TaskPriority` from `./taskTypes`, `DropdownOption` from `../layout/CustomDropdown`.
- Produces (used by Task 4 and Task 5): `TASK_PRIORITY_COLORS: Record<TaskPriority, string>`, `BOARD_CARD_PRIORITY_OPTIONS: TaskPriority[]`, `BOARD_CARD_PRIORITY_LABELS: Record<TaskPriority, string>`, `BOARD_CARD_PRIORITY_DROPDOWN_OPTIONS: DropdownOption[]`.

- [ ] **Step 1: Write `src/tasks/taskPriorityColors.ts`**

```typescript
import type { TaskPriority } from "./taskTypes";
import type { DropdownOption } from "../layout/CustomDropdown";

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: "#7c8aa8",
  low: "#38bdf8",
  medium: "#f59e0b",
  high: "#f43f5e",
};

export const BOARD_CARD_PRIORITY_OPTIONS: TaskPriority[] = ["none", "low", "medium", "high"];

export const BOARD_CARD_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "Zadna",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const BOARD_CARD_PRIORITY_DROPDOWN_OPTIONS: DropdownOption[] = BOARD_CARD_PRIORITY_OPTIONS.map((option) => ({
  value: option,
  label: BOARD_CARD_PRIORITY_LABELS[option],
}));
```

Note: `"Zadna"` is copied verbatim from the existing code (pre-existing mojibake-adjacent text, not something this task fixes — see Global Constraints).

- [ ] **Step 2: Update `AppShell.tsx` to import instead of define**

Find:

```typescript
const BOARD_CARD_PRIORITY_OPTIONS: TaskPriority[] = ["none", "low", "medium", "high"];
const BOARD_CARD_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "Zadna",
  low: "Low",
  medium: "Medium",
  high: "High",
};
const BOARD_CARD_PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: "#7c8aa8",
  low: "#38bdf8",
  medium: "#f59e0b",
  high: "#f43f5e",
};
const BOARD_CARD_PRIORITY_DROPDOWN_OPTIONS: DropdownOption[] = BOARD_CARD_PRIORITY_OPTIONS.map((option) => ({
  value: option,
  label: BOARD_CARD_PRIORITY_LABELS[option],
}));
const BOARD_CARD_LABEL_COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
```

Replace with:

```typescript
const BOARD_CARD_LABEL_COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
```

Then find the import block:

```typescript
import type { Task, TaskLabel, TaskList, TaskPriority, TaskSubtask, TaskUpdate } from "../tasks/taskTypes";
```

Replace with:

```typescript
import type { Task, TaskLabel, TaskList, TaskPriority, TaskSubtask, TaskUpdate } from "../tasks/taskTypes";
import {
  BOARD_CARD_PRIORITY_DROPDOWN_OPTIONS,
  BOARD_CARD_PRIORITY_LABELS,
  BOARD_CARD_PRIORITY_OPTIONS,
  TASK_PRIORITY_COLORS as BOARD_CARD_PRIORITY_COLORS,
} from "../tasks/taskPriorityColors";
```

(The `as BOARD_CARD_PRIORITY_COLORS` alias means every existing usage of `BOARD_CARD_PRIORITY_COLORS` elsewhere in `AppShell.tsx` — e.g. at the card composer priority picker and the board filter panel — keeps working unchanged.)

- [ ] **Step 3: Update `ListPanel.tsx` to import instead of define**

In `src/layout/panels/ListPanel.tsx`, find:

```typescript
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: "#7c8aa8",
  low: "#38bdf8",
  medium: "#f59e0b",
  high: "#f43f5e",
};
```

Delete this block (keep `PRIORITY_OPTIONS` and `PRIORITY_LABELS` above it — those stay local, only the color map is shared).

Then find:

```typescript
import type { Task, TaskList, TaskPriority, TaskUpdate } from "../../tasks/taskTypes";
```

Replace with:

```typescript
import type { Task, TaskList, TaskPriority, TaskUpdate } from "../../tasks/taskTypes";
import { TASK_PRIORITY_COLORS } from "../../tasks/taskPriorityColors";
```

Then find (two occurrences):

```typescript
                    style={{ "--priority-color": PRIORITY_COLORS[newTaskPriority] } as CSSProperties}
```

Replace with:

```typescript
                    style={{ "--priority-color": TASK_PRIORITY_COLORS[newTaskPriority] } as CSSProperties}
```

And find:

```typescript
                    style={{ "--priority-color": PRIORITY_COLORS[option.value as TaskPriority] } as CSSProperties}
```

Replace with:

```typescript
                    style={{ "--priority-color": TASK_PRIORITY_COLORS[option.value as TaskPriority] } as CSSProperties}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/tasks/taskPriorityColors.ts src/layout/AppShell.tsx src/layout/panels/ListPanel.tsx
git commit -m "Extract shared TASK_PRIORITY_COLORS, dedupe from AppShell and ListPanel"
```

---

### Task 3: Pure sort/filter functions in `projectBoardPreferences.ts`

**Files:**
- Modify: `src/projects/projectBoardPreferences.ts` (append pure functions)
- Modify: `src/layout/AppShell.tsx` (remove moved functions, use imports, update `ProjectDetailView` to call them)

**Interfaces:**
- Consumes: `Task`, `TaskPriority` from `../tasks/taskTypes`.
- Produces (used by Task 4's `ProjectBoardToolbar` and Task 5's `TableViewPanel`): `getTaskDueStatus(task: Task, today: string): ProjectBoardDueFilter | null`, `filterProjectTasks(tasks: Task[], filters: ProjectBoardFilters, today: string): Task[]`, `sortProjectTasks(tasks: Task[], sortKey: ProjectBoardSortKey): Task[]`, `toggleFilterValue<T>(list: T[], value: T): T[]`.

- [ ] **Step 1: Append the pure functions to `src/projects/projectBoardPreferences.ts`**

Find the top of the file:

```typescript
import type { TaskPriority } from "../tasks/taskTypes";
```

Replace with:

```typescript
import type { Task, TaskPriority } from "../tasks/taskTypes";
```

Then append at the end of the file (after `isRecord`):

```typescript

export function getTaskDueStatus(task: Task, today: string): ProjectBoardDueFilter | null {
  if (!task.dueDate) {
    return "none";
  }

  if (task.dueDate < today) {
    return "overdue";
  }

  if (task.dueDate === today) {
    return "today";
  }

  return null;
}

export function filterProjectTasks(
  tasks: Task[],
  filters: ProjectBoardFilters,
  today: string,
): Task[] {
  return tasks.filter((task) => {
    const { assigneeIds, priorities, dueStatuses, labelIds } = filters;

    if (assigneeIds.length > 0 && (!task.assigneeId || !assigneeIds.includes(task.assigneeId))) {
      return false;
    }

    if (priorities.length > 0 && !priorities.includes(task.priority)) {
      return false;
    }

    if (dueStatuses.length > 0) {
      const status = getTaskDueStatus(task, today);

      if (!status || !dueStatuses.includes(status)) {
        return false;
      }
    }

    if (labelIds.length > 0 && !task.labels.some((label) => labelIds.includes(label.id))) {
      return false;
    }

    return true;
  });
}

export function sortProjectTasks(tasks: Task[], sortKey: ProjectBoardSortKey): Task[] {
  if (sortKey === "manual") {
    return tasks;
  }

  const sorted = [...tasks];

  if (sortKey === "priority") {
    const priorityRank: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1, none: 0 };

    sorted.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);
  } else if (sortKey === "dueDate") {
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) {
        return 0;
      }

      if (!a.dueDate) {
        return 1;
      }

      if (!b.dueDate) {
        return -1;
      }

      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sortKey === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "cs"));
  }

  return sorted;
}

export function toggleFilterValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
```

- [ ] **Step 2: Write the throwaway verification script**

Create `tests/verify-project-board-preferences.mjs`:

```javascript
import assert from "node:assert/strict";
import {
  filterProjectTasks,
  getTaskDueStatus,
  sortProjectTasks,
  toggleFilterValue,
} from "../src/projects/projectBoardPreferences.ts";

const baseTask = {
  id: "t1",
  listId: "l1",
  title: "B task",
  completed: false,
  dueDate: null,
  dueTime: null,
  isArchived: false,
  note: "",
  priority: "low",
  recurrence: "none",
  teamId: null,
  assigneeId: null,
  ownerId: null,
  projectId: "p1",
  boardColumnKey: "todo",
  labels: [],
  subtasks: [],
};

assert.equal(getTaskDueStatus({ ...baseTask, dueDate: null }, "2026-07-24"), "none");
assert.equal(getTaskDueStatus({ ...baseTask, dueDate: "2026-07-20" }, "2026-07-24"), "overdue");
assert.equal(getTaskDueStatus({ ...baseTask, dueDate: "2026-07-24" }, "2026-07-24"), "today");
assert.equal(getTaskDueStatus({ ...baseTask, dueDate: "2026-08-01" }, "2026-07-24"), null);

const tasks = [
  { ...baseTask, id: "a", title: "B task", priority: "low", dueDate: "2026-07-30" },
  { ...baseTask, id: "b", title: "A task", priority: "high", dueDate: null },
];

const filtered = filterProjectTasks(tasks, {
  assigneeIds: [],
  priorities: ["high"],
  dueStatuses: [],
  labelIds: [],
}, "2026-07-24");
assert.deepEqual(filtered.map((task) => task.id), ["b"]);

const sortedByPriority = sortProjectTasks(tasks, "priority");
assert.deepEqual(sortedByPriority.map((task) => task.id), ["b", "a"]);

const sortedByTitle = sortProjectTasks(tasks, "title");
assert.deepEqual(sortedByTitle.map((task) => task.id), ["b", "a"]);

assert.deepEqual(toggleFilterValue(["x", "y"], "x"), ["y"]);
assert.deepEqual(toggleFilterValue(["x"], "z"), ["x", "z"]);

console.log("All projectBoardPreferences checks passed.");
```

- [ ] **Step 3: Run the verification script**

Run: `node --experimental-strip-types tests/verify-project-board-preferences.mjs`
Expected output: `All projectBoardPreferences checks passed.` with no assertion errors.

- [ ] **Step 4: Delete the throwaway script (not committed)**

```bash
rm tests/verify-project-board-preferences.mjs
```

- [ ] **Step 5: Remove the module-level duplicates from `AppShell.tsx`**

Find:

```typescript
function sortProjectTasks(tasks: Task[], sortKey: ProjectBoardSortKey): Task[] {
  if (sortKey === "manual") {
    return tasks;
  }

  const sorted = [...tasks];

  if (sortKey === "priority") {
    const priorityRank: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1, none: 0 };

    sorted.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);
  } else if (sortKey === "dueDate") {
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) {
        return 0;
      }

      if (!a.dueDate) {
        return 1;
      }

      if (!b.dueDate) {
        return -1;
      }

      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sortKey === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "cs"));
  }

  return sorted;
}

function toggleFilterValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
```

Delete this whole block.

Then find the import block:

```typescript
import {
  getDefaultProjectBoardPreferences,
  loadProjectBoardPreferences,
  saveProjectBoardPreferences,
  type ProjectBoardDueFilter,
  type ProjectBoardPreferences,
  type ProjectBoardSortKey,
} from "../projects/projectBoardPreferences";
```

Replace with:

```typescript
import {
  filterProjectTasks,
  getDefaultProjectBoardPreferences,
  loadProjectBoardPreferences,
  saveProjectBoardPreferences,
  sortProjectTasks,
  type ProjectBoardDueFilter,
  type ProjectBoardPreferences,
  type ProjectBoardSortKey,
} from "../projects/projectBoardPreferences";
```

(`toggleFilterValue` and `getTaskDueStatus` are not imported here — after Task 4 extracts the toolbar, `AppShell.tsx` no longer calls them directly.)

- [ ] **Step 6: Update `ProjectDetailView` to call the imported `filterProjectTasks`/`sortProjectTasks`**

Find:

```typescript
  function getTaskDueStatus(task: Task): ProjectBoardDueFilter | null {
    if (!task.dueDate) {
      return "none";
    }

    if (task.dueDate < today) {
      return "overdue";
    }

    if (task.dueDate === today) {
      return "today";
    }

    return null;
  }

  const filteredProjectTasks = projectTasks.filter((task) => {
    const { assigneeIds, priorities, dueStatuses, labelIds } = preferences.filters;

    if (assigneeIds.length > 0 && (!task.assigneeId || !assigneeIds.includes(task.assigneeId))) {
      return false;
    }

    if (priorities.length > 0 && !priorities.includes(task.priority)) {
      return false;
    }

    if (dueStatuses.length > 0) {
      const status = getTaskDueStatus(task);

      if (!status || !dueStatuses.includes(status)) {
        return false;
      }
    }

    if (labelIds.length > 0 && !task.labels.some((label) => labelIds.includes(label.id))) {
      return false;
    }

    return true;
  });

  const sortedProjectTasks = sortProjectTasks(filteredProjectTasks, preferences.sort);
```

Replace with:

```typescript
  const filteredProjectTasks = filterProjectTasks(projectTasks, preferences.filters, today);
  const sortedProjectTasks = sortProjectTasks(filteredProjectTasks, preferences.sort);
```

(`const today = getTodayDateValue();` a few lines above this block stays — it is now passed into `filterProjectTasks` instead of being read directly by a local `getTaskDueStatus`.)

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/projects/projectBoardPreferences.ts src/layout/AppShell.tsx
git commit -m "Move board sort/filter pure functions into projectBoardPreferences"
```

---

### Task 4: Extract `ProjectBoardToolbar` component

**Files:**
- Create: `src/projects/ProjectBoardToolbar.tsx`
- Modify: `src/layout/AppShell.tsx` (remove now-unused constants/state/JSX, render the new component)

**Interfaces:**
- Consumes: `CustomDropdown`, `DropdownOption` from `../layout/CustomDropdown`; `getMemberDisplayName` from `../teams/teamMemberDisplay` (Task 1); `TASK_PRIORITY_COLORS` (as `BOARD_CARD_PRIORITY_COLORS`), `BOARD_CARD_PRIORITY_LABELS`, `BOARD_CARD_PRIORITY_OPTIONS` from `../tasks/taskPriorityColors` (Task 2); `toggleFilterValue`, `getDefaultProjectBoardPreferences`, `ProjectBoardPreferences`, `ProjectBoardDueFilter`, `ProjectBoardSortKey` from `./projectBoardPreferences` (Task 3, existing); `TeamMember` from `../teams/teamTypes`; `TaskLabel` from `../tasks/taskTypes`.
- Produces (used by Task 5): `export function ProjectBoardToolbar({ preferences, onPreferencesChange, members, availableLabels }: ProjectBoardToolbarProps)`.

- [ ] **Step 1: Write `src/projects/ProjectBoardToolbar.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { ArrowUpDown, Filter, X } from "lucide-react";
import { CustomDropdown } from "../layout/CustomDropdown";
import type { DropdownOption } from "../layout/CustomDropdown";
import { getMemberDisplayName } from "../teams/teamMemberDisplay";
import type { TeamMember } from "../teams/teamTypes";
import type { TaskLabel } from "../tasks/taskTypes";
import {
  BOARD_CARD_PRIORITY_LABELS,
  BOARD_CARD_PRIORITY_OPTIONS,
  TASK_PRIORITY_COLORS as BOARD_CARD_PRIORITY_COLORS,
} from "../tasks/taskPriorityColors";
import {
  getDefaultProjectBoardPreferences,
  toggleFilterValue,
  type ProjectBoardDueFilter,
  type ProjectBoardPreferences,
  type ProjectBoardSortKey,
} from "./projectBoardPreferences";

const BOARD_DUE_FILTER_OPTIONS: { value: ProjectBoardDueFilter; label: string }[] = [
  { value: "overdue", label: "Po termínu" },
  { value: "today", label: "Dnes" },
  { value: "none", label: "Bez termínu" },
];
const BOARD_SORT_DROPDOWN_OPTIONS: DropdownOption[] = [
  { value: "manual", label: "Ruční pořadí" },
  { value: "priority", label: "Priorita, vysoká první" },
  { value: "dueDate", label: "Termín, nejbližší první" },
  { value: "title", label: "Abecedně" },
];
const BOARD_SORT_TRIGGER_LABELS: Record<ProjectBoardSortKey, string> = {
  manual: "Řadit",
  priority: "Řadit: Priorita",
  dueDate: "Řadit: Termín",
  title: "Řadit: Abecedně",
};

type ProjectBoardToolbarProps = {
  preferences: ProjectBoardPreferences;
  onPreferencesChange: Dispatch<SetStateAction<ProjectBoardPreferences>>;
  members: TeamMember[];
  availableLabels: TaskLabel[];
};

export function ProjectBoardToolbar({
  preferences,
  onPreferencesChange,
  members,
  availableLabels,
}: ProjectBoardToolbarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (filterPanelRef.current?.contains(target)) {
        return;
      }

      setIsFilterOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isFilterOpen]);

  const activeFilterCount =
    preferences.filters.assigneeIds.length +
    preferences.filters.priorities.length +
    preferences.filters.dueStatuses.length +
    preferences.filters.labelIds.length;

  function handleClearFilters(event: ReactMouseEvent) {
    event.stopPropagation();
    onPreferencesChange((current) => ({
      ...current,
      filters: getDefaultProjectBoardPreferences().filters,
    }));
  }

  return (
    <div className="project-detail__toolbar">
      <div className="project-detail__filter" ref={isFilterOpen ? filterPanelRef : null}>
        <button
          className="project-detail__filter-button"
          type="button"
          aria-expanded={isFilterOpen}
          onClick={() => setIsFilterOpen((current) => !current)}
        >
          <Filter aria-hidden="true" size={15} />
          <span>Filtr</span>
          {activeFilterCount > 0 ? (
            <span className="project-detail__filter-badge">{activeFilterCount}</span>
          ) : null}
        </button>
        {activeFilterCount > 0 ? (
          <button
            className="project-detail__filter-clear"
            type="button"
            aria-label="Zrušit filtry"
            onClick={handleClearFilters}
          >
            <X aria-hidden="true" size={12} />
          </button>
        ) : null}
        {isFilterOpen ? (
          <div className="project-detail__filter-panel" role="menu">
            <div className="project-detail__filter-section">
              <span>Přiřazeno</span>
              {members.length === 0 ? (
                <p className="project-detail__filter-empty">Nástěnka nemá žádné členy.</p>
              ) : (
                members.map((member) => (
                  <label className="project-detail__filter-option" key={member.userId}>
                    <input
                      type="checkbox"
                      checked={preferences.filters.assigneeIds.includes(member.userId)}
                      onChange={() =>
                        onPreferencesChange((current) => ({
                          ...current,
                          filters: {
                            ...current.filters,
                            assigneeIds: toggleFilterValue(
                              current.filters.assigneeIds,
                              member.userId,
                            ),
                          },
                        }))
                      }
                    />
                    <span>{getMemberDisplayName(member)}</span>
                  </label>
                ))
              )}
            </div>

            <div className="project-detail__filter-section">
              <span>Priorita</span>
              {BOARD_CARD_PRIORITY_OPTIONS.map((priorityOption) => (
                <label className="project-detail__filter-option" key={priorityOption}>
                  <input
                    type="checkbox"
                    checked={preferences.filters.priorities.includes(priorityOption)}
                    onChange={() =>
                      onPreferencesChange((current) => ({
                        ...current,
                        filters: {
                          ...current.filters,
                          priorities: toggleFilterValue(current.filters.priorities, priorityOption),
                        },
                      }))
                    }
                  />
                  <i
                    className="project-detail__filter-dot"
                    aria-hidden="true"
                    style={{ background: BOARD_CARD_PRIORITY_COLORS[priorityOption] }}
                  />
                  <span>{BOARD_CARD_PRIORITY_LABELS[priorityOption]}</span>
                </label>
              ))}
            </div>

            <div className="project-detail__filter-section">
              <span>Termín</span>
              {BOARD_DUE_FILTER_OPTIONS.map((option) => (
                <label className="project-detail__filter-option" key={option.value}>
                  <input
                    type="checkbox"
                    checked={preferences.filters.dueStatuses.includes(option.value)}
                    onChange={() =>
                      onPreferencesChange((current) => ({
                        ...current,
                        filters: {
                          ...current.filters,
                          dueStatuses: toggleFilterValue(current.filters.dueStatuses, option.value),
                        },
                      }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            {availableLabels.length > 0 ? (
              <div className="project-detail__filter-section">
                <span>Štítky</span>
                {availableLabels.map((label) => (
                  <label className="project-detail__filter-option" key={label.id}>
                    <input
                      type="checkbox"
                      checked={preferences.filters.labelIds.includes(label.id)}
                      onChange={() =>
                        onPreferencesChange((current) => ({
                          ...current,
                          filters: {
                            ...current.filters,
                            labelIds: toggleFilterValue(current.filters.labelIds, label.id),
                          },
                        }))
                      }
                    />
                    <i
                      className="project-detail__filter-dot"
                      aria-hidden="true"
                      style={{ background: label.color }}
                    />
                    <span>{label.name}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="project-detail__sort">
        <CustomDropdown
          ariaLabel="Řadit úkoly"
          className="project-detail__sort-dropdown"
          value={preferences.sort}
          options={BOARD_SORT_DROPDOWN_OPTIONS}
          onChange={(value) =>
            onPreferencesChange((current) => ({ ...current, sort: value as ProjectBoardSortKey }))
          }
          renderTriggerContent={() => (
            <span className="custom-dropdown__value">
              <ArrowUpDown aria-hidden="true" size={14} />
              {BOARD_SORT_TRIGGER_LABELS[preferences.sort]}
            </span>
          )}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `src/layout/AppShell.tsx` (still has the old inline toolbar — fixed in the next step). No errors reported for `src/projects/ProjectBoardToolbar.tsx` itself.

- [ ] **Step 3: Commit the new component**

```bash
git add src/projects/ProjectBoardToolbar.tsx
git commit -m "Add ProjectBoardToolbar component extracted from ProjectDetailView"
```

- [ ] **Step 4: Remove the module-level toolbar-only constants from `AppShell.tsx`**

Find:

```typescript
const BOARD_DUE_FILTER_OPTIONS: { value: ProjectBoardDueFilter; label: string }[] = [
  { value: "overdue", label: "Po termínu" },
  { value: "today", label: "Dnes" },
  { value: "none", label: "Bez termínu" },
];
const BOARD_SORT_DROPDOWN_OPTIONS: DropdownOption[] = [
  { value: "manual", label: "Ruční pořadí" },
  { value: "priority", label: "Priorita, vysoká první" },
  { value: "dueDate", label: "Termín, nejbližší první" },
  { value: "title", label: "Abecedně" },
];
const BOARD_SORT_TRIGGER_LABELS: Record<ProjectBoardSortKey, string> = {
  manual: "Řadit",
  priority: "Řadit: Priorita",
  dueDate: "Řadit: Termín",
  title: "Řadit: Abecedně",
};
```

Delete this whole block.

- [ ] **Step 5: Remove now-unused `Filter`/`ArrowUpDown` icon imports**

Find:

```typescript
import { ArrowUpDown, BarChart3, Bell, CheckCircle2, Filter, FolderKanban, MailPlus, MoreVertical, Pencil, ShieldCheck, Sparkle, Trash2, UserPlus, Users, X } from "lucide-react";
```

Replace with:

```typescript
import { BarChart3, Bell, CheckCircle2, FolderKanban, MailPlus, MoreVertical, Pencil, ShieldCheck, Sparkle, Trash2, UserPlus, Users, X } from "lucide-react";
```

- [ ] **Step 6: Import `ProjectBoardToolbar` in `AppShell.tsx`**

Find:

```typescript
import { ProjectBoardGrid } from "../projects/ProjectBoardGrid";
```

Replace with:

```typescript
import { ProjectBoardGrid } from "../projects/ProjectBoardGrid";
import { ProjectBoardToolbar } from "../projects/ProjectBoardToolbar";
```

- [ ] **Step 7: Remove `ProjectDetailView`'s local filter-panel UI state**

Find:

```typescript
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveProjectBoardPreferences(project.id, preferences);
  }, [project.id, preferences]);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (filterPanelRef.current?.contains(target)) {
        return;
      }

      setIsFilterOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isFilterOpen]);
```

Replace with:

```typescript
  useEffect(() => {
    saveProjectBoardPreferences(project.id, preferences);
  }, [project.id, preferences]);
```

- [ ] **Step 8: Remove `activeFilterCount` and `handleClearFilters` (now inside `ProjectBoardToolbar`)**

Find:

```typescript
  const activeFilterCount =
    preferences.filters.assigneeIds.length +
    preferences.filters.priorities.length +
    preferences.filters.dueStatuses.length +
    preferences.filters.labelIds.length;

  const filteredProjectTasks = filterProjectTasks(projectTasks, preferences.filters, today);
  const sortedProjectTasks = sortProjectTasks(filteredProjectTasks, preferences.sort);

  function handleClearFilters(event: ReactMouseEvent) {
    event.stopPropagation();
    setPreferences((current) => ({
      ...current,
      filters: getDefaultProjectBoardPreferences().filters,
    }));
  }
```

Replace with:

```typescript
  const filteredProjectTasks = filterProjectTasks(projectTasks, preferences.filters, today);
  const sortedProjectTasks = sortProjectTasks(filteredProjectTasks, preferences.sort);
```

- [ ] **Step 9: Replace the inline toolbar JSX with `<ProjectBoardToolbar>`**

Find the entire block:

```tsx
        <div className="project-detail__toolbar">
          <div className="project-detail__filter" ref={isFilterOpen ? filterPanelRef : null}>
            <button
              className="project-detail__filter-button"
              type="button"
              aria-expanded={isFilterOpen}
              onClick={() => setIsFilterOpen((current) => !current)}
            >
              <Filter aria-hidden="true" size={15} />
              <span>Filtr</span>
              {activeFilterCount > 0 ? (
                <span className="project-detail__filter-badge">{activeFilterCount}</span>
              ) : null}
            </button>
            {activeFilterCount > 0 ? (
              <button
                className="project-detail__filter-clear"
                type="button"
                aria-label="Zrušit filtry"
                onClick={handleClearFilters}
              >
                <X aria-hidden="true" size={12} />
              </button>
            ) : null}
            {isFilterOpen ? (
              <div className="project-detail__filter-panel" role="menu">
                <div className="project-detail__filter-section">
                  <span>Přiřazeno</span>
                  {members.length === 0 ? (
                    <p className="project-detail__filter-empty">Nástěnka nemá žádné členy.</p>
                  ) : (
                    members.map((member) => (
                      <label className="project-detail__filter-option" key={member.userId}>
                        <input
                          type="checkbox"
                          checked={preferences.filters.assigneeIds.includes(member.userId)}
                          onChange={() =>
                            setPreferences((current) => ({
                              ...current,
                              filters: {
                                ...current.filters,
                                assigneeIds: toggleFilterValue(
                                  current.filters.assigneeIds,
                                  member.userId,
                                ),
                              },
                            }))
                          }
                        />
                        <span>{getMemberDisplayName(member)}</span>
                      </label>
                    ))
                  )}
                </div>

                <div className="project-detail__filter-section">
                  <span>Priorita</span>
                  {BOARD_CARD_PRIORITY_OPTIONS.map((priorityOption) => (
                    <label className="project-detail__filter-option" key={priorityOption}>
                      <input
                        type="checkbox"
                        checked={preferences.filters.priorities.includes(priorityOption)}
                        onChange={() =>
                          setPreferences((current) => ({
                            ...current,
                            filters: {
                              ...current.filters,
                              priorities: toggleFilterValue(current.filters.priorities, priorityOption),
                            },
                          }))
                        }
                      />
                      <i
                        className="project-detail__filter-dot"
                        aria-hidden="true"
                        style={{ background: BOARD_CARD_PRIORITY_COLORS[priorityOption] }}
                      />
                      <span>{BOARD_CARD_PRIORITY_LABELS[priorityOption]}</span>
                    </label>
                  ))}
                </div>

                <div className="project-detail__filter-section">
                  <span>Termín</span>
                  {BOARD_DUE_FILTER_OPTIONS.map((option) => (
                    <label className="project-detail__filter-option" key={option.value}>
                      <input
                        type="checkbox"
                        checked={preferences.filters.dueStatuses.includes(option.value)}
                        onChange={() =>
                          setPreferences((current) => ({
                            ...current,
                            filters: {
                              ...current.filters,
                              dueStatuses: toggleFilterValue(current.filters.dueStatuses, option.value),
                            },
                          }))
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>

                {availableLabels.length > 0 ? (
                  <div className="project-detail__filter-section">
                    <span>Štítky</span>
                    {availableLabels.map((label) => (
                      <label className="project-detail__filter-option" key={label.id}>
                        <input
                          type="checkbox"
                          checked={preferences.filters.labelIds.includes(label.id)}
                          onChange={() =>
                            setPreferences((current) => ({
                              ...current,
                              filters: {
                                ...current.filters,
                                labelIds: toggleFilterValue(current.filters.labelIds, label.id),
                              },
                            }))
                          }
                        />
                        <i
                          className="project-detail__filter-dot"
                          aria-hidden="true"
                          style={{ background: label.color }}
                        />
                        <span>{label.name}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="project-detail__sort">
            <CustomDropdown
              ariaLabel="Řadit úkoly"
              className="project-detail__sort-dropdown"
              value={preferences.sort}
              options={BOARD_SORT_DROPDOWN_OPTIONS}
              onChange={(value) =>
                setPreferences((current) => ({ ...current, sort: value as ProjectBoardSortKey }))
              }
              renderTriggerContent={() => (
                <span className="custom-dropdown__value">
                  <ArrowUpDown aria-hidden="true" size={14} />
                  {BOARD_SORT_TRIGGER_LABELS[preferences.sort]}
                </span>
              )}
            />
          </div>
        </div>
```

Replace the whole matched block with:

```tsx
        <ProjectBoardToolbar
          preferences={preferences}
          onPreferencesChange={setPreferences}
          members={members}
          availableLabels={availableLabels}
        />
```

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Manually verify the Kanban board toolbar still works**

Run: `npm run dev`. Open a board with several tasks, open Filtr, toggle an assignee/priority/due/label filter, confirm cards filter correctly and the badge count updates. Open Řadit, switch sort key, confirm card order updates. Confirm switching to a different board resets filters (per-board `localStorage` scoping, unchanged behavior).

- [ ] **Step 12: Commit**

```bash
git add src/layout/AppShell.tsx
git commit -m "Use ProjectBoardToolbar in ProjectDetailView"
```

---

### Task 5: `TableViewPanel` component

**Files:**
- Create: `src/layout/panels/TableViewPanel.tsx`

**Interfaces:**
- Consumes: `CustomDropdown`, `DropdownOption` from `../CustomDropdown`; `loadProjectsForTeams`, `loadProjectColumns` from `../../supabase/projectApi`; `loadTeamMembers` from `../../supabase/teamApi`; `Project`, `ProjectColumn` from `../../projects/projectTypes`; `Team`, `TeamMember` from `../../teams/teamTypes`; `Task` from `../../tasks/taskTypes`; `getMemberInitials` from `../../teams/teamMemberDisplay` (Task 1); `TASK_PRIORITY_COLORS` from `../../tasks/taskPriorityColors` (Task 2); `getDefaultProjectBoardPreferences`, `loadProjectBoardPreferences`, `saveProjectBoardPreferences`, `filterProjectTasks`, `sortProjectTasks`, `ProjectBoardPreferences` from `../../projects/projectBoardPreferences` (Task 3, existing module extended by Task 3); `ProjectBoardToolbar` from `../../projects/ProjectBoardToolbar` (Task 4); `getTodayDateValue` from `../../tasks/dateUtils`.
- Produces (used by Task 8): `export function TableViewPanel({ teams, tasks, onOpenTask }: { teams: Team[]; tasks: Task[]; onOpenTask: (projectId: string, taskId: string) => void })`.

- [ ] **Step 1: Write `src/layout/panels/TableViewPanel.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { CustomDropdown } from "../CustomDropdown";
import type { DropdownOption } from "../CustomDropdown";
import { loadProjectColumns, loadProjectsForTeams } from "../../supabase/projectApi";
import { loadTeamMembers } from "../../supabase/teamApi";
import type { Project, ProjectColumn } from "../../projects/projectTypes";
import type { Team, TeamMember } from "../../teams/teamTypes";
import type { Task } from "../../tasks/taskTypes";
import { getMemberInitials } from "../../teams/teamMemberDisplay";
import { TASK_PRIORITY_COLORS } from "../../tasks/taskPriorityColors";
import { getTodayDateValue } from "../../tasks/dateUtils";
import {
  filterProjectTasks,
  getDefaultProjectBoardPreferences,
  loadProjectBoardPreferences,
  saveProjectBoardPreferences,
  sortProjectTasks,
  type ProjectBoardPreferences,
} from "../../projects/projectBoardPreferences";
import { ProjectBoardToolbar } from "../../projects/ProjectBoardToolbar";

type TableViewPanelProps = {
  teams: Team[];
  tasks: Task[];
  onOpenTask: (projectId: string, taskId: string) => void;
};

export function TableViewPanel({ teams, tasks, onOpenTask }: TableViewPanelProps) {
  const [boards, setBoards] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [preferences, setPreferences] = useState<ProjectBoardPreferences>(
    getDefaultProjectBoardPreferences(),
  );

  useEffect(() => {
    let isCancelled = false;
    const teamIds = teams.map((team) => team.id);

    async function loadBoards() {
      setIsLoading(true);
      setError(null);

      try {
        const nextBoards = await loadProjectsForTeams(teamIds);

        if (!isCancelled) {
          setBoards(nextBoards);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setBoards([]);
          setError(
            loadError instanceof Error ? loadError.message : "Nástěnky se nepodařilo načíst.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (teamIds.length === 0) {
      setBoards([]);
      setError(null);
      return;
    }

    void loadBoards();

    return () => {
      isCancelled = true;
    };
  }, [teams]);

  useEffect(() => {
    if (selectedBoardId && !boards.some((board) => board.id === selectedBoardId)) {
      setSelectedBoardId(null);
    }
  }, [boards, selectedBoardId]);

  const selectedBoard = boards.find((board) => board.id === selectedBoardId) ?? null;

  useEffect(() => {
    if (!selectedBoard) {
      setColumns([]);
      setMembers([]);
      return;
    }

    let isCancelled = false;
    const board = selectedBoard;
    setPreferences(loadProjectBoardPreferences(board.id));

    async function loadBoardDetails() {
      setIsLoading(true);
      setError(null);

      try {
        const [nextColumns, nextMembers] = await Promise.all([
          loadProjectColumns(board.id),
          loadTeamMembers(board.teamId),
        ]);

        if (!isCancelled) {
          setColumns(nextColumns);
          setMembers(nextMembers);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setColumns([]);
          setMembers([]);
          setError(
            loadError instanceof Error ? loadError.message : "Detail nástěnky se nepodařilo načíst.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBoardDetails();

    return () => {
      isCancelled = true;
    };
  }, [selectedBoard]);

  useEffect(() => {
    if (!selectedBoard) {
      return;
    }

    saveProjectBoardPreferences(selectedBoard.id, preferences);
  }, [selectedBoard, preferences]);

  const dropdownOptions: DropdownOption[] = boards.map((board) => ({
    value: board.id,
    label: board.name,
  }));

  const boardTasks = useMemo(() => {
    if (!selectedBoard) {
      return [];
    }

    return tasks.filter((task) => task.projectId === selectedBoard.id && !task.isArchived);
  }, [tasks, selectedBoard]);

  const availableLabels = useMemo(
    () => Array.from(new Map(boardTasks.flatMap((task) => task.labels).map((label) => [label.id, label])).values()),
    [boardTasks],
  );

  const today = getTodayDateValue();
  const filteredTasks = filterProjectTasks(boardTasks, preferences.filters, today);
  const sortedTasks = sortProjectTasks(filteredTasks, preferences.sort);
  const columnByKey = new Map(columns.map((column) => [column.key, column]));
  const memberById = new Map(members.map((member) => [member.userId, member]));

  return (
    <section className="app-panel table-view" aria-label="Tabulka úkolů">
      <header className="table-view__header">
        <CustomDropdown
          value={selectedBoardId ?? ""}
          options={dropdownOptions}
          onChange={(value) => setSelectedBoardId(value)}
          placeholder="Vyber nástěnku"
          ariaLabel="Vyber nástěnku pro tabulku"
          disabled={isLoading || dropdownOptions.length === 0}
        />
      </header>

      {error ? <p className="table-view__error">{error}</p> : null}

      {!selectedBoard ? (
        <p className="table-view__empty">Vyber nástěnku pro zobrazení úkolů.</p>
      ) : (
        <>
          <ProjectBoardToolbar
            preferences={preferences}
            onPreferencesChange={setPreferences}
            members={members}
            availableLabels={availableLabels}
          />

          {sortedTasks.length === 0 ? (
            <p className="table-view__empty">Tato nástěnka nemá žádné úkoly.</p>
          ) : (
            <div className="table-view__table-wrap">
              <table className="table-view__table">
                <thead>
                  <tr>
                    <th>Název</th>
                    <th>Přiřazeno</th>
                    <th>Stav</th>
                    <th>Termín</th>
                    <th>Priorita</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task) => {
                    const assignee = task.assigneeId ? memberById.get(task.assigneeId) : null;
                    const statusLabel = columnByKey.get(task.boardColumnKey)?.title ?? task.boardColumnKey;

                    return (
                      <tr
                        className="table-view__row"
                        key={task.id}
                        onClick={() => onOpenTask(selectedBoard.id, task.id)}
                      >
                        <td className="table-view__cell-name">
                          <span
                            className="table-view__completed-dot"
                            data-completed={task.completed ? "true" : "false"}
                            aria-hidden="true"
                          />
                          <span className="table-view__title">{task.title}</span>
                        </td>
                        <td>
                          {assignee ? (
                            <span className="table-view__assignee" title={assignee.email}>
                              {getMemberInitials(assignee)}
                            </span>
                          ) : (
                            <span className="table-view__cell-empty">—</span>
                          )}
                        </td>
                        <td>{statusLabel}</td>
                        <td>{task.dueDate ?? <span className="table-view__cell-empty">—</span>}</td>
                        <td>
                          <span
                            className="table-view__priority-dot"
                            aria-hidden="true"
                            style={{ background: TASK_PRIORITY_COLORS[task.priority] }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/layout/panels/TableViewPanel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/layout/panels/TableViewPanel.tsx
git commit -m "Add TableViewPanel component"
```

---

### Task 6: Table view styles

**Files:**
- Modify: `src/styles.css` (append at end of file, currently 13154 lines)

**Interfaces:**
- Consumes: existing CSS custom properties `--color-background-card`, `--color-background-card-hover`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-accent`, `--radius-sm`, `--radius-lg` (defined at the top of `src/styles.css`). Reuses the existing `.project-detail__toolbar`/`.project-detail__filter*`/`.project-detail__sort*` classes (no new CSS needed for the toolbar — `ProjectBoardToolbar` renders the identical class names already styled from the `e580ede` commit).
- Produces: `.table-view`, `.table-view__header`, `.table-view__error`, `.table-view__empty`, `.table-view__table-wrap`, `.table-view__table`, `.table-view__row`, `.table-view__cell-name`, `.table-view__completed-dot`, `.table-view__title`, `.table-view__assignee`, `.table-view__cell-empty`, `.table-view__priority-dot` class names, consumed by Task 5's JSX.

- [ ] **Step 1: Append table view styles to `src/styles.css`**

```css
.table-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.table-view__header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.table-view__error {
  color: #ef4444;
  margin: 0;
}

.table-view__empty {
  color: var(--color-text-secondary);
  margin: 0;
}

.table-view__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.table-view__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.table-view__table thead th {
  text-align: left;
  padding: 10px 14px;
  color: var(--color-text-secondary);
  font-weight: 600;
  font-size: 0.78rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.table-view__table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
  vertical-align: middle;
}

.table-view__row {
  cursor: pointer;
}

.table-view__row:hover td {
  background: var(--color-background-card-hover);
}

.table-view__cell-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
}

.table-view__completed-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--color-border);
  flex-shrink: 0;
}

.table-view__completed-dot[data-completed="true"] {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.table-view__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-view__assignee {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-background-card);
  border: 1px solid var(--color-border);
  font-size: 0.7rem;
  font-weight: 600;
}

.table-view__cell-empty {
  color: var(--color-text-secondary);
}

.table-view__priority-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "Add table view styles"
```

---

### Task 7: Sidebar nav button

**Files:**
- Modify: `src/layout/panels/SidebarPanel.tsx`

**Interfaces:**
- Consumes: a `Table2` icon, newly imported from `lucide-react`.
- Produces (used by Task 8): new props `onOpenTable: () => void` and `isTableOpen: boolean` on `SidebarPanelProps`.

- [ ] **Step 1: Import the `Table2` icon**

Find:

```typescript
import {
  CalendarDays,
  Clock3,
  FolderKanban,
  Download,
  Home,
  List,
  Moon,
  NotebookText,
  Pencil,
  Star,
  Sun,
  Trash2,
  User,
  Users,
  UserPlus,
} from "lucide-react";
```

Replace with:

```typescript
import {
  CalendarDays,
  Clock3,
  FolderKanban,
  Download,
  Home,
  List,
  Moon,
  NotebookText,
  Pencil,
  Star,
  Sun,
  Table2,
  Trash2,
  User,
  Users,
  UserPlus,
} from "lucide-react";
```

- [ ] **Step 2: Add the two new props to `SidebarPanelProps`**

Find:

```typescript
  onOpenProjectsOverview: () => void;
  onOpenCalendar: () => void;
  onOpenNotes: () => void;
```

Replace with:

```typescript
  onOpenProjectsOverview: () => void;
  onOpenCalendar: () => void;
  onOpenTable: () => void;
  onOpenNotes: () => void;
```

Then find:

```typescript
  isProjectsOverviewOpen: boolean;
  isCalendarOpen: boolean;
  isNotesOpen: boolean;
```

Replace with:

```typescript
  isProjectsOverviewOpen: boolean;
  isCalendarOpen: boolean;
  isTableOpen: boolean;
  isNotesOpen: boolean;
```

- [ ] **Step 3: Destructure the new props in the component**

Find:

```typescript
  onOpenProjectsOverview,
  onOpenCalendar,
  onOpenNotes,
```

Replace with:

```typescript
  onOpenProjectsOverview,
  onOpenCalendar,
  onOpenTable,
  onOpenNotes,
```

Then find:

```typescript
  isProjectsOverviewOpen,
  isCalendarOpen,
  isNotesOpen,
```

Replace with:

```typescript
  isProjectsOverviewOpen,
  isCalendarOpen,
  isTableOpen,
  isNotesOpen,
```

- [ ] **Step 4: Add `isTableOpen` alongside every existing `isCalendarOpen` visibility check**

Find:

```typescript
                  data-selected={isTeamWorkspace || isTeamsOverviewOpen || isProjectsOverviewOpen || isCalendarOpen || isNotesOpen}
                  role="tab"
                  aria-selected={isTeamWorkspace || isTeamsOverviewOpen || isProjectsOverviewOpen || isCalendarOpen || isNotesOpen}
```

Replace with:

```typescript
                  data-selected={isTeamWorkspace || isTeamsOverviewOpen || isProjectsOverviewOpen || isCalendarOpen || isTableOpen || isNotesOpen}
                  role="tab"
                  aria-selected={isTeamWorkspace || isTeamsOverviewOpen || isProjectsOverviewOpen || isCalendarOpen || isTableOpen || isNotesOpen}
```

Find:

```typescript
              {isTeamWorkspace || isWorkspaceHomeOpen || isTeamsOverviewOpen || isProjectsOverviewOpen || isCalendarOpen || isNotesOpen ? (
```

Replace with:

```typescript
              {isTeamWorkspace || isWorkspaceHomeOpen || isTeamsOverviewOpen || isProjectsOverviewOpen || isCalendarOpen || isTableOpen || isNotesOpen ? (
```

(Note: the other, older `!isProjectsOverviewOpen && !isNotesOpen`-style conditions elsewhere in this file do not currently include `isCalendarOpen` either — leave them exactly as-is; this task only adds `isTableOpen` wherever `isCalendarOpen` already appears, matching the calendar feature's own footprint exactly.)

- [ ] **Step 5: Add the "Tabulka" nav button**

Find:

```tsx
                  <button
                    className="list-nav__item workspace-nav__item"
                    data-selected={isCalendarOpen}
                    type="button"
                    onClick={onOpenCalendar}
                  >
                    <span className="list-nav__main">
                      <span className="workspace-nav__icon" aria-hidden="true">
                        <CalendarDays size={16} strokeWidth={1.9} />
                      </span>
                      <span className="list-nav__name">Kalendář</span>
                    </span>
                  </button>
                  <button
                    className="list-nav__item workspace-nav__item"
                    data-selected={isNotesOpen}
                    type="button"
                    onClick={onOpenNotes}
                  >
```

Replace with:

```tsx
                  <button
                    className="list-nav__item workspace-nav__item"
                    data-selected={isCalendarOpen}
                    type="button"
                    onClick={onOpenCalendar}
                  >
                    <span className="list-nav__main">
                      <span className="workspace-nav__icon" aria-hidden="true">
                        <CalendarDays size={16} strokeWidth={1.9} />
                      </span>
                      <span className="list-nav__name">Kalendář</span>
                    </span>
                  </button>
                  <button
                    className="list-nav__item workspace-nav__item"
                    data-selected={isTableOpen}
                    type="button"
                    onClick={onOpenTable}
                  >
                    <span className="list-nav__main">
                      <span className="workspace-nav__icon" aria-hidden="true">
                        <Table2 size={16} strokeWidth={1.9} />
                      </span>
                      <span className="list-nav__name">Tabulka</span>
                    </span>
                  </button>
                  <button
                    className="list-nav__item workspace-nav__item"
                    data-selected={isNotesOpen}
                    type="button"
                    onClick={onOpenNotes}
                  >
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `src/layout/AppShell.tsx` (missing new required props — expected, fixed in Task 8). No errors reported for `src/layout/panels/SidebarPanel.tsx` itself.

- [ ] **Step 7: Commit**

```bash
git add src/layout/panels/SidebarPanel.tsx
git commit -m "Add Tabulka nav button to sidebar"
```

---

### Task 8: Wire `TableViewPanel` into `AppShell`

**Files:**
- Modify: `src/layout/AppShell.tsx`

**Interfaces:**
- Consumes: `TableViewPanel` from `./panels/TableViewPanel` (Task 5), `onOpenTable`/`isTableOpen` props on `SidebarPanel` (Task 7), existing `teams: Team[]` and `allTasks: Task[]`, existing `handleOpenProjectsOverview(projectId?: string, taskId?: string)`.

- [ ] **Step 1: Import `TableViewPanel`**

Find:

```typescript
import { CalendarPanel } from "./panels/CalendarPanel";
```

Replace with:

```typescript
import { CalendarPanel } from "./panels/CalendarPanel";
import { TableViewPanel } from "./panels/TableViewPanel";
```

- [ ] **Step 2: Add `isTableOpen` state**

Find:

```typescript
  const [isProjectsOverviewOpen, setIsProjectsOverviewOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
```

Replace with:

```typescript
  const [isProjectsOverviewOpen, setIsProjectsOverviewOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
```

- [ ] **Step 3: Include `isTableOpen` in the overlay-layout check**

Find:

```typescript
      isWorkspaceHomeOpen ||
      isTeamsOverviewOpen ||
      isProjectsOverviewOpen ||
      isCalendarOpen ||
      isNotesOpen ||
      isProfileOpen,
```

Replace with:

```typescript
      isWorkspaceHomeOpen ||
      isTeamsOverviewOpen ||
      isProjectsOverviewOpen ||
      isCalendarOpen ||
      isTableOpen ||
      isNotesOpen ||
      isProfileOpen,
```

- [ ] **Step 4: Add `setIsTableOpen(false)` to every existing `handleOpenX` function, and add `handleOpenTable`**

Find:

```typescript
  function handleOpenWorkspaceHome() {
    if (!activeTeamId) {
      return;
    }

    onClearTaskSelection();
    setIsWorkspaceHomeOpen(true);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(false);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenTeamsOverview() {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(true);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(false);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenProjectsOverview(projectId?: string, taskId?: string) {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsProjectsOverviewOpen(true);
    setIsTeamsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(false);
    setOpenProjectRequestId(projectId ?? null);
    setOpenTaskCardRequestId(taskId ?? null);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenCalendar() {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(true);
    setIsNotesOpen(false);
    setIsProfileOpen(false);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenNotes(noteId?: string) {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsNotesOpen(true);
    setIsProfileOpen(false);
    setOpenNoteRequestId(noteId ?? null);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenProfile() {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(true);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }
```

Replace with:

```typescript
  function handleOpenWorkspaceHome() {
    if (!activeTeamId) {
      return;
    }

    onClearTaskSelection();
    setIsWorkspaceHomeOpen(true);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsTableOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(false);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenTeamsOverview() {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(true);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsTableOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(false);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenProjectsOverview(projectId?: string, taskId?: string) {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsProjectsOverviewOpen(true);
    setIsTeamsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsTableOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(false);
    setOpenProjectRequestId(projectId ?? null);
    setOpenTaskCardRequestId(taskId ?? null);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenCalendar() {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(true);
    setIsTableOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(false);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenTable() {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsTableOpen(true);
    setIsNotesOpen(false);
    setIsProfileOpen(false);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenNotes(noteId?: string) {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsTableOpen(false);
    setIsNotesOpen(true);
    setIsProfileOpen(false);
    setOpenNoteRequestId(noteId ?? null);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenProfile() {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsCalendarOpen(false);
    setIsTableOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(true);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }
```

(`handleOpenTeamCreateFlow`/`handleOpenProjectCreateFlow` do not toggle `isCalendarOpen` either, per the current file — leave them unchanged; they are unrelated to which of these panels is open.)

- [ ] **Step 5: Pass the new props to `SidebarPanel`**

Find:

```typescript
        onOpenProjectsOverview={handleOpenProjectsOverview}
        onOpenCalendar={handleOpenCalendar}
        onOpenNotes={() => handleOpenNotes()}
```

Replace with:

```typescript
        onOpenProjectsOverview={handleOpenProjectsOverview}
        onOpenCalendar={handleOpenCalendar}
        onOpenTable={handleOpenTable}
        onOpenNotes={() => handleOpenNotes()}
```

Find:

```typescript
        isProjectsOverviewOpen={isProjectsOverviewOpen}
        isCalendarOpen={isCalendarOpen}
        isNotesOpen={isNotesOpen}
```

Replace with:

```typescript
        isProjectsOverviewOpen={isProjectsOverviewOpen}
        isCalendarOpen={isCalendarOpen}
        isTableOpen={isTableOpen}
        isNotesOpen={isNotesOpen}
```

- [ ] **Step 6: Render `TableViewPanel` in the main panel switch**

Find:

```tsx
          ) : isCalendarOpen ? (
            <CalendarPanel teams={teams} tasks={allTasks} />
          ) : isProjectsOverviewOpen ? (
```

Replace with:

```tsx
          ) : isCalendarOpen ? (
            <CalendarPanel teams={teams} tasks={allTasks} />
          ) : isTableOpen ? (
            <TableViewPanel
              teams={teams}
              tasks={allTasks}
              onOpenTask={(projectId, taskId) => handleOpenProjectsOverview(projectId, taskId)}
            />
          ) : isProjectsOverviewOpen ? (
```

- [ ] **Step 7: Exclude the detail panel while the table view is open**

Find:

```tsx
        {!isWorkspaceHomeOpen && !isTeamsOverviewOpen && !isProjectsOverviewOpen && !isCalendarOpen && !isNotesOpen && !isProfileOpen && isPanelVisible(layout.visiblePanels, "detail") ? (
```

Replace with:

```tsx
        {!isWorkspaceHomeOpen && !isTeamsOverviewOpen && !isProjectsOverviewOpen && !isCalendarOpen && !isTableOpen && !isNotesOpen && !isProfileOpen && isPanelVisible(layout.visiblePanels, "detail") ? (
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/layout/AppShell.tsx
git commit -m "Wire TableViewPanel into AppShell"
```

---

### Task 9: Manual verification in the running app

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the app and select a workspace with a board that has several tasks across different columns, assignees, priorities, and due dates**

- [ ] **Step 3: Click "Tabulka" in the sidebar**

Expected: panel opens, dropdown shows "Vyber nástěnku", no table yet, empty-state text "Vyber nástěnku pro zobrazení úkolů." is visible.

- [ ] **Step 4: Select a board from the dropdown**

Expected: `ProjectBoardToolbar` (Filtr + Řadit) renders above the table, table renders with columns Název/Přiřazeno/Stav/Termín/Priorita, one row per non-archived task on that board.

- [ ] **Step 5: Use Filtr to filter by one assignee, then by one priority**

Expected: rows narrow to matching tasks; badge on the Filtr button shows the active count; behavior matches the Kanban board's Filtr for the same board (same underlying `localStorage` preferences, keyed by board id).

- [ ] **Step 6: Use Řadit to switch to "Priorita, vysoká první" and then "Termín, nejbližší první"**

Expected: row order updates accordingly.

- [ ] **Step 7: Click a task row**

Expected: the app navigates to "Nástěnky", opens that board's Kanban detail view, and the same `ProjectCardComposerModal` used by Kanban cards opens pre-filled with that task's data.

- [ ] **Step 8: Close the modal, go back to "Tabulka", select a board with zero tasks**

Expected: toolbar still renders, table area shows "Tato nástěnka nemá žádné úkoly." with no crash.

- [ ] **Step 9: Switch to another sidebar item (e.g. "Nástěnky") and back to "Tabulka"**

Expected: previously selected board resets to none (empty-state on reopen, same pattern as Kalendář), no leftover selection bugs.

- [ ] **Step 10: Re-verify the Kanban board's own Filtr/Řadit still works after the `ProjectBoardToolbar` extraction**

Open a board directly via "Nástěnky", confirm Filtr/Řadit behave identically to before this feature (per-board persistence, badge, clear button).

- [ ] **Step 11: Run the production build to confirm no build-time errors**

Run: `npm run build`
Expected: build completes successfully (the pre-existing warning about a >500kB main chunk is expected and not a new failure).
