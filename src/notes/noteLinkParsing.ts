import type { NoteReferenceTargetType, ParsedNoteReference } from "./noteTypes";

const WIKI_LINK_PATTERN = /\[\[([^\]\n]+)\]\]/g;
const MENTION_LINK_PATTERN = /\[([^\]\n]+)\]\(app-(task|project):\/\/([^)\s]+)\)/g;

export function resolveNoteTitleSlug(title: string): string {
  return title.trim().toLowerCase();
}

export function parseNoteLinks(markdown: string): ParsedNoteReference[] {
  const references: ParsedNoteReference[] = [];
  const seenKeys = new Set<string>();

  function addReference(targetType: NoteReferenceTargetType, targetKey: string, targetLabel: string) {
    const dedupeKey = targetType + ":" + targetKey;

    if (seenKeys.has(dedupeKey) || !targetKey) {
      return;
    }

    seenKeys.add(dedupeKey);
    references.push({ targetType, targetKey, targetLabel });
  }

  for (const match of markdown.matchAll(WIKI_LINK_PATTERN)) {
    const title = match[1].trim();

    if (title) {
      addReference("note", resolveNoteTitleSlug(title), title);
    }
  }

  for (const match of markdown.matchAll(MENTION_LINK_PATTERN)) {
    const [, label, targetType, id] = match;
    addReference(targetType as NoteReferenceTargetType, id, label.trim());
  }

  return references;
}

export function transformWikiLinksToMarkdownLinks(markdown: string): string {
  return markdown.replace(WIKI_LINK_PATTERN, (_fullMatch, rawTitle: string) => {
    const title = rawTitle.trim();

    return "[" + title + "](app-note://" + encodeURIComponent(title) + ")";
  });
}
