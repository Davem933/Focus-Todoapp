# Calendar Full-Month Grid Design

Date: 2026-07-22

## Goal

Change the calendar month grid (built in the phase-1 calendar feature) to always show complete weeks, filling leading/trailing cells with real days from the previous/next month — standard month-view behavior used by Outlook, Google Calendar, etc. Currently those cells are blank (`null`).

## Scope

In scope:
- `getMonthMatrix` in `src/calendar/calendarUtils.ts` returns `CalendarDay[][]` (no `null` cells) — every week has 7 real calendar days, spanning into the previous/next month as needed.
- Tasks due on those adjacent-month days are shown exactly like any other day — no special-casing needed, since task lookup is already by date string, not by "is this the selected month."
- No visual distinction between current-month and adjacent-month days (explicit user decision — keep it plain, matching plain month-view apps).
- No new interactivity (clicking a day still does nothing — unchanged from phase 1).

Out of scope (unchanged from phase 1):
- Month navigation (prev/next).
- Click-to-edit tasks from the calendar.

## Data / Logic Change

`getMonthMatrix(year, month)`:
- Leading padding cells (before day 1 of the target month) become real days of the previous month, computed via `new Date(year, month - 2, dayOfMonth)` — JS `Date` correctly rolls the year back when `month - 2` is negative.
- Trailing padding cells (after the last day) become real days of the next month, via `new Date(year, month, dayOfMonth)` — JS `Date` correctly rolls the year forward when `month` is 12.
- Return type changes from `(CalendarDay | null)[][]` to `CalendarDay[][]`.

No change needed to task-grouping logic (`groupTaskIdsByDueDate`) or to how `CalendarPanel` filters tasks by `selectedProjectId` — it already groups by raw `dueDate` string across all of a project's tasks, regardless of month; only the render skipped `null` cells before, so adjacent-month tasks were silently present in the map but never displayed. Once cells carry real dates, they'll display automatically.

## UI Change

`CalendarPanel.tsx`:
- Remove the `day ? (...) : null` branch — every cell always renders a day number + its tasks.
- Remove the `data-empty` attribute (no cell is ever empty now).

`styles.css`:
- Remove the now-dead `.calendar-panel__day[data-empty="true"]` rule.

## Testing

No test framework in this repo. Verify `getMonthMatrix` via the same throwaway-Node-script approach used for phase 1 (Node's `--experimental-strip-types`), checking: correct day count (always a multiple of 7), correct date strings at both a month/year boundary (e.g. December 2026 → January 2027) and a plain mid-year month, and no `null` values anywhere in the output. Verify the UI manually in the browser: open Kalendář, confirm the grid always shows full weeks with no blank cells, and that a task due in the trailing/leading days (if any exist for a test project) appears on the correct cell.
