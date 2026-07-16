# Notes Panel Obsidian-Style Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Notes panel to a 3-column Obsidian-style layout (folder-tree sidebar / centered editor / backlinks sidebar) with denser, pill-accented visual polish across the note list, folder tree, editor, wikilinks, and backlinks — reusing the app's existing `--color-*` CSS variables so light/dark theming keeps working, with zero behavior changes.

**Architecture:** Pure JSX-restructure + CSS task. `NotesPanel.tsx` splits its single detail column into two grid columns (editor, backlinks). Three other components (`NoteList.tsx`, `NoteMentionsList.tsx`) get small additive JSX (a heading/count row, an icon+count on backlink rows) with no prop or handler changes. All remaining polish is CSS-only in `src/styles.css`. No test framework exists in this project (no vitest/jest in `package.json`) — every task is verified manually via the running dev server, per this project's existing precedent (see `docs/superpowers/plans/2026-07-16-notes-toolbar-redesign.md`).

**Tech Stack:** React 19 + TypeScript, plain CSS (no CSS-in-JS, no Tailwind), `lucide-react` icons, Vite dev server.

## Global Constraints

- No new props on any Notes component's public interface (`NoteListProps`, `NoteEditorProps`, `NoteMentionsListProps`, `NotesPanelProps` all stay exactly as they are today) — only new local JSX and CSS classes.
- No changes to `useNotesWorkspace`, `NoteFolderTree.tsx`'s drag/drop or rename logic, `NoteEditor.tsx`'s autocomplete/markdown logic, or any Supabase/data-layer code (`src/supabase/noteApi.ts`).
- No new CSS custom properties — every color value must reference an existing `--color-*` token defined in `src/styles.css:1-70` (dark) / `src/styles.css:40-70` (`[data-theme="light"]`).
- No new features: no last-edited timestamp, no unlinked-mentions detection, no backlink preview-snippet text.
- Every existing handler stays wired to the same UI action it triggers today.

---

## File Structure

- Modify: `src/layout/panels/NotesPanel.tsx` — split the single `.notes-panel__detail` wrapper into `.notes-panel__editor` (holds `NoteEditor` + mobile back-button) and `.notes-panel__backlinks` (holds `NoteBacklinksPanel`), both grid children of `.notes-panel__layout`.
- Modify: `src/notes/NoteList.tsx` — add a `note-list__heading` (title + note count) to the toolbar's first row, alongside the existing icon group.
- Modify: `src/notes/NoteMentionsList.tsx` — add a count badge next to the section heading and a `FileText` icon on each backlink row.
- Modify: `src/styles.css` — layout grid (~11571-11634, ~12650-12659), note-list toolbar (~11656-11663), folder-tree counts/row density (~11973-11977, ~12034-12048), note editor polish (~12068-12099, ~12140, ~12185-12192, ~12251-12259), markdown link pill (~12319-12332), and note-mentions polish (~12360-12401).

---

### Task 1: Split the Notes panel into a 3-column grid (list / editor / backlinks)

**Files:**
- Modify: `src/layout/panels/NotesPanel.tsx:63-154`
- Modify: `src/styles.css:11571-11634` and `src/styles.css:12650-12659`

**Interfaces:**
- Consumes: existing `workspace` object from `useNotesWorkspace` (`workspace.selectedNote`, `workspace.selectedNoteId`, etc.) — no new fields used.
- Produces: no exports change. `NotesPanel` renders the same three child components (`NoteList`, `NoteEditor`, `NoteBacklinksPanel`) with the same props, just inside new wrapper `div`s.

- [ ] **Step 1: Replace the detail-column JSX in `NotesPanel.tsx`**

Open `src/layout/panels/NotesPanel.tsx`. Replace lines 63-154 (from `return (` through the closing `</div>` of `.notes-panel__layout`, i.e. everything up to but not including the `<NoteQuickSwitcher` block) with:

```tsx
  return (
    <section className="app-panel notes-panel" aria-label="Poznámky">
      <div
        className="notes-panel__layout"
        data-mobile={isMobileLayout}
        data-note-open={Boolean(workspace.selectedNote)}
      >
        <div className="notes-panel__list">
          <NoteList
            canManageFolders={canManageTeam}
            error={workspace.error}
            folderTree={workspace.folderTree}
            isLoading={workspace.isLoading}
            notes={workspace.notes}
            pinnedNotes={workspace.pinnedNotes}
            rootNotes={workspace.rootNotes}
            selectedNoteId={workspace.selectedNoteId}
            onCreateFolder={workspace.handleCreateFolder}
            onCreateNote={() => void workspace.handleCreateNote()}
            onDeleteFolder={workspace.handleDeleteFolder}
            onMoveFolder={workspace.handleMoveFolder}
            onMoveNoteToFolder={workspace.handleMoveNoteToFolder}
            onRenameFolder={workspace.handleRenameFolder}
            onSelectNote={workspace.setSelectedNoteId}
            onTogglePin={(noteId) => void workspace.handleTogglePin(noteId)}
            onOpenGraph={() => {
              setGraphMode("global");
              setIsGraphOpen(true);
            }}
            onOpenQuickSwitcher={() => setIsQuickSwitcherOpen(true)}
          />
        </div>

        {workspace.selectedNote ? (
          <>
            <div className="notes-panel__editor">
              {isMobileLayout ? (
                <button
                  className="notes-panel__back"
                  type="button"
                  onClick={() => workspace.setSelectedNoteId(null)}
                >
                  ← Zpět na seznam
                </button>
              ) : null}
              <NoteEditor
                canDelete={canManageTeam}
                content={workspace.draftContent}
                folderId={workspace.draftFolderId}
                folders={workspace.folders}
                isNarrow={isMobileLayout}
                isPinned={workspace.selectedNote.isPinned}
                mentionItems={workspace.mentionItems}
                notesInTeam={workspace.notes}
                tags={workspace.draftTags}
                title={workspace.draftTitle}
                onContentChange={workspace.setDraftContent}
                onCreateNoteWithTitle={workspace.handleCreateNoteWithTitle}
                onDeleteNote={() => void workspace.handleDeleteNote(workspace.selectedNote!.id)}
                onFolderChange={(folderId) => {
                  workspace.setDraftFolderId(folderId);
                  void workspace.persistNote({ folderId });
                }}
                onOpenNoteByTitle={workspace.handleOpenNoteByTitle}
                onOpenProject={onOpenProject}
                onOpenTask={onOpenTask}
                onTagsChange={(tags) => {
                  workspace.setDraftTags(tags);
                  void workspace.persistNote({ tags });
                }}
                onTitleChange={workspace.setDraftTitle}
                onTogglePin={() => void workspace.handleTogglePin(workspace.selectedNote!.id)}
                onOpenLocalGraph={() => {
                  setGraphMode("local");
                  setIsGraphOpen(true);
                }}
              />
            </div>

            <div className="notes-panel__backlinks">
              <NoteBacklinksPanel
                noteId={workspace.selectedNote.id}
                noteTitle={workspace.selectedNote.title}
                teamId={activeTeam.id}
                onOpenNote={workspace.setSelectedNoteId}
              />
            </div>
          </>
        ) : (
          <div className="notes-panel__placeholder">
            <NotebookText aria-hidden="true" size={28} />
            <p>Vyber poznámku vlevo, nebo založ novou.</p>
          </div>
        )}
      </div>
```

Leave the following `<NoteQuickSwitcher ... />` and `<NoteGraphView ... />` blocks and the closing `</section>` untouched.

- [ ] **Step 2: Update the layout grid CSS**

Open `src/styles.css`. Replace the block from `.notes-panel__layout` through `.notes-panel__layout[data-mobile="true"][data-note-open="false"] .notes-panel__detail { display: none; }` (lines 11571-11607) with:

```css
.notes-panel__layout {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr) minmax(15rem, 17.5rem);
  min-height: 0;
}

.notes-panel__list {
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.9rem;
}

.notes-panel__editor {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-height: 0;
  overflow-y: auto;
}

.notes-panel__backlinks {
  background: var(--color-background-sidebar);
  border-left: 1px solid var(--color-border);
  min-height: 0;
  overflow-y: auto;
  padding: 0.9rem 1rem;
}

.notes-panel__layout[data-mobile="true"] .notes-panel__list,
.notes-panel__layout[data-mobile="true"] .notes-panel__editor,
.notes-panel__layout[data-mobile="true"] .notes-panel__backlinks {
  border-left: none;
  border-right: none;
  padding-left: 0;
  padding-right: 0;
}

.notes-panel__layout[data-mobile="true"][data-note-open="true"] .notes-panel__list {
  display: none;
}

.notes-panel__layout[data-mobile="true"][data-note-open="false"] .notes-panel__editor,
.notes-panel__layout[data-mobile="true"][data-note-open="false"] .notes-panel__backlinks {
  display: none;
}

.notes-panel__layout[data-mobile="true"] .notes-panel__placeholder {
  grid-column: auto;
}
```

Then find `.notes-panel__placeholder` (a few lines below, currently ending `text-align: center;`) and add a `grid-column` line so the empty-state message spans the editor+backlinks columns on desktop:

```css
.notes-panel__placeholder {
  align-items: center;
  color: var(--color-text-secondary);
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.6rem;
  grid-column: 2 / span 2;
  justify-content: center;
  min-height: 12rem;
  text-align: center;
}
```

- [ ] **Step 3: Update the mobile breakpoint media query**

Find the `@media (max-width: 860px)` block near the end of the file (currently):

```css
@media (max-width: 860px) {
  .notes-panel__layout {
    grid-template-columns: 1fr;
  }

  .notes-panel__list {
    border-right: none;
    padding-right: 0;
  }
}
```

Replace it with:

```css
@media (max-width: 860px) {
  .notes-panel__layout {
    grid-template-columns: 1fr;
  }

  .notes-panel__list {
    border-right: none;
    padding-right: 0;
  }

  .notes-panel__backlinks {
    border-left: none;
    padding: 0.9rem 0;
  }

  .notes-panel__placeholder {
    grid-column: auto;
  }
}
```

- [ ] **Step 4: Verify in the dev server**

Start the dev server (`npm run dev` via the `dev` launch config) and open the Notes panel with a team that has notes. Confirm:
- Desktop width (>860px): three columns render side by side — note list, editor, backlinks.
- Selecting a note with backlinks shows them in the third column.
- Selecting a note with no backlinks shows an empty (but present) third column, not a layout break.
- No note selected: the placeholder message is centered across the editor+backlinks area, not squeezed into the middle column alone.
- Resize to mobile width (~375px, or use `resize_window`): confirm the list ⇄ editor toggle still works via the back button, and backlinks content appears below the editor in the single-column flow.

- [ ] **Step 5: Commit**

```bash
git add src/layout/panels/NotesPanel.tsx src/styles.css
git commit -m "Split Notes panel into 3-column layout with dedicated backlinks column"
```

---

### Task 2: Add title + count heading to the note list toolbar

**Files:**
- Modify: `src/notes/NoteList.tsx:105-136`
- Modify: `src/styles.css:11656-11663`

**Interfaces:**
- Consumes: existing `notes` prop (already destructured in `NoteList`) for the count — no new prop.
- Produces: no exports change.

- [ ] **Step 1: Add the heading row in `NoteList.tsx`**

Open `src/notes/NoteList.tsx`. Replace the first toolbar row (lines 106-136):

```tsx
        <div className="note-list__toolbar-row note-list__toolbar-row--icons">
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
```

with:

```tsx
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
```

(Only the wrapping `<div>` lost the `note-list__toolbar-row--icons` modifier class and gained the new `note-list__heading` block — the three buttons and their handlers are byte-for-byte unchanged.)

- [ ] **Step 2: Replace the row-alignment CSS**

Open `src/styles.css`. Replace:

```css
.note-list__toolbar-row--icons {
  justify-content: flex-end;
}

.note-list__icon-group {
  display: flex;
  gap: 0.4rem;
}
```

with:

```css
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
```

- [ ] **Step 3: Verify in the dev server**

Reload the Notes panel. Confirm the first toolbar row now shows "Poznámky" with a count badge matching the number of notes on the left, and the three icon buttons still right-aligned. Click each icon button (quick switcher, graph, new folder) and confirm they still trigger their existing behavior.

- [ ] **Step 4: Commit**

```bash
git add src/notes/NoteList.tsx src/styles.css
git commit -m "Add title and note-count heading to notes list toolbar"
```

---

### Task 3: Pill-style folder counts and denser folder-tree rows

**Files:**
- Modify: `src/styles.css:11973-11977` (`.note-tree__group-toggle small`)
- Modify: `src/styles.css:12042` (`.note-tree__note` font-size)

**Interfaces:**
- Consumes: existing `<small>{totalNoteCount}</small>` / `<small>{rootNotes.length}</small>` markup in `NoteFolderTree.tsx` (no JSX change there) and existing `.note-tree__note` markup in `NoteFolderTree.tsx`/`NoteList.tsx` (no JSX change).
- Produces: n/a (CSS-only).

- [ ] **Step 1: Restyle the folder note-count badge**

Open `src/styles.css`. Replace:

```css
.note-tree__group-toggle small {
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 600;
}
```

with:

```css
.note-tree__group-toggle small {
  background: var(--color-background-card);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.05rem 0.4rem;
}
```

- [ ] **Step 2: Trim note-row font size**

In the same file, find `.note-tree__note` and change its `font-size: 0.85rem;` line to `font-size: 0.8rem;` (every other declaration in that rule stays the same):

```css
.note-tree__note {
  align-items: center;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  font-size: 0.8rem;
  gap: 0.45rem;
  padding: 0.45rem 0.55rem;
  text-align: left;
  transition: var(--transition-fast);
  width: 100%;
}
```

- [ ] **Step 3: Verify in the dev server**

Reload the Notes panel. Confirm folder rows show a pill-shaped note-count badge instead of plain gray text, and folder/note rows read slightly more compact. Confirm folder expand/collapse, rename, drag-and-drop, and note selection still all work exactly as before (this task touched no JSX or logic).

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "Restyle folder note-counts as pill badges and tighten row density"
```

---

### Task 4: Polish note editor typography and spacing

**Files:**
- Modify: `src/styles.css:12068-12099` (`.note-editor`, `.note-editor__header`, `.note-editor__title`)
- Modify: `src/styles.css:12185-12192` (`.note-editor__tag-input`)
- Modify: `src/styles.css:12251-12259` (`.note-editor__textarea`)
- Modify: `src/styles.css:12309-12313` (`.note-markdown`)

**Interfaces:**
- Consumes: existing `.note-editor`, `.note-editor__header`, `.note-editor__title`, `.note-editor__tag-input`, `.note-editor__textarea`, `.note-markdown` class usage in `NoteEditor.tsx` and `NoteMarkdownRenderer.tsx` — no JSX changes.
- Produces: n/a (CSS-only).

- [ ] **Step 1: Center the editor column content and enlarge the title**

Open `src/styles.css`. Replace:

```css
.note-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

.note-editor__header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 46rem;
}

.note-editor__title-row {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.note-editor__title {
  background: none;
  border: none;
  color: var(--color-text-primary);
  flex: 1;
  font-size: 1.3rem;
  font-weight: 750;
  min-width: 0;
  outline: none;
  padding: 0.1rem 0;
}
```

with:

```css
.note-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0 auto;
  max-width: 46rem;
  min-height: 0;
  width: 100%;
}

.note-editor__header {
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.85rem;
}

.note-editor__title-row {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.note-editor__title {
  background: none;
  border: none;
  color: var(--color-text-primary);
  flex: 1;
  font-size: 1.6rem;
  font-weight: 700;
  min-width: 0;
  outline: none;
  padding: 0.1rem 0;
}
```

(`max-width: 46rem` moved from the header to the whole `.note-editor`, so the panes grid below the header is centered too, not just the title/meta row.)

- [ ] **Step 2: Give the "+ tag" input a dashed pill affordance**

Replace:

```css
.note-editor__tag-input {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  outline: none;
  width: 5rem;
}
```

with:

```css
.note-editor__tag-input {
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  outline: none;
  padding: 0.2rem 0.55rem;
  width: 5rem;
}

.note-editor__tag-input:focus,
.note-editor__tag-input:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
```

- [ ] **Step 3: Loosen body line-height in the textarea and markdown preview**

In `.note-editor__textarea`, change `line-height: 1.5;` to `line-height: 1.7;`. In `.note-markdown`, change `line-height: 1.6;` to `line-height: 1.7;`. Both rules keep every other declaration as-is:

```css
.note-editor__textarea {
  background: var(--color-background-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  flex: 1;
  font-family: inherit;
  font-size: 0.88rem;
  line-height: 1.7;
  min-height: 16rem;
  outline: none;
  padding: 0.85rem;
  resize: vertical;
  width: 100%;
}
```

```css
.note-markdown {
  color: var(--color-text-primary);
  font-size: 0.9rem;
  line-height: 1.7;
}
```

- [ ] **Step 4: Verify in the dev server**

Open a note. Confirm: the title reads larger and bolder; a divider line separates the title/tags/folder header block from the source/preview panes below; the "+ tag" input now shows a dashed pill outline that turns accent-colored on hover/focus; body text in both the textarea and the rendered preview has visibly more breathing room. Confirm typing in the title, adding/removing tags, changing folder, and editing content all still work exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "Polish note editor typography, spacing, and tag-input affordance"
```

---

### Task 5: Restyle wikilinks as accent-tinted pills

**Files:**
- Modify: `src/styles.css:12319-12332` (`.note-markdown__link`)

**Interfaces:**
- Consumes: existing `.note-markdown__link` / `data-resolved` markup in `NoteMarkdownRenderer.tsx` — no JSX change.
- Produces: n/a (CSS-only).

- [ ] **Step 1: Replace the wikilink underline style with a pill**

Open `src/styles.css`. Replace:

```css
.note-markdown__link {
  background: none;
  border: none;
  border-bottom: 1px solid var(--color-accent);
  color: var(--color-accent);
  cursor: pointer;
  font: inherit;
  padding: 0;
}

.note-markdown__link[data-resolved="false"] {
  border-bottom-style: dashed;
  color: var(--color-text-secondary);
}
```

with:

```css
.note-markdown__link {
  background: var(--color-accent-soft);
  border: none;
  border-radius: 3px;
  color: var(--color-accent);
  cursor: pointer;
  font: inherit;
  padding: 1px 4px;
}

.note-markdown__link:hover {
  text-decoration: underline;
}

.note-markdown__link[data-resolved="false"] {
  background: none;
  border-bottom: 1px dashed var(--color-text-secondary);
  color: var(--color-text-secondary);
  padding: 0;
}
```

- [ ] **Step 2: Verify in the dev server**

Open a note whose content includes a `[[Some Existing Note]]` wikilink and one with `[[Some Nonexistent Note]]`. Confirm the resolved link renders as an accent-tinted pill and the unresolved link keeps its plain dashed-underline treatment (both distinguishable from body text). Click the resolved link and confirm it still opens the target note. Confirm clicking an unresolved link still offers to create the note (existing `onCreateNoteWithTitle` behavior, unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "Restyle resolved wikilinks as accent-tinted pills"
```

---

### Task 6: Add icon and count badge to the backlinks list

**Files:**
- Modify: `src/notes/NoteMentionsList.tsx`
- Modify: `src/styles.css:12360-12401`

**Interfaces:**
- Consumes: existing `NoteMentionsListProps` (`heading`, `notes`, `isLoading`, `onOpenNote`) — no new props.
- Produces: no exports change.

- [ ] **Step 1: Add the count badge and row icon in `NoteMentionsList.tsx`**

Open `src/notes/NoteMentionsList.tsx`. Replace the whole file with:

```tsx
import { FileText, Link2 } from "lucide-react";
import type { Note } from "./noteTypes";

type NoteMentionsListProps = {
  heading?: string;
  notes: Note[];
  isLoading: boolean;
  onOpenNote: (noteId: string) => void;
};

export function NoteMentionsList({
  heading = "Zmíněno v poznámkách",
  notes,
  isLoading,
  onOpenNote,
}: NoteMentionsListProps) {
  if (!isLoading && notes.length === 0) {
    return null;
  }

  return (
    <section className="note-mentions" aria-label={heading}>
      <div className="note-mentions__head">
        <Link2 aria-hidden="true" size={14} />
        <h3>{heading}</h3>
        {!isLoading ? <span className="note-mentions__count">{notes.length}</span> : null}
      </div>
      {isLoading ? (
        <p className="note-mentions__loading">Načítám…</p>
      ) : (
        <ul className="note-mentions__list">
          {notes.map((note) => (
            <li key={note.id}>
              <button type="button" onClick={() => onOpenNote(note.id)}>
                <FileText aria-hidden="true" size={13} />
                <span>{note.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Restyle the backlinks section CSS**

Open `src/styles.css`. Replace:

```css
.note-mentions__head {
  align-items: center;
  color: var(--color-text-secondary);
  display: flex;
  gap: 0.4rem;
}

.note-mentions__head h3 {
  font-size: 0.82rem;
  font-weight: 700;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.note-mentions__loading {
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}

.note-mentions__list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  list-style: none;
  margin: 0.4rem 0 0;
  padding: 0;
}

.note-mentions__list button {
  background: none;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.15rem 0;
  text-align: left;
}

.note-mentions__list button:hover {
  text-decoration: underline;
}
```

with:

```css
.note-mentions__head {
  align-items: center;
  color: var(--color-text-secondary);
  display: flex;
  gap: 0.4rem;
}

.note-mentions__head h3 {
  font-size: 0.82rem;
  font-weight: 700;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.note-mentions__count {
  background: var(--color-background-card);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 600;
  margin-left: auto;
  padding: 0.05rem 0.4rem;
}

.note-mentions__loading {
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}

.note-mentions__list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  list-style: none;
  margin: 0.4rem 0 0;
  padding: 0;
}

.note-mentions__list button {
  align-items: center;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  font-size: 0.85rem;
  gap: 0.4rem;
  padding: 0.4rem 0.5rem;
  text-align: left;
  transition: var(--transition-fast);
  width: 100%;
}

.note-mentions__list button:hover {
  background: var(--color-background-card-hover);
  border-color: var(--color-border);
}
```

- [ ] **Step 3: Verify in the dev server**

Open a note that has at least one backlink. Confirm the "Zpětné odkazy" heading shows a count badge matching the number of backlinks, each row shows a small file icon before the title, and rows show a hover background instead of an underline. Click a backlink row and confirm it still navigates to that note (`onOpenNote` behavior unchanged). Open a note with zero backlinks and confirm the section still doesn't render at all (unchanged early-return behavior).

- [ ] **Step 4: Commit**

```bash
git add src/notes/NoteMentionsList.tsx src/styles.css
git commit -m "Add count badge and row icon to backlinks list"
```

---

### Task 7: Full-feature regression pass across both themes

**Files:** none (verification only)

**Interfaces:** n/a

- [ ] **Step 1: Dark theme desktop pass**

With the dev server running and the app in its default (dark) theme at desktop width, exercise every existing Notes behavior end-to-end: create a note, rename its title, add and remove a tag, move it into a folder via the folder dropdown, create a new folder and a subfolder, drag a note into a folder, drag a folder into another folder, pin and unpin a note, insert a `[[wikilink]]` to another note and click it, type `@` to mention a task/project and confirm autocomplete still works, open the quick switcher (Ctrl/Cmd+O), open both the global and local graph views, delete a note (if `canManageTeam` is true for the test account), and delete a folder.

- [ ] **Step 2: Light theme pass**

Toggle the app to light theme (`data-theme="light"` on the root — use whatever in-app control switches themes) and repeat a visual spot-check of the Notes panel: confirm all the new pill badges, dashed tag input, wikilink pills, and backlink rows still have visible, correctly-contrasting colors (no white-on-white or invisible borders), since every new rule uses the existing `--color-*` tokens that already have light-theme overrides.

- [ ] **Step 3: Mobile width pass**

Resize to ~375px width (or use the preview tool's `resize_window`). Confirm the list ⇄ editor toggle still works via the back button, and the backlinks section still appears below the editor content in the single-column flow, not clipped or hidden.

- [ ] **Step 4: Fix any regressions found**

If any step above reveals a visual or functional regression, fix it in the relevant file from Tasks 1-6 and re-run the affected check. Commit the fix separately with a message describing what was wrong (e.g. `git commit -m "Fix backlinks column overflow on narrow desktop widths"`).

- [ ] **Step 5: Final commit**

If Step 4 required no fixes, no commit is needed for this task — the plan is complete once Steps 1-3 all pass.
