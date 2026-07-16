import { useEffect, useState } from "react";
import { NotebookText } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { Team } from "../../teams/teamTypes";
import { NoteEditor } from "../../notes/NoteEditor";
import { NoteGraphView } from "../../notes/NoteGraphView";
import { NoteList } from "../../notes/NoteList";
import { NoteMentionsList } from "../../notes/NoteMentionsList";
import { NoteQuickSwitcher } from "../../notes/NoteQuickSwitcher";
import { useNoteBacklinks } from "../../notes/useNoteBacklinks";
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
  const { backlinks, isLoading: isLoadingBacklinks } = useNoteBacklinks(
    activeTeam?.id ?? "",
    workspace.selectedNote?.id ?? "",
    workspace.selectedNote?.title ?? "",
  );

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

  const hasBacklinks = Boolean(workspace.selectedNote) && backlinks.length > 0;

  const editorPane = workspace.selectedNote ? (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-4 py-3">
      {isMobileLayout ? (
        <button
          className="self-start text-sm font-semibold text-nt-muted hover:text-nt-fg"
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
      {isMobileLayout ? (
        <NoteMentionsList
          heading="Zpětné odkazy"
          isLoading={isLoadingBacklinks}
          notes={backlinks}
          onOpenNote={workspace.setSelectedNoteId}
        />
      ) : null}
    </div>
  ) : (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center text-nt-muted">
      <NotebookText aria-hidden="true" size={28} />
      <p>Vyber poznámku vlevo, nebo založ novou.</p>
    </div>
  );

  const listPane = (
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
  );

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-nt-bg text-nt-fg"
      aria-label="Poznámky"
    >
      {isMobileLayout ? (
        <div className="flex min-h-0 flex-1">
          {workspace.selectedNote ? (
            <div className="min-h-0 flex-1">{editorPane}</div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{listPane}</div>
          )}
        </div>
      ) : (
        <ResizablePanelGroup className="min-h-0 flex-1" id="notes-panel-layout">
          <ResizablePanel
            className="min-h-0 overflow-y-auto border-r border-nt-border px-3 py-3"
            defaultSize="22"
            id="notes-panel-list"
            maxSize="32"
            minSize="16"
          >
            {listPane}
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            className="mx-auto min-h-0 max-w-3xl overflow-y-auto"
            id="notes-panel-editor"
            minSize="30"
          >
            {editorPane}
          </ResizablePanel>
          {hasBacklinks ? (
            <>
              <ResizableHandle />
              <ResizablePanel
                className="min-h-0 overflow-y-auto border-l border-nt-border bg-nt-sidebar px-4 py-3"
                defaultSize="18"
                id="notes-panel-backlinks"
                maxSize="26"
                minSize="14"
              >
                <NoteMentionsList
                  heading="Zpětné odkazy"
                  isLoading={isLoadingBacklinks}
                  notes={backlinks}
                  onOpenNote={workspace.setSelectedNoteId}
                />
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      )}

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
