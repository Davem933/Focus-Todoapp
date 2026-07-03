import { useEffect, useState, type ReactNode } from "react";
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
  currentUserId: string | null;
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
  currentUserId,
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
              : "Workspace se nepodarilo nacist.",
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
  const welcomeName = currentMember
    ? formatWorkspaceUserName(currentMember.email)
    : "tam";
  const memberById = new Map(members.map((member) => [member.userId, member]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const activity = buildWorkspaceActivityItems(tasks, memberById, projectById, today).slice(0, 5);
  const welcomeSummary = getWorkspaceWelcomeSummary({
    activeProjects: activeProjects.length,
    dueTodayCount,
    memberCount: members.length,
    overdueCount,
  });

  return (
    <section className="app-panel workspace-home" aria-label="Workspace home">
      <div className="workspace-home__hero">
        <div>
          <span className="workspace-home__eyebrow">Workspace overview</span>
          <h2>Vitej zpet, {welcomeName}</h2>
          <p>{welcomeSummary}</p>
        </div>
      </div>

      <div className="workspace-home__grid">
        <div className="workspace-home__main">
          <section className="workspace-home__section">
            <div className="workspace-home__section-head">
              <h3>Rychly prehled</h3>
            </div>
            <div className="workspace-home__metrics">
              <MetricCard
                icon={<Users aria-hidden="true" size={16} />}
                label="Clenove tymu"
                tone="purple"
                value={members.length}
                detail={members.length > 0 ? members.length + " v tymu" : "Zatim bez clenu"}
                avatars={members.slice(0, 4).map((member) => getMemberInitials(member.email))}
              />
              <MetricCard
                icon={<FolderKanban aria-hidden="true" size={16} />}
                label="Bezici nastenky"
                tone="blue"
                value={activeProjects.length}
                detail={projects.length > 0 ? projects.length + " celkem" : "Zatim zadna"}
              />
              <MetricCard
                icon={<Clock3 aria-hidden="true" size={16} />}
                label="Termin dnes"
                tone={overdueCount > 0 ? "danger" : "orange"}
                value={dueTodayCount + overdueCount}
                detail={overdueCount > 0 ? overdueCount + " po terminu" : "Dnes bez skluzu"}
              />
            </div>
          </section>

          <section className="workspace-home__section workspace-home__boards">
            <div className="workspace-home__section-head">
              <h3>Stav nastenek</h3>
              <button type="button" onClick={onOpenProjectsOverview}>
                Otevrit vse
                <ArrowRight aria-hidden="true" size={15} />
              </button>
            </div>

            {error ? <p className="workspace-home__error">{error}</p> : null}
            {isLoading && projects.length === 0 ? (
              <p className="workspace-home__empty">Nacitam stav workspace...</p>
            ) : null}
            {!isLoading && projects.length === 0 ? (
              <div className="workspace-home__empty-card">
                <strong>Zatim tu neni zadna nastenka</strong>
                <span>Vytvor prvni board a dej tymu jasny tok prace.</span>
                <button type="button" onClick={onCreateBoard}>
                  <PlusSquare aria-hidden="true" size={16} />
                  Nova nastenka
                </button>
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
                      <div className="workspace-home__progress-row" aria-label={"Dokonceno " + stats.progress + " procent"}>
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
          <section className="workspace-home__section workspace-home__actions">
            <div className="workspace-home__section-head">
              <h3>Rychle akce</h3>
            </div>
            <div className="workspace-home__action-grid">
              <button type="button" onClick={onCreateTeam}>
                <Users aria-hidden="true" size={17} />
                <span>Novy tym</span>
              </button>
              <button type="button" onClick={onCreateBoard}>
                <FolderKanban aria-hidden="true" size={17} />
                <span>Nova nastenka</span>
              </button>
            </div>
          </section>

          <section className="workspace-home__section workspace-home__activity">
            <div className="workspace-home__section-head">
              <h3>Tymova aktivita</h3>
              <Activity aria-hidden="true" size={16} />
            </div>
            {activity.length === 0 ? (
              <p className="workspace-home__empty">Jakmile pribudou ukoly a pohyb na boardech, objevi se tady.</p>
            ) : (
              <div className="workspace-home__activity-list">
                {activity.map((item) => {
                  const content = (
                    <>
                      <span className="workspace-home__activity-avatar" data-tone={item.tone}>
                        {item.actor.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="workspace-home__activity-copy">
                        <strong>{item.actor}</strong>
                        <p>{item.detail}</p>
                        <small data-tone={item.tone}>{item.status}</small>
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
          </section>
        </aside>
      </div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
  avatars = [],
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  tone: "purple" | "blue" | "orange" | "danger";
  avatars?: string[];
}) {
  return (
    <article className="workspace-home__metric-card" data-tone={tone}>
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
    </article>
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
      ? "Tym je pripraveny. Ted chybi uz jen nastenky a prvni fokus."
      : "Zacni sestavenim tymu a prvni nastenky.";
  }

  if (overdueCount > 0) {
    return "Bezi " + formatBoardCount(activeProjects) + " a " + formatTaskCount(overdueCount) + " je po terminu.";
  }

  if (dueTodayCount > 0) {
    return "Bezi " + formatBoardCount(activeProjects) + " a dnes ceka " + formatTaskCount(dueTodayCount) + ".";
  }

  return "Bezi " + formatBoardCount(activeProjects) + " a tym ma otevreno " + formatTaskCount(Math.max(activeProjects, 1)) + ".";
}

function buildWorkspaceActivityItems(
  tasks: Task[],
  memberById: Map<string, TeamMember>,
  projectById: Map<string, Project>,
  today: string,
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
      ? getMemberDisplayName(assignee.email)
      : projectById.get(task.projectId ?? "")?.name ?? "Workspace";
    const projectName = task.projectId ? projectById.get(task.projectId)?.name : null;

    if (task.completed) {
      result.push({
        id: "completed-" + task.id,
        actor,
        detail: projectName
          ? task.title + " na " + projectName + " je hotovy ukol."
          : task.title + " je hotovy ukol.",
        status: "Hotovo",
        taskId: task.id,
        tone: "success",
      });
    } else if (task.dueDate && task.dueDate < today) {
      result.push({
        id: "overdue-" + task.id,
        actor,
        detail: projectName
          ? task.title + " na " + projectName + " potrebuje pozornost."
          : task.title + " potrebuje pozornost.",
        status: "Po terminu",
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
          ? task.title + " bezi na " + projectName + "."
          : task.title + " je v pohybu.",
        status: task.priority === "high" ? "Priorita" : "V procesu",
        taskId: task.id,
        tone: "default",
      });
    }

    if (result.length >= 6) {
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
        ? formatTaskCount(overdueCount) + " po terminu"
        : projectTasks.length > 0
          ? "Hotovo " + completedCount + " z " + projectTasks.length
          : "Zatim bez ukolu",
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
      return "Aktivni";
  }
}

function getMemberDisplayName(email: string) {
  return email.split("@")[0] || email;
}

function formatWorkspaceUserName(email: string) {
  const baseName = getMemberDisplayName(email);
  const parts = baseName
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

  return parts.join(" ") || "tam";
}

function getMemberInitials(email: string) {
  const name = getMemberDisplayName(email);
  const parts = name.split(/[._\\-\\s]+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function formatTaskCount(count: number) {
  if (count === 1) {
    return "1 ukol";
  }

  if (count >= 2 && count <= 4) {
    return count + " ukoly";
  }

  return count + " ukolu";
}

function formatBoardCount(count: number) {
  if (count === 1) {
    return "1 nastenka";
  }

  if (count >= 2 && count <= 4) {
    return count + " nastenky";
  }

  return count + " nastenek";
}
