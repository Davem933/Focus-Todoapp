import type { AnchorHTMLAttributes } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { FolderKanban, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { transformWikiLinksToMarkdownLinks } from "./noteLinkParsing";
import type { Note } from "./noteTypes";

const CUSTOM_LINK_PROTOCOLS = ["app-note:", "app-task:", "app-project:"];

function noteUrlTransform(url: string): string {
  if (CUSTOM_LINK_PROTOCOLS.some((protocol) => url.startsWith(protocol))) {
    return url;
  }

  return defaultUrlTransform(url);
}

type NoteMarkdownRendererProps = {
  content: string;
  notesInTeam: Note[];
  onOpenNoteByTitle: (title: string) => void;
  onCreateNoteWithTitle: (title: string) => void;
  onOpenTask: (taskId: string) => void;
  onOpenProject: (projectId: string) => void;
};

export function NoteMarkdownRenderer({
  content,
  notesInTeam,
  onOpenNoteByTitle,
  onCreateNoteWithTitle,
  onOpenTask,
  onOpenProject,
}: NoteMarkdownRendererProps) {
  const transformedContent = transformWikiLinksToMarkdownLinks(content);

  return (
    <div className="text-[0.9rem] leading-7 text-nt-fg [&>*:first-child]:mt-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={noteUrlTransform}
        components={{
          a: (linkProps) => (
            <NoteMarkdownLink
              {...linkProps}
              notesInTeam={notesInTeam}
              onCreateNoteWithTitle={onCreateNoteWithTitle}
              onOpenNoteByTitle={onOpenNoteByTitle}
              onOpenProject={onOpenProject}
              onOpenTask={onOpenTask}
            />
          ),
        }}
      >
        {transformedContent}
      </ReactMarkdown>
    </div>
  );
}

type NoteMarkdownLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  notesInTeam: Note[];
  onOpenNoteByTitle: (title: string) => void;
  onCreateNoteWithTitle: (title: string) => void;
  onOpenTask: (taskId: string) => void;
  onOpenProject: (projectId: string) => void;
};

function NoteMarkdownLink({
  href,
  children,
  notesInTeam,
  onOpenNoteByTitle,
  onCreateNoteWithTitle,
  onOpenTask,
  onOpenProject,
}: NoteMarkdownLinkProps) {
  if (!href) {
    return <a>{children}</a>;
  }

  if (href.startsWith("app-note://")) {
    const title = decodeURIComponent(href.slice("app-note://".length));
    const normalizedTitle = title.trim().toLowerCase();
    const resolvedNote = notesInTeam.find(
      (note) => note.title.trim().toLowerCase() === normalizedTitle,
    );

    return (
      <button
        className={cn(
          "rounded px-1 py-px [font:inherit] hover:underline",
          resolvedNote
            ? "bg-nt-brand-soft text-nt-brand"
            : "border-b border-dashed border-nt-muted text-nt-muted",
        )}
        data-resolved={Boolean(resolvedNote)}
        title={resolvedNote ? title : `Vytvořit poznámku "${title}"`}
        type="button"
        onClick={() =>
          resolvedNote ? onOpenNoteByTitle(title) : onCreateNoteWithTitle(title)
        }
      >
        {children}
      </button>
    );
  }

  if (href.startsWith("app-task://")) {
    const taskId = href.slice("app-task://".length);

    return (
      <button
        className="inline-flex items-center gap-1.5 rounded-full bg-nt-brand-soft px-2.5 py-0.5 text-sm font-semibold text-nt-brand hover:brightness-110"
        type="button"
        onClick={() => onOpenTask(taskId)}
      >
        <ListTodo aria-hidden="true" size={13} />
        {children}
      </button>
    );
  }

  if (href.startsWith("app-project://")) {
    const projectId = href.slice("app-project://".length);

    return (
      <button
        className="inline-flex items-center gap-1.5 rounded-full bg-nt-brand-soft px-2.5 py-0.5 text-sm font-semibold text-nt-brand hover:brightness-110"
        type="button"
        onClick={() => onOpenProject(projectId)}
      >
        <FolderKanban aria-hidden="true" size={13} />
        {children}
      </button>
    );
  }

  return (
    <a href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}
