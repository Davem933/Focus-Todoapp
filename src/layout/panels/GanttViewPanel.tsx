import { useMemo, useRef, useState } from "react";
import { Gantt, Willow, WillowDark } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import type { IApi } from "@svar-ui/gantt-store";
import type { Task, TaskUpdate } from "../../tasks/taskTypes";
import { toGanttLinks, toGanttTasks, fromDragUpdate, fromProgressUpdate } from "../../gantt/ganttAdapter";

type GanttZoomMode = "day" | "week" | "month";

const ZOOM_SCALES: Record<GanttZoomMode, { unit: string; step: number; format: string }[]> = {
  day: [
    { unit: "month", step: 1, format: "%F %Y" },
    { unit: "day", step: 1, format: "%j" },
  ],
  week: [
    { unit: "month", step: 1, format: "%F %Y" },
    { unit: "week", step: 1, format: "'týden' %W" },
  ],
  month: [{ unit: "month", step: 1, format: "%F %Y" }],
};

type GanttViewPanelProps = {
  tasks: Task[];
  currentUserId: string | null;
  themeMode: "dark" | "light";
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onOpenTask: (taskId: string) => void;
};

export function GanttViewPanel({ tasks, currentUserId, themeMode, onUpdateTask, onOpenTask }: GanttViewPanelProps) {
  const [zoomMode, setZoomMode] = useState<GanttZoomMode>("day");
  const apiRef = useRef<IApi | null>(null);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.assigneeId === currentUserId || task.ownerId === currentUserId),
    [tasks, currentUserId],
  );

  const ganttTasks = useMemo(() => toGanttTasks(visibleTasks), [visibleTasks]);
  const ganttLinks = useMemo(() => toGanttLinks(visibleTasks), [visibleTasks]);

  const ThemeWrapper = themeMode === "light" ? Willow : WillowDark;

  function handleJumpToToday() {
    apiRef.current?.exec("scroll-chart", { date: new Date() });
  }

  return (
    <div className="app-panel gantt-view-panel">
      <div className="gantt-view-panel__toolbar">
        <div className="gantt-view-panel__zoom" role="group" aria-label="Měřítko">
          <button type="button" data-active={zoomMode === "day"} onClick={() => setZoomMode("day")}>
            Dny
          </button>
          <button type="button" data-active={zoomMode === "week"} onClick={() => setZoomMode("week")}>
            Týdny
          </button>
          <button type="button" data-active={zoomMode === "month"} onClick={() => setZoomMode("month")}>
            Měsíce
          </button>
        </div>
        <button type="button" className="gantt-view-panel__today-button" onClick={handleJumpToToday}>
          Dnes
        </button>
      </div>
      <div className="gantt-view-panel__chart">
        <ThemeWrapper>
          <Gantt
            tasks={ganttTasks}
            links={ganttLinks}
            scales={ZOOM_SCALES[zoomMode]}
            init={(api: IApi) => {
              apiRef.current = api;

              api.intercept("delete-link", ({ id }) => {
                const link = api.getState().links.byId(id);

                if (!link) {
                  return;
                }

                const targetTask = visibleTasks.find((task) => task.id === String(link.target));

                if (!targetTask) {
                  return;
                }

                onUpdateTask(targetTask.id, {
                  dependencies: targetTask.dependencies.filter(
                    (dependencyId) => dependencyId !== String(link.source),
                  ),
                });
              });
            }}
            onUpdateTask={({ id, task, inProgress }) => {
              if (inProgress) {
                return;
              }

              const ganttTask = ganttTasks.find((entry) => entry.id === String(id));

              if (!ganttTask) {
                return;
              }

              onUpdateTask(String(id), {
                ...fromDragUpdate(task.start ?? ganttTask.start, task.end ?? ganttTask.end),
                ...fromProgressUpdate(task.progress ?? ganttTask.progress),
              });
            }}
            onAddLink={({ link }) => {
              if (link.source === undefined || link.target === undefined) {
                return;
              }

              const targetTask = visibleTasks.find((task) => task.id === String(link.target));

              if (!targetTask || targetTask.dependencies.includes(String(link.source))) {
                return;
              }

              onUpdateTask(targetTask.id, {
                dependencies: [...targetTask.dependencies, String(link.source)],
              });
            }}
            onSelectTask={({ id }) => onOpenTask(String(id))}
          />
        </ThemeWrapper>
      </div>
    </div>
  );
}
