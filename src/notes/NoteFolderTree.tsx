import { useState } from "react";
import type { DragEvent, FormEvent, KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NoteRow } from "./NoteRow";
import type { Note, NoteFolderTreeNode } from "./noteTypes";

const ROOT_KEY = "__root__";
const NOTE_DRAG_TYPE = "application/x-note-id";
const FOLDER_DRAG_TYPE = "application/x-note-folder-id";

type NoteFolderTreeProps = {
  tree: NoteFolderTreeNode[];
  rootNotes: Note[];
  selectedNoteId: string | null;
  canManageFolders: boolean;
  onSelectNote: (noteId: string) => void;
  onCreateSubfolder: (parentFolderId: string | null, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFolder: (folderId: string, nextParentFolderId: string | null) => void;
  onMoveNoteToFolder: (noteId: string, folderId: string | null) => void;
};

export function NoteFolderTree({
  tree,
  rootNotes,
  selectedNoteId,
  canManageFolders,
  onSelectNote,
  onCreateSubfolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onMoveNoteToFolder,
}: NoteFolderTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  function toggle(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  function handleDropOnFolder(event: DragEvent<HTMLElement>, folderId: string | null) {
    event.preventDefault();
    setDragOverKey(null);

    const noteId = event.dataTransfer.getData(NOTE_DRAG_TYPE);
    const draggedFolderId = event.dataTransfer.getData(FOLDER_DRAG_TYPE);

    if (noteId) {
      onMoveNoteToFolder(noteId, folderId);
      return;
    }

    if (draggedFolderId && draggedFolderId !== folderId) {
      onMoveFolder(draggedFolderId, folderId);
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          "flex flex-col rounded-md",
          dragOverKey === ROOT_KEY && "bg-nt-brand-soft",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOverKey(ROOT_KEY);
        }}
        onDragLeave={() => setDragOverKey((current) => (current === ROOT_KEY ? null : current))}
        onDrop={(event) => handleDropOnFolder(event, null)}
      >
        <button
          className="flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[0.82rem] font-semibold text-nt-muted hover:bg-nt-card-hover hover:text-nt-fg"
          type="button"
          onClick={() => toggle(ROOT_KEY)}
        >
          {collapsed.has(ROOT_KEY) ? (
            <ChevronRight aria-hidden="true" size={14} />
          ) : (
            <ChevronDown aria-hidden="true" size={14} />
          )}
          <Folder aria-hidden="true" size={14} />
          <span className="flex-1 truncate">Poznámky</span>
          <small className="rounded-full bg-nt-card px-1.5 py-0.5 text-[0.68rem] font-semibold text-nt-muted">
            {rootNotes.length}
          </small>
        </button>
        {!collapsed.has(ROOT_KEY) ? (
          rootNotes.length > 0 ? (
            <div className="ml-[0.9rem] flex flex-col gap-0.5 border-l border-nt-border pl-2.5">
              <ul className="flex list-none flex-col gap-0.5 p-0">
                {rootNotes.map((note) => (
                  <li key={note.id}>
                    <NoteRow
                      draggable
                      note={note}
                      selected={note.id === selectedNoteId}
                      onSelectNote={onSelectNote}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="ml-8 py-1 text-xs text-nt-muted">Prázdné</p>
          )
        ) : null}
      </div>

      {tree.map((node) => (
        <FolderNode
          key={node.folder.id}
          canManageFolders={canManageFolders}
          collapsed={collapsed}
          depth={0}
          dragOverKey={dragOverKey}
          node={node}
          selectedNoteId={selectedNoteId}
          onCreateSubfolder={onCreateSubfolder}
          onDeleteFolder={onDeleteFolder}
          onDragOverKey={setDragOverKey}
          onDropOnFolder={handleDropOnFolder}
          onRenameFolder={onRenameFolder}
          onSelectNote={onSelectNote}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

function FolderNode({
  node,
  depth,
  collapsed,
  selectedNoteId,
  canManageFolders,
  dragOverKey,
  onToggle,
  onSelectNote,
  onCreateSubfolder,
  onRenameFolder,
  onDeleteFolder,
  onDropOnFolder,
  onDragOverKey,
}: {
  node: NoteFolderTreeNode;
  depth: number;
  collapsed: Set<string>;
  selectedNoteId: string | null;
  canManageFolders: boolean;
  dragOverKey: string | null;
  onToggle: (key: string) => void;
  onSelectNote: (noteId: string) => void;
  onCreateSubfolder: (parentFolderId: string | null, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDropOnFolder: (event: DragEvent<HTMLElement>, folderId: string | null) => void;
  onDragOverKey: (key: string | null) => void;
}) {
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);
  const [subfolderName, setSubfolderName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.folder.name);

  const isCollapsed = collapsed.has(node.folder.id);
  const totalNoteCount =
    node.notes.length + node.children.reduce((sum, child) => sum + countNodeNotes(child), 0);

  function submitSubfolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = subfolderName.trim();

    if (!trimmed) {
      return;
    }

    onCreateSubfolder(node.folder.id, trimmed);
    setSubfolderName("");
    setIsCreatingSubfolder(false);
    collapsed.delete(node.folder.id);
  }

  function commitRename() {
    const trimmed = renameValue.trim();

    if (!trimmed || trimmed === node.folder.name) {
      setIsRenaming(false);
      return;
    }

    onRenameFolder(node.folder.id, trimmed);
    setIsRenaming(false);
  }

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitRename();
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setRenameValue(node.folder.name);
      setIsRenaming(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-md",
          dragOverKey === node.folder.id && "bg-nt-brand-soft",
        )}
        draggable={canManageFolders && !isRenaming}
        onDragOver={(event) => {
          event.preventDefault();
          onDragOverKey(node.folder.id);
        }}
        onDragLeave={() => onDragOverKey(null)}
        onDragStart={(event) => {
          event.dataTransfer.setData(FOLDER_DRAG_TYPE, node.folder.id);
        }}
        onDrop={(event) => onDropOnFolder(event, node.folder.id)}
      >
        {isRenaming ? (
          <form className="flex-1" onSubmit={submitRename}>
            <input
              autoFocus
              aria-label="Přejmenovat složku"
              className="w-full rounded-md border border-nt-brand bg-nt-card px-2 py-1 text-[0.82rem] font-semibold text-nt-fg outline-none"
              value={renameValue}
              onBlur={commitRename}
              onChange={(event) => setRenameValue(event.currentTarget.value)}
              onKeyDown={handleRenameKeyDown}
            />
          </form>
        ) : (
          <button
            className="flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[0.82rem] font-semibold text-nt-muted hover:bg-nt-card-hover hover:text-nt-fg"
            type="button"
            onClick={() => onToggle(node.folder.id)}
          >
            {isCollapsed ? (
              <ChevronRight aria-hidden="true" size={14} />
            ) : (
              <ChevronDown aria-hidden="true" size={14} />
            )}
            <Folder aria-hidden="true" size={14} />
            <span className="flex-1 truncate">{node.folder.name}</span>
            <small className="rounded-full bg-nt-card px-1.5 py-0.5 text-[0.68rem] font-semibold text-nt-muted">
              {totalNoteCount}
            </small>
          </button>
        )}
        {canManageFolders && !isRenaming ? (
          <div className="flex shrink-0 items-center gap-0.5 pr-1">
            <button
              aria-label={`Nová podsložka v ${node.folder.name}`}
              className="rounded-md p-1 text-nt-muted hover:bg-nt-card-hover hover:text-nt-fg"
              title="Nová podsložka"
              type="button"
              onClick={() => setIsCreatingSubfolder((current) => !current)}
            >
              <FolderPlus aria-hidden="true" size={12} />
            </button>
            <button
              aria-label={`Přejmenovat složku ${node.folder.name}`}
              className="rounded-md p-1 text-nt-muted hover:bg-nt-card-hover hover:text-nt-fg"
              title="Přejmenovat"
              type="button"
              onClick={() => setIsRenaming(true)}
            >
              <Pencil aria-hidden="true" size={12} />
            </button>
            <button
              aria-label={`Smazat složku ${node.folder.name}`}
              className="rounded-md p-1 text-nt-muted hover:bg-nt-danger-soft hover:text-nt-danger"
              title="Smazat"
              type="button"
              onClick={() => onDeleteFolder(node.folder.id)}
            >
              <Trash2 aria-hidden="true" size={12} />
            </button>
          </div>
        ) : null}
      </div>

      {isCreatingSubfolder ? (
        <form className="ml-[0.9rem] mt-1 flex gap-1 border-l border-nt-border pl-2.5" onSubmit={submitSubfolder}>
          <input
            autoFocus
            aria-label="Název podsložky"
            className="w-36 rounded-full border border-nt-border bg-nt-card px-2.5 py-1 text-xs text-nt-fg outline-none focus-visible:border-nt-brand"
            placeholder="Název podsložky"
            value={subfolderName}
            onChange={(event) => setSubfolderName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsCreatingSubfolder(false);
                setSubfolderName("");
              }
            }}
          />
          <button
            className="rounded-full bg-nt-brand px-2.5 py-1 text-xs font-semibold text-nt-brand-foreground disabled:opacity-50"
            disabled={!subfolderName.trim()}
            type="submit"
          >
            Přidat
          </button>
        </form>
      ) : null}

      {!isCollapsed ? (
        <div className="ml-[0.9rem] flex flex-col gap-0.5 border-l border-nt-border pl-2.5">
          {node.notes.length > 0 ? (
            <ul className="flex list-none flex-col gap-0.5 p-0">
              {node.notes.map((note) => (
                <li key={note.id}>
                  <NoteRow
                    draggable
                    note={note}
                    selected={note.id === selectedNoteId}
                    onSelectNote={onSelectNote}
                  />
                </li>
              ))}
            </ul>
          ) : node.children.length === 0 ? (
            <p className="py-1 text-xs text-nt-muted">Prázdné</p>
          ) : null}

          {node.children.map((child) => (
            <FolderNode
              key={child.folder.id}
              canManageFolders={canManageFolders}
              collapsed={collapsed}
              depth={depth + 1}
              dragOverKey={dragOverKey}
              node={child}
              selectedNoteId={selectedNoteId}
              onCreateSubfolder={onCreateSubfolder}
              onDeleteFolder={onDeleteFolder}
              onDragOverKey={onDragOverKey}
              onDropOnFolder={onDropOnFolder}
              onRenameFolder={onRenameFolder}
              onSelectNote={onSelectNote}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function countNodeNotes(node: NoteFolderTreeNode): number {
  return node.notes.length + node.children.reduce((sum, child) => sum + countNodeNotes(child), 0);
}
