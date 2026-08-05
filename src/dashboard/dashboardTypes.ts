export type DashboardWidgetKind =
  | "stats"
  | "priority"
  | "upcoming"
  | "assigneePie"
  | "assigneeBar"
  | "labels"
  | "projectBreakdown"
  | "workload"
  | "memberPriority";

export type DashboardWidgetLayoutItem = {
  i: DashboardWidgetKind;
  x: number;
  y: number;
  w: number;
  h: number;
};
