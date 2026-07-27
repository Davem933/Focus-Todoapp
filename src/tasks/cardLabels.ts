import type { TaskLabel } from "./taskTypes";

const BOARD_CARD_LABEL_COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

export function createCardLabels(value: string): TaskLabel[] {
  const names = normalizeCardLabelNames(value);

  return names.map((name, index) => ({
    id: "label-" + index + "-" + name.toLowerCase().replace(/\s+/g, "-"),
    name,
    color: getCardLabelColor(name),
  }));
}

export function normalizeCardLabelNames(value: string) {
  return value
    .split(",")
    .map((label) => label.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 5);
}

export function formatCardLabelsValue(value: string) {
  return normalizeCardLabelNames(value).join(", ");
}

export function appendCardLabelValue(currentValue: string, rawValue: string) {
  const names = normalizeCardLabelNames(currentValue);
  const existingNames = new Set(names.map((name) => name.toLowerCase()));

  for (const nextName of normalizeCardLabelNames(rawValue)) {
    const normalizedName = nextName.toLowerCase();

    if (existingNames.has(normalizedName) || names.length >= 5) {
      continue;
    }

    names.push(nextName);
    existingNames.add(normalizedName);
  }

  return names.join(", ");
}

export function getCardLabelColor(name: string) {
  const seed = name
    .toLowerCase()
    .split("")
    .reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return BOARD_CARD_LABEL_COLORS[seed % BOARD_CARD_LABEL_COLORS.length];
}
