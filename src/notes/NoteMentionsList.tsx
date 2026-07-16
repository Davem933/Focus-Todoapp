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
    <section aria-label={heading} className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-nt-muted">
        <Link2 aria-hidden="true" size={14} />
        <h3 className="text-xs font-bold uppercase tracking-wide text-nt-fg">{heading}</h3>
        {!isLoading ? (
          <span className="ml-auto rounded-full border border-nt-border bg-nt-card px-1.5 py-0.5 text-[0.68rem] font-semibold text-nt-muted">
            {notes.length}
          </span>
        ) : null}
      </div>
      {isLoading ? (
        <p className="text-sm text-nt-muted">Načítám…</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                className="flex w-full items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-left text-sm text-nt-fg transition-colors hover:border-nt-border hover:bg-nt-card-hover"
                type="button"
                onClick={() => onOpenNote(note.id)}
              >
                <FileText aria-hidden="true" size={13} className="shrink-0 text-nt-muted" />
                <span className="truncate">{note.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
