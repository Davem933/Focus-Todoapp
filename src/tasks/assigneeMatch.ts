import type { TeamMember } from "../teams/teamTypes";
import { getMemberDisplayName } from "../teams/teamMemberDisplay";

export function matchAssigneeIdByName(name: string, members: TeamMember[]): string | null {
  const normalizedName = normalizeForMatch(name);

  if (!normalizedName) {
    return null;
  }

  const exactMatch = members.find(
    (member) => normalizeForMatch(getMemberDisplayName(member)) === normalizedName,
  );

  if (exactMatch) {
    return exactMatch.userId;
  }

  const partialMatch = members.find((member) => {
    const displayName = normalizeForMatch(getMemberDisplayName(member));
    return displayName.includes(normalizedName) || normalizedName.includes(displayName);
  });

  return partialMatch ? partialMatch.userId : null;
}

const COMBINING_DIACRITICS_PATTERN = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS_PATTERN, "")
    .toLowerCase()
    .trim();
}
