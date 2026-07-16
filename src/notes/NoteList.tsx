import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  FileText,
  FolderPlus,
  NotebookText,
  Pin,
  Plus,
  Search,
  SearchCode,
  Share2,
} from "lucide-react";
import { NoteFolderTree } from "./NoteFolderTree";
import { NoteTagPane } from "./NoteTagPane";
import type { Note, NoteFolderTreeNode } from "./noteTypes";

type NoteListProps = {
  notes: Note[];
  pinnedNotes: Note[];
  folderTree: NoteFolderTreeNode[];
  rootNotes: Note[];
  selectedNoteId: string | null;
  isLoading: boolean;
  error: string | null;
  canManageFolders: boolean;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onCreateFolder: (parentFolderId: string | null, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFolder: (folderId: string, nextParentFolderId: string | null) => void;
  onMoveNoteToFolder: (noteId: string, folderId: string | null) => void;
  onTogglePin: (noteId: string) => void;
  onOpenQuickSwitcher: () => void;
  onOpenGraph: () => void;
};

export function NoteList({
  notes,
  pinnedNotes,
  folderTree,
  rootNotes,
  selectedNoteId,
  isLoading,
  error,
  canManageFolders,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onMoveNoteToFolder,
  onTogglePin,
  onOpenQuickSwitcher,
  onOpenGraph,
}: NoteListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isFiltering = Boolean(normalizedSearch) || activeTags.length > 0;

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      if (activeTags.length > 0 && !activeTags.every((tag) => note.tags.includes(tag))) {
        return false;
      }

      if (
        normalizedSearch &&
        !note.title.toLowerCase().includes(normalizedSearch) &&
        !note.content.toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }

      return true;
    });
  }, [activeTags, normalizedSearch, notes]);

  function toggleTag(tag: string) {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((existing) => existing !== tag) : [...current, tag],
    );
  }

  function handleCreateFolderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newFolderName.trim();

    if (!trimmed) {
      return;
    }

    onCreateFolder(null, trimmed);
    setNewFolderName("");
    setIsCreatingFolder(false);
  }

  return (
    <div className="note-list">
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

      {isCreatingFolder ? (
        <form className="note-list__folder-create-form" onSubmit={handleCreateFolderSubmit}>
          <input
            autoFocus
            aria-label="Název nové složky"
            placeholder="Název složky"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsCreatingFolder(false);
                setNewFolderName("");
              }
            }}
          />
          <button type="submit" disabled={!newFolderName.trim()}>
            Přidat
          </button>
        </form>
      ) : null}

      <NoteTagPane activeTags={activeTags} notes={notes} onToggleTag={toggleTag} />

      {!isFiltering && pinnedNotes.length > 0 ? (
        <div className="note-list__pinned">
          <div className="note-list__pinned-head">
            <Pin aria-hidden="true" size={13} />
            <span>Připnuté</span>
          </div>
          <ul className="note-list__pinned-items">
            {pinnedNotes.map((note) => (
              <li className="note-list__pinned-item" key={note.id}>
                <button
                  className="note-tree__note"
                  data-selected={note.id === selectedNoteId}
                  type="button"
                  onClick={() => onSelectNote(note.id)}
                >
                  <FileText aria-hidden="true" size={14} />
                  <span>{note.title}</span>
                </button>
                <button
                  aria-label="Odepnout poznámku"
                  className="note-list__pinned-unpin"
                  title="Odepnout poznámku"
                  type="button"
                  onClick={() => onTogglePin(note.id)}
                >
                  <Pin aria-hidden="true" size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="note-list__error">{error}</p> : null}
      {isLoading && notes.length === 0 ? (
        <p className="note-list__empty">Načítám poznámky…</p>
      ) : null}
      {!isLoading && notes.length === 0 ? (
        <div className="note-list__empty-card">
          <NotebookText aria-hidden="true" size={24} />
          <strong>Zatím tu nejsou žádné poznámky</strong>
          <button type="button" onClick={onCreateNote}>
            Založit první poznámku
          </button>
        </div>
      ) : null}

      {!isLoading && notes.length > 0 && isFiltering && filteredNotes.length === 0 ? (
        <p className="note-list__empty">Nic neodpovídá filtru</p>
      ) : null}

      {isFiltering && filteredNotes.length > 0 ? (
        <ul className="note-tree__notes">
          {filteredNotes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              selected={note.id === selectedNoteId}
              onSelectNote={onSelectNote}
            />
          ))}
        </ul>
      ) : null}

      {!isFiltering && notes.length > 0 ? (
        <NoteFolderTree
          canManageFolders={canManageFolders}
          rootNotes={rootNotes}
          selectedNoteId={selectedNoteId}
          tree={folderTree}
          onCreateSubfolder={onCreateFolder}
          onDeleteFolder={onDeleteFolder}
          onMoveFolder={onMoveFolder}
          onMoveNoteToFolder={onMoveNoteToFolder}
          onRenameFolder={onRenameFolder}
          onSelectNote={onSelectNote}
        />
      ) : null}
    </div>
  );
}

function NoteRow({
  note,
  selected,
  onSelectNote,
}: {
  note: Note;
  selected: boolean;
  onSelectNote: (noteId: string) => void;
}) {
  return (
    <li>
      <button
        className="note-tree__note"
        data-selected={selected}
        type="button"
        onClick={() => onSelectNote(note.id)}
      >
        <FileText aria-hidden="true" size={14} />
        <span>{note.title}</span>
      </button>
    </li>
  );
}
