# Kanban Flat Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Kanban board column a flat, borderless tray and the task card the only visible "box", per `docs/superpowers/specs/2026-07-23-kanban-flat-card-design.md`.

**Architecture:** CSS-only change to two existing rule blocks in `src/styles.css` (`.project-detail__column`, `.project-detail__task-row`), plus removal of a now-redundant light-theme override and one keyframe endpoint fix so the drag-settle animation doesn't leave a ghost border. No JSX/structure changes in `AppShell.tsx`.

**Tech Stack:** Plain CSS with custom properties (`--color-background-sidebar`, `--color-background-card`, `--shadow-sm`, `--shadow-md`) already defined in `src/styles.css` `:root` / `[data-theme="light"]` blocks.

## Global Constraints

- CSS-only: do not modify `src/layout/AppShell.tsx` markup or class names.
- Do not touch `.project-detail__add-column` (the dashed "+ add column" placeholder) — explicitly out of scope per the spec.
- Do not change drag-and-drop behavior, card content, or the card detail modal.
- This repo has no test framework (`CLAUDE.md`: "no test script, no `*.test.*`/`*.spec.*` files") — verification is `npx tsc --noEmit` plus manual browser confirmation, not unit tests.
- Repo uses Prettier/existing formatting conventions in `styles.css` (2-space indent, alphabetically-ish grouped declarations as seen in surrounding rules) — match the style of the block being edited.

---

### Task 1: Flatten the column — no border, theme-token background

**Files:**
- Modify: `src/styles.css:10078-10091` (`.project-detail__column` base rule)
- Modify: `src/styles.css:10319-10336` (`@keyframes project-column-settle`, the `100%` step)
- Modify: `src/styles.css:10417-10420` (`[data-theme="light"] .project-detail__column` override — remove)

**Interfaces:**
- Consumes: existing CSS custom properties `--color-background-sidebar` (defined in `:root` at `src/styles.css:3` and re-defined in `[data-theme="light"]` at `src/styles.css:42`).
- Produces: `.project-detail__column` renders with no visible default border in either theme; `[data-drop-target="true"]` and `[data-drop-settled="true"]` states (defined at `src/styles.css:10093-10104`, untouched by this task) continue to work unmodified because the border property (not shorthand) is kept, just made transparent by default.

- [ ] **Step 1: Edit the column base rule**

Current (`src/styles.css:10078-10091`):
```css
.project-detail__column {
  background: rgba(15, 23, 42, 0.58);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 12px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 13rem;
  padding: 0.75rem;
}
```

Replace with:
```css
.project-detail__column {
  background: var(--color-background-sidebar);
  border: 1px solid transparent;
  border-radius: 12px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 13rem;
  padding: 0.75rem;
}
```

This keeps a 1px transparent border (instead of deleting the property) so the existing `[data-drop-target="true"]` rule — which only sets `border-color`, not the full `border` shorthand — still produces a visible border when a card is dragged over the column, with zero layout shift.

- [ ] **Step 2: Fix the settle-animation endpoint so it doesn't leave a ghost border**

Current (`src/styles.css:10319-10336`):
```css
@keyframes project-column-settle {
  0% {
    border-color: rgba(167, 139, 250, 0.32);
    box-shadow: inset 0 0 0 0 rgba(167, 139, 250, 0), 0 0 0 rgba(76, 29, 149, 0);
  }

  45% {
    border-color: rgba(196, 181, 253, 0.78);
    box-shadow:
      inset 0 0 0 1px rgba(167, 139, 250, 0.34),
      0 18px 34px rgba(76, 29, 149, 0.2);
  }

  100% {
    border-color: rgba(148, 163, 184, 0.14);
    box-shadow: inset 0 0 0 0 rgba(167, 139, 250, 0), 0 0 0 rgba(76, 29, 149, 0);
  }
}
```

Replace only the `100%` step's `border-color` (leave `0%` and `45%` untouched — they're the purple drop-accent mid-animation, which is fine):
```css
  100% {
    border-color: transparent;
    box-shadow: inset 0 0 0 0 rgba(167, 139, 250, 0), 0 0 0 rgba(76, 29, 149, 0);
  }
```

Reason: `100%` previously matched the column's old default border color (`rgba(148, 163, 184, 0.14)`) so the settle animation eased back to the resting look. Since the resting border is now transparent (Step 1), the animation must ease back to `transparent` too, or a faint gray border will flash and linger after a card is dropped.

- [ ] **Step 3: Remove the now-redundant light-theme override**

Current (`src/styles.css:10417-10420`):
```css
[data-theme="light"] .project-detail__column {
  background: rgba(248, 250, 252, 0.88);
  border-color: rgba(15, 23, 42, 0.1);
}
```

Delete this block entirely. `var(--color-background-sidebar)` already resolves to `#ffffff` in the light theme (`src/styles.css:43`), and the border is transparent in both themes, so this override has nothing left to do.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0 (this is a CSS-only change; this step just confirms nothing else in the repo is broken).

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "$(cat <<'EOF'
Flatten Kanban column: theme-token background, no default border

EOF
)"
```

---

### Task 2: Flatten the card — no border, shadow-based elevation

**Files:**
- Modify: `src/styles.css:10005-10021` (`.project-detail__task-row` base rule)
- Modify: `src/styles.css:10023-10025` (add a new `:hover` rule immediately after `.project-detail__task-row:active`, before `[data-dragging="true"]`)

**Interfaces:**
- Consumes: `--color-background-card`, `--shadow-sm`, `--shadow-md` custom properties (defined in `:root` at `src/styles.css:4,27,28` and `[data-theme="light"]` at `src/styles.css:44,59,60`).
- Produces: `.project-detail__task-row` has no border in either theme, a permanent `box-shadow: var(--shadow-sm)` for baseline definition against the column, and a `:hover` state using `var(--shadow-md)` + `translateY(-1px)`. Source order keeps `[data-dragging="true"]`'s `transform: rotate(1deg) scale(0.985)` (unchanged, at `src/styles.css:10027-10031` post-edit) winning over the new `:hover` transform when both apply, since it's declared later with equal specificity.

- [ ] **Step 1: Edit the card base rule**

Current (`src/styles.css:10005-10021`):
```css
.project-detail__task-row {
  align-items: center;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  gap: 0.6rem;
  justify-content: space-between;
  min-height: 34px;
  padding: 0.38rem 0.55rem;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease,
    transform 0.18s ease;
}
```

Replace with:
```css
.project-detail__task-row {
  align-items: center;
  background: var(--color-background-card);
  border: 0;
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  display: flex;
  gap: 0.6rem;
  justify-content: space-between;
  min-height: 34px;
  padding: 0.38rem 0.55rem;
  transition:
    box-shadow 0.18s ease,
    opacity 0.18s ease,
    transform 0.18s ease;
}
```

Note `border-color` was dropped from the `transition` list since the card no longer has a border to animate the color of; `box-shadow`, `opacity`, and `transform` transitions are kept.

This also fixes a latent bug called out in the spec: the card previously had no `[data-theme="light"]` override at all, so on the light theme's `.project-detail__column` background it was nearly invisible (`rgba(255, 255, 255, 0.035)` on near-white). Switching to `var(--color-background-card)` (`#ffffff` in light theme, `#161d2c` in dark) fixes both themes via the existing token, with no new override needed.

- [ ] **Step 2: Add the hover rule**

Current (`src/styles.css:10023-10027`):
```css
.project-detail__task-row:active {
  cursor: grabbing;
}

.project-detail__task-row[data-dragging="true"] {
```

Insert a new rule between `:active` and `[data-dragging="true"]`:
```css
.project-detail__task-row:active {
  cursor: grabbing;
}

.project-detail__task-row:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.project-detail__task-row[data-dragging="true"] {
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "$(cat <<'EOF'
Flatten Kanban card: theme-token background, shadow-based hover instead of border

EOF
)"
```

---

### Task 3: Verify in the browser

**Files:** none (verification only, no code changes).

**Interfaces:**
- Consumes: the running dev server (`npm run dev`) and a project with at least one board that has 2+ columns and 2+ cards (create one via the UI if the local data doesn't have one).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173`).

- [ ] **Step 2: Open a project board and confirm the flat look**

Navigate to a team's project board (Nástěnky → pick a project). Confirm:
- The column has no visible border — just a flat background tone distinct from the page background.
- Each task card has no border, sits clearly above the column via a visible shadow, and has rounded corners.

- [ ] **Step 3: Confirm hover elevation**

Hover a card with the mouse. Confirm the shadow deepens and the card lifts slightly (`translateY(-1px)`), matching the same interaction pattern already used by `.task-list__row:hover` in the day/list view.

- [ ] **Step 4: Confirm drag/drop-target accent still works**

Drag a card from one column and hover it over a different column. Confirm the target column still shows the temporary purple accent border and lift (from the untouched `[data-drop-target="true"]` rule). Drop the card and confirm no gray border flashes or lingers on the column afterward (this checks the Task 1 Step 2 keyframe fix).

- [ ] **Step 5: Confirm the completed-card treatment is unchanged**

Find or mark a card as completed (or drag one to a "Hotovo"/done column if the board has one). Confirm the title still shows strikethrough + muted text, per the existing `[data-completed="true"]` rule (untouched by this plan).

- [ ] **Step 6: Confirm both themes**

Toggle the app's light/dark theme (via the profile/theme switch). In light theme, confirm cards are clearly visible against the column background (this is the light-theme bug the spec called out — previously the card background was almost invisible there). Switch back to dark theme and confirm the same.

- [ ] **Step 7: Stop the dev server**

Stop the `npm run dev` process (Ctrl+C or close the background task) once verification is complete. No commit for this task.
