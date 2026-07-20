import { useEffect, useMemo, useState } from "react";
import type { Project } from "../projects/projectTypes";
import { loadProjectsForTeams } from "../supabase/projectApi";
import {
  createNoteFolder,
  createNoteInSupabase,
  deleteNoteFolder,
  deleteNoteInSupabase,
  loadNoteFolders,
  loadNotesForTeams,
  moveNoteFolder,
  moveNoteToFolder,
  renameNoteFolder,
  setNotePinned,
  updateNoteInSupabase,
} from "../supabase/noteApi";
import type { Task } from "../tasks/taskTypes";
import type { Team } from "../teams/teamTypes";
import { buildNoteFolderTree, wouldCreateFolderCycle } from "./noteFolderTreeHelpers";
import type { MentionItem, Note, NoteFolder, NoteFolderTreeNode } from "./noteTypes";

const AUTOSAVE_DELAY_MS = 800;

type UseNotesWorkspaceArgs = {
  activeTeam: Team | null;
  currentUserId: string | null;
  tasks: Task[];
  openNoteId: string | null;
  onOpenNoteRequestHandled: () => void;
};

export function useNotesWorkspace({
  activeTeam,
  currentUserId,
  tasks,
  openNoteId,
  onOpenNoteRequestHandled,
}: UseNotesWorkspaceArgs) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftFolderId, setDraftFolderId] = useState<string | null>(null);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const folderTree = useMemo(() => buildNoteFolderTree(folders, notes), [folders, notes]);
  const rootNotes = useMemo(
    () =>
      notes
        .filter((note) => note.folderId === null)
        .sort((left, right) => left.title.localeCompare(right.title, "cs-CZ")),
    [notes],
  );
  const pinnedNotes = useMemo(() => notes.filter((note) => note.isPinned), [notes]);

  useEffect(() => {
    if (!activeTeam) {
      setNotes([]);
      setFolders([]);
      setProjects([]);
      setSelectedNoteId(null);
      return;
    }

    let isCancelled = false;
    const team = activeTeam;

    async function loadNotesWorkspace() {
      setIsLoading(true);
      setError(null);

      try {
        const [nextNotes, nextFolders, nextProjects] = await Promise.all([
          loadNotesForTeams([team.id]),
          loadNoteFolders(team.id),
          loadProjectsForTeams([team.id]),
        ]);

        if (!isCancelled) {
          setNotes(nextNotes);
          setFolders(nextFolders);
          setProjects(nextProjects);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setNotes([]);
          setFolders([]);
          setProjects([]);
          setError(
            loadError instanceof Error ? loadError.message : "Poznámky se nepodařilo načíst.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadNotesWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [activeTeam]);

  useEffect(() => {
    if (openNoteId) {
      setSelectedNoteId(openNoteId);
      onOpenNoteRequestHandled();
    }
  }, [onOpenNoteRequestHandled, openNoteId]);

  useEffect(() => {
    setDraftTitle(selectedNote?.title ?? "");
    setDraftContent(selectedNote?.content ?? "");
    setDraftTags(selectedNote?.tags ?? []);
    setDraftFolderId(selectedNote?.folderId ?? null);
  }, [selectedNote]);

  useEffect(() => {
    if (!selectedNote) {
      return;
    }

    if (draftTitle === selectedNote.title && draftContent === selectedNote.content) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistNote({ content: draftContent, title: draftTitle });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftContent, draftTitle]);

  const mentionItems: MentionItem[] = useMemo(() => {
    const taskItems: MentionItem[] = tasks
      .filter((task) => !task.isArchived)
      .map((task) => ({ id: task.id, label: task.title, type: "task" as const }));
    const projectItems: MentionItem[] = projects.map((project) => ({
      id: project.id,
      label: project.name,
      type: "project" as const,
    }));

    return [...taskItems, ...projectItems];
  }, [projects, tasks]);

  async function persistNote(
    overrides: Partial<{
      title: string;
      content: string;
      tags: string[];
      folderId: string | null;
    }> = {},
  ) {
    if (!selectedNote || !activeTeam) {
      return;
    }

    const nextTitle = overrides.title ?? draftTitle;
    const nextContent = overrides.content ?? draftContent;
    const nextTags = overrides.tags ?? draftTags;
    const nextFolderId = overrides.folderId !== undefined ? overrides.folderId : draftFolderId;

    if (!nextTitle.trim()) {
      return;
    }

    try {
      const updated = await updateNoteInSupabase({
        content: nextContent,
        folderId: nextFolderId,
        noteId: selectedNote.id,
        tags: nextTags,
        teamId: activeTeam.id,
        title: nextTitle,
      });

      setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Poznámku se nepodařilo uložit.");
    }
  }

  async function handleCreateNote(initialTitle?: string) {
    if (!activeTeam || !currentUserId) {
      return;
    }

    const title = (initialTitle ?? "Nová poznámka").trim() || "Nová poznámka";

    try {
      const created = await createNoteInSupabase({
        createdBy: currentUserId,
        teamId: activeTeam.id,
        title,
      });

      setNotes((current) => [created, ...current]);
      setSelectedNoteId(created.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Poznámku se nepodařilo založit.");
    }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      await deleteNoteInSupabase(noteId);
      setNotes((current) => current.filter((note) => note.id !== noteId));

      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Poznámku se nepodařilo smazat.");
    }
  }

  async function handleCreateFolder(parentFolderId: string | null, name: string) {
    if (!activeTeam) {
      return;
    }

    try {
      const folder = await createNoteFolder(activeTeam.id, name, parentFolderId);
      setFolders((current) => [...current, folder]);
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : "Složku se nepodařilo založit.");
    }
  }

  async function handleRenameFolder(folderId: string, name: string) {
    try {
      const folder = await renameNoteFolder(folderId, name);
      setFolders((current) => current.map((existing) => (existing.id === folder.id ? folder : existing)));
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Složku se nepodařilo přejmenovat.");
    }
  }

  async function handleDeleteFolder(folderId: string) {
    try {
      await deleteNoteFolder(folderId);
      setFolders((current) =>
        current.filter((folder) => folder.id !== folderId && folder.parentFolderId !== folderId),
      );
      setNotes((current) =>
        current.map((note) => (note.folderId === folderId ? { ...note, folderId: null } : note)),
      );
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : "Složku se nepodařilo smazat.");
    }
  }

  function canMoveFolder(folderId: string, nextParentFolderId: string | null): boolean {
    return !wouldCreateFolderCycle(folders, folderId, nextParentFolderId);
  }

  async function handleMoveFolder(folderId: string, nextParentFolderId: string | null) {
    if (!canMoveFolder(folderId, nextParentFolderId)) {
      setError("Složku nelze přesunout do vlastní podsložky.");
      return;
    }

    try {
      const folder = await moveNoteFolder(folderId, nextParentFolderId);
      setFolders((current) => current.map((existing) => (existing.id === folder.id ? folder : existing)));
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Složku se nepodařilo přesunout.");
    }
  }

  async function handleMoveNoteToFolder(noteId: string, folderId: string | null) {
    try {
      const updated = await moveNoteToFolder(noteId, folderId);
      setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)));

      if (noteId === selectedNoteId) {
        setDraftFolderId(updated.folderId);
      }
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Poznámku se nepodařilo přesunout.");
    }
  }

  async function handleTogglePin(noteId: string) {
    const note = notes.find((existing) => existing.id === noteId);

    if (!note) {
      return;
    }

    try {
      const updated = await setNotePinned(noteId, !note.isPinned);
      setNotes((current) => current.map((existing) => (existing.id === updated.id ? updated : existing)));
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Poznámku se nepodařilo připnout.");
    }
  }

  function handleOpenNoteByTitle(title: string) {
    const normalizedTitle = title.trim().toLowerCase();
    const targetNote = notes.find((note) => note.title.trim().toLowerCase() === normalizedTitle);

    if (targetNote) {
      setSelectedNoteId(targetNote.id);
    }
  }

  function handleCreateNoteWithTitle(title: string) {
    void handleCreateNote(title);
  }

  return {
    draftContent,
    draftFolderId,
    draftTags,
    draftTitle,
    error,
    folderTree,
    folders,
    handleCreateFolder,
    handleCreateNote,
    handleCreateNoteWithTitle,
    handleDeleteFolder,
    handleDeleteNote,
    handleMoveFolder,
    handleMoveNoteToFolder,
    handleOpenNoteByTitle,
    handleRenameFolder,
    handleTogglePin,
    isLoading,
    mentionItems,
    notes,
    persistNote,
    pinnedNotes,
    rootNotes,
    selectedNote,
    selectedNoteId,
    setDraftContent,
    setDraftFolderId,
    setDraftTags,
    setDraftTitle,
    setSelectedNoteId,
  };
}
