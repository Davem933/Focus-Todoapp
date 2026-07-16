import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "./noteTypes";

type NoteTagPaneProps = {
  notes: Note[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
};

export function NoteTagPane({ notes, activeTags, onToggleTag }: NoteTagPaneProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const note of notes) {
      for (const tag of note.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ count, tag }))
      .sort((left, right) => left.tag.localeCompare(right.tag, "cs-CZ"));
  }, [notes]);

  if (tagCounts.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-nt-border pt-2">
      <button
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-[0.82rem] font-semibold text-nt-muted hover:text-nt-fg"
        type="button"
        onClick={() => setIsCollapsed((current) => !current)}
      >
        {isCollapsed ? (
          <ChevronRight aria-hidden="true" size={14} />
        ) : (
          <ChevronDown aria-hidden="true" size={14} />
        )}
        <Tag aria-hidden="true" size={14} />
        <span className="flex-1 text-left">Štítky</span>
        <small className="text-xs font-semibold text-nt-muted">{tagCounts.length}</small>
      </button>
      {!isCollapsed ? (
        <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-2">
          {tagCounts.map(({ tag, count }) => (
            <button
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                activeTags.includes(tag)
                  ? "border-nt-brand bg-nt-brand-soft text-nt-brand"
                  : "border-transparent text-nt-muted hover:bg-nt-card-hover hover:text-nt-fg",
              )}
              data-selected={activeTags.includes(tag)}
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
            >
              <span>#{tag}</span>
              <span className="text-nt-muted">{count}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
