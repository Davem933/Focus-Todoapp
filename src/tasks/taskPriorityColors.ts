import type { TaskPriority } from "./taskTypes";
import type { DropdownOption } from "../layout/CustomDropdown";

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: "#7c8aa8",
  low: "#38bdf8",
  medium: "#f59e0b",
  high: "#f43f5e",
};

export const BOARD_CARD_PRIORITY_OPTIONS: TaskPriority[] = ["none", "low", "medium", "high"];

export const BOARD_CARD_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "Zadna",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const BOARD_CARD_PRIORITY_DROPDOWN_OPTIONS: DropdownOption[] = BOARD_CARD_PRIORITY_OPTIONS.map((option) => ({
  value: option,
  label: BOARD_CARD_PRIORITY_LABELS[option],
}));
