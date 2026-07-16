# Notes Panel Visual Redesign (Obsidian-style reference) — Design Spec

**Date:** 2026-07-16
**Reference:** `Poznámky App - standalone.html` (user-supplied static mockup of an Obsidian-style dark notes UI)
**Status:** Approved by user, pending implementation plan

## Goal

Restyle the existing Notes feature (`src/notes/*`, `src/layout/panels/NotesPanel.tsx`) to visually match the reference mockup's Obsidian-style look — 3-column layout, compact folder-tree list, centered editor with pill-styled tags/wikilinks, and a right-hand backlinks sidebar — **without changing any existing behavior, props, handlers, or data flow**. This is a CSS/JSX-restructure task, not a feature-addition task. The already-completed two-row toolbar redesign (`src/notes/NoteList.tsx`, see `2026-07-16-notes-toolbar-redesign-design.md`) is left as-is.

## Explicitly Out of Scope

- No new props on any Notes component's public interface beyond what's needed for the 3-column layout wiring in `NotesPanel.tsx`.
- No changes to `useNotesWorkspace`, Supabase/data-layer code (`src/supabase/noteApi.ts`), folder drag/drop logic, autocomplete, markdown parsing, or graph view.
- No "last-edited timestamp" — present in the mockup, not present in the app today; adding it is new feature work and was explicitly declined.
- No "unlinked mentions" section or backlink preview-snippet text — present in the mockup, requires new text-scanning logic; explicitly declined. `NoteBacklinksPanel` / `NoteMentionsList` keep their current data (list of notes linking to this one) and get CSS-only polish.
- No new color values. All styling maps onto the app's existing `--color-*` CSS custom properties (`src/styles.css:1-70`) so light/dark theme toggling (`[data-theme="light"]`) keeps working. The mockup's own gray/blue palette is a reference for *proportions and contrast*, not literal hex values.

## 1. Layout

### Desktop (current 2-column grid → 3-column grid)

`NotesPanel.tsx`'s `.notes-panel__layout` currently is:

```css
grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
```

with `.notes-panel__detail` stacking `NoteEditor` + `NoteBacklinksPanel` vertically in the second column.

New structure — 3 columns:

```css
grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr) minmax(15rem, 17.5rem);
```

- **Column 1** — `.notes-panel__list` (`NoteList`): unchanged component, unchanged width band.
- **Column 2** — `.notes-panel__editor`: contains only `NoteEditor`, no longer `NoteBacklinksPanel`. Its content wrapper gets `max-width: 46rem; margin: 0 auto;` so the editor reads as centered content with breathing room on wide screens (matching the mockup's centered-column editor), rather than stretching edge-to-edge.
- **Column 3** — `.notes-panel__backlinks` (new grid cell): contains `NoteBacklinksPanel`, given a fixed-ish width via the grid track above and its own left border (`--color-border`) instead of the top-margin gap it has today when stacked under the editor.

`NotesPanel.tsx` JSX changes: split today's single `.notes-panel__detail` wrapper into two sibling divs (`.notes-panel__editor` and `.notes-panel__backlinks`), both still conditionally rendered only when `workspace.selectedNote` is set, same as today. The placeholder state (`NotebookText` + "Vyber poznámku...") spans columns 2+3 when no note is selected (no backlinks column shown with nothing to show backlinks for).

### Mobile (`data-mobile="true"`, unchanged behavior)

Stays single-column: list ⇄ editor via the existing back-button toggle (`data-note-open`). The backlinks panel renders **below** the editor content in the same scrolling column (not a separate column) — i.e. on mobile, `.notes-panel__editor` and `.notes-panel__backlinks` collapse into one visually stacked flow, same as `.notes-panel__detail` behaves today. Achieved by making the 3-column grid `grid-template-columns: 1fr` and both new column divs `display: contents` (or simple block stacking) under the mobile media query / `[data-mobile="true"]` attribute selector, mirroring the existing mobile override pattern at `styles.css:12651-12659`.

## 2. Visual language

All values below reference the existing tokens defined in `src/styles.css:1-70` (dark) and `:40-70` (`[data-theme="light"]` overrides) — no new custom properties are introduced.

| Element | Token(s) used | Notes |
|---|---|---|
| List & backlinks sidebar background | `--color-background-sidebar` | matches app's existing sidebar treatment elsewhere |
| Center editor column background | `--color-background-main` | |
| Row/card surfaces (badges, backlink rows, tag pills) | `--color-background-card`, hover → `--color-background-card-hover` | |
| Column dividers | 1px solid `--color-border` | replaces mockup's `#2a2a2a` |
| Tag-add chip | dashed 1px `--color-border`, hover border → `--color-accent`, hover text → `--color-accent` | matches mockup's dashed "+ tag" affordance |
| Primary text (titles, selected/active rows) | `--color-text-primary` | |
| Secondary/muted text (icons, folder counts, backlink row text) | `--color-text-secondary` | mockup's 3-tier muting collapses onto this single secondary token — no new "faint" tier |
| Wikilinks + selected note row | `--color-accent` text on `--color-accent-soft` background, `border-radius: 3px`, `padding: 1px 4px` | recolors mockup's blue pill-on-tint to the app's purple accent |
| Count badges (backlinks count, folder note count) | pill shape (`border-radius: 999px`), `--color-background-card` bg, `--color-text-secondary` text, small `padding` | new consistent treatment replacing today's plain `<small>` counts |

Typography adjustments (all via existing rem-based sizing, no new font families):

- Note title input: ~`1.6rem` / `font-weight: 700` (was smaller/less prominent) — echoes mockup's 28px/700 H1.
- Editor textarea + markdown preview line-height: bumped to `~1.7` for airier prose.
- Folder-tree rows / backlink rows: trimmed to `~0.8rem` font-size, tighter `padding` for a denser Obsidian-file-explorer feel, with `transition: var(--transition-fast)` added to hover states for smoothness (already partly done per the toolbar redesign spec's Task 2).

## 3. Component-by-component changes

| Component | Change type | Details |
|---|---|---|
| `NotesPanel.tsx` | JSX + CSS | Split `.notes-panel__detail` into `.notes-panel__editor` + `.notes-panel__backlinks` (3rd grid column). Mobile stacking preserved via existing `data-mobile`/`data-note-open` attribute pattern. |
| `NoteList.tsx` | CSS only | Tighter row padding; pill-style note-count badge added next to "Poznámky" heading (heading itself already exists per toolbar redesign). |
| `NoteFolderTree.tsx` | CSS only | Smaller chevron/folder icon sizing, folder note-count (`<small>`) restyled as pill badge, smoother hover/selected transitions. No JSX/logic change — drag/drop, rename, collapse state all untouched. |
| `NoteEditor.tsx` | CSS only | Title input restyled borderless/large; folder-select + tag-pill row restyled (dashed chip, accent hover); textarea/preview typography loosened; a plain `--color-border` divider line added above the meta row area (purely decorative border, no new "last-edited" text). No prop/handler change. |
| `NoteMarkdownRenderer.tsx` (`.note-markdown__link`) | CSS only | Wikilink pill restyled to accent-tinted background per table above. Resolved/unresolved (`data-resolved`) logic untouched. |
| `NoteBacklinksPanel.tsx` / `NoteMentionsList.tsx` | CSS only | Heading + count-badge treatment; each row restyled as a hoverable card-ish list item with icon. Same backlinks data (`loadBacklinksForNote`), same "no unlinked mentions / no snippet" scope as today. |

## Testing / Verification

Since this is CSS/JSX-restructure with no new logic, verification is manual via the running dev server:

1. Desktop width: confirm 3 columns render (list / centered editor / backlinks), confirm editor content is visually centered with max-width rather than edge-to-edge.
2. Select a note with existing backlinks and confirm the backlinks column shows them, styled per the table above (count badge, hoverable rows).
3. No note selected: confirm placeholder still renders sensibly across the merged column 2+3 space.
4. Mobile width (~375px): confirm list↔editor toggle still works via back button, and backlinks content still appears below the editor in the single scrolling column (no separate 3rd column).
5. Toggle light/dark theme (`data-theme` on root) and confirm all new styling still reads correctly in both — no hardcoded colors leaking through.
6. Exercise unchanged functionality to confirm no regressions: create/rename/delete folder, drag a note into a folder, pin/unpin a note, add/remove a tag, insert a `[[wikilink]]` and click it, open quick switcher (Ctrl/Cmd+O), open graph view.
