export type LayoutViewport = "mobile" | "tablet" | "desktop";

export type LayoutMode =
  | "mobile-list-only"
  | "mobile-detail-only"
  | "tablet-list-detail"
  | "tablet-sidebar-list"
  | "desktop-sidebar-list"
  | "desktop-sidebar-list-detail";

export type VisiblePanel = "sidebar" | "list" | "detail";

export type AppLayoutState = {
  viewport: LayoutViewport;
  mode: LayoutMode;
  visiblePanels: VisiblePanel[];
};

export type UseAppLayoutOptions = {
  selectedTaskId: string | null;
};
