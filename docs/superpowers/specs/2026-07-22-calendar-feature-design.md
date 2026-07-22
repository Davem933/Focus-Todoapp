# Calendar Feature — Phase 1 Design

Date: 2026-07-22

## Goal

Add a "Kalendář" (Calendar) entry point to the sidebar. In this first phase, the user
picks a project ("nástěnka") from a dropdown and sees the current calendar month with
that project's tasks placed on the days they're due.

## Scope (Phase 1 only)

In scope:
- New sidebar nav button "Kalendář" next to "Projekty".
- New `CalendarPanel`, following the same open/close pattern as `ProjectsOverviewPanel` /
  `NotesPanel` in `AppShell.tsx` (`isCalendarOpen` boolean + `handleOpenCalendar()`).
- A dropdown at the top of the panel listing **all projects the user has access to**
  across every team (same project set `ProjectsOverviewPanel` receives — not scoped to
  the currently active workspace/team).
- No project selected by default — empty state prompts the user to pick one.
- Once a project is selected, render the current calendar month as a day grid, today
  highlighted.
- Tasks where `task.projectId === selectedProjectId` and `task.dueDate` falls within the
  displayed month are shown on their due day (simple label/dot + task title).

Out of scope (future phases, not built now):
- Month navigation (prev/next month, jump to date).
- Clicking a task to open/edit it.
- Drag-and-drop rescheduling from the calendar.
- Any filter beyond "which project" (e.g. archived vs. active projects).
- Week/day views — month view only.

## Data

No new data model needed. Reuses:
- `Project[]` (from the same source `ProjectsOverviewPanel` uses) for the dropdown.
- `Task[]`, filtered by `task.projectId` and `task.dueDate` (existing fields in
  `src/tasks/taskTypes.ts`).

## UI Flow

1. User clicks "Kalendář" in the sidebar (icon: `CalendarDays`, already imported in
   `SidebarPanel.tsx`).
2. `AppShell` opens `CalendarPanel` the same way it opens other overview panels: set
   `isCalendarOpen = true` and all sibling `isXOpen` flags to `false` (mirrors
   `handleOpenProjectsOverview` / `handleOpenNotes` in `AppShell.tsx:565-592`).
3. Panel shows a dropdown ("Vyber nástěnku") populated with all accessible projects.
4. On selection, panel renders the current month grid and places matching tasks by
   `dueDate`.
5. Tasks with no `dueDate`, or belonging to a different project, are not shown.

## Error Handling

- No projects available: dropdown shows empty state, no crash.
- Project selected but has zero tasks with due dates in the current month: show the
  empty month grid with no task labels (not an error state).

## Testing

No test framework exists in this repo (per project `CLAUDE.md`). Verification is manual:
open the app, navigate to Kalendář, select a project with tasks due this month, confirm
tasks appear on the correct day.
