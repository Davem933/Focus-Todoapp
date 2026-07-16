# Notes Toolbar & List Row Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Notes panel toolbar from a single flat row into a two-row layout with title/count and grouped icons on top, search + labeled "Nová" button below — with no behavior changes — and polish note/folder row hover states to match.

**Architecture:** Pure JSX restructure of the toolbar markup in `NoteList.tsx` plus corresponding CSS in `styles.css`. Every existing prop, handler, and piece of state in `NoteList.tsx` keeps its exact current name and signature — only the JSX layout and class names for the toolbar change.

**Tech Stack:** React 19 + TypeScript, plain CSS (no CSS-in-JS, no Tailwind), `lucide-react` icons.

## Global Constraints

- No new props on `NoteList` — the component's public interface (`NoteListProps`) is unchanged.
- No changes to `useNotesWorkspace`, `NoteFolderTree`, `NoteTagPane`, `NoteBacklinksPanel`, or any Supabase/data-layer code.
- All existing handlers (`onCreateNote`, `onCreateFolder`, `onOpenQuickSwitcher`, `onOpenGraph`, `onSelectNote`, `onTogglePin`, etc.) must remain wired to the same UI actions they are today, just re-positioned.
- Note/folder rows keep their current information density (icon + title only) — no dates, previews, or tags added to rows, matching Obsidian's minimal file-explorer look per the design spec.
- This is a CSS/JSX-only change with no meaningful unit-testable logic; verification is manual visual checking via the dev server in both themes and at mobile width, per the design spec's Testing section.

---

## File Structure

- Modify: `src/notes/NoteList.tsx` — restructure the `.note-list__toolbar` JSX block (lines ~103-151) into two rows
- Modify: `src/styles.css` — replace/extend `.note-list__toolbar` and `.note-list__icon-button` rules (~lines 11644-11696), and polish `.note-tree__note` (~lines 12010-12039) and `.note-list__pinned-item` (~lines 11848-11856) hover/selected states

---

### Task 1: Restructure toolbar into two rows (title/count + icons, search + labeled button)

**Files:**
- Modify: `src/notes/NoteList.tsx:103-151`
- Modify: `src/styles.css:11644-11696`

**Interfaces:**
- Consumes: existing `NoteListProps` fields `notes`, `onSelectNote`, `onCreateNote`, `onCreateFolder`, `onOpenQuickSwitcher`, `onOpenGraph` (all already destructured in the component) — no new props
- Produces: no exports change; this task only changes rendered markup/classes inside `NoteList`

- [ ] **Step 1: Replace the toolbar JSX in `NoteList.tsx`**

Open `src/notes/NoteList.tsx`. Replace the existing toolbar block (the `<div className="note-list__toolbar">...</div>` currently at lines 105-151) with:

```tsx
      <div className="note-list__toolbar">
        <div className="note-list__toolbar-row">
          <div className="note-list__heading">
            <span className="note-list__heading-title">Poznámky</span>
            <span className="note-list__heading-count">{notes.length}</span>
          </div>
          <div className="note-list__icon-group">
            <button
              aria-label="Rychlé přepínání poznámek"
              className="note-list__icon-button"
              title="Rychlé přepínání (Ctrl/Cmd+O)"
              type="button"
              onClick={onOpenQuickSwitcher}
            >
              <SearchCode aria-hidden="true" size={15} />
            </button>
            <button
              aria-label="Graf poznámek"
              className="note-list__icon-button"
              title="Graf poznámek"
              type="button"
              onClick={onOpenGraph}
            >
              <Share2 aria-hidden="true" size={15} />
            </button>
            <button
              aria-label="Nová složka"
              className="note-list__icon-button"
              title="Nová složka"
              type="button"
              onClick={() => setIsCreatingFolder((current) => !current)}
            >
              <FolderPlus aria-hidden="true" size={15} />
            </button>
          </div>
        </div>
        <div className="note-list__toolbar-row">
          <div className="note-list__search">
            <Search aria-hidden="true" size={15} />
            <input
              aria-label="Hledat v poznámkách"
              placeholder="Hledat poznámky…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.currentTarget.value)}
            />
          </div>
          <button
            aria-label="Nová poznámka"
            className="note-list__icon-button note-list__icon-button--primary note-list__new-note-button"
            title="Nová poznámka"
            type="button"
            onClick={onCreateNote}
          >
            <Plus aria-hidden="true" size={15} />
            <span>Nová</span>
          </button>
        </div>
      </div>
```

This keeps every handler (`onOpenQuickSwitcher`, `onOpenGraph`, `setIsCreatingFolder`, `onCreateNote`), every `aria-label`/`title`, and every icon component identical to the current code — only the wrapping structure and class names change, plus a `<span>Nová</span>` label added next to the `Plus` icon on the new-note button.

- [ ] **Step 2: Add CSS for the two-row toolbar layout**

Open `src/styles.css`. Replace the existing `.note-list__toolbar` rule (currently `display: flex; gap: 0.6rem;` at line 11644) and everything through `.note-list__icon-button--primary:hover` (line 11696) with:

```css
.note-list__toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.note-list__toolbar-row {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.note-list__heading {
  align-items: baseline;
  display: flex;
  gap: 0.4rem;
}

.note-list__heading-title {
  color: var(--color-text-primary);
  font-size: 0.92rem;
  font-weight: 700;
}

.note-list__heading-count {
  background: var(--color-background-card);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  padding: 0.05rem 0.45rem;
}

.note-list__icon-group {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}

.note-list__search {
  align-items: center;
  background: var(--color-background-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  display: flex;
  flex: 1;
  gap: 0.45rem;
  padding: 0.5rem 0.7rem;
}

.note-list__search input {
  background: none;
  border: none;
  color: var(--color-text-primary);
  flex: 1;
  font-size: 0.85rem;
  outline: none;
}

.note-list__icon-button {
  align-items: center;
  background: var(--color-background-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  justify-content: center;
  padding: 0.5rem;
  transition: var(--transition-fast);
}

.note-list__icon-button:hover {
  background: var(--color-background-card-hover);
  color: var(--color-text-primary);
}

.note-list__icon-button--primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.note-list__icon-button--primary:hover {
  filter: brightness(1.08);
}

.note-list__new-note-button {
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 650;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
}
```

- [ ] **Step 3: Start the dev server and verify the toolbar renders correctly**

Use the preview tool to start the dev server (`npm run dev` config) and navigate to the Notes panel. Confirm:
- Row 1 shows "Poznámky" title, a count badge matching the number of notes, and three icon buttons (quick switcher, graph, new folder) right-aligned
- Row 2 shows the search input filling available width and a "+ Nová" labeled button
- Clicking the quick switcher icon opens the quick switcher modal
- Clicking the graph icon opens the graph view
- Clicking the folder-plus icon toggles the inline new-folder form below the toolbar
- Clicking "+ Nová" creates a new note (existing `onCreateNote` behavior)
- Typing in the search input still filters the note list below

- [ ] **Step 4: Check both themes and mobile width**

Using the preview tool's `resize_window`, check the toolbar at desktop width in dark theme (default) and light theme (`data-theme="light"` on root), and at mobile width (375px). Confirm no wrapping/overflow issues — the icon group and search row should stay on one line each at all checked widths.

- [ ] **Step 5: Commit**

```bash
git add src/notes/NoteList.tsx src/styles.css
git commit -m "Restyle notes toolbar into two-row layout with title, count, and labeled new-note button"
```

---

### Task 2: Polish note/folder row hover and selected states

**Files:**
- Modify: `src/styles.css:12010-12039` (`.note-tree__note` rules)
- Modify: `src/styles.css:11848-11856` (`.note-list__pinned-item` rules)

**Interfaces:**
- Consumes: existing `.note-tree__note` and `.note-list__pinned-item` class usage in `NoteList.tsx`, `NoteFolderTree.tsx` — no markup changes in this task, CSS only
- Produces: n/a (leaf styling task)

- [ ] **Step 1: Read current pinned-item rule for context**

Confirm the current rule at `src/styles.css:11848-11856` reads:

```css
.note-list__pinned-item {
  align-items: center;
  display: flex;
  gap: 0.2rem;
}

.note-list__pinned-item .note-tree__note {
  padding: 0.3rem 0.4rem;
}
```

- [ ] **Step 2: Update `.note-tree__note` for smoother transitions and slightly roomier padding**

Replace the existing `.note-tree__note` rule block (`src/styles.css:12010-12039`) with:

```css
.note-tree__note {
  align-items: center;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  font-size: 0.85rem;
  gap: 0.45rem;
  padding: 0.45rem 0.55rem;
  text-align: left;
  transition: var(--transition-fast);
  width: 100%;
}

.note-tree__note span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-tree__note:hover {
  background: var(--color-background-card-hover);
  color: var(--color-text-primary);
}

.note-tree__note[data-selected="true"] {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}
```

(This only adds `transition: var(--transition-fast);` and bumps padding from `0.4rem 0.5rem` to `0.45rem 0.55rem` — same selectors, same behavior, smoother hover.)

- [ ] **Step 3: Verify visually in the running dev server**

With the dev server still running from Task 1, open the Notes panel, hover over several notes in the folder tree and in the pinned list, and click to select one. Confirm:
- Hover shows a smooth background transition (no jarring snap)
- Selected row still shows the accent-tinted background/text
- Pinned note rows (which reuse `.note-tree__note`) look consistent with the folder tree rows

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "Add smoother hover transition and spacing to note/folder rows"
```
