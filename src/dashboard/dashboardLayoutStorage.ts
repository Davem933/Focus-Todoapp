import type { DashboardWidgetKind, DashboardWidgetLayoutItem } from "./dashboardTypes";

const STORAGE_KEY = "donext.dashboardLayout.v1";
const HIDDEN_STORAGE_KEY = "donext.dashboardHiddenWidgets.v1";

const VALID_KINDS: DashboardWidgetKind[] = [
  "stats",
  "priority",
  "upcoming",
  "assigneePie",
  "assigneeBar",
  "labels",
  "projectBreakdown",
  "workload",
];

const DEFAULT_LAYOUT: DashboardWidgetLayoutItem[] = [
  { i: "stats", x: 0, y: 0, w: 12, h: 2 },
  { i: "priority", x: 0, y: 2, w: 6, h: 4 },
  { i: "upcoming", x: 6, y: 2, w: 6, h: 4 },
];

export function getDefaultDashboardLayout(): DashboardWidgetLayoutItem[] {
  return DEFAULT_LAYOUT.map((item) => ({ ...item }));
}

function isDashboardWidgetLayoutItem(value: unknown): value is DashboardWidgetLayoutItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.i === "string" &&
    VALID_KINDS.includes(item.i as DashboardWidgetKind) &&
    typeof item.x === "number" &&
    typeof item.y === "number" &&
    typeof item.w === "number" &&
    typeof item.h === "number"
  );
}

export function loadDashboardLayout(): DashboardWidgetLayoutItem[] {
  if (typeof window === "undefined") {
    return getDefaultDashboardLayout();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return getDefaultDashboardLayout();
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return getDefaultDashboardLayout();
    }

    const items = parsed.filter(isDashboardWidgetLayoutItem);

    return items.length > 0 ? items : getDefaultDashboardLayout();
  } catch {
    return getDefaultDashboardLayout();
  }
}

export function saveDashboardLayout(layout: DashboardWidgetLayoutItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function loadHiddenWidgets(): DashboardWidgetKind[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HIDDEN_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((kind): kind is DashboardWidgetKind =>
      VALID_KINDS.includes(kind as DashboardWidgetKind),
    );
  } catch {
    return [];
  }
}

export function saveHiddenWidgets(hidden: DashboardWidgetKind[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(hidden));
}
