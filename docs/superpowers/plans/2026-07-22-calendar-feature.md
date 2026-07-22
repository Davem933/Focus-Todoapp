# Calendar Feature (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Kalendář" sidebar entry that lets the user pick a project ("nástěnka") and see the current month with that project's tasks placed on their due date.

**Architecture:** A new pure-function module computes the month grid and groups tasks by due date. A new `CalendarPanel` component (same shape as the existing `NotesPanel`) owns its own project-loading state and renders the dropdown + month grid. `AppShell.tsx` wires it in following the exact `isXOpen` boolean-flag pattern already used for `ProjectsOverviewPanel`/`NotesPanel`/etc. `SidebarPanel.tsx` gets one new nav button.

**Tech Stack:** React 19 + TypeScript, no test framework in this repo (confirmed via `CLAUDE.md` — no test script, no `*.test.*`/`*.spec.*` files). Verification of pure logic uses Node 22's built-in TypeScript stripping (`node --experimental-strip-types`) via a throwaway script that is deleted before committing. Verification of UI is manual, in the running dev server.

## Global Constraints

- Keep every file under 500 lines (project `CLAUDE.md` rule).
- Never create files unless necessary; never save working/test files to repo root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts` (project `CLAUDE.md` rule).
- No `Co-Authored-By` trailer on commits (project `CLAUDE.md` rule).
- No automated test framework exists in this repo — do not add Jest/Vitest. Verify manually as described per task.
- Follow existing Czech-language UI copy conventions (all user-facing strings in this app are Czech).
- Do not touch `src/layout/AppShell.tsx` mojibake / mangled Czech strings unrelated to this feature (documented gotcha in project `CLAUDE.md`).

---

### Task 1: Calendar date utilities

**Files:**
- Create: `src/calendar/calendarUtils.ts`
- Verification script (temporary, deleted at end of task): `tests/verify-calendar-utils.mjs`

**Interfaces:**
- Consumes: nothing (pure functions, no repo dependencies).
- Produces (used by Task 2):
  - `CZECH_MONTH_NAMES: string[]` — 12 entries, index 0 = leden.
  - `CZECH_WEEKDAY_LABELS: string[]` — 7 entries, Monday-first (`["Po","Út","St","Čt","Pá","So","Ne"]`).
  - `type CalendarDay = { date: string; dayOfMonth: number }` — `date` is `"YYYY-MM-DD"`.
  - `getCurrentYearMonth(): { year: number; month: number }` — `month` is 1-12.
  - `getMonthMatrix(year: number, month: number): (CalendarDay | null)[][]` — array of weeks (each length 7), Monday-first, `null` for padding cells outside the month.
  - `groupTaskIdsByDueDate(tasks: { id: string; dueDate: string | null }[]): Map<string, string[]>` — keys are `"YYYY-MM-DD"`, values are task ids due that day; tasks with `dueDate === null` are skipped.

- [ ] **Step 1: Write `src/calendar/calendarUtils.ts`**

```typescript
export const CZECH_MONTH_NAMES = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
];

export const CZECH_WEEKDAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export type CalendarDay = {
  date: string;
  dayOfMonth: number;
};

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();

  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getMonthMatrix(year: number, month: number): (CalendarDay | null)[][] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekdayMondayIndex = (firstOfMonth.getDay() + 6) % 7;

  const cells: (CalendarDay | null)[] = [];

  for (let i = 0; i < firstWeekdayMondayIndex; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const monthStr = String(month).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    cells.push({ date: `${year}-${monthStr}-${dayStr}`, dayOfMonth: day });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (CalendarDay | null)[][] = [];

  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

export function groupTaskIdsByDueDate(
  tasks: { id: string; dueDate: string | null }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const task of tasks) {
    if (!task.dueDate) {
      continue;
    }

    const existing = map.get(task.dueDate);

    if (existing) {
      existing.push(task.id);
    } else {
      map.set(task.dueDate, [task.id]);
    }
  }

  return map;
}
```

- [ ] **Step 2: Write the throwaway verification script**

Create `tests/verify-calendar-utils.mjs`:

```javascript
import assert from "node:assert/strict";
import {
  CZECH_MONTH_NAMES,
  CZECH_WEEKDAY_LABELS,
  getMonthMatrix,
  groupTaskIdsByDueDate,
} from "../src/calendar/calendarUtils.ts";

assert.equal(CZECH_MONTH_NAMES.length, 12);
assert.equal(CZECH_MONTH_NAMES[0], "leden");
assert.equal(CZECH_WEEKDAY_LABELS.length, 7);
assert.equal(CZECH_WEEKDAY_LABELS[0], "Po");

// July 2026 starts on a Wednesday and has 31 days.
const julyWeeks = getMonthMatrix(2026, 7);
const flatDays = julyWeeks.flat().filter((day) => day !== null);
assert.equal(flatDays.length, 31);
assert.equal(flatDays[0].date, "2026-07-01");
assert.equal(flatDays[0].dayOfMonth, 1);
assert.equal(flatDays[30].date, "2026-07-31");
julyWeeks.forEach((week) => assert.equal(week.length, 7));
// 2026-07-01 is a Wednesday -> index 2 in a Monday-first week (Mon=0).
assert.equal(julyWeeks[0][2]?.date, "2026-07-01");
assert.equal(julyWeeks[0][0], null);
assert.equal(julyWeeks[0][1], null);

const grouped = groupTaskIdsByDueDate([
  { id: "a", dueDate: "2026-07-05" },
  { id: "b", dueDate: "2026-07-05" },
  { id: "c", dueDate: null },
  { id: "d", dueDate: "2026-07-31" },
]);
assert.deepEqual(grouped.get("2026-07-05"), ["a", "b"]);
assert.deepEqual(grouped.get("2026-07-31"), ["d"]);
assert.equal(grouped.has("2026-07-06"), false);

console.log("All calendarUtils checks passed.");
```

- [ ] **Step 3: Run the verification script**

Run: `node --experimental-strip-types tests/verify-calendar-utils.mjs`
Expected output: `All calendarUtils checks passed.` with no assertion errors.

- [ ] **Step 4: Delete the throwaway script (not committed)**

```bash
rm tests/verify-calendar-utils.mjs
```

If `tests/` is now empty, remove it too (Windows Git doesn't track empty dirs anyway, so this is a no-op if the directory can't be removed).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/calendar/calendarUtils.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/calendar/calendarUtils.ts
git commit -m "Add calendar date-grid and task-grouping utilities"
```

---

### Task 2: `CalendarPanel` component

**Files:**
- Create: `src/layout/panels/CalendarPanel.tsx`

**Interfaces:**
- Consumes:
  - `CustomDropdown`, `DropdownOption` from `../CustomDropdown` (props: `value: string`, `options: DropdownOption[]`, `onChange: (value: string) => void`, `placeholder?: string`, `ariaLabel: string`, `disabled?: boolean`).
  - `loadProjectsForTeams(teamIds: string[]): Promise<Project[]>` from `../../supabase/projectApi`.
  - `Project` type (`{ id, teamId, name, ... }`) from `../../projects/projectTypes`.
  - `Team` type from `../../teams/teamTypes`.
  - `Task` type (`{ id, projectId, dueDate, title, ... }`) from `../../tasks/taskTypes`.
  - `CZECH_MONTH_NAMES`, `CZECH_WEEKDAY_LABELS`, `CalendarDay`, `getCurrentYearMonth`, `getMonthMatrix`, `groupTaskIdsByDueDate` from `../../calendar/calendarUtils` (Task 1).
- Produces (used by Task 4): `export function CalendarPanel({ teams, tasks }: { teams: Team[]; tasks: Task[] })`.

- [ ] **Step 1: Write `src/layout/panels/CalendarPanel.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { CustomDropdown } from "../CustomDropdown";
import type { DropdownOption } from "../CustomDropdown";
import { loadProjectsForTeams } from "../../supabase/projectApi";
import type { Project } from "../../projects/projectTypes";
import type { Team } from "../../teams/teamTypes";
import type { Task } from "../../tasks/taskTypes";
import {
  CZECH_MONTH_NAMES,
  CZECH_WEEKDAY_LABELS,
  getCurrentYearMonth,
  getMonthMatrix,
  groupTaskIdsByDueDate,
} from "../../calendar/calendarUtils";

type CalendarPanelProps = {
  teams: Team[];
  tasks: Task[];
};

export function CalendarPanel({ teams, tasks }: CalendarPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { year, month } = useMemo(() => getCurrentYearMonth(), []);

  useEffect(() => {
    let isCancelled = false;
    const teamIds = teams.map((team) => team.id);

    async function loadProjects() {
      setIsLoading(true);
      setError(null);

      try {
        const nextProjects = await loadProjectsForTeams(teamIds);

        if (!isCancelled) {
          setProjects(nextProjects);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setProjects([]);
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
      setProjects([]);
      setError(null);
      return;
    }

    void loadProjects();

    return () => {
      isCancelled = true;
    };
  }, [teams]);

  useEffect(() => {
    if (selectedProjectId && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [projects, selectedProjectId]);

  const dropdownOptions: DropdownOption[] = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month]);

  const taskIdsByDueDate = useMemo(() => {
    if (!selectedProjectId) {
      return new Map<string, string[]>();
    }

    const projectTasks = tasks.filter((task) => task.projectId === selectedProjectId);

    return groupTaskIdsByDueDate(projectTasks);
  }, [tasks, selectedProjectId]);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  return (
    <div className="calendar-panel">
      <header className="calendar-panel__header">
        <CustomDropdown
          value={selectedProjectId ?? ""}
          options={dropdownOptions}
          onChange={(value) => setSelectedProjectId(value)}
          placeholder="Vyber nástěnku"
          ariaLabel="Vyber nástěnku pro kalendář"
          disabled={isLoading || dropdownOptions.length === 0}
        />
        <h2 className="calendar-panel__title">
          {CZECH_MONTH_NAMES[month - 1]} {year}
        </h2>
      </header>

      {error ? <p className="calendar-panel__error">{error}</p> : null}

      {!selectedProjectId ? (
        <p className="calendar-panel__empty">Vyber nástěnku pro zobrazení úkolů.</p>
      ) : (
        <div className="calendar-panel__grid">
          <div className="calendar-panel__weekdays">
            {CZECH_WEEKDAY_LABELS.map((label) => (
              <span key={label} className="calendar-panel__weekday">
                {label}
              </span>
            ))}
          </div>
          {weeks.map((week, weekIndex) => (
            <div className="calendar-panel__week" key={weekIndex}>
              {week.map((day, dayIndex) => (
                <div
                  className="calendar-panel__day"
                  key={day?.date ?? `empty-${weekIndex}-${dayIndex}`}
                  data-empty={day ? "false" : "true"}
                >
                  {day ? (
                    <>
                      <span className="calendar-panel__day-number">{day.dayOfMonth}</span>
                      <div className="calendar-panel__day-tasks">
                        {(taskIdsByDueDate.get(day.date) ?? []).map((taskId) => {
                          const task = taskById.get(taskId);

                          return task ? (
                            <span
                              className="calendar-panel__task"
                              key={taskId}
                              title={task.title}
                            >
                              {task.title}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/layout/panels/CalendarPanel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/layout/panels/CalendarPanel.tsx
git commit -m "Add CalendarPanel component"
```

---

### Task 3: Calendar panel styles

**Files:**
- Modify: `src/styles.css` (append at end of file, currently 12869 lines)

**Interfaces:**
- Consumes: existing CSS custom properties `--color-background-card`, `--color-background-card-hover`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-accent`, `--color-accent-soft`, `--radius-sm`, `--radius-lg` (all defined at the top of `src/styles.css`).
- Produces: `.calendar-panel`, `.calendar-panel__header`, `.calendar-panel__title`, `.calendar-panel__error`, `.calendar-panel__empty`, `.calendar-panel__grid`, `.calendar-panel__weekdays`, `.calendar-panel__weekday`, `.calendar-panel__week`, `.calendar-panel__day`, `.calendar-panel__day-number`, `.calendar-panel__day-tasks`, `.calendar-panel__task` class names, consumed by Task 2's JSX.

- [ ] **Step 1: Append calendar styles to `src/styles.css`**

Add at the end of the file:

```css
.calendar-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.calendar-panel__header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.calendar-panel__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  text-transform: capitalize;
}

.calendar-panel__error {
  color: #ef4444;
  margin: 0;
}

.calendar-panel__empty {
  color: var(--color-text-secondary);
  margin: 0;
}

.calendar-panel__grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.calendar-panel__weekdays,
.calendar-panel__week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-panel__weekday {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  padding-bottom: 4px;
}

.calendar-panel__day {
  min-height: 88px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background-card);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.calendar-panel__day[data-empty="true"] {
  background: transparent;
  border-color: transparent;
}

.calendar-panel__day-number {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.calendar-panel__day-tasks {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.calendar-panel__task {
  font-size: 0.72rem;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "Add calendar panel styles"
```

---

### Task 4: Sidebar nav button

**Files:**
- Modify: `src/layout/panels/SidebarPanel.tsx`

**Interfaces:**
- Consumes: `CalendarDays` icon already imported at `src/layout/panels/SidebarPanel.tsx:10`.
- Produces: new props `onOpenCalendar: () => void` and `isCalendarOpen: boolean` on `SidebarPanelProps`, consumed by Task 5.

- [ ] **Step 1: Add the two new props to `SidebarPanelProps`**

In `src/layout/panels/SidebarPanel.tsx`, find:

```typescript
  onOpenProjectsOverview: () => void;
  onOpenNotes: () => void;
```

Replace with:

```typescript
  onOpenProjectsOverview: () => void;
  onOpenCalendar: () => void;
  onOpenNotes: () => void;
```

Then find:

```typescript
  isWorkspaceHomeOpen: boolean;
  isTeamsOverviewOpen: boolean;
  isProjectsOverviewOpen: boolean;
  isNotesOpen: boolean;
  isProfileOpen: boolean;
```

Replace with:

```typescript
  isWorkspaceHomeOpen: boolean;
  isTeamsOverviewOpen: boolean;
  isProjectsOverviewOpen: boolean;
  isCalendarOpen: boolean;
  isNotesOpen: boolean;
  isProfileOpen: boolean;
```

- [ ] **Step 2: Destructure the new props in the component**

Find:

```typescript
  onOpenProjectsOverview,
  onOpenNotes,
```

Replace with:

```typescript
  onOpenProjectsOverview,
  onOpenCalendar,
  onOpenNotes,
```

Then find:

```typescript
  isWorkspaceHomeOpen,
  isTeamsOverviewOpen,
  isProjectsOverviewOpen,
  isNotesOpen,
  isProfileOpen,
```

Replace with:

```typescript
  isWorkspaceHomeOpen,
  isTeamsOverviewOpen,
  isProjectsOverviewOpen,
  isCalendarOpen,
  isNotesOpen,
  isProfileOpen,
```

- [ ] **Step 3: Add `isCalendarOpen` to the workspace-nav visibility conditions**

Find (the `data-selected`/`aria-selected` pair on the "Workspace" tab button):

```typescript
                  data-selected={isTeamWorkspace || isTeamsOverviewOpen || isProjectsOverviewOpen || isNotesOpen}
                  role="tab"
                  aria-selected={isTeamWorkspace || isTeamsOverviewOpen || isProjectsOverviewOpen || isNotesOpen}
```

Replace with:

```typescript
                  data-selected={isTeamWorkspace || isTeamsOverviewOpen || isProjectsOverviewOpen || isCalendarOpen || isNotesOpen}
                  role="tab"
                  aria-selected={isTeamWorkspace || isTeamsOverviewOpen || isProjectsOverviewOpen || isCalendarOpen || isNotesOpen}
```

Find:

```typescript
              {isTeamWorkspace || isWorkspaceHomeOpen || isTeamsOverviewOpen || isProjectsOverviewOpen || isNotesOpen ? (
```

Replace with:

```typescript
              {isTeamWorkspace || isWorkspaceHomeOpen || isTeamsOverviewOpen || isProjectsOverviewOpen || isCalendarOpen || isNotesOpen ? (
```

Find:

```typescript
            {!isTeamWorkspace && !isTeamsOverviewOpen && !isProjectsOverviewOpen && !isNotesOpen ? (
```

Replace with:

```typescript
            {!isTeamWorkspace && !isTeamsOverviewOpen && !isProjectsOverviewOpen && !isCalendarOpen && !isNotesOpen ? (
```

- [ ] **Step 4: Add the "Kalendář" nav button**

Find:

```tsx
                  <button
                    className="list-nav__item workspace-nav__item"
                    data-selected={isProjectsOverviewOpen}
                    type="button"
                    onClick={onOpenProjectsOverview}
                  >
                    <span className="list-nav__main">
                      <span className="workspace-nav__icon" aria-hidden="true">
                        <FolderKanban size={16} strokeWidth={1.9} />
                      </span>
                      <span className="list-nav__name">Nástěnky</span>
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
                    data-selected={isProjectsOverviewOpen}
                    type="button"
                    onClick={onOpenProjectsOverview}
                  >
                    <span className="list-nav__main">
                      <span className="workspace-nav__icon" aria-hidden="true">
                        <FolderKanban size={16} strokeWidth={1.9} />
                      </span>
                      <span className="list-nav__name">Nástěnky</span>
                    </span>
                  </button>
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

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `src/layout/AppShell.tsx` (missing new required props — that's expected, fixed in Task 5). No errors reported for `src/layout/panels/SidebarPanel.tsx` itself.

- [ ] **Step 6: Commit**

```bash
git add src/layout/panels/SidebarPanel.tsx
git commit -m "Add Kalendář nav button to sidebar"
```

---

### Task 5: Wire `CalendarPanel` into `AppShell`

**Files:**
- Modify: `src/layout/AppShell.tsx`

**Interfaces:**
- Consumes: `CalendarPanel` from `./panels/CalendarPanel` (Task 2), `onOpenCalendar`/`isCalendarOpen` props on `SidebarPanel` (Task 4), existing `teams: Team[]` and `allTasks: Task[]` already available in `AppShell`.

- [ ] **Step 1: Import `CalendarPanel`**

Find (near the top of `src/layout/AppShell.tsx`, alongside other panel imports — search for `NotesPanel` import):

```typescript
import { NotesPanel } from "./panels/NotesPanel";
```

Replace with:

```typescript
import { CalendarPanel } from "./panels/CalendarPanel";
import { NotesPanel } from "./panels/NotesPanel";
```

(If the existing import line differs slightly, add the `CalendarPanel` import line immediately above whichever line imports `NotesPanel`.)

- [ ] **Step 2: Add `isCalendarOpen` state**

Find:

```typescript
  const [isProjectsOverviewOpen, setIsProjectsOverviewOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
```

Replace with:

```typescript
  const [isProjectsOverviewOpen, setIsProjectsOverviewOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
```

- [ ] **Step 3: Include `isCalendarOpen` in the overlay-layout check**

Find:

```typescript
    isListSlotOverlayOpen:
      isWorkspaceHomeOpen ||
      isTeamsOverviewOpen ||
      isProjectsOverviewOpen ||
      isNotesOpen ||
      isProfileOpen,
```

Replace with:

```typescript
    isListSlotOverlayOpen:
      isWorkspaceHomeOpen ||
      isTeamsOverviewOpen ||
      isProjectsOverviewOpen ||
      isCalendarOpen ||
      isNotesOpen ||
      isProfileOpen,
```

- [ ] **Step 4: Update all `handleOpenX` functions to close the calendar panel, and add `handleOpenCalendar`**

Find this entire block:

```typescript
  function handleOpenWorkspaceHome() {
    if (!activeTeamId) {
      return;
    }

    onClearTaskSelection();
    setIsWorkspaceHomeOpen(true);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
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
    setIsNotesOpen(false);
    setIsProfileOpen(false);
    setOpenProjectRequestId(projectId ?? null);
    setOpenTaskCardRequestId(taskId ?? null);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenNotes(noteId?: string) {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
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
    setIsNotesOpen(false);
    setIsProfileOpen(true);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenTeamCreateFlow() {
    setIsWorkspaceHomeOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsTeamsOverviewOpen(true);
    setIsNotesOpen(false);
    setIsProfileOpen(false);
    setTeamCreateRequestToken((currentValue) => currentValue + 1);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenProjectCreateFlow() {
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(true);
    setIsNotesOpen(false);
    setIsProfileOpen(false);
    setProjectCreateRequestToken((currentValue) => currentValue + 1);

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

  function handleOpenTeamCreateFlow() {
    setIsWorkspaceHomeOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsTeamsOverviewOpen(true);
    setIsCalendarOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(false);
    setTeamCreateRequestToken((currentValue) => currentValue + 1);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenProjectCreateFlow() {
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(true);
    setIsCalendarOpen(false);
    setIsNotesOpen(false);
    setIsProfileOpen(false);
    setProjectCreateRequestToken((currentValue) => currentValue + 1);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }
```

- [ ] **Step 5: Pass the new props to `SidebarPanel`**

Find:

```typescript
        onOpenProjectsOverview={handleOpenProjectsOverview}
        onOpenNotes={() => handleOpenNotes()}
```

Replace with:

```typescript
        onOpenProjectsOverview={handleOpenProjectsOverview}
        onOpenCalendar={handleOpenCalendar}
        onOpenNotes={() => handleOpenNotes()}
```

Find:

```typescript
        isProjectsOverviewOpen={isProjectsOverviewOpen}
        isNotesOpen={isNotesOpen}
```

Replace with:

```typescript
        isProjectsOverviewOpen={isProjectsOverviewOpen}
        isCalendarOpen={isCalendarOpen}
        isNotesOpen={isNotesOpen}
```

- [ ] **Step 6: Render `CalendarPanel` in the main panel switch**

Find:

```tsx
          ) : isProjectsOverviewOpen ? (
            <ProjectsOverviewPanel
```

Replace with:

```tsx
          ) : isCalendarOpen ? (
            <CalendarPanel teams={teams} tasks={allTasks} />
          ) : isProjectsOverviewOpen ? (
            <ProjectsOverviewPanel
```

- [ ] **Step 7: Exclude the detail panel while the calendar is open**

Find:

```tsx
        {!isWorkspaceHomeOpen && !isTeamsOverviewOpen && !isProjectsOverviewOpen && !isNotesOpen && !isProfileOpen && isPanelVisible(layout.visiblePanels, "detail") ? (
```

Replace with:

```tsx
        {!isWorkspaceHomeOpen && !isTeamsOverviewOpen && !isProjectsOverviewOpen && !isCalendarOpen && !isNotesOpen && !isProfileOpen && isPanelVisible(layout.visiblePanels, "detail") ? (
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/layout/AppShell.tsx
git commit -m "Wire CalendarPanel into AppShell"
```

---

### Task 6: Manual verification in the running app

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the app in the browser and log in / load an existing workspace with at least one project that has tasks due in the current month**

- [ ] **Step 3: Click "Kalendář" in the sidebar**

Expected: panel opens, dropdown shows "Vyber nástěnku", month grid is not shown yet, empty-state text "Vyber nástěnku pro zobrazení úkolů." is visible.

- [ ] **Step 4: Select a project from the dropdown**

Expected: current month grid renders (correct number of days, correct weekday header alignment for the 1st of the month), and any task in that project whose `dueDate` falls in the current month appears as a small label on the correct day cell.

- [ ] **Step 5: Select a different project with no tasks due this month**

Expected: grid still renders, no task labels appear, no crash.

- [ ] **Step 6: Switch to another sidebar item (e.g. "Nástěnky") and back to "Kalendář"**

Expected: the previously selected project resets to none (per the empty-state-on-reopen behavior in `handleOpenCalendar`), no leftover selection bugs.

- [ ] **Step 7: Run the production build to confirm no build-time errors**

Run: `npm run build`
Expected: build completes successfully (the pre-existing warning about a >500kB main chunk is expected and not a new failure).
