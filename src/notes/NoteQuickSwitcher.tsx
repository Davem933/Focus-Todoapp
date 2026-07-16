import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { rankNotesByQuery } from "./noteFuzzySearch";
import type { Note } from "./noteTypes";

const MAX_RESULTS = 30;

const backdropMotion = {
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  initial: { opacity: 0 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

const cardMotion = {
  animate: { opacity: 1, scale: 1, x: "-50%", y: 0 },
  exit: { opacity: 0, scale: 0.97, x: "-50%", y: -8 },
  initial: { opacity: 0, scale: 0.97, x: "-50%", y: -8 },
  transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const },
};

type NoteQuickSwitcherProps = {
  isOpen: boolean;
  notes: Note[];
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (title: string) => void;
};

export function NoteQuickSwitcher({
  isOpen,
  notes,
  onClose,
  onSelectNote,
  onCreateNote,
}: NoteQuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => rankNotesByQuery(notes, query).slice(0, MAX_RESULTS), [notes, query]);
  const trimmedQuery = query.trim();
  const hasExactMatch = results.some(
    (note) => note.title.trim().toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCreateOption = trimmedQuery.length > 0 && !hasExactMatch;
  const totalItems = results.length + (showCreateOption ? 1 : 0);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function commitActiveItem() {
    if (activeIndex < results.length) {
      onSelectNote(results[activeIndex].id);
      onClose();
      return;
    }

    if (showCreateOption) {
      onCreateNote(trimmedQuery);
      onClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (totalItems === 0 ? 0 : (current + 1) % totalItems));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (totalItems === 0 ? 0 : (current - 1 + totalItems) % totalItems));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitActiveItem();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.button
            {...backdropMotion}
            aria-label="Zavřít rychlé přepínání poznámek"
            className="fixed inset-0 bg-black/60"
            type="button"
            onClick={onClose}
          />
          <motion.div
            {...cardMotion}
            aria-label="Rychlé přepínání poznámek"
            aria-modal="true"
            className="fixed left-1/2 top-24 w-full max-w-lg overflow-hidden rounded-lg border border-nt-border bg-nt-card-strong shadow-2xl"
            role="dialog"
          >
            <div className="flex items-center gap-2 border-b border-nt-border px-3 py-2.5">
              <Search aria-hidden="true" className="shrink-0 text-nt-muted" size={16} />
              <input
                aria-label="Hledat poznámku"
                className="flex-1 bg-transparent text-sm text-nt-fg outline-none placeholder:text-nt-muted"
                placeholder="Přejít na poznámku…"
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <ul className="max-h-80 list-none overflow-y-auto p-1.5">
              {results.map((note, index) => (
                <li key={note.id}>
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-nt-fg",
                      index === activeIndex && "bg-nt-brand-soft text-nt-brand",
                    )}
                    data-active={index === activeIndex}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelectNote(note.id);
                      onClose();
                    }}
                  >
                    <FileText aria-hidden="true" size={14} />
                    <span>{note.title}</span>
                  </button>
                </li>
              ))}
              {showCreateOption ? (
                <li>
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-nt-fg",
                      activeIndex === results.length && "bg-nt-brand-soft text-nt-brand",
                    )}
                    data-active={activeIndex === results.length}
                    type="button"
                    onMouseEnter={() => setActiveIndex(results.length)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onCreateNote(trimmedQuery);
                      onClose();
                    }}
                  >
                    <Plus aria-hidden="true" size={14} />
                    <span>Vytvořit poznámku „{trimmedQuery}“</span>
                  </button>
                </li>
              ) : null}
              {results.length === 0 && !showCreateOption ? (
                <li className="px-2.5 py-4 text-center text-sm text-nt-muted">Žádné poznámky</li>
              ) : null}
            </ul>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
