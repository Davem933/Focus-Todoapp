# Calendar View Modes (Day / 4 Days / Week / Month) Design

Date: 2026-07-27

## Goal

Add a Notion/Outlook-style view switcher to the calendar: Day, 4 days, Week, and Month. Day/4-day/Week share one hourly-timeline layout parameterized by number of days; Month keeps the existing mosaic grid unchanged.

## Scope

In scope:
- A view-mode dropdown ("Den" / "4 dny" / "Týden" / "Měsíc") in the calendar header, styled like the existing project dropdown, default "Měsíc".
- One reusable hourly-timeline component/branch inside `CalendarPanel`, parameterized by day count (1 for Day, 4 for 4 days, 7 for Week) — not three separate implementations.
- 24-hour vertical timeline (00:00–24:00), scrollable, initially scrolled to the current hour (or 08:00 if the visible range doesn't include today).
- A day column per visible day, showing:
  - An "Celý den" (all-day) row above the hourly grid for tasks with `dueTime === null`.
  - Timed tasks (`dueTime` set) placed as a fixed 30-minute-tall block at their `dueTime`, in the correct day column.
- A small "+" button (visible on hover, matching the month view's per-day "+" button) in each hour cell opens the task composer in "create" mode with `dueDate` and `dueTime` prefilled to that cell's day/hour (reusing the existing `ProjectCardComposerModal` and creation flow already wired for the month view's "+" button).
- Clicking an existing task block opens it for editing (same modal, same flow as month view's task click).
- Prev/next navigation shifts the anchor date by the view's day count (1/4/7); Month view's prev/next continues to shift by calendar month, unchanged.
- "Dnes" resets the anchor to the current date (Day/4-day/Week) or current month (Month), matching each view's semantics.
- Filter (assignee/priority/completed, already built) applies identically across all view modes — it filters the same underlying task list before placement, regardless of which view renders it.

Out of scope:
- Real task duration/end time — the app has no such field (only `dueDate`/`dueTime`). Timed blocks are a fixed 30-minute visual marker, not a real time reservation.
- Drag-and-drop rescheduling in the hourly grid (still a separate, unrequested future item, same as the month view).
- Changing the fixed 30-minute block height per task.
- A "today" jump-to-current-hour button beyond the initial scroll position.

## Data Layer (`src/calendar/calendarUtils.ts`)

New pure functions, additive to the existing exports (no changes to `getMonthMatrix`, `groupTaskIdsByDueDate`, etc.):

- `getDateRange(anchorDate: string, days: number): string[]` — returns `days` consecutive `"YYYY-MM-DD"` strings starting at `anchorDate`, using `Date` arithmetic (handles month/year rollover the same way `getMonthMatrix` already does).
- `shiftDate(date: string, days: number): string` — returns the date `days` days after (or before, if negative) `date`.
- `CZECH_WEEKDAY_FULL_NAMES: string[]` — full Czech weekday names (`"pondělí"`, `"úterý"`, …), Monday-first, for the Day view's header (`"úterý 22. července 2026"` style) and day-column headers in 4-day/Week views.

Verified the same way as the existing calendar utilities: a throwaway Node script run with `node --experimental-strip-types`, checking date-range length, ordering, and month/year rollover, then deleted before committing (not a committed test file — this repo has no test framework).

## UI Layer (`CalendarPanel.tsx`)

- New state: `viewMode: "day" | "4day" | "week" | "month"`, default `"month"`.
- New header dropdown (reusing `CustomDropdown`) with options Den/4 dny/Týden/Měsíc, placed at the left of the header nav area (matching the reference screenshot's pill-style trigger).
- `goToPreviousMonth`/`goToNextMonth`/`goToToday` are renamed in effect to branch on `viewMode`: for `"month"` they behave exactly as today (shift `{year, month}`); for `"day"/"4day"/"week"` they shift an `anchorDate` string by 1/4/7 days via `shiftDate`, and "Dnes" resets `anchorDate` to `getTodayDateValue()`.
- New `anchorDate` state (string, default `getTodayDateValue()`) used only by the three hourly views; the existing `{year, month}` state continues to drive Month view only.
- New render branch: when `viewMode !== "month"`, render the hourly grid instead of the month mosaic:
  - Compute `visibleDays = getDateRange(anchorDate, dayCountForMode)` where `dayCountForMode` is 1/4/7 based on `viewMode`.
  - Header title shows the full Czech weekday + date for Day view, or a date range (first–last day, Czech month name) for 4-day/Week.
  - All-day row: for each visible day, list tasks matching that day with `dueTime === null` (from the same filtered task list already computed for Month view — the existing `taskIdsByDueDate`/filter logic is reused, just also grouping by whether `dueTime` is set).
  - Hourly grid: 24 rows (00–23), each row split into one column per visible day; a task with `dueTime` set renders as a positioned block in its hour row/day column, fixed-height (30 minutes' worth of row height).
  - Clicking the hour cell's "+" button calls a new `handleAddTaskAtHour(date, hour)`, mirroring `handleAddTask(date)` but also setting `cardComposerDueDate`/a new due-time composer field to that hour (e.g. `"09:00"`).
  - Clicking a task block calls the existing `handleOpenTask(taskId)` — unchanged.
- The composer (`ProjectCardComposerModal`) itself is unchanged in this feature — it doesn't currently expose a due-time field, so due-time is set programmatically (from the clicked hour) but not editable inside the modal. This matches how the modal already doesn't expose board-column selection either. If precise due-time editing inside the modal is wanted later, that's a follow-up, not part of this feature.
- Filter panel and its state (`filterAssigneeIds`, `filterPriorities`, `showCompletedTasks`) are unchanged and apply to whichever view is active.

## CSS

New rules for the hourly grid: `.calendar-panel__view-dropdown`, `.calendar-panel__hourly-grid`, `.calendar-panel__hourly-day-headers`, `.calendar-panel__hourly-day-header`, `.calendar-panel__hourly-time-gutter`, `.calendar-panel__all-day-row`, `.calendar-panel__all-day-cell`, `.calendar-panel__hourly-body`, `.calendar-panel__hour-row`, `.calendar-panel__hour-label`, `.calendar-panel__hour-cell`, `.calendar-panel__hour-add-button`, `.calendar-panel__timed-task`. Uses the same CSS custom properties (`--color-*`, `--radius-*`) as the rest of the calendar panel for theme consistency.

## Error Handling

- No project selected: view-mode dropdown and hourly grid are irrelevant until a project is picked, same empty-state as today.
- Anchor date navigation has no invalid states (pure date arithmetic, always produces valid dates).
- Clicking an hour cell to add a task still requires `projectColumns.length > 0` (same guard as the existing month-view "+" button) — if a project has no columns yet (shouldn't normally happen, since `loadProjectColumns` guarantees a default), the click is a no-op.

## Testing

No test framework in this repo. Verify `getDateRange`/`shiftDate` via a throwaway Node script (same convention as prior calendar work) covering: correct day count, correct ordering, and a month/year boundary case. Verify the UI manually in the browser: switch between Den/4 dny/Týden/Měsíc, confirm the day range and hour grid render correctly, confirm all-day vs timed task placement, confirm clicking an empty hour cell opens the composer with the right date/time prefilled, confirm clicking a task still opens it for editing, confirm the filter still works in every view mode.
