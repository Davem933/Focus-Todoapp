export type DashboardWidgetKind = "stats" | "priority" | "upcoming" | "assigneePie" | "assigneeBar";

export type DashboardWidgetLayoutItem = {
  i: DashboardWidgetKind;
  x: number;
  y: number;
  w: number;
  h: number;
};
