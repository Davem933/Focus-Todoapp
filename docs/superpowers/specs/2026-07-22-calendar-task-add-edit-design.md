# Calendar Inline Task Add/Edit Design

Date: 2026-07-22

## Goal

Let the user add a new task or open/edit an existing task directly from the Kalendář panel, without navigating away to the Nástěnky (board) screen. This follows phase-1 (project picker + month grid) and phase-2a (month navigation).

## Scope

In scope:
- Clicking a task shown on a day in the calendar grid opens an edit modal prefilled with that task's data (title, note, priority, due date, assignee, labels, subtasks).
- Each day cell gets a small "+" button, shown on hover, that opens the same modal in "new task" mode, with due date prefilled to that day.
- Saving an edited task calls the existing `onUpdateTask`. Saving a new task calls the existing `onCreateTask`.
- New tasks created from the calendar are placed in the project's first board column (by position) — the calendar has no column concept of its own.
- Reuses the existing `ProjectCardComposerModal` (already used by the Nástěnky board view) rather than building a new modal component, for visual/behavioral consistency.

Out of scope:
- Deleting a task from the calendar (not requested; `ProjectCardComposerModal` itself has no delete action — deletion happens elsewhere on the board, same as today).
- Changing a task's board column from the calendar.
- Drag-and-drop rescheduling (still a separate, unrequested future item).

## Data Loading

When a project is selected in `CalendarPanel`, two more things load (mirroring what `ProjectsOverviewPanel` already does for the same project):
- `projectMembers` via the existing `loadTeamMembers(project.teamId)` (teamApi) — needed for the assignee dropdown in the modal.
- `projectColumns` via the existing `loadProjectColumns(projectId)` (projectApi) — needed to label an existing task's column in the modal header, and to pick the first column for new tasks. This function already returns columns sorted by `position` ascending and guarantees at least one column exists (falls back to `ensureDefaultProjectColumns`), so `projectColumns[0]` is always safe to use for new tasks.

## Shared Helper Extraction

`createCardLabels`, `normalizeCardLabelNames`, `getCardLabelColor`, and `BOARD_CARD_LABEL_COLORS` currently live as module-private declarations inside `src/layout/AppShell.tsx`, used only by the board's card composer. Move them into a new file `src/tasks/cardLabels.ts`, exported from there. `AppShell.tsx` imports them back (no behavior change to the existing board flow) and `CalendarPanel.tsx` imports the same functions. This mirrors the existing precedent of extracting `getMemberDisplayName`/`getMemberInitials` into `src/teams/teamMemberDisplay.ts`.

## New Props on `CalendarPanel`

- `onCreateTask: (title: string, options?: TaskUpdate) => string | null`
- `onUpdateTask: (taskId: string, update: TaskUpdate) => void`

Both already exist at the `AppShell` level and are passed to sibling panels today; `AppShell` passes the same functions down to `CalendarPanel`.

## New Local State in `CalendarPanel`

Mirrors the composer state already in `ProjectsOverviewPanel` (in `AppShell.tsx`): `cardComposerTaskId`, `cardComposerColumnKey`, `cardComposerTitle`, `cardComposerNote`, `cardComposerPriority`, `cardComposerDueDate`, `cardComposerLabels`, `cardComposerLabelInput`, `cardComposerAssigneeId`, `cardComposerSubtaskTitle`, `cardComposerSubtasks`.

## Interaction Flow

- **Edit existing task:** click a task label in a day cell → populate composer state from that task (`cardComposerTaskId = task.id`, column title looked up from `projectColumns` by `task.boardColumnKey`, other fields copied from the task) → modal opens with `isEditing = true`.
- **Add new task:** hover a day cell → its "+" button appears → click it → populate composer state with `cardComposerTaskId = null`, `cardComposerDueDate = <that day's date>`, `cardComposerColumnKey = projectColumns[0].key`, everything else blank → modal opens with `isEditing = false`.
- **Submit:** if `cardComposerTaskId` is set, call `onUpdateTask(cardComposerTaskId, update)`; otherwise call `onCreateTask(cardComposerTitle, { ...update, projectId: selectedProjectId, teamId: selectedProject.teamId })`. This mirrors `handleSubmitProjectCard` in `AppShell.tsx`.
- **Close:** resets all composer state fields, same as `resetCardComposer`.

## UI Changes

- `.calendar-panel__task` changes from a `<span>` to a `<button type="button">` (keeps the same visual styling; adds click affordance and a focus state).
- New `.calendar-panel__day-add-button`: a small "+" button, visually hidden by default and shown on `.calendar-panel__day:hover` (and on keyboard focus, for accessibility), positioned in the day cell's corner.
- The modal itself (`ProjectCardComposerModal`) is unchanged — reused as-is with an `<AnimatePresence>` wrapper, same as its existing usage.

## Error Handling

- No project selected: no "+" buttons render meaningfully (there's nothing to add a task to) — actually the "+" only needs to be interactable once `selectedProjectId` is set, consistent with the rest of the panel already gating on that.
- `projectMembers`/`projectColumns` still loading when the user clicks "+": disable the "+" buttons and existing task buttons while `isLoading` is true (same guard pattern the project dropdown already uses).

## Testing

No test framework in this repo. Verify manually in the browser: open Kalendář, pick a project, hover a day to see the "+" button appear, click it, fill in a title, save, confirm the task appears on that day; click an existing task, confirm the modal opens prefilled correctly, edit a field, save, confirm the change reflects in the grid.
