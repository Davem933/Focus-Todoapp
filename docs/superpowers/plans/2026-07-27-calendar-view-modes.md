# Calendar View Modes (Day / 4 Days / Week / Month) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Den/4 dny/Týden/Měsíc view switcher to the calendar, where Day/4-day/Week share one hourly-timeline layout parameterized by day count, and Month keeps its existing mosaic grid unchanged.

**Architecture:** New pure date-range/weekday utilities in `src/calendar/calendarUtils.ts` (additive only — existing exports are untouched). `CalendarPanel.tsx` gains a `viewMode` state and an `anchorDate` state; navigation (prev/next/today) branches on `viewMode` between the existing month-shift logic and a new day-shift logic. A new render branch shows a 24-hour grid (one column per visible day, an all-day row above it) when `viewMode !== "month"`, reusing the existing task-composer modal and creation/edit handlers already wired for the month view.

**Tech Stack:** React 19 + TypeScript, no test framework in this repo (confirmed — no test script, no `*.test.*`/`*.spec.*` files, per `CLAUDE.md`).

## Global Constraints

- Keep every file under 500 lines (project `CLAUDE.md` rule). `CalendarPanel.tsx` will grow substantially in this plan — check its line count after Task 2 and flag if it approaches 500 (see Task 2's self-review note).
- Never create files unless necessary; never save working/test files to repo root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts` (project `CLAUDE.md` rule).
- No `Co-Authored-By` trailer on commits (project `CLAUDE.md` rule).
- No automated test framework — verify pure functions via a throwaway Node script run with `node --experimental-strip-types`, deleted before committing (not committed, per this repo's established convention from prior calendar work).
- Timed tasks have no real duration field (`Task.dueTime: string | null` only, no end time) — every timed task renders as a fixed 30-minute-tall visual block. This is explicit, accepted scope from the design spec — do not add a duration field.
- Follow existing Czech-language UI copy conventions — all user-facing strings in this app are Czech.
- Do not touch `src/layout/AppShell.tsx` mojibake / mangled Czech strings unrelated to this feature (documented gotcha in project `CLAUDE.md`).
- **This repository currently has unrelated in-progress, uncommitted changes in other files from a separate concurrent work session** (as of this plan's writing: `src/App.tsx`, `src/layout/AppShell.tsx`, `src/layout/panels/SidebarPanel.tsx`, `src/supabase/AuthWidget.tsx`, `mcp-server/*`, `package.json`, a deleted `src/layout/panels/TableViewPanel.tsx`). **This plan's tasks only touch `src/calendar/calendarUtils.ts` and `src/layout/panels/CalendarPanel.tsx` (plus `src/styles.css`, isolated to calendar-panel rules) — never stage or commit any other file, even if `git status` shows it modified.** When committing, use `git add <exact files from this plan>` — never `git add -A` or `git add .`. If `styles.css` shows unrelated changes mixed in at commit time, isolate your own hunks the same way prior calendar work in this repo did (extract a clean copy of the file from `HEAD`, apply only your CSS additions to that clean copy, diff it against `HEAD` to get an isolated patch, and `git apply --cached` that patch — never commit the working-tree version of a shared file directly).

---

### Task 1: Date-range and weekday utilities

**Files:**
- Modify: `src/calendar/calendarUtils.ts` (append new exports; do not change any existing function)

**Interfaces:**
- Consumes: nothing new (uses the file's existing private `formatDate` helper already defined in this file).
- Produces (used by Task 2):
  - `CZECH_WEEKDAY_FULL_NAMES: string[]` — 7 entries, Monday-first, full Czech weekday names.
  - `shiftDate(date: string, days: number): string` — returns the `"YYYY-MM-DD"` date `days` days after `date` (negative shifts backward), correctly rolling over month/year boundaries.
  - `getDateRange(anchorDate: string, days: number): string[]` — returns `days` consecutive `"YYYY-MM-DD"` strings starting at `anchorDate` (inclusive).
  - `getWeekdayIndex(date: string): number` — returns 0–6, Monday-first, for the given date.
  - `getWeekdayFullName(date: string): string` — returns the full Czech weekday name for the given date (looks up `CZECH_WEEKDAY_FULL_NAMES[getWeekdayIndex(date)]`).

- [ ] **Step 1: Append the new exports to `src/calendar/calendarUtils.ts`**

Find the existing `getAdjacentYearMonth` function (it ends right before `function formatDate(date: Date): string {`):

```typescript
export function getAdjacentYearMonth(
  year: number,
  month: number,
  delta: -1 | 1,
): { year: number; month: number } {
  const shifted = new Date(year, month - 1 + delta, 1);

  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 };
}
```

Immediately after it (and before `function formatDate`), insert:

```typescript
export const CZECH_WEEKDAY_FULL_NAMES = [
  "pondělí",
  "úterý",
  "středa",
  "čtvrtek",
  "pátek",
  "sobota",
  "neděle",
];

export function getWeekdayIndex(date: string): number {
  const [year, month, day] = date.split("-").map(Number);

  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

export function getWeekdayFullName(date: string): string {
  return CZECH_WEEKDAY_FULL_NAMES[getWeekdayIndex(date)];
}
```

Then find the end of `groupTaskIdsByDueDate` (the very last function in the file, ending with the file's final `}`), and append after it:

```typescript

export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(year, month - 1, day + days);

  return formatDate(shifted);
}

export function getDateRange(anchorDate: string, days: number): string[] {
  const dates: string[] = [];

  for (let i = 0; i < days; i += 1) {
    dates.push(shiftDate(anchorDate, i));
  }

  return dates;
}
```

(`shiftDate` and `getDateRange` are placed at the end of the file, after `groupTaskIdsByDueDate`, simply because that's the current end of the file — there's no ordering requirement between them and the other functions, since `shiftDate` only calls the file's private `formatDate` helper, which is already defined near the top of the file and visible throughout.)

- [ ] **Step 2: Write the throwaway verification script**

Create `tests/verify-calendar-view-utils.mjs`:

```javascript
import assert from "node:assert/strict";
import {
  CZECH_WEEKDAY_FULL_NAMES,
  getDateRange,
  getWeekdayFullName,
  getWeekdayIndex,
  shiftDate,
} from "../src/calendar/calendarUtils.ts";

assert.equal(CZECH_WEEKDAY_FULL_NAMES.length, 7);
assert.equal(CZECH_WEEKDAY_FULL_NAMES[0], "pondělí");
assert.equal(CZECH_WEEKDAY_FULL_NAMES[6], "neděle");

// 2026-07-22 is a Wednesday (index 2, Monday-first).
assert.equal(getWeekdayIndex("2026-07-22"), 2);
assert.equal(getWeekdayFullName("2026-07-22"), "středa");
// 2026-07-27 is a Monday (index 0).
assert.equal(getWeekdayIndex("2026-07-27"), 0);
assert.equal(getWeekdayFullName("2026-07-27"), "pondělí");

assert.equal(shiftDate("2026-07-22", 1), "2026-07-23");
assert.equal(shiftDate("2026-07-31", 1), "2026-08-01");
assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
assert.equal(shiftDate("2026-07-22", -7), "2026-07-15");

const week = getDateRange("2026-07-22", 7);
assert.deepEqual(week, [
  "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25",
  "2026-07-26", "2026-07-27", "2026-07-28",
]);

const fourDaysAcrossMonthBoundary = getDateRange("2026-07-30", 4);
assert.deepEqual(fourDaysAcrossMonthBoundary, [
  "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02",
]);

const singleDay = getDateRange("2026-07-22", 1);
assert.deepEqual(singleDay, ["2026-07-22"]);

console.log("All view-mode date utility checks passed.");
```

- [ ] **Step 3: Run the verification script**

Run: `node --experimental-strip-types tests/verify-calendar-view-utils.mjs`
Expected output: `All view-mode date utility checks passed.` with no assertion errors.

- [ ] **Step 4: Delete the throwaway script (not committed)**

```bash
rm tests/verify-calendar-view-utils.mjs
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/calendar/calendarUtils.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/calendar/calendarUtils.ts
git commit -m "Add date-range and weekday utilities for calendar view modes"
```

---

### Task 2: View-mode switcher, navigation, and hourly grid

**Files:**
- Modify: `src/layout/panels/CalendarPanel.tsx` (replace the entire file with the content below)

**Interfaces:**
- Consumes: `getDateRange`, `getWeekdayFullName`, `getWeekdayIndex`, `shiftDate`, `CZECH_WEEKDAY_FULL_NAMES` from Task 1's `src/calendar/calendarUtils.ts` additions; all other imports are already present in the current file (see the full replacement below for the exact import list).
- Produces: no new external interface — `CalendarPanel`'s props (`teams`, `tasks`, `onCreateTask`, `onUpdateTask`) are unchanged. Internally introduces `viewMode: "day" | "4day" | "week" | "month"` and `anchorDate: string` state, and a `cardComposerDueTime` composer field, none of which are consumed outside this component.
- Task 3 (CSS) needs these exact class names, introduced by this task's JSX: `.calendar-panel__view-dropdown` (passed as the `className` prop to the view-mode `CustomDropdown`), `.calendar-panel__hourly-grid`, `.calendar-panel__hourly-day-headers`, `.calendar-panel__hourly-time-gutter`, `.calendar-panel__hourly-day-header`, `.calendar-panel__all-day-row`, `.calendar-panel__all-day-cell`, `.calendar-panel__hourly-body`, `.calendar-panel__hour-row`, `.calendar-panel__hour-label`, `.calendar-panel__hour-cell`, `.calendar-panel__hour-add-button`, `.calendar-panel__timed-task`.

- [ ] **Step 1: Replace the full content of `src/layout/panels/CalendarPanel.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Filter, Plus, X } from "lucide-react";
import { CustomDropdown } from "../CustomDropdown";
import type { DropdownOption } from "../CustomDropdown";
import { ProjectCardComposerModal } from "../ProjectCardComposerModal";
import { loadProjectColumns, loadProjectsForTeams } from "../../supabase/projectApi";
import { loadTeamMembers } from "../../supabase/teamApi";
import type { Project, ProjectColumn } from "../../projects/projectTypes";
import { toggleFilterValue } from "../../projects/projectBoardPreferences";
import { getMemberDisplayName } from "../../teams/teamMemberDisplay";
import type { Team, TeamMember } from "../../teams/teamTypes";
import type { Task, TaskPriority, TaskSubtask, TaskUpdate } from "../../tasks/taskTypes";
import { getTodayDateValue } from "../../tasks/dateUtils";
import { createEntityId } from "../../tasks/idUtils";
import { appendCardLabelValue, createCardLabels } from "../../tasks/cardLabels";
import {
  BOARD_CARD_PRIORITY_LABELS,
  BOARD_CARD_PRIORITY_OPTIONS,
  TASK_PRIORITY_COLORS as BOARD_CARD_PRIORITY_COLORS,
} from "../../tasks/taskPriorityColors";
import {
  CZECH_MONTH_NAMES,
  CZECH_WEEKDAY_LABELS,
  getAdjacentYearMonth,
  getCurrentYearMonth,
  getDateRange,
  getMonthMatrix,
  getWeekdayFullName,
  getWeekdayIndex,
  groupTaskIdsByDueDate,
  shiftDate,
} from "../../calendar/calendarUtils";

type CalendarViewMode = "day" | "4day" | "week" | "month";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const VIEW_MODE_DAY_COUNTS: Record<Exclude<CalendarViewMode, "month">, number> = {
  day: 1,
  "4day": 4,
  week: 7,
};

const VIEW_MODE_OPTIONS: DropdownOption[] = [
  { value: "day", label: "Den" },
  { value: "4day", label: "4 dny" },
  { value: "week", label: "Týden" },
  { value: "month", label: "Měsíc" },
];

type CalendarPanelProps = {
  teams: Team[];
  tasks: Task[];
  onCreateTask: (title: string, options?: TaskUpdate) => string | null;
  onUpdateTask: (taskId: string, update: TaskUpdate) => void;
};

export function CalendarPanel({ teams, tasks, onCreateTask, onUpdateTask }: CalendarPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [{ year, month }, setYearMonth] = useState(() => getCurrentYearMonth());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => getTodayDateValue());

  const [projectMembers, setProjectMembers] = useState<TeamMember[]>([]);
  const [projectColumns, setProjectColumns] = useState<ProjectColumn[]>([]);
  const [cardComposerTaskId, setCardComposerTaskId] = useState<string | null>(null);
  const [cardComposerColumnKey, setCardComposerColumnKey] = useState<Task["boardColumnKey"] | null>(null);
  const [cardComposerTitle, setCardComposerTitle] = useState("");
  const [cardComposerNote, setCardComposerNote] = useState("");
  const [cardComposerPriority, setCardComposerPriority] = useState<TaskPriority>("none");
  const [cardComposerDueDate, setCardComposerDueDate] = useState("");
  const [cardComposerDueTime, setCardComposerDueTime] = useState("");
  const [cardComposerLabels, setCardComposerLabels] = useState("");
  const [cardComposerLabelInput, setCardComposerLabelInput] = useState("");
  const [cardComposerAssigneeId, setCardComposerAssigneeId] = useState("");
  const [cardComposerSubtaskTitle, setCardComposerSubtaskTitle] = useState("");
  const [cardComposerSubtasks, setCardComposerSubtasks] = useState<TaskSubtask[]>([]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAssigneeIds, setFilterAssigneeIds] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<TaskPriority[]>([]);
  const [showCompletedTasks, setShowCompletedTasks] = useState(true);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const hourlyBodyRef = useRef<HTMLDivElement | null>(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

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

  function goToPrevious() {
    if (viewMode === "month") {
      setYearMonth((current) => getAdjacentYearMonth(current.year, current.month, -1));
      return;
    }

    setAnchorDate((current) => shiftDate(current, -VIEW_MODE_DAY_COUNTS[viewMode]));
  }

  function goToNext() {
    if (viewMode === "month") {
      setYearMonth((current) => getAdjacentYearMonth(current.year, current.month, 1));
      return;
    }

    setAnchorDate((current) => shiftDate(current, VIEW_MODE_DAY_COUNTS[viewMode]));
  }

  function goToToday() {
    setYearMonth(getCurrentYearMonth());
    setAnchorDate(getTodayDateValue());
  }

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

  useEffect(() => {
    let isCancelled = false;

    if (!selectedProject) {
      setProjectMembers([]);
      setProjectColumns([]);
      return;
    }

    const project = selectedProject;

    async function loadProjectExtras() {
      try {
        const [members, columns] = await Promise.all([
          loadTeamMembers(project.teamId),
          loadProjectColumns(project.id),
        ]);

        if (!isCancelled) {
          setProjectMembers(members);
          setProjectColumns(columns);
        }
      } catch {
        if (!isCancelled) {
          setProjectMembers([]);
          setProjectColumns([]);
        }
      }
    }

    void loadProjectExtras();

    return () => {
      isCancelled = true;
    };
  }, [selectedProject]);

  const dropdownOptions: DropdownOption[] = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const today = getTodayDateValue();

  const visibleDays = useMemo(() => {
    if (viewMode === "month") {
      return [];
    }

    return getDateRange(anchorDate, VIEW_MODE_DAY_COUNTS[viewMode]);
  }, [viewMode, anchorDate]);

  const headerTitle = useMemo(() => {
    if (viewMode === "month") {
      return `${CZECH_MONTH_NAMES[month - 1]} ${year}`;
    }

    const firstDay = visibleDays[0];
    const lastDay = visibleDays[visibleDays.length - 1];
    const [firstYear, firstMonthStr, firstDayStr] = firstDay.split("-");
    const [lastYear, lastMonthStr, lastDayStr] = lastDay.split("-");

    if (viewMode === "day") {
      return `${getWeekdayFullName(firstDay)} ${Number(firstDayStr)}. ${CZECH_MONTH_NAMES[Number(firstMonthStr) - 1]} ${firstYear}`;
    }

    return `${Number(firstDayStr)}. – ${Number(lastDayStr)}. ${CZECH_MONTH_NAMES[Number(lastMonthStr) - 1]} ${lastYear}`;
  }, [viewMode, year, month, visibleDays]);

  useEffect(() => {
    if (viewMode === "month" || !hourlyBodyRef.current) {
      return;
    }

    const scrollToHour = visibleDays.includes(today) ? new Date().getHours() : 8;
    const rowHeight = hourlyBodyRef.current.scrollHeight / HOURS.length;

    hourlyBodyRef.current.scrollTop = Math.max(0, (scrollToHour - 1) * rowHeight);
  }, [viewMode, anchorDate, visibleDays, today]);

  const filteredProjectTasks = useMemo(() => {
    if (!selectedProjectId) {
      return [];
    }

    return tasks.filter((task) => {
      if (task.projectId !== selectedProjectId) {
        return false;
      }

      if (!showCompletedTasks && task.completed) {
        return false;
      }

      if (
        filterAssigneeIds.length > 0 &&
        (!task.assigneeId || !filterAssigneeIds.includes(task.assigneeId))
      ) {
        return false;
      }

      if (filterPriorities.length > 0 && !filterPriorities.includes(task.priority)) {
        return false;
      }

      return true;
    });
  }, [tasks, selectedProjectId, filterAssigneeIds, filterPriorities, showCompletedTasks]);

  const taskIdsByDueDate = useMemo(
    () => groupTaskIdsByDueDate(filteredProjectTasks),
    [filteredProjectTasks],
  );

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const composerColumn = projectColumns.find((column) => column.key === cardComposerColumnKey) ?? null;
  const activeFilterCount =
    filterAssigneeIds.length + filterPriorities.length + (showCompletedTasks ? 0 : 1);

  function getTasksForDate(date: string) {
    return filteredProjectTasks.filter((task) => task.dueDate === date);
  }

  function handleClearFilters() {
    setFilterAssigneeIds([]);
    setFilterPriorities([]);
    setShowCompletedTasks(true);
  }

  function resetCardComposer() {
    setCardComposerTaskId(null);
    setCardComposerColumnKey(null);
    setCardComposerTitle("");
    setCardComposerNote("");
    setCardComposerPriority("none");
    setCardComposerDueDate("");
    setCardComposerDueTime("");
    setCardComposerLabels("");
    setCardComposerLabelInput("");
    setCardComposerAssigneeId("");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks([]);
  }

  function handleOpenTask(taskId: string) {
    const task = taskById.get(taskId);

    if (!task) {
      return;
    }

    setCardComposerTaskId(task.id);
    setCardComposerColumnKey(task.boardColumnKey);
    setCardComposerTitle(task.title);
    setCardComposerNote(task.note);
    setCardComposerPriority(task.priority);
    setCardComposerDueDate(task.dueDate ?? "");
    setCardComposerDueTime(task.dueTime ?? "");
    setCardComposerLabels(task.labels.map((label) => label.name).join(", "));
    setCardComposerAssigneeId(task.assigneeId ?? "");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks(task.subtasks.map((subtask) => ({ ...subtask })));
  }

  function handleAddTask(date: string, dueTime?: string) {
    if (projectColumns.length === 0) {
      return;
    }

    setCardComposerTaskId(null);
    setCardComposerColumnKey(projectColumns[0].key);
    setCardComposerTitle("");
    setCardComposerNote("");
    setCardComposerPriority("none");
    setCardComposerDueDate(date);
    setCardComposerDueTime(dueTime ?? "");
    setCardComposerLabels("");
    setCardComposerLabelInput("");
    setCardComposerAssigneeId("");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks([]);
  }

  function handleAddTaskAtHour(date: string, hour: number) {
    handleAddTask(date, `${String(hour).padStart(2, "0")}:00`);
  }

  function handleAddComposerSubtask() {
    const title = cardComposerSubtaskTitle.trim();

    if (!title) {
      return;
    }

    setCardComposerSubtasks((current) => [
      ...current,
      { id: createEntityId(), title, completed: false },
    ]);
    setCardComposerSubtaskTitle("");
  }

  function handleToggleComposerSubtask(subtaskId: string) {
    setCardComposerSubtasks((current) =>
      current.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask,
      ),
    );
  }

  function handleAddComposerLabel(rawValue: string) {
    setCardComposerLabels(appendCardLabelValue(cardComposerLabels, rawValue));
    setCardComposerLabelInput("");
  }

  function handleSubmitComposer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject || !cardComposerColumnKey || !cardComposerTitle.trim()) {
      return;
    }

    const update: TaskUpdate = {
      assigneeId: cardComposerAssigneeId || null,
      boardColumnKey: cardComposerColumnKey,
      dueDate: cardComposerDueDate || null,
      dueTime: cardComposerDueTime || null,
      labels: createCardLabels(cardComposerLabels),
      note: cardComposerNote,
      priority: cardComposerPriority,
      projectId: selectedProject.id,
      subtasks: cardComposerSubtasks,
      teamId: selectedProject.teamId,
      title: cardComposerTitle,
    };

    if (cardComposerTaskId) {
      onUpdateTask(cardComposerTaskId, update);
      resetCardComposer();
      return;
    }

    const createdTaskId = onCreateTask(cardComposerTitle, update);

    if (createdTaskId) {
      resetCardComposer();
    }
  }

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
                {projectMembers.length === 0 ? (
                  <p className="project-detail__filter-empty">Nástěnka nemá žádné členy.</p>
                ) : (
                  projectMembers.map((member) => (
                    <label className="project-detail__filter-option" key={member.userId}>
                      <input
                        type="checkbox"
                        checked={filterAssigneeIds.includes(member.userId)}
                        onChange={() =>
                          setFilterAssigneeIds((current) => toggleFilterValue(current, member.userId))
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
                      checked={filterPriorities.includes(priorityOption)}
                      onChange={() =>
                        setFilterPriorities((current) => toggleFilterValue(current, priorityOption))
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
                <span>Stav</span>
                <label className="project-detail__filter-option">
                  <input
                    type="checkbox"
                    checked={showCompletedTasks}
                    onChange={() => setShowCompletedTasks((current) => !current)}
                  />
                  <span>Zobrazit dokončené úkoly</span>
                </label>
              </div>
            </div>
          ) : null}
        </div>
        <div className="calendar-panel__nav">
          <CustomDropdown
            className="calendar-panel__view-dropdown"
            value={viewMode}
            options={VIEW_MODE_OPTIONS}
            onChange={(value) => setViewMode(value as CalendarViewMode)}
            ariaLabel="Vyber zobrazení kalendáře"
          />
          <button
            className="calendar-panel__nav-button"
            type="button"
            aria-label="Předchozí"
            onClick={goToPrevious}
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <h2 className="calendar-panel__title">{headerTitle}</h2>
          <button
            className="calendar-panel__nav-button"
            type="button"
            aria-label="Následující"
            onClick={goToNext}
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
          <button className="calendar-panel__today-button" type="button" onClick={goToToday}>
            Dnes
          </button>
        </div>
      </header>

      {error ? <p className="calendar-panel__error">{error}</p> : null}

      {!selectedProjectId ? (
        <p className="calendar-panel__empty">Vyber nástěnku pro zobrazení úkolů.</p>
      ) : viewMode === "month" ? (
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
              {week.map((day) => (
                <div
                  className="calendar-panel__day"
                  key={day.date}
                  data-today={day.date === today ? "true" : "false"}
                >
                  <div className="calendar-panel__day-header">
                    <span className="calendar-panel__day-number">{day.dayOfMonth}</span>
                    <button
                      className="calendar-panel__day-add-button"
                      type="button"
                      aria-label={"Přidat úkol na den " + day.dayOfMonth}
                      onClick={() => handleAddTask(day.date)}
                      disabled={projectColumns.length === 0}
                    >
                      <Plus size={12} strokeWidth={2.4} />
                    </button>
                  </div>
                  <div className="calendar-panel__day-tasks">
                    {(taskIdsByDueDate.get(day.date) ?? []).map((taskId) => {
                      const task = taskById.get(taskId);

                      return task ? (
                        <button
                          className="calendar-panel__task"
                          key={taskId}
                          type="button"
                          title={task.title}
                          onClick={() => handleOpenTask(taskId)}
                        >
                          {task.title}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="calendar-panel__hourly-grid">
          <div className="calendar-panel__hourly-day-headers">
            <div className="calendar-panel__hourly-time-gutter" />
            {visibleDays.map((day) => (
              <div
                className="calendar-panel__hourly-day-header"
                key={day}
                data-today={day === today ? "true" : "false"}
              >
                <span>{CZECH_WEEKDAY_LABELS[getWeekdayIndex(day)]}</span>
                <span>{Number(day.split("-")[2])}</span>
              </div>
            ))}
          </div>
          <div className="calendar-panel__all-day-row">
            <div className="calendar-panel__hourly-time-gutter">Celý den</div>
            {visibleDays.map((day) => (
              <div className="calendar-panel__all-day-cell" key={day}>
                {getTasksForDate(day)
                  .filter((task) => !task.dueTime)
                  .map((task) => (
                    <button
                      className="calendar-panel__task"
                      key={task.id}
                      type="button"
                      title={task.title}
                      onClick={() => handleOpenTask(task.id)}
                    >
                      {task.title}
                    </button>
                  ))}
              </div>
            ))}
          </div>
          <div className="calendar-panel__hourly-body" ref={hourlyBodyRef}>
            {HOURS.map((hour) => (
              <div className="calendar-panel__hour-row" key={hour}>
                <div className="calendar-panel__hour-label">{String(hour).padStart(2, "0")}:00</div>
                {visibleDays.map((day) => {
                  const hourTasks = getTasksForDate(day).filter(
                    (task) => task.dueTime && Number(task.dueTime.split(":")[0]) === hour,
                  );

                  return (
                    <div className="calendar-panel__hour-cell" key={day}>
                      <button
                        className="calendar-panel__hour-add-button"
                        type="button"
                        aria-label={`Přidat úkol na ${day} v ${String(hour).padStart(2, "0")}:00`}
                        onClick={() => handleAddTaskAtHour(day, hour)}
                        disabled={projectColumns.length === 0}
                      >
                        <Plus size={10} strokeWidth={2.4} />
                      </button>
                      {hourTasks.map((task) => (
                        <button
                          className="calendar-panel__timed-task"
                          key={task.id}
                          type="button"
                          title={task.title}
                          onClick={() => handleOpenTask(task.id)}
                        >
                          {task.title}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {cardComposerColumnKey && selectedProject ? (
          <ProjectCardComposerModal
            actionLabel={cardComposerTaskId ? "Uložit kartu" : "Přidat kartu"}
            assigneeId={cardComposerAssigneeId}
            columnTitle={composerColumn?.title ?? "Sloupec"}
            dueDate={cardComposerDueDate}
            labelInput={cardComposerLabelInput}
            labels={cardComposerLabels}
            isEditing={Boolean(cardComposerTaskId)}
            members={projectMembers}
            note={cardComposerNote}
            priority={cardComposerPriority}
            projectName={selectedProject.name}
            subtaskTitle={cardComposerSubtaskTitle}
            subtasks={cardComposerSubtasks}
            title={cardComposerTitle}
            onAddSubtask={handleAddComposerSubtask}
            onAssigneeChange={setCardComposerAssigneeId}
            onClose={resetCardComposer}
            onDueDateChange={setCardComposerDueDate}
            onLabelInputChange={setCardComposerLabelInput}
            onAddLabel={handleAddComposerLabel}
            onLabelsChange={setCardComposerLabels}
            onNoteChange={setCardComposerNote}
            onPriorityChange={setCardComposerPriority}
            onSubtaskTitleChange={setCardComposerSubtaskTitle}
            onSubmit={handleSubmitComposer}
            onToggleSubtask={handleToggleComposerSubtask}
            onTitleChange={setCardComposerTitle}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
```

Note: `ProjectCardComposerModal` has no `dueTime` prop — it was not designed to edit time-of-day (see the design spec's explicit note on this). `cardComposerDueTime` is tracked and submitted, but not surfaced in the modal's UI in this plan. This matches the spec: "due-time is set programmatically (from the clicked hour) but not editable inside the modal."

- [ ] **Step 2: Check the file's line count against the 500-line constraint**

Run: `wc -l src/layout/panels/CalendarPanel.tsx`

If it's at or near 500 lines, note this as a concern in your report (see Report Format) rather than splitting the file — a mid-plan file split isn't part of this task's scope, but the controller should know.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/layout/panels/CalendarPanel.tsx` or `src/calendar/calendarUtils.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/layout/panels/CalendarPanel.tsx
git commit -m "Add Day/4-day/Week hourly view modes to calendar"
```

If `git status` shows other modified files (from the unrelated concurrent work noted in Global Constraints), do not add them — `git add` only the exact path above.

---

### Task 3: Hourly grid and view-dropdown styles

**Files:**
- Modify: `src/styles.css` (append new rules; see the Global Constraints note on isolating this file's diff from unrelated concurrent changes before committing)

**Interfaces:**
- Consumes: existing CSS custom properties already used elsewhere in this file: `--color-background-card`, `--color-background-card-hover`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-accent`, `--color-accent-soft`, `--radius-sm`.
- Produces: styles for every class name Task 2 introduced (listed in Task 2's Interfaces section), consumed by that task's JSX.

- [ ] **Step 1: Append the new CSS rules to `src/styles.css`**

Add at the end of the file:

```css
.calendar-panel__view-dropdown {
  min-width: 110px;
}

.calendar-panel__hourly-grid {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.calendar-panel__hourly-time-gutter {
  width: 64px;
  flex-shrink: 0;
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  padding: 6px 8px;
}

.calendar-panel__hourly-day-headers {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-card);
}

.calendar-panel__hourly-day-header {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.calendar-panel__hourly-day-header[data-today="true"] {
  color: var(--color-accent);
}

.calendar-panel__all-day-row {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  min-height: 32px;
}

.calendar-panel__all-day-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border-left: 1px solid var(--color-border);
}

.calendar-panel__all-day-cell:first-child {
  border-left: none;
}

.calendar-panel__hourly-body {
  max-height: 480px;
  overflow-y: auto;
}

.calendar-panel__hour-row {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  min-height: 48px;
}

.calendar-panel__hour-label {
  width: 64px;
  flex-shrink: 0;
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  padding: 4px 8px;
}

.calendar-panel__hour-cell {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px;
  border-left: 1px solid var(--color-border);
}

.calendar-panel__hour-cell:hover {
  background: var(--color-background-card-hover);
}

.calendar-panel__hour-cell:first-of-type {
  border-left: none;
}

.calendar-panel__hour-add-button {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  opacity: 0;
  transition: var(--transition-fast);
}

.calendar-panel__hour-cell:hover .calendar-panel__hour-add-button,
.calendar-panel__hour-add-button:focus-visible {
  opacity: 1;
}

.calendar-panel__hour-add-button:hover {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.calendar-panel__timed-task {
  display: block;
  width: 100%;
  min-height: 30px;
  font-size: 0.72rem;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border: none;
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  white-space: nowrap;
}

.calendar-panel__timed-task:hover {
  background: var(--color-accent);
  color: #fff;
}
```

- [ ] **Step 2: Isolate and commit**

Check whether `src/styles.css` has unrelated uncommitted changes mixed in from the concurrent work session noted in Global Constraints:

Run: `git diff --stat src/styles.css`

If the diff is larger than just this task's additions, isolate your hunk before committing:

```bash
git show HEAD:src/styles.css > /tmp/styles_head.css
```

Then manually apply only the CSS block above to a copy of that clean file (append it at the end), diff the clean-plus-your-change copy against `/tmp/styles_head.css`, turn that diff into a patch with `--- a/src/styles.css` / `+++ b/src/styles.css` headers, and stage it with `git apply --cached <patch>` — never `git add src/styles.css` directly if the working-tree file has unrelated changes mixed in. Verify with `git diff --cached src/styles.css` that only your intended lines are staged, and verify with `git diff src/styles.css` (unstaged) that the concurrent session's other changes are still present and untouched in the working tree.

If `git diff --stat src/styles.css` shows ONLY your additions (no unrelated changes present), a plain `git add src/styles.css` is fine.

```bash
git commit -m "Add styles for calendar hourly view modes"
```

---

### Task 4: Manual verification in the running app

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the app, log in, navigate to Kalendář, and select a project that has at least one task with a `dueDate` in the current week and, ideally, one task with both `dueDate` and `dueTime` set**

- [ ] **Step 3: Confirm the view-mode dropdown defaults to "Měsíc" and the month grid looks unchanged from before this plan**

- [ ] **Step 4: Switch to "Týden"**

Expected: a 7-day hourly grid appears, with day headers (weekday + day number) for the 7 days containing today, a "Celý den" row above the hour grid, and 24 hour rows below. Any task due within that week with no `dueTime` appears in the all-day row under its day; any task with a `dueTime` appears in the correct hour row under its day. The grid should also auto-scroll so the current hour is visible near the top (not scrolled to 00:00).

- [ ] **Step 5: Switch to "4 dny" and "Den", confirming each shows the correct number of day columns**

- [ ] **Step 6: Click the prev/next arrows in Week view**

Expected: the visible 7-day range shifts by 7 days; the header title updates to show the new date range.

- [ ] **Step 7: Click "Dnes" after navigating away**

Expected: the view returns to the range containing today (in whichever of Day/4-day/Week/Month is currently selected).

- [ ] **Step 8: Hover an hour cell in Week view and click the small "+" button that appears**

Expected: the task composer opens in "create" mode with the due date set to that column's day and the due time set to that row's hour (e.g. `14:00`).

- [ ] **Step 9: Fill in a title and save; confirm the new task appears in the correct hour cell**

- [ ] **Step 10: Click an existing timed task block**

Expected: the composer opens in "edit" mode, prefilled with that task's data (the due-time itself isn't shown in the modal, per the design's accepted scope — only date, title, note, priority, assignee, labels, subtasks are editable there).

- [ ] **Step 11: Open the Filtr panel while in Week view and toggle a filter (e.g. hide completed tasks)**

Expected: both the all-day row and hour cells update to reflect the filter, consistent with how Month view already filters.

- [ ] **Step 12: Switch back to "Měsíc"**

Expected: the month grid reappears unaffected, still showing the project's tasks as before.

- [ ] **Step 13: Run the production build**

Run: `npm run build`
Expected: build completes successfully (the pre-existing >500kB chunk-size warning is expected, not a new failure).
