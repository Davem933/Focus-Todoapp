import { useEffect, useState } from "react";
import { loadBacklinksForNote } from "../supabase/noteApi";
import type { Note } from "./noteTypes";

export function useNoteBacklinks(teamId: string, noteId: string, noteTitle: string) {
  const [backlinks, setBacklinks] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadBacklinks() {
      setIsLoading(true);

      try {
        const notes = await loadBacklinksForNote(teamId, noteTitle);

        if (!isCancelled) {
          setBacklinks(notes.filter((note) => note.id !== noteId));
        }
      } catch {
        if (!isCancelled) {
          setBacklinks([]);
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
  }, [noteId, noteTitle, teamId]);

  return { backlinks, isLoading };
}
