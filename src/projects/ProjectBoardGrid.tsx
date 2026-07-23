import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { Project } from "./projectTypes";
import type { Team } from "../teams/teamTypes";
import type { Task } from "../tasks/taskTypes";
import { getTodayDateValue } from "../tasks/dateUtils";

type ProjectBoardGridProps = {
  canManageProject: (project: Project) => boolean;
  projects: Project[];
  teamById: Map<string, Team>;
  tasks: Task[];
  isLoading: boolean;
  onOpenProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
};

export function ProjectBoardGrid({
  canManageProject,
  projects,
  teamById,
  tasks,
  isLoading,
  onOpenProject,
  onEditProject,
  onDeleteProject,
}: ProjectBoardGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const today = getTodayDateValue();
  const activeId = hoveredId ?? focusedId;
  const openMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (openMenuRef.current?.contains(target)) {
        return;
      }

      setOpenMenuId(null);
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openMenuId]);

  return (
    <div className="projects-overview__grid">
      {isLoading && projects.length === 0 ? (
        <p className="teams-overview__empty projects-overview__empty">Načítám nástěnky...</p>
      ) : null}
      {!isLoading && projects.length === 0 ? (
        <div className="projects-overview__empty-card">
          <strong>Zatím nemáš žádnou nástěnku</strong>
          <span>Vytvoř nástěnku, přiřaď ji týmu a dej práci jasný tok.</span>
        </div>
      ) : null}
      {projects.map((project, index) => {
        const projectTeam = teamById.get(project.teamId);
        const dateRange = formatProjectDateRange(project.startDate, project.endDate);
        const stats = getProjectProgress(project, tasks, today);
        const isActive = activeId === project.id;
        const canManage = canManageProject(project);

        return (
          <motion.div
            className="projects-overview__card-wrap"
            key={project.id}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03, ease: [0.16, 1, 0.3, 1] }}
            onMouseEnter={() => setHoveredId(project.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <AnimatePresence>
              {isActive ? (
                <motion.span
                  className="projects-overview__card-glow"
                  aria-hidden="true"
                  layoutId={prefersReducedMotion ? undefined : "projectsOverviewGlow"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.15 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                />
              ) : null}
            </AnimatePresence>
            <article
              className="projects-overview__card"
              role="button"
              tabIndex={0}
              onFocus={() => setFocusedId(project.id)}
              onBlur={() => setFocusedId(null)}
              onClick={() => onOpenProject(project)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenProject(project);
                }
              }}
            >
              <div className="projects-overview__card-header">
                <span className="projects-overview__team-pill">{projectTeam?.name ?? "Tým"}</span>
                <span className="projects-overview__card-header-right">
                  <span className="projects-overview__status" data-status={project.status}>
                    {getProjectStatusLabel(project.status)}
                  </span>
                  {canManage ? (
                    <span
                      className="projects-overview__card-menu"
                      ref={openMenuId === project.id ? openMenuRef : null}
                    >
                      <button
                        className="projects-overview__card-menu-button"
                        type="button"
                        aria-label={"Akce nástěnky " + project.name}
                        aria-expanded={openMenuId === project.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId((current) => (current === project.id ? null : project.id));
                        }}
                      >
                        <MoreVertical aria-hidden="true" size={16} />
                      </button>
                      {openMenuId === project.id ? (
                        <div className="projects-overview__card-menu-content" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuId(null);
                              onEditProject(project);
                            }}
                          >
                            <Pencil aria-hidden="true" size={15} />
                            Upravit nástěnku
                          </button>
                          <button
                            className="projects-overview__card-menu-danger"
                            type="button"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuId(null);
                              onDeleteProject(project);
                            }}
                          >
                            <Trash2 aria-hidden="true" size={15} />
                            Smazat nástěnku
                          </button>
                        </div>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </div>
              <h3>{project.name}</h3>
              {project.description ? <p>{project.description}</p> : <p>Bez popisu mise.</p>}
              <div className="workspace-home__progress-row" aria-label={"Dokončeno " + stats.progress + " procent"}>
                <div className="workspace-home__progress-bar">
                  <span style={{ width: stats.progress + "%" }} />
                </div>
                <strong>{stats.progress}%</strong>
              </div>
              <div className="projects-overview__meta">
                <span>{dateRange}</span>
              </div>
            </article>
          </motion.div>
        );
      })}
    </div>
  );
}

function getProjectProgress(project: Project, tasks: Task[], today: string) {
  const projectTasks = tasks.filter(
    (task) => task.projectId === project.id && !task.isArchived,
  );
  const completedCount = projectTasks.filter((task) => task.completed).length;
  const overdueCount = projectTasks.filter(
    (task) => !task.completed && task.dueDate !== null && task.dueDate < today,
  ).length;
  const progress = projectTasks.length === 0
    ? 0
    : Math.round((completedCount / projectTasks.length) * 100);

  return { progress, completedCount, overdueCount, total: projectTasks.length };
}

function getProjectStatusLabel(status: Project["status"]) {
  switch (status) {
    case "completed":
      return "Hotovo";
    case "paused":
      return "Pozastaveno";
    case "archived":
      return "Archiv";
    case "active":
    default:
      return "Aktivní";
  }
}

function formatProjectDateRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) {
    return formatShortDate(startDate) + " - " + formatShortDate(endDate);
  }

  if (startDate) {
    return "Od " + formatShortDate(startDate);
  }

  if (endDate) {
    return "Do " + formatShortDate(endDate);
  }

  return "Bez terminu";
}

function formatShortDate(value: string) {
  const [year, month, day] = value.split("-");

  return day && month && year ? day + "." + month + "." + year : value;
}
