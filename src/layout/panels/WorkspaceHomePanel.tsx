import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Clock3,
  FolderKanban,
  PlusSquare,
  Users,
} from "lucide-react";
import type { Project } from "../../projects/projectTypes";
import { loadProjectsForTeams } from "../../supabase/projectApi";
import { loadTeamMembers } from "../../supabase/teamApi";
import { getTodayDateValue } from "../../tasks/dateUtils";
import type { Task } from "../../tasks/taskTypes";
import type { Team, TeamMember } from "../../teams/teamTypes";

type WorkspaceHomePanelProps = {
  activeTeam: Team | null;
  canCreateBoard: boolean;
  canCreateTeam: boolean;
  currentUserId: string | null;
  currentUserEmail: string | null;
  currentUserNickname: string | null;
  tasks: Task[];
  onCreateBoard: () => void;
  onCreateTeam: () => void;
  onOpenProjectsOverview: () => void;
  onOpenTask: (taskId: string) => void;
};

type WorkspaceActivityItem = {
  id: string;
  actor: string;
  detail: string;
  status: string;
  tone: "default" | "danger" | "success";
  taskId: string | null;
};

export function WorkspaceHomePanel({
  activeTeam,
  canCreateBoard,
  canCreateTeam,
  currentUserId,
  currentUserEmail,
  currentUserNickname,
  tasks,
  onCreateBoard,
  onCreateTeam,
  onOpenProjectsOverview,
  onOpenTask,
}: WorkspaceHomePanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);

  useEffect(() => {
    if (!activeTeam) {
      setProjects([]);
      setMembers([]);
      return;
    }

    let isCancelled = false;
    const team = activeTeam;

    async function loadWorkspaceHome() {
      setIsLoading(true);
      setError(null);

      try {
        const [nextProjects, nextMembers] = await Promise.all([
          loadProjectsForTeams([team.id]),
          loadTeamMembers(team.id),
        ]);

        if (!isCancelled) {
          setProjects(nextProjects);
          setMembers(nextMembers);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setProjects([]);
          setMembers([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Pracovní prostor se nepodařilo načíst.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkspaceHome();

    return () => {
      isCancelled = true;
    };
  }, [activeTeam]);

  if (!activeTeam) {
    return null;
  }

  const today = getTodayDateValue();
  const activeTasks = tasks.filter((task) => !task.completed && !task.isArchived);
  const dueTodayCount = activeTasks.filter((task) => task.dueDate === today).length;
  const overdueCount = activeTasks.filter(
    (task) => task.dueDate !== null && task.dueDate < today,
  ).length;
  const activeProjects = projects.filter((project) => project.status === "active");
  const currentMember = currentUserId
    ? members.find((member) => member.userId === currentUserId) ?? null
    : null;
  const welcomeEmail = currentMember?.email ?? currentUserEmail ?? "";
  const welcomeName =
    currentUserNickname?.trim() || formatWorkspaceUserName(welcomeEmail);
  const memberById = new Map(members.map((member) => [member.userId, member]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const canExpandActivity = canCreateBoard;
  const allActivity = buildWorkspaceActivityItems(
    tasks,
    memberById,
    projectById,
    today,
    canExpandActivity ? 20 : 5,
  );
  const activity = isActivityExpanded ? allActivity : allActivity.slice(0, 5);
  const hasMoreActivity = canExpandActivity && allActivity.length > 5;
  const welcomeSummary = getWorkspaceWelcomeSummary({
    activeProjects: activeProjects.length,
    dueTodayCount,
    memberCount: members.length,
    overdueCount,
  });

  return (
    <section className="app-panel workspace-home" aria-label="Domov pracovního prostoru">
      <div className="workspace-home__hero">
        <div>
          <span className="workspace-home__eyebrow">Přehled pracovního prostoru</span>
          <h2>Vítej zpět{welcomeName ? `, ${welcomeName}` : ""}</h2>
          <p>{welcomeSummary}</p>
        </div>
      </div>

      <div className="workspace-home__grid">
        <div className="workspace-home__main">
          <section className="workspace-home__section">
            <div className="workspace-home__section-head">
              <h3>Rychlý přehled</h3>
            </div>
            <div className="workspace-home__metrics">
              <MetricCard
                index={0}
                icon={<Users aria-hidden="true" size={16} />}
                label="Členové týmu"
                tone="purple"
                value={members.length}
                detail={members.length > 0 ? members.length + " v týmu" : "Zatím bez členů"}
                avatars={members.slice(0, 4).map((member) => getMemberInitials(member))}
              />
              <MetricCard
                index={1}
                icon={<FolderKanban aria-hidden="true" size={16} />}
                label="Běžící nástěnky"
                tone="blue"
                value={activeProjects.length}
                detail={projects.length > 0 ? projects.length + " celkem" : "Zatím žádná"}
              />
              <MetricCard
                index={2}
                icon={<Clock3 aria-hidden="true" size={16} />}
                label="Termíny dnes"
                tone={overdueCount > 0 ? "danger" : "orange"}
                value={dueTodayCount + overdueCount}
                detail={overdueCount > 0 ? overdueCount + " po termínu" : "Dnes bez skluzu"}
              />
            </div>
          </section>

          <section className="workspace-home__section workspace-home__boards">
            <div className="workspace-home__section-head">
              <h3>Stav nástěnek</h3>
              <button type="button" onClick={onOpenProjectsOverview}>
                Otevřít vše
                <ArrowRight aria-hidden="true" size={15} />
              </button>
            </div>

            {error ? <p className="workspace-home__error">{error}</p> : null}
            {isLoading && projects.length === 0 ? (
              <p className="workspace-home__empty">Načítám stav pracovního prostoru...</p>
            ) : null}
            {!isLoading && projects.length === 0 ? (
              <div className="workspace-home__empty-card">
                <strong>Zatím tu není žádná nástěnka</strong>
                <span>Vytvoř první board a dej týmu jasný tok práce.</span>
                {canCreateBoard ? (
                  <button type="button" onClick={onCreateBoard}>
                    <PlusSquare aria-hidden="true" size={16} />
                    Nová nástěnka
                  </button>
                ) : null}
              </div>
            ) : null}
            {projects.length > 0 ? (
              <div className="workspace-home__board-list">
                {projects.map((project) => {
                  const stats = getProjectProgress(project, tasks, today);

                  return (
                    <article className="workspace-home__board-card" key={project.id}>
                      <div className="workspace-home__board-top">
                        <div>
                          <strong>{project.name}</strong>
                          <small>{stats.subtitle}</small>
                        </div>
                        <span data-status={project.status}>{getProjectStatusLabel(project.status)}</span>
                      </div>
                      <div className="workspace-home__progress-row" aria-label={"Dokončeno " + stats.progress + " procent"}>
                        <div className="workspace-home__progress-bar">
                          <span style={{ width: stats.progress + "%" }} />
                        </div>
                        <strong>{stats.progress}%</strong>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="workspace-home__side">
          {canCreateTeam || canCreateBoard ? (
            <section className="workspace-home__section workspace-home__actions">
              <div className="workspace-home__section-head">
                <h3>Rychlé akce</h3>
              </div>
              <div className="workspace-home__action-grid">
                {canCreateTeam ? (
                  <button type="button" onClick={onCreateTeam}>
                    <Users aria-hidden="true" size={15} />
                    <span>Nový tým</span>
                  </button>
                ) : null}
                {canCreateBoard ? (
                  <button type="button" onClick={onCreateBoard}>
                    <FolderKanban aria-hidden="true" size={15} />
                    <span>Nová nástěnka</span>
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="workspace-home__section workspace-home__activity">
            <div className="workspace-home__section-head">
              <h3>Týmová aktivita</h3>
              <Activity aria-hidden="true" size={16} />
            </div>
            {activity.length === 0 ? (
              <p className="workspace-home__empty">Jakmile přibudou úkoly a pohyb na boardech, objeví se tady.</p>
            ) : (
              <div className="workspace-home__activity-list">
                {activity.map((item) => {
                  const content = (
                    <>
                      <span className="workspace-home__activity-avatar" data-tone={item.tone}>
                        {item.actor.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="workspace-home__activity-copy">
                        <div className="workspace-home__activity-top">
                          <strong>{item.actor}</strong>
                          <small data-tone={item.tone}>{item.status}</small>
                        </div>
                        <p>{item.detail}</p>
                      </div>
                    </>
                  );

                  return item.taskId ? (
                    <button
                      className="workspace-home__activity-item workspace-home__activity-item--button"
                      key={item.id}
                      type="button"
                      onClick={() => onOpenTask(item.taskId as string)}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="workspace-home__activity-item" key={item.id}>
                      {content}
                    </div>
                  );
                })}
              </div>
            )}
            {hasMoreActivity ? (
              <button
                type="button"
                className="workspace-home__activity-toggle"
                onClick={() => setIsActivityExpanded((expanded) => !expanded)}
              >
                {isActivityExpanded ? "Zobrazit méně" : "Zobrazit více"}
              </button>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}

function MetricCard({
  index,
  icon,
  label,
  value,
  detail,
  tone,
  avatars = [],
}: {
  index: number;
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  tone: "purple" | "blue" | "orange" | "danger";
  avatars?: string[];
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.article
      className="workspace-home__metric-card"
      data-tone={tone}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
    >
      <div className="workspace-home__metric-head">
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
      {avatars.length > 0 ? (
        <div className="workspace-home__avatars" aria-hidden="true">
          {avatars.map((avatar) => (
            <span key={avatar}>{avatar}</span>
          ))}
        </div>
      ) : null}
    </motion.article>
  );
}

function getWorkspaceWelcomeSummary({
  activeProjects,
  dueTodayCount,
  memberCount,
  overdueCount,
}: {
  activeProjects: number;
  dueTodayCount: number;
  memberCount: number;
  overdueCount: number;
}) {
  if (activeProjects === 0 && dueTodayCount === 0 && overdueCount === 0) {
    return memberCount > 0
      ? "Tým je připravený. Teď chybí už jen nástěnky a první úkoly."
      : "Začni sestavením týmu a první nástěnky.";
  }

  if (overdueCount > 0) {
    return "Běží " + formatBoardCount(activeProjects) + " a " + formatTaskCount(overdueCount) + " je po termínu.";
  }

  if (dueTodayCount > 0) {
    return "Běží " + formatBoardCount(activeProjects) + " a dnes čeká " + formatTaskCount(dueTodayCount) + ".";
  }

  return "Běží " + formatBoardCount(activeProjects) + " a tým má otevřené " + formatTaskCount(Math.max(activeProjects, 1)) + ".";
}

function buildWorkspaceActivityItems(
  tasks: Task[],
  memberById: Map<string, TeamMember>,
  projectById: Map<string, Project>,
  today: string,
  limit = 6,
): WorkspaceActivityItem[] {
  const candidates = [
    ...tasks
      .filter((task) => !task.isArchived && !task.completed && task.dueDate !== null && task.dueDate < today)
      .sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? "")),
    ...tasks.filter((task) => !task.isArchived && !task.completed && task.dueDate === today),
    ...tasks.filter((task) => !task.isArchived && task.completed),
    ...tasks.filter((task) => !task.isArchived && !task.completed && task.priority === "high"),
  ];
  const seen = new Set<string>();
  const result: WorkspaceActivityItem[] = [];

  for (const task of candidates) {
    if (seen.has(task.id)) {
      continue;
    }

    seen.add(task.id);
    const assignee = task.assigneeId ? memberById.get(task.assigneeId) : null;
    const actor = assignee
      ? getMemberDisplayName(assignee)
      : projectById.get(task.projectId ?? "")?.name ?? "Workspace";
    const projectName = task.projectId ? projectById.get(task.projectId)?.name : null;

    if (task.completed) {
      result.push({
        id: "completed-" + task.id,
        actor,
        detail: projectName
          ? task.title + " na " + projectName + " je hotový úkol."
          : task.title + " je hotový úkol.",
        status: "Hotovo",
        taskId: task.id,
        tone: "success",
      });
    } else if (task.dueDate && task.dueDate < today) {
      result.push({
        id: "overdue-" + task.id,
        actor,
        detail: projectName
          ? task.title + " na " + projectName + " potřebuje pozornost."
          : task.title + " potřebuje pozornost.",
        status: "Po termínu",
        taskId: task.id,
        tone: "danger",
      });
    } else if (task.dueDate === today) {
      result.push({
        id: "today-" + task.id,
        actor,
        detail: projectName
          ? task.title + " na " + projectName + " je na dnes."
          : task.title + " je na dnes.",
        status: "Dnes",
        taskId: task.id,
        tone: "default",
      });
    } else {
      result.push({
        id: "active-" + task.id,
        actor,
        detail: projectName
          ? task.title + " běží na " + projectName + "."
          : task.title + " je v pohybu.",
        status: task.priority === "high" ? "Priorita" : "V procesu",
        taskId: task.id,
        tone: "default",
      });
    }

    if (result.length >= limit) {
      break;
    }
  }

  return result;
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

  return {
    progress,
    subtitle:
      overdueCount > 0
        ? formatTaskCount(overdueCount) + " po termínu"
        : projectTasks.length > 0
          ? "Hotovo " + completedCount + " z " + projectTasks.length
          : "Zatím bez úkolů",
  };
}

function getProjectStatusLabel(status: Project["status"]) {
  switch (status) {
    case "completed":
      return "Hotovo";
    case "paused":
      return "Pozastaveno";
    case "archived":
      return "Archiv";
    default:
      return "Aktivní";
  }
}

function getEmailLocalName(email: string) {
  return email.split("@")[0] || email;
}

function getMemberDisplayName(member: { email: string; nickname?: string | null }) {
  const nickname = member.nickname?.trim();
  if (nickname) {
    return nickname;
  }
  return getEmailLocalName(member.email);
}

function formatWorkspaceUserName(email: string) {
  const baseName = getEmailLocalName(email);
  const parts = baseName
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

  return parts.join(" ");
}

function getMemberInitials(member: { email: string; nickname?: string | null }) {
  const name = getMemberDisplayName(member);
  const parts = name.split(/[._\\-\\s]+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function formatTaskCount(count: number) {
  if (count === 1) {
    return "1 úkol";
  }

  if (count >= 2 && count <= 4) {
    return count + " úkoly";
  }

  return count + " úkolů";
}

function formatBoardCount(count: number) {
  if (count === 1) {
    return "1 nástěnka";
  }

  if (count >= 2 && count <= 4) {
    return count + " nástěnky";
  }

  return count + " nástěnek";
}
