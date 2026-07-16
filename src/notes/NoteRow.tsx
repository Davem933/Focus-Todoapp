import type { DragEvent } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "./noteTypes";

export const NOTE_DRAG_TYPE = "application/x-note-id";

type NoteRowProps = {
  note: Note;
  selected: boolean;
  depth?: number;
  draggable?: boolean;
  onSelectNote: (noteId: string) => void;
};

export function NoteRow({ note, selected, depth = 0, draggable = false, onSelectNote }: NoteRowProps) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-1.5 truncate rounded-md py-1.5 pr-2 text-left text-[0.8rem] text-nt-muted transition-colors hover:bg-nt-card-hover hover:text-nt-fg",
        selected && "bg-nt-brand-soft text-nt-brand hover:bg-nt-brand-soft hover:text-nt-brand",
      )}
      data-selected={selected}
      draggable={draggable}
      style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
      type="button"
      onClick={() => onSelectNote(note.id)}
      onDragStart={
        draggable
          ? (event: DragEvent<HTMLButtonElement>) => {
              event.dataTransfer.setData(NOTE_DRAG_TYPE, note.id);
            }
          : undefined
      }
    >
      <FileText aria-hidden="true" size={14} className="shrink-0" />
      <span className="truncate">{note.title}</span>
    </button>
  );
}
