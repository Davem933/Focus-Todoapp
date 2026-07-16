import { useEffect, useState } from "react";
import { loadBacklinksForNote } from "../supabase/noteApi";
import { NoteMentionsList } from "./NoteMentionsList";
import type { Note } from "./noteTypes";

type NoteBacklinksPanelProps = {
  teamId: string;
  noteId: string;
  noteTitle: string;
  onOpenNote: (noteId: string) => void;
  onBacklinksChange?: (count: number) => void;
};

export function NoteBacklinksPanel({
  teamId,
  noteId,
  noteTitle,
  onOpenNote,
  onBacklinksChange,
}: NoteBacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadBacklinks() {
      setIsLoading(true);

      try {
        const notes = await loadBacklinksForNote(teamId, noteTitle);

        if (!isCancelled) {
          const filtered = notes.filter((note) => note.id !== noteId);
          setBacklinks(filtered);
          onBacklinksChange?.(filtered.length);
        }
      } catch {
        if (!isCancelled) {
          setBacklinks([]);
          onBacklinksChange?.(0);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBacklinks();

    return () => {
      isCancelled = true;
    };
  }, [noteId, noteTitle, teamId, onBacklinksChange]);

  return (
    <NoteMentionsList
      heading="Zpětné odkazy"
      isLoading={isLoading}
      notes={backlinks}
      onOpenNote={onOpenNote}
    />
  );
}
