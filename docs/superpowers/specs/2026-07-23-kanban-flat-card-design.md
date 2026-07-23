# Kanban board: flat column, card as the only box

## Problem

On the project board (`AppShell.tsx` → `project-detail__board`), both the column
(`.project-detail__column`) and each task card (`.project-detail__task-row`) have
their own background + border + border-radius. Two visually similar nested
"boxes" read as redundant chrome — a card-in-a-card look — instead of one clear
level of hierarchy.

## Goal

Match the Trello convention: the column is a flat, borderless tray that groups
cards by tone only; the card is the single visible "box" in the view, given
definition by shadow and background contrast rather than a border.

## Scope

CSS-only change in `src/styles.css`. No JSX/structure change in `AppShell.tsx`.
Covers `.project-detail__column` and `.project-detail__task-row` (and their
existing state variants: hover, drag, drop-target, completed, focus-visible).
Explicitly out of scope: `.project-detail__add-column` (the dashed "+ add
column" placeholder) stays as-is.

## Design

**Column (`.project-detail__column`)**
- Remove `border` entirely (including the light-theme-only override at
  `[data-theme="light"] .project-detail__column`, which becomes unnecessary).
- Replace the hardcoded `background: rgba(15, 23, 42, 0.58)` with
  `var(--color-background-sidebar)` so light/dark theming is automatic.
- Keep border-radius (12px) and padding — still a visually grouped tray, just
  without its own outline.
- `data-drop-target="true"` keeps its temporary accent border + shadow +
  translateY while a card is dragged over it — this is a transient
  interaction cue, not a permanent second box, so it stays.

**Card (`.project-detail__task-row`)**
- Remove `border` entirely.
- Replace the hardcoded `background: rgba(255, 255, 255, 0.035)` with
  `var(--color-background-card)` — distinct enough from the column's
  `--color-background-sidebar` tone to read as a separate surface without a
  border. (This also fixes a latent bug: the card currently has no
  light-theme override at all, so it's nearly invisible on the light column
  background introduced there; the token switch fixes both themes at once.)
- Add a permanent `box-shadow: var(--shadow-sm)` for baseline definition
  against the column background.
- On hover, switch to `var(--shadow-md)` plus the small `translateY(-1px)`
  lift already used by task rows in `ListPanel` (`.task-list__row:hover`),
  for visual consistency across the app.
- Dragging (`data-dragging`), settling (`data-settling`), completed
  (`data-completed`), and `focus-visible` states keep their current behavior
  unchanged.

## Non-goals

- No change to the "+ Přidat sloupec" (add column) placeholder styling.
- No change to card content/markup, drag-and-drop behavior, or the card
  detail modal.
