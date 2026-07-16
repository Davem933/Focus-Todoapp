import { useCallback, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";

export type MentionItem = {
  id: string;
  type: "task" | "project";
  label: string;
};

type AutocompleteItemType = "note" | "note-create" | "task" | "project";

export type AutocompleteItem = {
  type: AutocompleteItemType;
  id: string;
  label: string;
};

type ActiveMatch = {
  trigger: "[[" | "@";
  query: string;
  start: number;
  end: number;
};

type CaretPosition = {
  top: number;
  left: number;
};

type UseInlineAutocompleteOptions = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  noteTitles: string[];
  mentionItems: MentionItem[];
  onCommit: (nextValue: string, nextCursor: number) => void;
};

const WIKI_TRIGGER_PATTERN = /\[\[([^\]\n]*)$/;
const MENTION_TRIGGER_PATTERN = /@(\S*)$/;
const MAX_SUGGESTIONS = 8;

export function useInlineAutocomplete({
  textareaRef,
  noteTitles,
  mentionItems,
  onCommit,
}: UseInlineAutocompleteOptions) {
  const [match, setMatch] = useState<ActiveMatch | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorPosition, setAnchorPosition] = useState<CaretPosition | null>(null);

  const items = match ? buildSuggestions(match, noteTitles, mentionItems) : [];

  const refresh = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      setMatch(null);
      return;
    }

    const cursor = textarea.selectionStart;
    const textBeforeCursor = textarea.value.slice(0, cursor);
    const wikiMatch = textBeforeCursor.match(WIKI_TRIGGER_PATTERN);
    const mentionMatch = !wikiMatch ? textBeforeCursor.match(MENTION_TRIGGER_PATTERN) : null;

    if (wikiMatch) {
      const query = wikiMatch[1];
      const start = cursor - query.length - 2;
      setMatch({ end: cursor, query, start, trigger: "[[" });
      setActiveIndex(0);
      setAnchorPosition(measureCaretPosition(textarea, start));
      return;
    }

    if (mentionMatch) {
      const query = mentionMatch[1];
      const start = cursor - query.length - 1;
      setMatch({ end: cursor, query, start, trigger: "@" });
      setActiveIndex(0);
      setAnchorPosition(measureCaretPosition(textarea, start));
      return;
    }

    setMatch(null);
  }, [textareaRef]);

  const close = useCallback(() => {
    setMatch(null);
  }, []);

  const commitItem = useCallback(
    (item: AutocompleteItem) => {
      const textarea = textareaRef.current;

      if (!textarea || !match) {
        return;
      }

      const insertText = buildInsertText(item);
      const before = textarea.value.slice(0, match.start);
      const after = textarea.value.slice(match.end);
      const nextValue = before + insertText + after;
      const nextCursor = before.length + insertText.length;

      setMatch(null);
      onCommit(nextValue, nextCursor);
    },
    [match, onCommit, textareaRef],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!match || items.length === 0) {
        return false;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % items.length);
        return true;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + items.length) % items.length);
        return true;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        commitItem(items[activeIndex]);
        return true;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return true;
      }

      return false;
    },
    [activeIndex, close, commitItem, items, match],
  );

  return {
    activeIndex,
    anchorPosition,
    close,
    handleKeyDown,
    handleSelect: commitItem,
    isOpen: Boolean(match) && items.length > 0,
    items,
    refresh,
    trigger: match?.trigger ?? null,
  };
}

function buildSuggestions(
  match: ActiveMatch,
  noteTitles: string[],
  mentionItems: MentionItem[],
): AutocompleteItem[] {
  const query = match.query.trim().toLowerCase();

  if (match.trigger === "[[") {
    const suggestions = noteTitles
      .filter((title) => title.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS)
      .map((title): AutocompleteItem => ({ id: title, label: title, type: "note" }));

    const trimmedQuery = match.query.trim();
    const hasExactMatch = noteTitles.some((title) => title.toLowerCase() === query);

    if (trimmedQuery && !hasExactMatch) {
      suggestions.push({
        id: trimmedQuery,
        label: `Vytvořit „${trimmedQuery}“`,
        type: "note-create",
      });
    }

    return suggestions;
  }

  return mentionItems
    .filter((item) => item.label.toLowerCase().includes(query))
    .slice(0, MAX_SUGGESTIONS)
    .map((item): AutocompleteItem => ({ id: item.id, label: item.label, type: item.type }));
}

function buildInsertText(item: AutocompleteItem): string {
  if (item.type === "note") {
    return `[[${item.label}]]`;
  }

  if (item.type === "note-create") {
    return `[[${item.id}]]`;
  }

  const scheme = item.type === "task" ? "app-task" : "app-project";

  return `[${item.label}](${scheme}://${item.id})`;
}

function measureCaretPosition(textarea: HTMLTextAreaElement, caretIndex: number): CaretPosition {
  const mirror = document.createElement("div");
  const style = window.getComputedStyle(textarea);
  const propertiesToCopy = [
    "boxSizing",
    "width",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
  ] as const;

  for (const property of propertiesToCopy) {
    mirror.style.setProperty(kebabCase(property), style.getPropertyValue(kebabCase(property)));
  }

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.textContent = textarea.value.slice(0, caretIndex);

  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const markerTop = marker.offsetTop;
  const markerLeft = marker.offsetLeft;
  const lineHeight = parseFloat(style.lineHeight || "16") || 16;

  document.body.removeChild(mirror);

  return {
    left: textarea.offsetLeft + markerLeft - textarea.scrollLeft,
    top: textarea.offsetTop + markerTop + lineHeight - textarea.scrollTop,
  };
}

function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
}
