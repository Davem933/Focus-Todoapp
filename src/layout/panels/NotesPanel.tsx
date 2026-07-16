import { useEffect, useState } from "react";
import { NotebookText } from "lucide-react";
import type { Team } from "../../teams/teamTypes";
import { NoteBacklinksPanel } from "../../notes/NoteBacklinksPanel";
import { NoteEditor } from "../../notes/NoteEditor";
import { NoteGraphView } from "../../notes/NoteGraphView";
import { NoteList } from "../../notes/NoteList";
import { NoteQuickSwitcher } from "../../notes/NoteQuickSwitcher";
import { useNotesWorkspace } from "../../notes/useNotesWorkspace";
import type { Task } from "../../tasks/taskTypes";

type NotesPanelProps = {
  activeTeam: Team | null;
  currentUserId: string | null;
  canManageTeam: boolean;
  isMobileLayout: boolean;
  tasks: Task[];
  openNoteId: string | null;
  onOpenNoteRequestHandled: () => void;
  onOpenTask: (taskId: string) => void;
  onOpenProject: (projectId: string) => void;
};

export function NotesPanel({
  activeTeam,
  currentUserId,
  canManageTeam,
  isMobileLayout,
  tasks,
  openNoteId,
  onOpenNoteRequestHandled,
  onOpenTask,
  onOpenProject,
}: NotesPanelProps) {
  const workspace = useNotesWorkspace({
    activeTeam,
    currentUserId,
    onOpenNoteRequestHandled,
    openNoteId,
    tasks,
  });
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [graphMode, setGraphMode] = useState<"global" | "local">("global");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        setIsQuickSwitcherOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!activeTeam) {
    return null;
  }

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

      <NoteQuickSwitcher
        isOpen={isQuickSwitcherOpen}
        notes={workspace.notes}
        onClose={() => setIsQuickSwitcherOpen(false)}
        onCreateNote={workspace.handleCreateNoteWithTitle}
        onSelectNote={workspace.setSelectedNoteId}
      />

      <NoteGraphView
        focusNoteId={workspace.selectedNoteId}
        isOpen={isGraphOpen}
        mode={graphMode}
        notes={workspace.notes}
        onClose={() => setIsGraphOpen(false)}
        onModeChange={setGraphMode}
        onOpenNote={workspace.setSelectedNoteId}
      />
    </section>
  );
}
