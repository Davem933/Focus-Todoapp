# Notes toolbar & list row redesign

## Problem

The Notes panel's top toolbar (`NoteList.tsx`) is a single flat row: a search input, three identical unlabeled icon buttons (quick switcher, graph, new folder), and a purple "+" icon button for new note. There's no visual hierarchy, no title/count, and no labels — it reads as unfinished compared to the rest of the app. The note/folder rows below it are minimal but consistent with the toolbar's plainness.

## Scope

Pure FE/CSS restyle of the toolbar area in `NoteList.tsx` and its styles in `styles.css`. No new props, no behavior changes, no changes to `useNotesWorkspace`, `NoteFolderTree`, `NoteTagPane`, or any data flow. Every existing handler (`onSelectNote`, `onCreateNote`, `onCreateFolder`, `onTogglePin`, `onOpenQuickSwitcher`, `onOpenGraph`, etc.) keeps its exact current signature and call sites.

## Design

### Toolbar — two-row layout

Row 1 (header row):
- "Poznámky" title (bold) + a count badge showing `notes.length`, left-aligned
- Icon buttons right-aligned, in this order: quick switcher (⌘/Ctrl+O), graph view, new folder — same three actions as today, same icons (`SearchCode`, `Share2`, `FolderPlus`), just moved and restyled as a tighter icon group

Row 2 (action row):
- Search input (`Search` icon + placeholder "Hledat poznámky…"), flex-grow to fill available width
- Primary "+ Nová" button to the right of search — same `onCreateNote` handler, now with a text label next to the `Plus` icon instead of icon-only

The inline "new folder" creation form (shown when the folder-plus icon is toggled) stays functionally identical, rendered below row 2 exactly as it is today.

### Note/folder rows — visual polish only

Keep the current minimal density (icon + title, no date/preview/tag metadata on the row itself — matches Obsidian's default file-explorer style, which is the reference point the user wants to preserve). Changes are cosmetic only:
- Refine hover/selected background and padding so rows feel consistent with the redesigned toolbar's spacing rhythm
- No new information is added to rows; `NoteFolderTree`, pinned list, and tag pane keep their current structure and only get spacing/color touch-ups where needed to match

### Out of scope

- Note editor (right-hand pane), backlinks panel, graph view, quick switcher modal — untouched
- Any new metadata on note rows (dates, previews, tags) — explicitly rejected in favor of matching Obsidian's minimal look
- Any change to data fetching, Supabase queries, or `useNotesWorkspace` state shape

## Files touched

- `src/notes/NoteList.tsx` — restructure toolbar JSX into two rows, add title/count, add label to primary button
- `src/styles.css` — new/updated rules for `.note-list__toolbar` (or split into header-row/action-row classes), `.note-list__icon-button`, row hover/selected states

## Testing

Manual visual verification only (CSS/layout change with no new logic): open Notes panel in both light and dark theme, at desktop and mobile (narrow) widths, confirm toolbar renders in two rows, all existing buttons still trigger their handlers (quick switcher, graph, new folder form, new note), and note/folder row selection still works.
