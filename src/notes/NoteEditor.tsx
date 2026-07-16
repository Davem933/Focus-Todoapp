import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { FolderKanban, ListTodo, Pin, Share2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NoteMarkdownRenderer } from "./NoteMarkdownRenderer";
import { buildNoteFolderTree, flattenFolderTreeForOptions } from "./noteFolderTreeHelpers";
import { useInlineAutocomplete } from "./useInlineAutocomplete";
import type { MentionItem } from "./useInlineAutocomplete";
import type { Note, NoteFolder } from "./noteTypes";

type NoteEditorProps = {
  title: string;
  content: string;
  tags: string[];
  folderId: string | null;
  folders: NoteFolder[];
  notesInTeam: Note[];
  mentionItems: MentionItem[];
  isNarrow: boolean;
  canDelete: boolean;
  isPinned: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onFolderChange: (folderId: string | null) => void;
  onOpenNoteByTitle: (title: string) => void;
  onCreateNoteWithTitle: (title: string) => void;
  onOpenTask: (taskId: string) => void;
  onOpenProject: (projectId: string) => void;
  onDeleteNote: () => void;
  onTogglePin: () => void;
  onOpenLocalGraph: () => void;
};

const NONE_FOLDER_VALUE = "__none__";

export function NoteEditor({
  title,
  content,
  tags,
  folderId,
  folders,
  notesInTeam,
  mentionItems,
  isNarrow,
  canDelete,
  isPinned,
  onTitleChange,
  onContentChange,
  onTagsChange,
  onFolderChange,
  onOpenNoteByTitle,
  onCreateNoteWithTitle,
  onOpenTask,
  onOpenProject,
  onDeleteNote,
  onTogglePin,
  onOpenLocalGraph,
}: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const noteTitles = notesInTeam.map((note) => note.title);

  const folderOptions = useMemo(() => {
    const tree = buildNoteFolderTree(folders, notesInTeam);

    return [
      { label: "Bez složky", value: NONE_FOLDER_VALUE },
      ...flattenFolderTreeForOptions(tree).map((option) => ({
        label: option.label,
        value: option.id,
      })),
    ];
  }, [folders, notesInTeam]);

  const autocomplete = useInlineAutocomplete({
    mentionItems,
    noteTitles,
    onCommit: (nextValue, nextCursor) => {
      onContentChange(nextValue);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;

        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(nextCursor, nextCursor);
        }
      });
    },
    textareaRef,
  });

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    autocomplete.handleKeyDown(event);
  }

  function addTag() {
    const trimmed = tagDraft.trim();

    if (!trimmed || tags.includes(trimmed)) {
      setTagDraft("");
      return;
    }

    onTagsChange([...tags, trimmed]);
    setTagDraft("");
  }

  function removeTag(tag: string) {
    onTagsChange(tags.filter((existingTag) => existingTag !== tag));
  }

  const showEditor = !isNarrow || mobileView === "edit";
  const showPreview = !isNarrow || mobileView === "preview";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-col gap-3">
      <div className="flex flex-col gap-2 border-b border-nt-border pb-3">
        <div className="flex items-center gap-2">
          <input
            aria-label="Název poznámky"
            className="flex-1 bg-transparent text-2xl font-bold text-nt-fg outline-none placeholder:text-nt-muted"
            placeholder="Název poznámky"
            value={title}
            onChange={(event) => onTitleChange(event.currentTarget.value)}
          />
          <div className="flex shrink-0 items-center gap-1">
            <Button
              aria-label={isPinned ? "Odepnout poznámku" : "Připnout poznámku"}
              className={cn(isPinned && "border-nt-brand bg-nt-brand-soft text-nt-brand")}
              size="icon"
              title={isPinned ? "Odepnout poznámku" : "Připnout poznámku"}
              type="button"
              variant="outline"
              onClick={onTogglePin}
            >
              <Pin aria-hidden="true" size={15} />
            </Button>
            <Button
              aria-label="Lokální graf poznámky"
              size="icon"
              title="Lokální graf poznámky"
              type="button"
              variant="outline"
              onClick={onOpenLocalGraph}
            >
              <Share2 aria-hidden="true" size={15} />
            </Button>
            {canDelete ? (
              <Button
                aria-label="Smazat poznámku"
                size="icon"
                title="Smazat poznámku"
                type="button"
                variant="destructiveGhost"
                onClick={onDeleteNote}
              >
                <Trash2 aria-hidden="true" size={15} />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={folderId ?? NONE_FOLDER_VALUE}
            onValueChange={(value) => onFolderChange(value === NONE_FOLDER_VALUE ? null : value)}
          >
            <SelectTrigger aria-label="Složka" className="max-w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {folderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-nt-brand-soft px-2.5 py-1 text-xs font-semibold text-nt-brand"
                key={tag}
              >
                {tag}
                <button
                  aria-label={`Odebrat tag ${tag}`}
                  className="inline-flex text-nt-brand"
                  type="button"
                  onClick={() => removeTag(tag)}
                >
                  <X aria-hidden="true" size={11} />
                </button>
              </span>
            ))}
            <input
              aria-label="Přidat tag"
              className="w-20 rounded-full border border-dashed border-nt-border bg-transparent px-2.5 py-1 text-xs text-nt-muted outline-none focus-visible:border-nt-brand focus-visible:text-nt-brand"
              placeholder="+ tag"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
            />
          </div>
        </div>
      </div>

      {isNarrow ? (
        <div
          className="inline-flex w-fit gap-1 rounded-full border border-nt-border bg-nt-card p-1"
          role="tablist"
          aria-label="Zobrazení poznámky"
        >
          <button
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold text-nt-muted",
              mobileView === "edit" && "bg-nt-brand text-nt-brand-foreground",
            )}
            role="tab"
            aria-selected={mobileView === "edit"}
            type="button"
            onClick={() => setMobileView("edit")}
          >
            Editovat
          </button>
          <button
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold text-nt-muted",
              mobileView === "preview" && "bg-nt-brand text-nt-brand-foreground",
            )}
            role="tab"
            aria-selected={mobileView === "preview"}
            type="button"
            onClick={() => setMobileView("preview")}
          >
            Náhled
          </button>
        </div>
      ) : null}

      <div className={cn("grid min-h-64 flex-1 gap-4", isNarrow ? "grid-cols-1" : "grid-cols-2")}>
        {showEditor ? (
          <div className="relative min-h-0">
            <Textarea
              aria-label="Obsah poznámky (markdown)"
              className="h-full min-h-64 resize-y leading-relaxed"
              placeholder="Piš markdown… použij [[Název poznámky]] pro odkaz na jinou poznámku a @ pro zmínku úkolu/nástěnky."
              ref={textareaRef}
              value={content}
              onChange={(event) => {
                onContentChange(event.currentTarget.value);
                requestAnimationFrame(autocomplete.refresh);
              }}
              onClick={autocomplete.refresh}
              onKeyDown={handleTextareaKeyDown}
              onKeyUp={autocomplete.refresh}
            />
            {autocomplete.isOpen && autocomplete.anchorPosition ? (
              <ul
                className="absolute z-20 max-h-56 w-64 list-none overflow-y-auto rounded-md border border-nt-border bg-nt-card-strong p-1 shadow-xl"
                style={{
                  left: autocomplete.anchorPosition.left,
                  top: autocomplete.anchorPosition.top,
                }}
              >
                {autocomplete.items.map((item, index) => (
                  <li key={item.type + ":" + item.id}>
                    <button
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-sm text-nt-fg",
                        index === autocomplete.activeIndex && "bg-nt-brand-soft text-nt-brand",
                      )}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        autocomplete.handleSelect(item);
                      }}
                    >
                      {item.type === "task" ? (
                        <ListTodo aria-hidden="true" size={13} />
                      ) : item.type === "project" ? (
                        <FolderKanban aria-hidden="true" size={13} />
                      ) : null}
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {showPreview ? (
          <div className="min-h-0 overflow-y-auto border-l border-nt-border pl-4">
            <NoteMarkdownRenderer
              content={content}
              notesInTeam={notesInTeam}
              onCreateNoteWithTitle={onCreateNoteWithTitle}
              onOpenNoteByTitle={onOpenNoteByTitle}
              onOpenProject={onOpenProject}
              onOpenTask={onOpenTask}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
