import { useEffect, useMemo, useState } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Plus, RotateCcw } from "lucide-react";
import { DashboardWidget } from "./DashboardWidget";
import { StatsOverviewWidget } from "./widgets/StatsOverviewWidget";
import { PriorityBreakdownWidget } from "./widgets/PriorityBreakdownWidget";
import { UpcomingTasksWidget } from "./widgets/UpcomingTasksWidget";
import { AssigneePieWidget } from "./widgets/AssigneePieWidget";
import { AssigneeBarWidget } from "./widgets/AssigneeBarWidget";
import { LabelBreakdownWidget } from "./widgets/LabelBreakdownWidget";
import { ProjectBreakdownWidget } from "./widgets/ProjectBreakdownWidget";
import { WorkloadWidget } from "./widgets/WorkloadWidget";
import {
  getDefaultDashboardLayout,
  loadDashboardLayout,
  loadHiddenWidgets,
  saveDashboardLayout,
  saveHiddenWidgets,
} from "./dashboardLayoutStorage";
import type { DashboardWidgetKind, DashboardWidgetLayoutItem } from "./dashboardTypes";
import { loadTeamMembers } from "../supabase/teamApi";
import { loadProjectsForTeams } from "../supabase/projectApi";
import { getPriorityBreakdown } from "./priorityBreakdown";
import { getLabelBreakdown } from "./labelBreakdown";
import { getAssigneeBreakdown } from "./assigneeBreakdown";
import { getProjectBreakdown } from "./projectBreakdown";
import type { ExportRow } from "./dashboardExport";
import type { Task, TaskUpdate } from "../tasks/taskTypes";
import type { TeamMember } from "../teams/teamTypes";
import type { Project } from "../projects/projectTypes";

const GridLayoutWithWidth = WidthProvider(GridLayout);

const WIDGET_TITLES: Record<DashboardWidgetKind, string> = {
  stats: "Přehled statistik",
  priority: "Rozdělení podle priorit",
  upcoming: "Nadcházející úkoly",
  assigneePie: "Úkoly podle assignee (koláčový graf)",
  assigneeBar: "Úkoly podle assignee (sloupcový graf)",
  labels: "Rozdělení podle štítků",
  projectBreakdown: "Rozdělení podle nástěnky",
  workload: "Vytížení týmu",
};

const ALL_WIDGET_KINDS: DashboardWidgetKind[] = [
  "stats",
  "priority",
  "upcoming",
  "assigneePie",
  "assigneeBar",
  "labels",
  "projectBreakdown",
  "workload",
];

function getExportRowsForWidget(
  kind: DashboardWidgetKind,
  tasks: Task[],
  members: TeamMember[],
  projects: Project[],
): ExportRow[] | null {
  switch (kind) {
    case "priority":
      return getPriorityBreakdown(tasks).map((entry) => ({ Kategorie: entry.label, Počet: entry.count }));
    case "labels":
      return getLabelBreakdown(tasks).map((entry) => ({ Kategorie: entry.name, Počet: entry.count }));
    case "assigneePie":
    case "assigneeBar":
    case "workload":
      return getAssigneeBreakdown(tasks, members).map((entry) => ({ Kategorie: entry.name, Počet: entry.count }));
    case "projectBreakdown":
      return getProjectBreakdown(tasks, projects).map((entry) => ({ Kategorie: entry.name, Počet: entry.count }));
    case "stats":
    case "upcoming":
    default:
      return null;
  }
}

type DashboardPanelProps = {
  tasks: Task[];
  activeTeamId: string | null;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onOpenTask: (taskId: string) => void;
  onOpenProject: (projectId: string) => void;
};

export function DashboardPanel({
  tasks,
  activeTeamId,
  onUpdateTask,
  onOpenTask,
  onOpenProject,
}: DashboardPanelProps) {
  const [layout, setLayout] = useState<DashboardWidgetLayoutItem[]>(() => loadDashboardLayout());
  const [hiddenWidgets, setHiddenWidgets] = useState<DashboardWidgetKind[]>(() => loadHiddenWidgets());
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!activeTeamId) {
      setMembers([]);
      return;
    }

    let isCancelled = false;

    loadTeamMembers(activeTeamId)
      .then((nextMembers) => {
        if (!isCancelled) {
          setMembers(nextMembers);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setMembers([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTeamId]);

  useEffect(() => {
    if (!activeTeamId) {
      setProjects([]);
      return;
    }

    let isCancelled = false;

    loadProjectsForTeams([activeTeamId])
      .then((nextProjects) => {
        if (!isCancelled) {
          setProjects(nextProjects);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setProjects([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTeamId]);

  const visibleLayout = useMemo(
    () => layout.filter((item) => !hiddenWidgets.includes(item.i)),
    [layout, hiddenWidgets],
  );

  const visibleKinds = visibleLayout.map((item) => item.i);
  const availableToAdd = ALL_WIDGET_KINDS.filter((kind) => !visibleKinds.includes(kind));

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
      case "assigneePie":
        return <AssigneePieWidget tasks={tasks} members={members} />;
      case "assigneeBar":
        return <AssigneeBarWidget tasks={tasks} members={members} />;
      case "labels":
        return <LabelBreakdownWidget tasks={tasks} />;
      case "projectBreakdown":
        return <ProjectBreakdownWidget tasks={tasks} projects={projects} onOpenProject={onOpenProject} />;
      case "workload":
        return <WorkloadWidget tasks={tasks} members={members} />;
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
                exportRows={getExportRowsForWidget(item.i, tasks, members, projects) ?? undefined}
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
