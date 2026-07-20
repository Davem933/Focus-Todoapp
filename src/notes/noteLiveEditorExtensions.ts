import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { syntaxTree } from "@codemirror/language";
import { autocompletion } from "@codemirror/autocomplete";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { Decoration, EditorView, WidgetType, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { MentionItem } from "./noteTypes";

export type NoteLiveEditorConfig = {
  getNoteTitles: () => string[];
  noteExists: (title: string) => boolean;
  getMentionItems: () => MentionItem[];
  onOpenNoteByTitle: (title: string) => void;
  onCreateNoteWithTitle: (title: string) => void;
  onOpenTask: (taskId: string) => void;
  onOpenProject: (projectId: string) => void;
};

export type NoteLiveEditorConfigRef = { current: NoteLiveEditorConfig };

const WIKI_LINK_PATTERN = /\[\[([^\]\n]+)\]\]/g;
const WIKI_TRIGGER_PATTERN = /\[\[([^\]\n]*)$/;
const MENTION_TRIGGER_PATTERN = /@(\S*)$/;
const MAX_SUGGESTIONS = 8;

const LUCIDE_ICON_ATTRS = {
  fill: "none",
  stroke: "currentColor",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "stroke-width": "2",
  viewBox: "0 0 24 24",
  width: "13",
  height: "13",
};

const LIST_TODO_PATHS = [
  "M13 5h8",
  "M13 12h8",
  "M13 19h8",
  "m3 17 2 2 4-4",
];
const LIST_TODO_RECT = { x: "3", y: "4", width: "6", height: "6", rx: "1" };

const FOLDER_KANBAN_PATHS = [
  "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z",
  "M8 10v4",
  "M12 10v2",
  "M16 10v6",
];

function createLucideIcon(kind: "task" | "project"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  for (const [attribute, value] of Object.entries(LUCIDE_ICON_ATTRS)) {
    svg.setAttribute(attribute, value);
  }

  const paths = kind === "task" ? LIST_TODO_PATHS : FOLDER_KANBAN_PATHS;

  for (const d of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }

  if (kind === "task") {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    for (const [attribute, value] of Object.entries(LIST_TODO_RECT)) {
      rect.setAttribute(attribute, value);
    }
    svg.appendChild(rect);
  }

  return svg;
}

type PillVariant = "note" | "note-missing" | "task" | "project" | "external";

function pillClassName(variant: PillVariant): string {
  if (variant === "note") {
    return "rounded bg-nt-brand-soft px-1 py-px text-nt-brand cursor-pointer hover:underline";
  }

  if (variant === "note-missing") {
    return "rounded border-b border-dashed border-nt-muted px-0.5 text-nt-muted cursor-pointer hover:underline";
  }

  if (variant === "external") {
    return "text-nt-brand underline decoration-dotted cursor-pointer";
  }

  return "inline-flex items-center gap-1 rounded-full bg-nt-brand-soft px-2.5 py-0.5 text-sm font-semibold text-nt-brand cursor-pointer hover:brightness-110";
}

class PillWidget extends WidgetType {
  constructor(
    private readonly label: string,
    private readonly variant: PillVariant,
    private readonly onActivate: () => void,
  ) {
    super();
  }

  eq(other: PillWidget): boolean {
    return other.label === this.label && other.variant === this.variant;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = pillClassName(this.variant);
    span.setAttribute("role", "button");
    span.tabIndex = 0;

    if (this.variant === "task" || this.variant === "project") {
      span.appendChild(createLucideIcon(this.variant));
    }

    const text = document.createElement("span");
    text.textContent = this.label;
    span.appendChild(text);

    span.addEventListener("mousedown", (event) => {
      event.preventDefault();
      this.onActivate();
    });

    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function headingClassName(level: number): string {
  const sizes: Record<number, string> = {
    1: "text-2xl",
    2: "text-xl",
    3: "text-lg",
    4: "text-base",
    5: "text-base",
    6: "text-base",
  };

  return `font-bold text-nt-fg ${sizes[level] ?? "text-base"}`;
}

type DecorationEntry = { from: number; to: number; decoration: Decoration };

function activeLineNumbers(view: EditorView): Set<number> {
  const lines = new Set<number>();

  for (const range of view.state.selection.ranges) {
    lines.add(view.state.doc.lineAt(range.from).number);
    lines.add(view.state.doc.lineAt(range.to).number);
  }

  return lines;
}

function buildLinkDecoration(
  entries: DecorationEntry[],
  from: number,
  to: number,
  label: string,
  url: string,
  config: NoteLiveEditorConfig,
) {
  if (url.startsWith("app-task://")) {
    const taskId = url.slice("app-task://".length);
    entries.push({
      from,
      to,
      decoration: Decoration.replace({
        widget: new PillWidget(label, "task", () => config.onOpenTask(taskId)),
      }),
    });
    return;
  }

  if (url.startsWith("app-project://")) {
    const projectId = url.slice("app-project://".length);
    entries.push({
      from,
      to,
      decoration: Decoration.replace({
        widget: new PillWidget(label, "project", () => config.onOpenProject(projectId)),
      }),
    });
    return;
  }

  if (url.startsWith("app-note://")) {
    const title = decodeURIComponent(url.slice("app-note://".length));
    const exists = config.noteExists(title);
    entries.push({
      from,
      to,
      decoration: Decoration.replace({
        widget: new PillWidget(
          label,
          exists ? "note" : "note-missing",
          () => (exists ? config.onOpenNoteByTitle(title) : config.onCreateNoteWithTitle(title)),
        ),
      }),
    });
    return;
  }

  entries.push({
    from,
    to,
    decoration: Decoration.replace({
      widget: new PillWidget(label, "external", () => {
        window.open(url, "_blank", "noopener,noreferrer");
      }),
    }),
  });
}

function buildDecorations(view: EditorView, config: NoteLiveEditorConfig): DecorationSet {
  const entries: DecorationEntry[] = [];
  const active = activeLineNumbers(view);
  const isLineActive = (pos: number) => active.has(view.state.doc.lineAt(pos).number);
  const doc = view.state.doc;

  syntaxTree(view.state).iterate({
    enter(node) {
      switch (node.name) {
        case "ATXHeading1":
        case "ATXHeading2":
        case "ATXHeading3":
        case "ATXHeading4":
        case "ATXHeading5":
        case "ATXHeading6": {
          const level = Number(node.name.slice(-1));
          entries.push({
            from: node.from,
            to: node.to,
            decoration: Decoration.mark({ class: headingClassName(level) }),
          });

          const headerMark = node.node.getChild("HeaderMark");

          if (headerMark && !isLineActive(node.from)) {
            let end = headerMark.to;
            while (end < node.to && /\s/.test(doc.sliceString(end, end + 1))) {
              end += 1;
            }
            entries.push({ from: headerMark.from, to: end, decoration: Decoration.replace({}) });
          }
          break;
        }

        case "StrongEmphasis":
        case "Emphasis": {
          const className = node.name === "StrongEmphasis" ? "font-bold" : "italic";
          entries.push({ from: node.from, to: node.to, decoration: Decoration.mark({ class: className }) });

          if (!isLineActive(node.from)) {
            const marks = node.node.getChildren("EmphasisMark");
            for (const mark of marks) {
              entries.push({ from: mark.from, to: mark.to, decoration: Decoration.replace({}) });
            }
          }
          break;
        }

        case "Strikethrough": {
          entries.push({
            from: node.from,
            to: node.to,
            decoration: Decoration.mark({ class: "line-through" }),
          });

          if (!isLineActive(node.from)) {
            const marks = node.node.getChildren("StrikethroughMark");
            for (const mark of marks) {
              entries.push({ from: mark.from, to: mark.to, decoration: Decoration.replace({}) });
            }
          }
          break;
        }

        case "InlineCode": {
          entries.push({
            from: node.from,
            to: node.to,
            decoration: Decoration.mark({ class: "rounded bg-nt-card px-1 font-mono text-sm" }),
          });

          if (!isLineActive(node.from)) {
            const marks = node.node.getChildren("CodeMark");
            for (const mark of marks) {
              entries.push({ from: mark.from, to: mark.to, decoration: Decoration.replace({}) });
            }
          }
          break;
        }

        case "Link": {
          if (isLineActive(node.from)) {
            break;
          }

          const marks = node.node.getChildren("LinkMark");
          const urlNode = node.node.getChild("URL");

          if (marks.length >= 2 && urlNode) {
            const label = doc.sliceString(marks[0].to, marks[1].from);
            const url = doc.sliceString(urlNode.from, urlNode.to);
            buildLinkDecoration(entries, node.from, node.to, label, url, config);
          }
          break;
        }

        default:
          break;
      }
    },
  });

  const docText = doc.toString();

  for (const match of docText.matchAll(WIKI_LINK_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;

    if (isLineActive(start)) {
      continue;
    }

    const title = match[1].trim();

    if (!title) {
      continue;
    }

    const exists = config.noteExists(title);
    entries.push({
      from: start,
      to: end,
      decoration: Decoration.replace({
        widget: new PillWidget(
          title,
          exists ? "note" : "note-missing",
          () => (exists ? config.onOpenNoteByTitle(title) : config.onCreateNoteWithTitle(title)),
        ),
      }),
    });
  }

  entries.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(
    entries.map((entry) => entry.decoration.range(entry.from, entry.to)),
    true,
  );
}

class NoteLiveDecorationPlugin {
  decorations: DecorationSet;

  constructor(
    private readonly view: EditorView,
    private readonly configRef: NoteLiveEditorConfigRef,
  ) {
    this.decorations = buildDecorations(view, configRef.current);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = buildDecorations(update.view, this.configRef.current);
    }
  }
}

function noteLiveDecorationExtension(configRef: NoteLiveEditorConfigRef): Extension {
  return ViewPlugin.define((view) => new NoteLiveDecorationPlugin(view, configRef), {
    decorations: (plugin) => plugin.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  });
}

function wikiLinkCompletionSource(configRef: NoteLiveEditorConfigRef) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(WIKI_TRIGGER_PATTERN);

    if (!match) {
      return null;
    }

    const query = match.text.slice(2).trim().toLowerCase();
    const noteTitles = configRef.current.getNoteTitles();
    const options: Completion[] = noteTitles
      .filter((title) => title.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS)
      .map((title) => ({
        label: title,
        type: "text",
        apply: `[[${title}]]`,
      }));

    const hasExactMatch = noteTitles.some((title) => title.toLowerCase() === query);

    if (query && !hasExactMatch) {
      const rawQuery = match.text.slice(2).trim();
      options.push({
        label: `Vytvořit „${rawQuery}“`,
        type: "text",
        apply: `[[${rawQuery}]]`,
      });
    }

    return {
      filter: false,
      from: match.from,
      options,
      validFor: /^\[\[[^\]\n]*$/,
    };
  };
}

function mentionCompletionSource(configRef: NoteLiveEditorConfigRef) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(MENTION_TRIGGER_PATTERN);

    if (!match) {
      return null;
    }

    const query = match.text.slice(1).trim().toLowerCase();
    const mentionItems = configRef.current.getMentionItems();
    const options: Completion[] = mentionItems
      .filter((item) => item.label.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS)
      .map((item) => {
        const scheme = item.type === "task" ? "app-task" : "app-project";
        return {
          label: item.label,
          type: item.type,
          apply: `[${item.label}](${scheme}://${item.id})`,
        };
      });

    return {
      filter: false,
      from: match.from,
      options,
      validFor: /^@\S*$/,
    };
  };
}

const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--color-nt-fg)",
    fontSize: "0.9rem",
  },
  ".cm-content": {
    backgroundColor: "transparent",
    caretColor: "var(--color-nt-fg)",
    fontFamily: "inherit",
    lineHeight: "1.75",
    padding: "0",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-scroller": {
    fontFamily: "inherit",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-tooltip-autocomplete": {
    backgroundColor: "var(--color-nt-card-strong)",
    border: "1px solid var(--color-nt-border)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--color-nt-brand-soft)",
    color: "var(--color-nt-brand)",
  },
});

export function createNoteLiveEditorExtensions(configRef: NoteLiveEditorConfigRef): Extension[] {
  return [
    markdown({ extensions: [GFM] }),
    EditorView.lineWrapping,
    noteLiveDecorationExtension(configRef),
    autocompletion({
      override: [wikiLinkCompletionSource(configRef), mentionCompletionSource(configRef)],
    }),
    editorTheme,
  ];
}
