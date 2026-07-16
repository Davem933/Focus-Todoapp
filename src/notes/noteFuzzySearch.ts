import type { Note } from "./noteTypes";

const CONSECUTIVE_BONUS = 8;
const WORD_BOUNDARY_BONUS = 6;
const BASE_MATCH_SCORE = 1;

export function scoreFuzzyMatch(query: string, target: string): number | null {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTarget = target.toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;
  let targetIndex = 0;
  let previousMatchIndex = -2;

  for (let queryIndex = 0; queryIndex < normalizedQuery.length; queryIndex += 1) {
    const char = normalizedQuery[queryIndex];
    const foundIndex = normalizedTarget.indexOf(char, targetIndex);

    if (foundIndex === -1) {
      return null;
    }

    score += BASE_MATCH_SCORE;

    if (foundIndex === previousMatchIndex + 1) {
      score += CONSECUTIVE_BONUS;
    }

    if (foundIndex === 0 || /[\s\-_/]/.test(normalizedTarget[foundIndex - 1])) {
      score += WORD_BOUNDARY_BONUS;
    }

    previousMatchIndex = foundIndex;
    targetIndex = foundIndex + 1;
  }

  score += Math.max(0, 20 - normalizedTarget.length) * 0.1;

  return score;
}

export function rankNotesByQuery(notes: Note[], query: string): Note[] {
  const trimmed = query.trim();

  if (!trimmed) {
    return notes;
  }

  const scored = notes
    .map((note) => ({ note, score: scoreFuzzyMatch(trimmed, note.title) }))
    .filter((entry): entry is { note: Note; score: number } => entry.score !== null);

  scored.sort((left, right) => right.score - left.score);

  return scored.map((entry) => entry.note);
}
