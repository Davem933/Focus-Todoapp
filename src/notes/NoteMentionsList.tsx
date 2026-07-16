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
