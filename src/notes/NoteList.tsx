import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FolderPlus, NotebookText, Pin, Plus, Search, SearchCode, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoteFolderTree } from "./NoteFolderTree";
import { NoteRow } from "./NoteRow";
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-nt-fg">Poznámky</span>
            <Badge variant="count">{notes.length}</Badge>
          </div>
          <div className="ml-auto flex gap-1">
            <Button
              aria-label="Rychlé přepínání poznámek"
              size="icon"
              title="Rychlé přepínání (Ctrl/Cmd+O)"
              type="button"
              variant="ghost"
              onClick={onOpenQuickSwitcher}
            >
              <SearchCode aria-hidden="true" size={15} />
            </Button>
            <Button
              aria-label="Graf poznámek"
              size="icon"
              title="Graf poznámek"
              type="button"
              variant="ghost"
              onClick={onOpenGraph}
            >
              <Share2 aria-hidden="true" size={15} />
            </Button>
            <Button
              aria-label="Nová složka"
              size="icon"
              title="Nová složka"
              type="button"
              variant="ghost"
              onClick={() => setIsCreatingFolder((current) => !current)}
            >
              <FolderPlus aria-hidden="true" size={15} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex flex-1 items-center gap-1.5 rounded-md border border-nt-border bg-nt-card px-2.5">
            <Search aria-hidden="true" className="text-nt-muted" size={15} />
            <input
              aria-label="Hledat v poznámkách"
              className="h-9 flex-1 bg-transparent text-sm text-nt-fg outline-none placeholder:text-nt-muted"
              placeholder="Hledat poznámky…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.currentTarget.value)}
            />
          </div>
          <Button size="sm" type="button" variant="default" onClick={onCreateNote}>
            <Plus aria-hidden="true" size={15} />
            <span>Nová</span>
          </Button>
        </div>
      </div>

      {isCreatingFolder ? (
        <form className="flex gap-1.5" onSubmit={handleCreateFolderSubmit}>
          <Input
            autoFocus
            aria-label="Název nové složky"
            className="h-8 rounded-full text-xs"
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
          <Button
            className="rounded-full"
            disabled={!newFolderName.trim()}
            size="sm"
            type="submit"
            variant="default"
          >
            Přidat
          </Button>
        </form>
      ) : null}

      <NoteTagPane activeTags={activeTags} notes={notes} onToggleTag={toggleTag} />

      {!isFiltering && pinnedNotes.length > 0 ? (
        <div className="border-t border-nt-border pt-2">
          <div className="flex items-center gap-1.5 px-1 py-1 text-[0.82rem] font-semibold text-nt-muted">
            <Pin aria-hidden="true" size={13} />
            <span>Připnuté</span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {pinnedNotes.map((note) => (
              <li className="flex items-center" key={note.id}>
                <div className="flex-1">
                  <NoteRow note={note} selected={note.id === selectedNoteId} onSelectNote={onSelectNote} />
                </div>
                <button
                  aria-label="Odepnout poznámku"
                  className="shrink-0 rounded-md p-1.5 text-nt-brand hover:bg-nt-brand-soft"
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

      {error ? <p className="text-sm text-nt-danger">{error}</p> : null}
      {isLoading && notes.length === 0 ? (
        <p className="text-sm text-nt-muted">Načítám poznámky…</p>
      ) : null}
      {!isLoading && notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-nt-muted">
          <NotebookText aria-hidden="true" size={24} />
          <strong className="text-nt-fg">Zatím tu nejsou žádné poznámky</strong>
          <Button size="sm" type="button" variant="default" onClick={onCreateNote}>
            Založit první poznámku
          </Button>
        </div>
      ) : null}

      {!isLoading && notes.length > 0 && isFiltering && filteredNotes.length === 0 ? (
        <p className="text-sm text-nt-muted">Nic neodpovídá filtru</p>
      ) : null}

      {isFiltering && filteredNotes.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {filteredNotes.map((note) => (
            <li key={note.id}>
              <NoteRow note={note} selected={note.id === selectedNoteId} onSelectNote={onSelectNote} />
            </li>
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
