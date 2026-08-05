import { useMemo, useState } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Plus, RotateCcw } from "lucide-react";
import { DashboardWidget } from "./DashboardWidget";
import { StatsOverviewWidget } from "./widgets/StatsOverviewWidget";
import { PriorityBreakdownWidget } from "./widgets/PriorityBreakdownWidget";
import { UpcomingTasksWidget } from "./widgets/UpcomingTasksWidget";
import {
  getDefaultDashboardLayout,
  loadDashboardLayout,
  loadHiddenWidgets,
  saveDashboardLayout,
  saveHiddenWidgets,
} from "./dashboardLayoutStorage";
import type { DashboardWidgetKind, DashboardWidgetLayoutItem } from "./dashboardTypes";
import type { Task, TaskUpdate } from "../tasks/taskTypes";

const GridLayoutWithWidth = WidthProvider(GridLayout);

const WIDGET_TITLES: Record<DashboardWidgetKind, string> = {
  stats: "Přehled statistik",
  priority: "Rozdělení podle priorit",
  upcoming: "Nadcházející úkoly",
};

const ALL_WIDGET_KINDS: DashboardWidgetKind[] = ["stats", "priority", "upcoming"];

type DashboardPanelProps = {
  tasks: Task[];
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onOpenTask: (taskId: string) => void;
};

export function DashboardPanel({ tasks, onUpdateTask, onOpenTask }: DashboardPanelProps) {
  const [layout, setLayout] = useState<DashboardWidgetLayoutItem[]>(() => loadDashboardLayout());
  const [hiddenWidgets, setHiddenWidgets] = useState<DashboardWidgetKind[]>(() => loadHiddenWidgets());
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const visibleLayout = useMemo(
    () => layout.filter((item) => !hiddenWidgets.includes(item.i)),
    [layout, hiddenWidgets],
  );

  const availableToAdd = ALL_WIDGET_KINDS.filter((kind) => hiddenWidgets.includes(kind));

  function handleLayoutChange(nextLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>) {
    if (!isEditMode) {
      return;
    }

    const merged: DashboardWidgetLayoutItem[] = layout.map((item) => {
      const updated = nextLayout.find((entry) => entry.i === item.i);
      return updated ? { i: item.i, x: updated.x, y: updated.y, w: updated.w, h: updated.h } : item;
    });

    setLayout(merged);
    saveDashboardLayout(merged);
  }

  function handleHideWidget(kind: DashboardWidgetKind) {
    const next = [...hiddenWidgets, kind];
    setHiddenWidgets(next);
    saveHiddenWidgets(next);
  }

  function handleAddWidget(kind: DashboardWidgetKind) {
    const next = hiddenWidgets.filter((hidden) => hidden !== kind);
    setHiddenWidgets(next);
    saveHiddenWidgets(next);
    setIsAddMenuOpen(false);

    if (layout.some((item) => item.i === kind)) {
      return;
    }

    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    const nextLayout = [...layout, { i: kind, x: 0, y: maxY, w: 6, h: 4 }];
    setLayout(nextLayout);
    saveDashboardLayout(nextLayout);
  }

  function handleResetLayout() {
    const defaultLayout = getDefaultDashboardLayout();
    setLayout(defaultLayout);
    setHiddenWidgets([]);
    saveDashboardLayout(defaultLayout);
    saveHiddenWidgets([]);
  }

  function renderWidgetContent(kind: DashboardWidgetKind) {
    switch (kind) {
      case "stats":
        return <StatsOverviewWidget tasks={tasks} />;
      case "priority":
        return <PriorityBreakdownWidget tasks={tasks} />;
      case "upcoming":
        return (
          <UpcomingTasksWidget
            tasks={tasks}
            onToggleTaskCompleted={(taskId, completed) => onUpdateTask(taskId, { completed })}
            onOpenTask={onOpenTask}
          />
        );
      default:
        return null;
    }
  }

  return (
    <section className="app-panel dashboard-panel" aria-label="Dashboard">
      <div className="dashboard-panel__toolbar">
        <h2>Dashboard</h2>
        <div className="dashboard-panel__toolbar-actions">
          {isEditMode ? (
            <button type="button" onClick={handleResetLayout}>
              <RotateCcw aria-hidden="true" size={15} />
              Obnovit výchozí rozvržení
            </button>
          ) : null}
          {isEditMode && availableToAdd.length > 0 ? (
            <div className="dashboard-panel__add-menu">
              <button type="button" onClick={() => setIsAddMenuOpen((open) => !open)}>
                <Plus aria-hidden="true" size={15} />
                Přidat widget
              </button>
              {isAddMenuOpen ? (
                <div className="dashboard-panel__add-menu-list" role="menu">
                  {availableToAdd.map((kind) => (
                    <button key={kind} type="button" role="menuitem" onClick={() => handleAddWidget(kind)}>
                      {WIDGET_TITLES[kind]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="dashboard-panel__edit-toggle"
            data-active={isEditMode}
            onClick={() => setIsEditMode((mode) => !mode)}
          >
            {isEditMode ? "Hotovo" : "Upravit dashboard"}
          </button>
        </div>
      </div>

      <div className="dashboard-panel__grid" data-edit-mode={isEditMode}>
        <GridLayoutWithWidth
          className="dashboard-panel__layout"
          layout={visibleLayout}
          cols={12}
          rowHeight={60}
          margin={[16, 16]}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          draggableHandle=".dashboard-widget__drag-handle"
          onLayoutChange={handleLayoutChange}
        >
          {visibleLayout.map((item) => (
            <div key={item.i}>
              <DashboardWidget
                kind={item.i}
                title={WIDGET_TITLES[item.i]}
                isEditMode={isEditMode}
                onHide={handleHideWidget}
              >
                {renderWidgetContent(item.i)}
              </DashboardWidget>
            </div>
          ))}
        </GridLayoutWithWidth>
      </div>
    </section>
  );
}
