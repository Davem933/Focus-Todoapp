import { useMemo, useState } from "react";
import { Pin, Share2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { NoteLiveEditor } from "./NoteLiveEditor";
import { buildNoteFolderTree, flattenFolderTreeForOptions } from "./noteFolderTreeHelpers";
import type { MentionItem, Note, NoteFolder } from "./noteTypes";

type NoteEditorProps = {
  title: string;
  content: string;
  noteId: string;
  tags: string[];
  folderId: string | null;
  folders: NoteFolder[];
  notesInTeam: Note[];
  mentionItems: MentionItem[];
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
  noteId,
  tags,
  folderId,
  folders,
  notesInTeam,
  mentionItems,
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
  const [tagDraft, setTagDraft] = useState("");

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

      <div className="flex min-h-64 flex-1 flex-col">
        <NoteLiveEditor
          content={content}
          mentionItems={mentionItems}
          noteId={noteId}
          notesInTeam={notesInTeam}
          onContentChange={onContentChange}
          onCreateNoteWithTitle={onCreateNoteWithTitle}
          onOpenNoteByTitle={onOpenNoteByTitle}
          onOpenProject={onOpenProject}
          onOpenTask={onOpenTask}
        />
      </div>
    </div>
  );
}
