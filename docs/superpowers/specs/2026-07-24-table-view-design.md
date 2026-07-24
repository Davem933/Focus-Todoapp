# Table View Feature — Phase 1 (v1) Design

Date: 2026-07-24

## Goal

Add a "Tabulka" (Table) entry point to the sidebar. The user picks a board ("nástěnka")
from a dropdown and sees that board's tasks as a ClickUp/Monday-style table (screenshot
reference: `C:\Users\David\screeny\table.jpg`), as a third way to view/manage tasks
alongside the existing Kanban board and Calendar.

## Scope (v1 only)

In scope:
- New sidebar nav entry "Tabulka" in `SidebarPanel.tsx`, wired identically to the
  existing "Kalendář" entry (same `isCalendarOpen`/`onOpenCalendar` pattern) —
  `isTableOpen`/`onOpenTable`.
- Panel-open state added to `AppShell.tsx:200-212` alongside the other `isXOpen`
  booleans — not a union `activePanel`, matching existing convention.
- New `TableViewPanel` component (`src/layout/panels/TableViewPanel.tsx`), following the
  pattern of other panels in `src/layout/panels/`.
- A board-selector dropdown at the top of the panel, built on
  `src/layout/CustomDropdown.tsx`, listing the same board set `ProjectBoardGrid.tsx` uses.
  No board selected by default — empty state prompts the user to pick one.
- Once a board is selected, render its tasks (`task.projectId` matches the board) as a
  table with fixed columns:
  1. Name (icon + expand, same visual pattern as the Kanban card)
  2. Assignee (initials via `getMemberInitials()` — no new Avatar component)
  3. Status (derived from `task.boardColumnKey` matched against `ProjectColumn.key` —
     there is no separate status field)
  4. Due date
  5. Priority (colors moved to one shared utility, replacing the duplicated definitions
     in `AppShell.tsx:89-93` and `ListPanel.tsx:45-49` — a small cleanup while working in
     this area, not a separate refactor)
- Sorting/filtering reuses the logic just added to the board-detail toolbar (`e580ede`),
  applied to the selected board's task array.
- Clicking a row opens the existing `ProjectCardComposerModal` — identical behavior to
  clicking a Kanban card.
- Implementation is a custom lightweight table (plain markup styled via `styles.css`),
  not a datagrid library — v1's scope (fixed columns, simple sort) doesn't need one, and
  it avoids adding a new dependency to an already bundle-size-flagged build (`vite build`
  >500kB chunk warning, per project `CLAUDE.md`).

Out of scope (deferred, not built now):
- Checkbox column / row selection / bulk actions — omitted entirely in v1 rather than
  rendered inert; added later together with the bulk-action functionality it exists for.
- The "+" add-custom-column control from the mockup — requires new Supabase
  column-schema storage; deferred until a version that actually needs it.
- Inline cell editing (spreadsheet-style) — row click always opens the modal in v1.
- URL sync (`pushBoardRoute`) for the selected board — no such sync exists for
  Nástěnky/Kalendář either; stays consistent with those.
- Column resizing/reordering, virtualization for very large boards.

## Data

No new data model needed. Reuses:
- The same board list `ProjectBoardGrid.tsx` renders, for the dropdown.
- `Task[]`, filtered by `task.projectId` (existing field in `src/tasks/taskTypes.ts`).
- `ProjectColumn[]` (`src/projects/projectTypes.ts`) to resolve `boardColumnKey` → status
  label.

## UI Flow

1. User clicks "Tabulka" in the sidebar.
2. `AppShell` opens `TableViewPanel` the same way it opens other overview panels: set
   `isTableOpen = true` and all sibling `isXOpen` flags to `false` (mirrors
   `handleOpenProjectsOverview` / `handleOpenCalendar` in `AppShell.tsx`).
3. Panel shows a dropdown ("Vyber nástěnku") populated with the user's accessible boards.
4. On selection, panel renders that board's tasks as a table with the fixed columns
   above, sorted/filtered via the reused toolbar logic.
5. Clicking a row opens `ProjectCardComposerModal` for that task, identical to the
   Kanban flow.

## Error Handling

- No boards available: dropdown shows empty state, no crash.
- No board selected (first open): dropdown + placeholder prompt, no table rendered.
- Board selected but has zero tasks: table renders an empty state matching the Kanban
  empty-column style/text.
- Selected board is deleted/archived while open: dropdown resets to "no board selected",
  same behavior `ProjectBoardGrid` already has for a vanished board.

## Testing

No test framework exists in this repo (per project `CLAUDE.md`). Verification is manual:
open the app, navigate to Tabulka, select a board with several tasks in different
statuses/priorities, confirm the table renders correctly, sort/filter works, and clicking
a row opens the same modal as the Kanban card.
