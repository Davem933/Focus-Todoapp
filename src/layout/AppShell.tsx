import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent, FormEvent, ReactNode, TouchEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BarChart3, Bell, CheckCircle2, FolderKanban, MailPlus, MoreVertical, Pencil, ShieldCheck, Sparkle, Trash2, UserPlus, Users, X } from "lucide-react";
import { useAppLayout } from "./useAppLayout";
import type { VisiblePanel } from "./layoutTypes";
import { getTodayDateValue } from "../tasks/dateUtils";
import { DetailPanel } from "./panels/DetailPanel";
import { ListPanel } from "./panels/ListPanel";
import { SidebarPanel } from "./panels/SidebarPanel";
import { WorkspaceHomePanel } from "./panels/WorkspaceHomePanel";
import { ProfilePanel } from "./panels/ProfilePanel";
import type { LayoutMode } from "./layoutTypes";
import { buildCountsByListId } from "../tasks/taskCounts";
import { buildCountsByTeamId } from "../teams/teamCounts";
import type { Team, TeamInvite, TeamMember } from "../teams/teamTypes";
import type { Project, ProjectColumn } from "../projects/projectTypes";
import {
  inviteTeamMemberByEmail,
  loadTeamInvites,
  loadTeamMembers,
  removeTeamMember,
  updateTeamInSupabase,
  updateTeamMemberRole,
} from "../supabase/teamApi";
import {
  archiveProjectColumn,
  createProjectColumn,
  createProjectInSupabase,
  deleteProjectColumn,
  deleteProjectInSupabase,
  loadProjectColumns,
  loadProjectsForTeams,
  updateProjectColumn,
  updateProjectInSupabase,
} from "../supabase/projectApi";
import {
  getDailyAttentionTasks,
  getDailyTaskStats,
} from "../tasks/taskDailyOverview";
import {
  getFocusProgress,
  getFocusScope,
  getFocusScopeTasks,
  getPrimaryTimeStatus,
  getRecommendedTasks,
  type RecommendedTask,
} from "../tasks/taskRecommendation";
import {
  getArchivedTasksForList,
  getVisibleTasksForList,
} from "../tasks/taskViews";
import type { Task, TaskLabel, TaskList, TaskPriority, TaskSubtask, TaskUpdate } from "../tasks/taskTypes";

type CreateTaskOptions = {
  assigneeId?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  labels?: TaskLabel[];
  note?: string;
  priority?: TaskPriority;
  projectId?: string | null;
  boardColumnKey?: Task["boardColumnKey"];
  subtasks?: TaskSubtask[];
  teamId?: string | null;
};

const BOARD_CARD_PRIORITY_OPTIONS: TaskPriority[] = ["none", "low", "medium", "high"];
const BOARD_CARD_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "Zadna",
  low: "Low",
  medium: "Medium",
  high: "High",
};
const BOARD_CARD_LABEL_COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
type AppShellProps = {
  tasks: Task[];
  allTasks: Task[];
  lists: TaskList[];
  allLists: TaskList[];
  activeListId: string;
  selectedTaskId: string | null;
  themeMode: "dark" | "light";
  currentUserId: string | null;
  isGlobalAdmin: boolean;
  onSelectList: (listId: string) => void;
  onCreateList: (name: string, color?: string | null) => void;
  onRenameList: (listId: string, name: string) => void;
  onArchiveList: (listId: string) => void;
  onRestoreList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onSelectTask: (taskId: string) => void;
  onCreateTask: (title: string, options?: CreateTaskOptions) => string | null;
  onCreateTeam: (name: string, color?: string | null, description?: string | null) => Promise<Team | null | void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onTeamUpdated: (team: Team) => void;
  onSelectWorkspace: (teamId: string | null) => void;
  activeTeamId: string | null;
  teams: Team[];
  onUpdateTask: (taskId: string, update: TaskUpdate) => void;
  onArchiveTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  deletedTaskUndo: Task | null;
  onUndoDeleteTask: () => void;
  archivedTaskUndo: Task | null;
  onUndoArchiveTask: () => void;
  missedNotificationTask: Task | null;
  onOpenMissedNotificationTask: () => void;
  onDismissMissedNotification: () => void;
  onStartFocus: (taskId: string) => void;
  onClearTaskSelection: () => void;
  onToggleTheme: () => void;
  userEmail: string | null;
  userCreatedAt: string | null;
  nickname: string | null;
  authError: string | null;
  authMessage: string | null;
  isAuthActionLoading: boolean;
  onUpdateNickname: (nickname: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function AppShell(props: AppShellProps) {
  const {
    tasks,
    allTasks,
    lists,
    allLists,
    activeListId,
    selectedTaskId,
    themeMode,
    isGlobalAdmin,
    currentUserId,
    onSelectList,
    onCreateList,
    onRenameList,
    onArchiveList,
    onRestoreList,
    onDeleteList,
    onSelectTask,
    onCreateTask,
    onCreateTeam,
    onDeleteTeam,
    onTeamUpdated,
    onSelectWorkspace,
    activeTeamId,
    teams,
    onUpdateTask,
    onArchiveTask,
    onDeleteTask,
    deletedTaskUndo,
    onUndoDeleteTask,
    archivedTaskUndo,
    onUndoArchiveTask,
    missedNotificationTask,
    onOpenMissedNotificationTask,
    onDismissMissedNotification,
    onStartFocus,
    onClearTaskSelection,
    onToggleTheme,
    userEmail,
    userCreatedAt,
    nickname,
    authError,
    authMessage,
    isAuthActionLoading,
    onUpdateNickname,
    onSignOut,
  } = props;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFocusAssistantOpen, setIsFocusAssistantOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isWorkspaceHomeOpen, setIsWorkspaceHomeOpen] = useState(false);
  const [isTeamsOverviewOpen, setIsTeamsOverviewOpen] = useState(false);
  const [isProjectsOverviewOpen, setIsProjectsOverviewOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const layout = useAppLayout({
    selectedTaskId,
    isListSlotOverlayOpen:
      isWorkspaceHomeOpen || isTeamsOverviewOpen || isProjectsOverviewOpen || isProfileOpen,
  });
  const [teamCreateRequestToken, setTeamCreateRequestToken] = useState(0);
  const [projectCreateRequestToken, setProjectCreateRequestToken] = useState(0);
  const drawerTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [recommendationMessage, setRecommendationMessage] = useState<
    string | null
  >(null);
  const [recommendedTaskIndex, setRecommendedTaskIndex] = useState(0);
  const isMobileLayout =
    layout.mode === "mobile-list-only" || layout.mode === "mobile-detail-only";
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  function handleDeleteTaskAction(taskId: string) {
    onDeleteTask(taskId);
  }
  const globalFocusScope = getFocusScope(lists, activeListId, "global");
  const listFocusScope = getFocusScope(lists, activeListId, "list");
  const listVisibleTasks = getVisibleTasksForList(tasks, lists, activeListId);
  const dashboardSummary = getDashboardSummary(
    listVisibleTasks,
    listFocusScope.activeView === "user-list" ? "v tomto seznamu" : "v tomto pohledu",
  );
  const checkInSummary = getCheckInSummary(
    listVisibleTasks,
    listFocusScope.activeView === "user-list" ? "v tomto seznamu" : "v tomto pohledu",
  );
  const assistantRecommendedTasks = getRecommendedTasks(tasks, listFocusScope);
  const visibleTasks = orderVisibleTasksForList(
    listVisibleTasks,
    getRecommendedTasks(listVisibleTasks, listFocusScope),
  );
  const archivedTasks = getArchivedTasksForList(tasks, lists, activeListId);
  const countsByListId = buildCountsByListId(tasks, lists);
  const countsByTeamId = buildCountsByTeamId(allTasks);
  const dailyStats = getDailyTaskStats(tasks, globalFocusScope);
  const dailyAttentionOverview = getDailyAttentionTasks(
    tasks,
    globalFocusScope,
  );
  const currentRecommendedTasks = getRecommendedTasks(tasks, globalFocusScope);
  const recommendedTaskPreview =
    currentRecommendedTasks[recommendedTaskIndex] ?? null;
  const [assistantTaskIndex, setAssistantTaskIndex] = useState(0);
  const assistantRecommendation =
    assistantRecommendedTasks[assistantTaskIndex] ?? null;
  const dailyFocusTasks = getFocusScopeTasks(tasks, globalFocusScope);
  const dailyProgress = getFocusProgress(
    tasks,
    globalFocusScope,
    recommendedTaskPreview?.task.id ?? null,
  );
  const dailyNextTasks = currentRecommendedTasks
    .slice(recommendedTaskIndex + 1, recommendedTaskIndex + 3)
    .map(({ task }) => task);

  useEffect(() => {
    if (!isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (activeTeamId === null) {
      setIsWorkspaceHomeOpen(false);
    }
  }, [activeTeamId]);

  useEffect(() => {
    setRecommendedTaskIndex(0);
    setAssistantTaskIndex(0);
    setRecommendationMessage(null);
  }, [activeListId, activeTeamId]);

  useEffect(() => {
    if (
      currentRecommendedTasks.length > 0 &&
      recommendedTaskIndex >= currentRecommendedTasks.length
    ) {
      setRecommendedTaskIndex(currentRecommendedTasks.length - 1);
    }
  }, [currentRecommendedTasks.length, recommendedTaskIndex]);

  useEffect(() => {
    if (
      assistantRecommendedTasks.length > 0 &&
      assistantTaskIndex >= assistantRecommendedTasks.length
    ) {
      setAssistantTaskIndex(assistantRecommendedTasks.length - 1);
    }
  }, [assistantRecommendedTasks.length, assistantTaskIndex]);

  function handleSelectList(listId: string) {
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsProfileOpen(false);
    onSelectList(listId);
    clearRecommendation();

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleSelectWorkspace(teamId: string | null) {
    setIsWorkspaceHomeOpen(teamId !== null);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsProfileOpen(false);
    onSelectWorkspace(teamId);
    clearRecommendation();

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleStartRecommendedTask() {
    if (!recommendedTaskPreview) {
      setRecommendationMessage("Nem?? ??dn? aktivn? ?koly");
      return;
    }

    clearRecommendation();
    onStartFocus(recommendedTaskPreview.task.id);
  }

  function handleSkipRecommendedTask() {
    if (recommendedTaskIndex + 1 >= currentRecommendedTasks.length) {
      setRecommendationMessage("Tohle byl nejlep?? ?kol");
      return;
    }

    setRecommendedTaskIndex((currentIndex) => currentIndex + 1);
    setRecommendationMessage(null);
  }

  function handleSelectTask(taskId: string) {
    clearRecommendation();
    onSelectTask(taskId);
  }

  function handleCreateTask(title: string, options?: CreateTaskOptions) {
    clearRecommendation();
    return onCreateTask(title, options);
  }

  function clearRecommendation() {
    setRecommendationMessage(null);
    setRecommendedTaskIndex(0);
  }

  function handleOpenFocusAssistant() {
    setIsFocusAssistantOpen(true);
  }

  function handleOpenDashboard() {
    setIsDashboardOpen(true);
  }

  function handleOpenCheckIn() {
    setIsCheckInOpen(true);
  }

  function handleOpenWorkspaceHome() {
    if (!activeTeamId) {
      return;
    }

    onClearTaskSelection();
    setIsWorkspaceHomeOpen(true);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsProfileOpen(false);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenTeamsOverview() {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(true);
    setIsProjectsOverviewOpen(false);
    setIsProfileOpen(false);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenProjectsOverview() {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsProjectsOverviewOpen(true);
    setIsTeamsOverviewOpen(false);
    setIsProfileOpen(false);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenProfile() {
    onClearTaskSelection();
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsProfileOpen(true);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenTeamCreateFlow() {
    setIsWorkspaceHomeOpen(false);
    setIsProjectsOverviewOpen(false);
    setIsTeamsOverviewOpen(true);
    setIsProfileOpen(false);
    setTeamCreateRequestToken((currentValue) => currentValue + 1);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenProjectCreateFlow() {
    setIsWorkspaceHomeOpen(false);
    setIsTeamsOverviewOpen(false);
    setIsProjectsOverviewOpen(true);
    setIsProfileOpen(false);
    setProjectCreateRequestToken((currentValue) => currentValue + 1);

    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
  }

  function handleCloseDashboard() {
    setIsDashboardOpen(false);
  }

  function handleCloseCheckIn() {
    setIsCheckInOpen(false);
  }

  function handleCloseFocusAssistant() {
    setIsFocusAssistantOpen(false);
  }

  function handleStartRecommendedTaskFromAssistant() {
    if (!assistantRecommendation) {
      setRecommendationMessage("Nem?? ??dn? aktivn? ?koly");
      return;
    }

    clearRecommendation();
    onStartFocus(assistantRecommendation.task.id);
    setIsFocusAssistantOpen(false);
  }

  function handleSkipAssistantTask() {
    if (assistantTaskIndex + 1 >= assistantRecommendedTasks.length) {
      return;
    }

    setAssistantTaskIndex((currentIndex) => currentIndex + 1);
  }

  function handleOpenTaskComposerFromAssistant() {
    setIsFocusAssistantOpen(false);
    window.dispatchEvent(new CustomEvent("app:open-task-composer"));
  }

  function handleOpenTaskComposerFromCheckIn() {
    setIsCheckInOpen(false);
    window.dispatchEvent(new CustomEvent("app:open-task-composer"));
  }

  function handleMoveCheckInTasksToTomorrow() {
    const tomorrow = getTomorrowDateValue();

    checkInSummary.moveCandidates.forEach((task) => {
      onUpdateTask(task.id, { dueDate: tomorrow });
    });

    setIsCheckInOpen(false);
  }

  function renderSidebarPanel(isMobileDrawer = false) {
    const useTouchListActions =
      isMobileDrawer || layout.mode === "tablet-sidebar-list";

    return (
      <SidebarPanel
        lists={allLists}
        countsByListId={countsByListId}
        countsByTeamId={countsByTeamId}
        activeListId={activeListId}
        activeTeamId={activeTeamId}
        teams={teams}
        isGlobalAdmin={isGlobalAdmin}
        themeMode={themeMode}
        currentUserId={currentUserId}
        onSelectList={handleSelectList}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateList={onCreateList}
        onCreateTeam={onCreateTeam}
        onRenameList={onRenameList}
        onArchiveList={onArchiveList}
        onRestoreList={onRestoreList}
        onDeleteList={onDeleteList}
        onToggleTheme={onToggleTheme}
        onOpenWorkspaceHome={handleOpenWorkspaceHome}
        onOpenTeamsOverview={handleOpenTeamsOverview}
        onOpenProjectsOverview={handleOpenProjectsOverview}
        onOpenProfile={handleOpenProfile}
        isWorkspaceHomeOpen={isWorkspaceHomeOpen}
        isTeamsOverviewOpen={isTeamsOverviewOpen}
        isProjectsOverviewOpen={isProjectsOverviewOpen}
        isProfileOpen={isProfileOpen}
        isMobileDrawer={isMobileDrawer}
        useTouchListActions={useTouchListActions}
      />
    );
  }

  function handleDrawerTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    drawerTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleDrawerTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const touchStart = drawerTouchStartRef.current;
    const touch = event.changedTouches[0];

    drawerTouchStartRef.current = null;

    if (!touchStart || !touch) {
      return;
    }

    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    if (deltaX < -80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      setIsSidebarOpen(false);
    }
  }

  return (
    <div
      className="app-shell"
      data-has-topbar={isMobileLayout ? "true" : "false"}
      data-layout-mode={layout.mode}
    >
      {isMobileLayout ? (
        <header className="app-shell__topbar">
          <button
            className="app-shell__menu-button"
            aria-label="Otev??t seznamy"
            type="button"
            onClick={() => setIsSidebarOpen(true)}
          >
            <MoreVertical aria-hidden="true" size={16} />
          </button>
          <div className="app-shell__topbar-actions" aria-label="Rychl? akce">
            <button
              className="app-shell__topbar-action"
              aria-label="Otev??t asistenta"
              title="Asistent"
              type="button"
              onClick={handleOpenFocusAssistant}
            >
              <Sparkle aria-hidden="true" size={17} />
            </button>
            <button
              className="app-shell__topbar-action"
              aria-label="Otev??t dashboard"
              title="Dashboard"
              type="button"
              onClick={handleOpenDashboard}
            >
              <BarChart3 aria-hidden="true" size={17} />
            </button>
            <button
              className="app-shell__topbar-action"
              aria-label="Otev??t check-in"
              data-active={checkInSummary.isActive ? "true" : "false"}
              title="Check-in"
              type="button"
              onClick={handleOpenCheckIn}
            >
              <Bell aria-hidden="true" size={17} />
            </button>
          </div>
        </header>
      ) : null}

      <main className="app-shell__main" aria-label="Hlavn? rozvr?en? aplikace">
        {!isMobileLayout && isPanelVisible(layout.visiblePanels, "sidebar")
          ? renderSidebarPanel()
          : null}
        {isPanelVisible(layout.visiblePanels, "list") ? (
          isProfileOpen ? (
            <ProfilePanel
              userEmail={userEmail}
              userCreatedAt={userCreatedAt}
              nickname={nickname}
              themeMode={themeMode}
              authError={authError}
              authMessage={authMessage}
              isAuthActionLoading={isAuthActionLoading}
              onToggleTheme={onToggleTheme}
              onUpdateNickname={onUpdateNickname}
              onSignOut={onSignOut}
            />
          ) : isWorkspaceHomeOpen && activeTeamId ? (
            <WorkspaceHomePanel
              activeTeam={teams.find((team) => team.id === activeTeamId) ?? null}
              currentUserId={currentUserId}
              currentUserEmail={userEmail}
              currentUserNickname={nickname}
              tasks={tasks}
              onCreateBoard={handleOpenProjectCreateFlow}
              onCreateTeam={handleOpenTeamCreateFlow}
              onOpenProjectsOverview={handleOpenProjectsOverview}
              onOpenTask={(taskId) => {
                setIsWorkspaceHomeOpen(false);
                handleSelectTask(taskId);
              }}
            />
          ) : isTeamsOverviewOpen ? (
            <TeamsOverviewPanel
              activeTeamId={activeTeamId}
              createRequestToken={teamCreateRequestToken}
              currentUserId={currentUserId}
              teams={teams}
              onCreateTeam={onCreateTeam}
              onDeleteTeam={onDeleteTeam}
              onOpenTeamWorkspace={handleSelectWorkspace}
              onTeamUpdated={onTeamUpdated}
            />
          ) : isProjectsOverviewOpen ? (
            <ProjectsOverviewPanel
              activeTeamId={activeTeamId}
              createRequestToken={projectCreateRequestToken}
              currentUserId={currentUserId}
              tasks={allTasks}
              teams={teams}
              onCreateTask={onCreateTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onOpenTask={(taskId) => {
                setIsProjectsOverviewOpen(false);
                handleSelectTask(taskId);
              }}
            />
          ) : (
          <ListPanel
            tasks={visibleTasks}
            archivedTasks={archivedTasks}
            lists={lists}
            layoutMode={layout.mode as LayoutMode}
            activeListId={activeListId}
            selectedTaskId={selectedTaskId}
            dailyStats={dailyStats}
            dailyFocusTasks={dailyFocusTasks}
            dailyAttentionTasks={dailyAttentionOverview.tasks}
            dailyAttentionHiddenCount={dailyAttentionOverview.hiddenCount}
            dailyProgress={dailyProgress}
            dailyNextTasks={dailyNextTasks}
            recommendationMessage={recommendationMessage}
            recommendedTask={recommendedTaskPreview}
            onOpenFocusAssistant={handleOpenFocusAssistant}
            onOpenDashboard={handleOpenDashboard}
            onOpenCheckIn={handleOpenCheckIn}
            onSelectTask={handleSelectTask}
            onCreateTask={handleCreateTask}
            onStartRecommendedTask={handleStartRecommendedTask}
            onSkipRecommendedTask={handleSkipRecommendedTask}
            onToggleTaskCompleted={(taskId, completed) =>
              onUpdateTask(taskId, { completed })
            }
            onUpdateTask={onUpdateTask}
            onArchiveTask={onArchiveTask}
            onDeleteTask={handleDeleteTaskAction}
            onMoveTask={(taskId, listId) => onUpdateTask(taskId, { listId })}
          />
          )
        ) : null}
        {!isWorkspaceHomeOpen && !isTeamsOverviewOpen && !isProjectsOverviewOpen && !isProfileOpen && isPanelVisible(layout.visiblePanels, "detail") ? (
          <DetailPanel
            task={selectedTask}
            lists={lists}
            onClose={onClearTaskSelection}
            onUpdateTask={onUpdateTask}
            onArchiveTask={onArchiveTask}
            onDeleteTask={handleDeleteTaskAction}
            onStartFocus={onStartFocus}
          />
        ) : null}
      </main>
      {deletedTaskUndo || archivedTaskUndo ? (
        <div className="app-toast" role="status">
          <span>{deletedTaskUndo ? "?kol smaz?n" : "?kol archivov?n"}</span>
          <span aria-hidden="true">?</span>
          <button
            type="button"
            onClick={deletedTaskUndo ? onUndoDeleteTask : onUndoArchiveTask}
          >
            Zp?t
          </button>
        </div>
      ) : null}
      {isMobileLayout && isSidebarOpen ? (
        <div className="sidebar-drawer" role="presentation">
          <button
            className="sidebar-drawer__backdrop"
            aria-label="Zav??t seznamy"
            type="button"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div
            className="sidebar-drawer__panel"
            role="dialog"
            aria-label="Seznamy"
            onTouchEnd={handleDrawerTouchEnd}
            onTouchStart={handleDrawerTouchStart}
          >
            <button
              className="sidebar-drawer__close"
              aria-label="Zav??t seznamy"
              type="button"
              onClick={() => setIsSidebarOpen(false)}
            >
              <span aria-hidden="true">?</span>
            </button>
            {renderSidebarPanel(true)}
          </div>
        </div>
      ) : null}
      {isFocusAssistantOpen ? (
        <FocusAssistantOverlay
          recommendation={assistantRecommendation}
          urgentTasks={assistantRecommendedTasks.filter(({ bucket }) => bucket <= 2)}
          deferredCount={assistantRecommendedTasks.filter(({ bucket }) => bucket > 3).length}
          scopeLabel={getAssistantScopeLabel(listFocusScope.activeView)}
          outsideHint={getOutsideUrgencyHint(
            listFocusScope.activeView,
            assistantRecommendation,
            recommendedTaskPreview,
          )}
          onClose={handleCloseFocusAssistant}
          onSkip={handleSkipAssistantTask}
          onStart={handleStartRecommendedTaskFromAssistant}
          onCreateTask={handleOpenTaskComposerFromAssistant}
        />
      ) : null}
      {isDashboardOpen ? (
        <DashboardOverlay
          summary={dashboardSummary}
          onClose={handleCloseDashboard}
        />
      ) : null}
      {isCheckInOpen ? (
        <CheckInOverlay
          summary={checkInSummary}
          onClose={handleCloseCheckIn}
          onCreateTask={handleOpenTaskComposerFromCheckIn}
          onMoveToTomorrow={handleMoveCheckInTasksToTomorrow}
        />
      ) : null}
    </div>
  );
}

type CreateTeamDraftMember = {
  email: string;
  id: string;
  role: "admin" | "member";
};

type TeamsOverviewPanelProps = {
  activeTeamId: string | null;
  createRequestToken?: number;
  currentUserId: string | null;
  teams: Team[];
  onCreateTeam: (name: string, color?: string | null, description?: string | null) => Promise<Team | null | void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onOpenTeamWorkspace: (teamId: string | null) => void;
  onTeamUpdated: (team: Team) => void;
};

function TeamsOverviewPanel({
  activeTeamId,
  createRequestToken = 0,
  currentUserId,
  teams,
  onCreateTeam,
  onDeleteTeam,
  onOpenTeamWorkspace,
  onTeamUpdated,
}: TeamsOverviewPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    activeTeamId ?? teams[0]?.id ?? null,
  );
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamMission, setNewTeamMission] = useState("");
  const [newTeamMemberEmail, setNewTeamMemberEmail] = useState("");
  const [newTeamMemberRole, setNewTeamMemberRole] = useState<"admin" | "member">("member");
  const [newTeamMembers, setNewTeamMembers] = useState<CreateTeamDraftMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const currentMember = currentUserId
    ? members.find((member) => member.userId === currentUserId) ?? null
    : null;
  const canManageSelectedTeam = Boolean(
    selectedTeam &&
      currentUserId &&
      (isTeamAdminRole(currentMember?.role) ||
        (members.length === 0 && selectedTeam.ownerId === currentUserId)),
  );
  const trimmedNewTeamName = newTeamName.trim();
  const trimmedNewTeamMemberEmail = newTeamMemberEmail.trim().toLowerCase();
  const trimmedNewMemberEmail = newMemberEmail.trim();

  useEffect(() => {
    if (activeTeamId && teams.some((team) => team.id === activeTeamId)) {
      setSelectedTeamId(activeTeamId);
      return;
    }

    setSelectedTeamId((currentTeamId) =>
      currentTeamId && teams.some((team) => team.id === currentTeamId)
        ? currentTeamId
        : teams[0]?.id ?? null,
    );
  }, [activeTeamId, teams]);

  useEffect(() => {
    if (createRequestToken > 0) {
      setIsCreateTeamOpen(true);
    }
  }, [createRequestToken]);

  useEffect(() => {
    if (!selectedTeamId) {
      setMembers([]);
      setInvites([]);
      return;
    }

    let isCancelled = false;
    const teamId = selectedTeamId;

    async function loadOverview() {
      setIsLoading(true);
      setError(null);

      try {
        const [nextMembers, nextInvites] = await Promise.all([
          loadTeamMembers(teamId),
          loadTeamInvites(teamId),
        ]);

        if (!isCancelled) {
          setMembers(nextMembers);
          setInvites(nextInvites);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setMembers([]);
          setInvites([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Nepodarilo se nacist tym.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isCancelled = true;
    };
  }, [selectedTeamId]);

  function resetTeamFlowFields() {
    setNewTeamName("");
    setNewTeamMission("");
    setNewTeamMemberEmail("");
    setNewTeamMemberRole("member");
    setNewTeamMembers([]);
  }

  function openCreateTeamFlow() {
    setEditingTeamId(null);
    resetTeamFlowFields();
    setError(null);
    setIsCreateTeamOpen(true);
    setIsInviteOpen(false);
  }

  function openEditTeamFlow() {
    if (!selectedTeam || !canManageSelectedTeam) {
      return;
    }

    setEditingTeamId(selectedTeam.id);
    setNewTeamName(selectedTeam.name);
    setNewTeamMission(selectedTeam.description ?? "");
    setNewTeamMemberEmail("");
    setNewTeamMemberRole("member");
    setNewTeamMembers([]);
    setError(null);
    setIsCreateTeamOpen(true);
    setIsInviteOpen(false);
  }

  function closeCreateTeamFlow() {
    setIsCreateTeamOpen(false);
    setEditingTeamId(null);
    resetTeamFlowFields();
  }

  function handleAddDraftTeamMember() {
    if (!trimmedNewTeamMemberEmail) {
      return;
    }

    setNewTeamMembers((currentMembers) => {
      if (currentMembers.some((member) => member.email === trimmedNewTeamMemberEmail)) {
        return currentMembers;
      }

      return [
        ...currentMembers,
        {
          email: trimmedNewTeamMemberEmail,
          id: crypto.randomUUID(),
          role: newTeamMemberRole,
        },
      ];
    });
    setNewTeamMemberEmail("");
    setNewTeamMemberRole("member");
  }

  function handleRemoveDraftTeamMember(memberId: string) {
    setNewTeamMembers((currentMembers) =>
      currentMembers.filter((member) => member.id !== memberId),
    );
  }

  function handleChangeDraftTeamMemberRole(memberId: string, role: "admin" | "member") {
    setNewTeamMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === memberId ? { ...member, role } : member,
      ),
    );
  }

  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedNewTeamName || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const targetTeam = editingTeamId
        ? await updateTeamInSupabase({
            description: newTeamMission,
            name: trimmedNewTeamName,
            teamId: editingTeamId,
          })
        : await onCreateTeam(trimmedNewTeamName, null, newTeamMission);

      if (!targetTeam) {
        return;
      }

      if (editingTeamId) {
        onTeamUpdated(targetTeam);
      }

      for (const draftMember of newTeamMembers) {
        const result = await inviteTeamMemberByEmail({
          email: draftMember.email,
          teamId: targetTeam.id,
        });

        if (result.kind === "member" && draftMember.role === "admin") {
          await updateTeamMemberRole({
            role: "admin",
            teamId: targetTeam.id,
            userId: result.member.userId,
          });
        }
      }

      const [nextMembers, nextInvites] = await Promise.all([
        loadTeamMembers(targetTeam.id),
        loadTeamInvites(targetTeam.id),
      ]);

      setMembers(nextMembers);
      setInvites(nextInvites);
      setSelectedTeamId(targetTeam.id);
      closeCreateTeamFlow();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : editingTeamId
            ? "Tym se nepodarilo ulozit."
            : "Tym se nepodarilo vytvorit.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTeamId || !trimmedNewMemberEmail || !canManageSelectedTeam) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await inviteTeamMemberByEmail({
        email: trimmedNewMemberEmail,
        teamId: selectedTeamId,
      });

      if (result.kind === "member") {
        setMembers((currentMembers) => {
          const withoutDuplicate = currentMembers.filter(
            (member) => member.userId !== result.member.userId,
          );

          return [...withoutDuplicate, result.member].sort(sortTeamMembers);
        });
        setInvites((currentInvites) =>
          currentInvites.filter(
            (invite) => invite.email.toLowerCase() !== result.member.email.toLowerCase(),
          ),
        );
      } else {
        setInvites((currentInvites) => {
          const withoutDuplicate = currentInvites.filter(
            (invite) => invite.id !== result.invite.id,
          );

          return [...withoutDuplicate, result.invite].sort(sortTeamInvites);
        });
      }

      setNewMemberEmail("");
      setIsInviteOpen(false);
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "Pozvanku se nepodarilo odeslat.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChangeMemberRole(member: TeamMember, role: "admin" | "member") {
    if (!selectedTeamId || !canManageSelectedTeam || member.role === role) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedMember = await updateTeamMemberRole({
        role,
        teamId: selectedTeamId,
        userId: member.userId,
      });

      setMembers((currentMembers) =>
        currentMembers
          .map((currentMember) =>
            currentMember.userId === updatedMember.userId ? updatedMember : currentMember,
          )
          .sort(sortTeamMembers),
      );
    } catch (roleError) {
      setError(
        roleError instanceof Error ? roleError.message : "Roli se nepodarilo zmenit.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRemoveMember(member: TeamMember) {
    if (!selectedTeamId || !canManageSelectedTeam) {
      return;
    }

    const shouldRemove = window.confirm("Odebrat clena " + member.email + " z tymu?");

    if (!shouldRemove) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await removeTeamMember({ teamId: selectedTeamId, userId: member.userId });
      setMembers((currentMembers) =>
        currentMembers.filter((currentMember) => currentMember.userId !== member.userId),
      );
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Clena se nepodarilo odebrat.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteTeamAction() {
    if (!selectedTeam || !canManageSelectedTeam || isLoading) {
      return;
    }

    const shouldDelete = window.confirm(
      `Smazat tým ${selectedTeam.name}? Smažou se i jeho týmové seznamy, úkoly a nástěnky.`,
    );

    if (!shouldDelete) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onDeleteTeam(selectedTeam.id);
      setIsInviteOpen(false);
      setMembers([]);
      setInvites([]);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "T�m se nepoda�ilo smazat.",
      );
    } finally {
      setIsLoading(false);
    }
  }
  async function handleDeleteSpecificTeam(team: Team) {
    if (!currentUserId || team.ownerId !== currentUserId || isLoading) {
      return;
    }

    const shouldDelete = window.confirm(
      `Smazat tým ${team.name}? Smažou se i jeho týmové seznamy, úkoly a nástěnky.`,
    );

    if (!shouldDelete) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onDeleteTeam(team.id);
      setIsInviteOpen(false);
      setMembers([]);
      setInvites([]);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Tým se nepodařilo smazat.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const adminCount = members.filter((member) => isTeamAdminRole(member.role)).length;
  const openInviteCount = invites.length;
  const totalWorkspacePeople = members.length + openInviteCount;
  const selectedTeamMemberCount = members.length;

  return (
    <section className="app-panel teams-overview teams-page" aria-label="Přehled týmů">
      <div className="teams-overview__header">
        <div>
          <h2>Správa týmů</h2>
          <p>Spravuj role, pozvánky a členy pracovního prostoru.</p>
        </div>
        <div className="teams-overview__actions teams-page__actions">
          <button type="button" onClick={openCreateTeamFlow}>
            <UserPlus aria-hidden="true" size={16} />
            <span>Vytvořit tým</span>
          </button>
          <button
            type="button"
            disabled={!selectedTeam || !canManageSelectedTeam}
            onClick={() => setIsInviteOpen((isOpen) => !isOpen)}
          >
            <MailPlus aria-hidden="true" size={16} />
            <span>Pozvat člena</span>
          </button>
        </div>
      </div>

      <div className="teams-metrics" aria-label="Metriky týmu">
        <TeamsMetricCard
          index={0}
          icon={<Users aria-hidden="true" size={16} />}
          label="Celkem členů"
          tone="purple"
          value={totalWorkspacePeople}
        />
        <TeamsMetricCard
          index={1}
          icon={<CheckCircle2 aria-hidden="true" size={16} />}
          label="Aktivní členové"
          tone="mint"
          value={selectedTeamMemberCount}
        />
        <TeamsMetricCard
          index={2}
          icon={<ShieldCheck aria-hidden="true" size={16} />}
          label="Správci"
          tone="slate"
          value={adminCount}
        />
        <TeamsMetricCard
          index={3}
          icon={<MailPlus aria-hidden="true" size={16} />}
          label="Otevřené pozvánky"
          tone="amber"
          value={openInviteCount}
        />
      </div>


      {isInviteOpen && selectedTeam ? (
        <form className="teams-overview__inline-form" onSubmit={handleInviteMember}>
          <label>
            <span>E-mail člena</span>
            <input
              autoComplete="email"
              inputMode="email"
              placeholder="email@firma.cz"
              type="email"
              value={newMemberEmail}
              onChange={(event) => setNewMemberEmail(event.currentTarget.value)}
            />
          </label>
          <button type="submit" disabled={!trimmedNewMemberEmail || isLoading}>Pozvat</button>
        </form>
      ) : null}

      {error ? <p className="teams-overview__error" role="alert">{error}</p> : null}

      <div className="teams-overview__dashboard-grid">
        <div className="teams-overview__members-card">
          <div className="teams-overview__card-head">
            <div>
              <h3>Členové týmu</h3>
            </div>
            <button
              className="teams-overview__icon-button"
              type="button"
              aria-label="Upravit tým"
              disabled={!selectedTeam || !canManageSelectedTeam}
              onClick={openEditTeamFlow}
            >
              <Pencil aria-hidden="true" size={16} />
            </button>
            <button
              className="teams-overview__icon-button"
              type="button"
              aria-label="Smazat tým"
              disabled={!selectedTeam || !canManageSelectedTeam || isLoading}
              onClick={() => void handleDeleteTeamAction()}
            >
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </div>

          <div className="teams-overview__table" role="table" aria-label="Členové týmu">
            <div className="teams-overview__table-row teams-overview__table-row--head" role="row">
              <span role="columnheader">Člen</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Akce</span>
            </div>
            {isLoading && members.length === 0 && invites.length === 0 ? (
              <p className="teams-overview__empty">Načítám členy...</p>
            ) : null}
            {!isLoading && members.length === 0 && invites.length === 0 ? (
              <p className="teams-overview__empty">Vybraný tým zatím nemá žádné členy ani pozvánky.</p>
            ) : null}
            <AnimatePresence initial={false}>
              {members.map((member, memberIndex) => {
                const memberIsAdmin = isTeamAdminRole(member.role);
                const nextRole = memberIsAdmin ? "member" : "admin";
                const memberInitials = getMemberInitials(member.email);

                return (
                  <motion.div
                    className="teams-overview__table-row"
                    key={member.userId}
                    role="row"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.2, delay: prefersReducedMotion ? 0 : memberIndex * 0.03 }}
                  >
                    <span className="teams-overview__member-cell" role="cell">
                      <span className="teams-overview__avatar" aria-hidden="true">{memberInitials}</span>
                      <span>
                        <strong>{getMemberDisplayName(member.email)}</strong>
                        <small>{member.email}</small>
                      </span>
                    </span>
                    <span role="cell" data-role={memberIsAdmin ? "admin" : "member"}>
                      {getTeamRoleLabel(member.role)}
                    </span>
                    <span role="cell" data-status="active">Aktivní</span>
                    <span className="teams-overview__row-actions" role="cell">
                      {canManageSelectedTeam ? (
                        <>
                          {!memberIsAdmin ? (
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => void handleChangeMemberRole(member, nextRole)}
                            >
                              Admin
                            </button>
                          ) : null}
                          <button
                            className="teams-overview__row-actions-danger"
                            type="button"
                            disabled={isLoading}
                            onClick={() => void handleRemoveMember(member)}
                          >
                            Odebrat
                          </button>
                        </>
                      ) : (
                        <small>Jen správce</small>
                      )}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <aside className="teams-overview__side-stack" aria-label="Postranní panel týmů">
          <section className="teams-overview__side-card">
            <div className="teams-overview__card-head">
              <div>
                <h3>Týmy</h3>
                <p>Vyber pracovní prostor</p>
              </div>
            </div>
            <div className="teams-overview__team-list">
              {teams.length > 0 ? (
                teams.map((team) => (
                  <div className="teams-overview__team-row" key={team.id}>
                    <button
                      className="teams-overview__team-card"
                      data-selected={team.id === selectedTeamId}
                      style={{ "--team-color": team.color ?? "#6d5dfc" } as CSSProperties}
                      type="button"
                      onClick={() => setSelectedTeamId(team.id)}
                    >
                      <span aria-hidden="true" />
                      <strong>{team.name}</strong>
                    </button>
                    {currentUserId && team.ownerId === currentUserId ? (
                      <button
                        className="teams-overview__icon-button teams-overview__team-delete"
                        type="button"
                        aria-label={`Smazat tým ${team.name}`}
                        disabled={isLoading}
                        onClick={() => void handleDeleteSpecificTeam(team)}
                      >
                        <X aria-hidden="true" size={14} />
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="teams-overview__empty">Zatím nemáš žádné týmy.</p>
              )}
            </div>
          </section>

          <section className="teams-overview__side-card">
            <div className="teams-overview__card-head">
              <div>
                <h3>Čekající pozvánky</h3>
                <p>{openInviteCount === 1 ? "1 čekající pozvánka" : `${openInviteCount} čekajících pozvánek`}</p>
              </div>
            </div>
            <div className="teams-overview__invite-list">
              {invites.length > 0 ? (
                invites.slice(0, 4).map((invite) => (
                  <div className="teams-overview__invite-row" key={invite.id}>
                    <span className="teams-overview__invite-icon" aria-hidden="true">
                      <MailPlus size={14} />
                    </span>
                    <span>
                      <strong>{invite.email}</strong>
                      <small>Čeká na registraci</small>
                    </span>
                  </div>
                ))
              ) : (
                <p className="teams-overview__empty">Žádné otevřené pozvánky.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <AnimatePresence>
        {isCreateTeamOpen ? (
        <div className="team-create-flow" role="presentation">
          <motion.button
            className="team-create-flow__backdrop"
            aria-label="Zavřít vytváření týmu"
            type="button"
            onClick={closeCreateTeamFlow}
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.form
            className="team-create-flow__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-create-title"
            onSubmit={handleCreateTeam}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="team-create-flow__header">
              <div>
                <span>{editingTeamId ? "Nastavení týmu" : "Vytvořit nový tým"}</span>
                <h2 id="team-create-title">{editingTeamId ? "Upravit tým" : "Vytvořit tým"}</h2>
                <p>{editingTeamId ? "Uprav zaměření týmu a doplň členy kdykoliv později." : "Definuj tým, nastav základní kontext a rovnou přidej registrované členy."}</p>
              </div>
              <button
                className="team-create-flow__close"
                aria-label="Zavřít"
                type="button"
                onClick={closeCreateTeamFlow}
              >
                <X size={18} />
              </button>
            </div>

            <div className="team-create-flow__grid">
              <section className="team-create-flow__card">
                <h3>Identita týmu</h3>
                <label className="team-create-flow__field">
                  <span>Název týmu</span>
                  <input
                    autoFocus
                    maxLength={60}
                    placeholder="např. Produktový tým"
                    value={newTeamName}
                    onChange={(event) => setNewTeamName(event.currentTarget.value)}
                  />
                </label>
                <label className="team-create-flow__field">
                  <span>Zaměření a mise</span>
                  <textarea
                    placeholder="Stručně popiš, k čemu tým slouží."
                    rows={4}
                    value={newTeamMission}
                    onChange={(event) => setNewTeamMission(event.currentTarget.value)}
                  />
                </label>
              </section>

              <section className="team-create-flow__card team-create-flow__deploy">
                <h3>Přidat členy</h3>
                <div className="team-create-flow__member-add">
                  <input
                    aria-label="E-mail člena"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="kolega@firma.cz"
                    type="email"
                    value={newTeamMemberEmail}
                    onChange={(event) => setNewTeamMemberEmail(event.currentTarget.value)}
                  />
                  <select
                    aria-label="Role člena"
                    value={newTeamMemberRole}
                    onChange={(event) =>
                      setNewTeamMemberRole(event.currentTarget.value as "admin" | "member")
                    }
                  >
                    <option value="member">Člen</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button type="button" onClick={handleAddDraftTeamMember} disabled={!trimmedNewTeamMemberEmail}>
                    +
                  </button>
                </div>
                <div className="team-create-flow__staging-title">Připravené pozvánky</div>
                <div className="team-create-flow__draft-list">
                  {newTeamMembers.length > 0 ? (
                    newTeamMembers.map((member) => (
                      <div className="team-create-flow__draft-row" key={member.id}>
                        <span className="teams-overview__avatar" aria-hidden="true">
                          {getMemberInitials(member.email)}
                        </span>
                        <span>
                          <strong>{member.email}</strong>
                          <select
                            aria-label={"Role pro " + member.email}
                            value={member.role}
                            onChange={(event) =>
                              handleChangeDraftTeamMemberRole(
                                member.id,
                                event.currentTarget.value as "admin" | "member",
                              )
                            }
                          >
                            <option value="member">Člen</option>
                            <option value="admin">Admin</option>
                          </select>
                        </span>
                        <button
                          aria-label={"Odebrat " + member.email}
                          type="button"
                          onClick={() => handleRemoveDraftTeamMember(member.id)}
                        >x</button>
                      </div>
                    ))
                  ) : (
                    <p className="team-create-flow__empty">Členy můžeš přidat hned, nebo později v týmu.</p>
                  )}
                </div>
                <button className="team-create-flow__submit" type="submit" disabled={!trimmedNewTeamName || isLoading}>
                  {editingTeamId ? "Uložit tým" : "Vytvořit tým"}
                </button>
                <button className="team-create-flow__cancel" type="button" onClick={closeCreateTeamFlow}>
                  Zrušit
                </button>
              </section>
            </div>
          </motion.form>
        </div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}


type ProjectsOverviewPanelProps = {
  activeTeamId: string | null;
  createRequestToken?: number;
  currentUserId: string | null;
  tasks: Task[];
  teams: Team[];
  onCreateTask: (title: string, options?: CreateTaskOptions) => string | null;
  onUpdateTask: (taskId: string, update: TaskUpdate) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
};
function ProjectsOverviewPanel({
  activeTeamId,
  createRequestToken = 0,
  currentUserId,
  tasks,
  teams,
  onCreateTask,
  onUpdateTask,
  onOpenTask,
  onDeleteTask,
}: ProjectsOverviewPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStartDate, setProjectStartDate] = useState("");
  const [projectEndDate, setProjectEndDate] = useState("");
  const [projectStatus, setProjectStatus] = useState<Project["status"]>("active");
  const [projectTeamId, setProjectTeamId] = useState(activeTeamId ?? teams[0]?.id ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectMembers, setProjectMembers] = useState<TeamMember[]>([]);
  const [projectColumns, setProjectColumns] = useState<ProjectColumn[]>([]);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState("");
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);
  const [cardComposerTaskId, setCardComposerTaskId] = useState<string | null>(null);
  const [cardComposerColumnKey, setCardComposerColumnKey] = useState<Task["boardColumnKey"] | null>(null);
  const [cardComposerTitle, setCardComposerTitle] = useState("");
  const [cardComposerNote, setCardComposerNote] = useState("");
  const [cardComposerPriority, setCardComposerPriority] = useState<TaskPriority>("none");
  const [cardComposerDueDate, setCardComposerDueDate] = useState("");
  const [cardComposerLabels, setCardComposerLabels] = useState("");
  const [cardComposerLabelInput, setCardComposerLabelInput] = useState("");
  const [cardComposerAssigneeId, setCardComposerAssigneeId] = useState("");
  const [cardComposerSubtaskTitle, setCardComposerSubtaskTitle] = useState("");
  const [cardComposerSubtasks, setCardComposerSubtasks] = useState<TaskSubtask[]>([]);
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const trimmedProjectName = projectName.trim();

  useEffect(() => {
    setProjectTeamId((currentTeamId) =>
      currentTeamId && teams.some((team) => team.id === currentTeamId)
        ? currentTeamId
        : activeTeamId ?? teams[0]?.id ?? "",
    );
  }, [activeTeamId, teams]);

  useEffect(() => {
    let isCancelled = false;
    const teamIds = teams.map((team) => team.id);

    async function loadProjects() {
      setIsLoading(true);
      setError(null);

      try {
        const nextProjects = await loadProjectsForTeams(teamIds);

        if (!isCancelled) {
          setProjects(nextProjects);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setProjects([]);
          setError(loadError instanceof Error ? loadError.message : "Nastenky se nepodarilo nacist.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (teamIds.length === 0) {
      setProjects([]);
      setError(null);
      return;
    }

    void loadProjects();

    return () => {
      isCancelled = true;
    };
  }, [teams]);

  useEffect(() => {
    if (createRequestToken > 0 && teams.length > 0) {
      openCreateProject();
    }
  }, [createRequestToken, teams.length]);

  useEffect(() => {
    if (!selectedProject) {
      setProjectMembers([]);
      return;
    }

    let isCancelled = false;
    const project = selectedProject;

    async function loadProjectMembers() {
      setIsLoading(true);
      setError(null);

      try {
        const members = await loadTeamMembers(project.teamId);

        if (!isCancelled) {
          setProjectMembers(members);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setProjectMembers([]);
          setError(loadError instanceof Error ? loadError.message : "Cleny nastenky se nepodarilo nacist.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProjectMembers();

    return () => {
      isCancelled = true;
    };
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject) {
      setProjectColumns([]);
      setNewColumnTitle("");
      setEditingColumnId(null);
      setEditingColumnTitle("");
      setOpenColumnMenuId(null);
      return;
    }

    let isCancelled = false;
    const project = selectedProject;

    async function loadColumns() {
      setIsLoading(true);
      setError(null);

      try {
        const columns = await loadProjectColumns(project.id);

        if (!isCancelled) {
          setProjectColumns(columns);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setProjectColumns([]);
          setError(loadError instanceof Error ? loadError.message : "Sloupce nastenky se nepodarilo nacist.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadColumns();

    return () => {
      isCancelled = true;
    };
  }, [selectedProject]);
  function resetProjectForm() {
    setEditingProjectId(null);
    setProjectName("");
    setProjectDescription("");
    setProjectStartDate("");
    setProjectEndDate("");
    setProjectStatus("active");
    setProjectTeamId(activeTeamId ?? teams[0]?.id ?? "");
  }

  function openCreateProject() {
    resetProjectForm();
    setError(null);
    setIsCreateOpen(true);
  }

  function openEditProject(project: Project) {
    setEditingProjectId(project.id);
    setProjectName(project.name);
    setProjectDescription(project.description ?? "");
    setProjectStartDate(project.startDate ?? "");
    setProjectEndDate(project.endDate ?? "");
    setProjectStatus(project.status);
    setProjectTeamId(project.teamId);
    setError(null);
    setIsCreateOpen(true);
  }

  function closeCreateProject() {
    setIsCreateOpen(false);
    resetProjectForm();
  }


  function openProjectDetail(project: Project) {
    setSelectedProjectId(project.id);
    setError(null);
  }

  function closeProjectDetail() {
    setSelectedProjectId(null);
    setProjectMembers([]);
    setProjectColumns([]);
    setNewColumnTitle("");
    setEditingColumnId(null);
    setEditingColumnTitle("");
    setOpenColumnMenuId(null);
    resetCardComposer();
  }

  function resetCardComposer() {
    setCardComposerTaskId(null);
    setCardComposerColumnKey(null);
    setCardComposerTitle("");
    setCardComposerNote("");
    setCardComposerPriority("none");
    setCardComposerDueDate("");
    setCardComposerLabels("");
    setCardComposerAssigneeId("");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks([]);
  }

  function handleCreateProjectTask(columnKey: Task["boardColumnKey"] = "todo") {
    if (!selectedProject) {
      return;
    }

    setCardComposerTaskId(null);
    setCardComposerColumnKey(columnKey);
    setCardComposerTitle("");
    setCardComposerNote("");
    setCardComposerPriority("none");
    setCardComposerDueDate("");
    setCardComposerLabels("");
    setCardComposerAssigneeId("");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks([]);
    setError(null);
  }

  function handleOpenProjectCard(taskId: string) {
    const task = tasks.find((currentTask) => currentTask.id === taskId);

    if (!task || !selectedProject || task.projectId !== selectedProject.id) {
      return;
    }

    setCardComposerTaskId(task.id);
    setCardComposerColumnKey(task.boardColumnKey);
    setCardComposerTitle(task.title);
    setCardComposerNote(task.note);
    setCardComposerPriority(task.priority);
    setCardComposerDueDate(task.dueDate ?? "");
    setCardComposerLabels(task.labels.map((label) => label.name).join(", "));
    setCardComposerAssigneeId(task.assigneeId ?? "");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks(task.subtasks.map((subtask) => ({ ...subtask })));
    setError(null);
  }
  function handleAddCardComposerSubtask() {
    const title = cardComposerSubtaskTitle.trim();

    if (!title) {
      return;
    }

    setCardComposerSubtasks((currentSubtasks) => [
      ...currentSubtasks,
      {
        id: "subtask-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        title,
        completed: false,
      },
    ]);
    setCardComposerSubtaskTitle("");
  }

  function handleAddCardComposerLabel(rawValue: string) {
    const nextValue = appendCardLabelValue(cardComposerLabels, rawValue);

    setCardComposerLabels(nextValue);
    setCardComposerLabelInput("");
  }

  function handleToggleCardComposerSubtask(subtaskId: string) {
    setCardComposerSubtasks((currentSubtasks) =>
      currentSubtasks.map((subtask) =>
        subtask.id === subtaskId
          ? { ...subtask, completed: !subtask.completed }
          : subtask,
      ),
    );
  }


  function handleSubmitProjectCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject || !cardComposerColumnKey || !cardComposerTitle.trim()) {
      return;
    }

    const update = {
      assigneeId: cardComposerAssigneeId || null,
      boardColumnKey: cardComposerColumnKey,
      dueDate: cardComposerDueDate || null,
      labels: createCardLabels(cardComposerLabels),
      note: cardComposerNote,
      priority: cardComposerPriority,
      projectId: selectedProject.id,
      subtasks: cardComposerSubtasks,
      teamId: selectedProject.teamId,
      title: cardComposerTitle,
    };

    if (cardComposerTaskId) {
      onUpdateTask(cardComposerTaskId, update);
      resetCardComposer();
      return;
    }

    const createdTaskId = onCreateTask(cardComposerTitle, update);

    if (createdTaskId) {
      resetCardComposer();
    }
  }

  async function handleAddProjectColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject || !newColumnTitle.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const column = await createProjectColumn(selectedProject.id, newColumnTitle, projectColumns.length);
      setProjectColumns((currentColumns) => [...currentColumns, column].sort((a, b) => a.position - b.position));
      setNewColumnTitle("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Sloupec se nepodarilo pridat.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleStartRenameProjectColumn(column: ProjectColumn) {
    setEditingColumnId(column.id);
    setEditingColumnTitle(column.title);
  }

  function handleCancelRenameProjectColumn() {
    setEditingColumnId(null);
    setEditingColumnTitle("");
  }

  async function handleRenameProjectColumn(columnId: string, title: string) {
    const trimmedTitle = title.trim();
    const currentColumn = projectColumns.find((column) => column.id === columnId);

    if (!currentColumn || isLoading) {
      return;
    }

    if (!trimmedTitle || trimmedTitle === currentColumn.title) {
      handleCancelRenameProjectColumn();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const column = await updateProjectColumn(columnId, trimmedTitle);
      setProjectColumns((currentColumns) =>
        currentColumns
          .map((currentColumnItem) => currentColumnItem.id === column.id ? column : currentColumnItem)
          .sort((a, b) => a.position - b.position),
      );
      handleCancelRenameProjectColumn();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Sloupec se nepodarilo prejmenovat.");
    } finally {
      setIsLoading(false);
    }
  }

  function getProjectColumnFallbackKey(columnId: string) {
    const currentIndex = projectColumns.findIndex((column) => column.id === columnId);

    if (currentIndex < 0) {
      return null;
    }

    return projectColumns[currentIndex + 1]?.key ?? projectColumns[currentIndex - 1]?.key ?? null;
  }

  function moveProjectColumnTasks(columnKey: string, fallbackColumnKey: string) {
    tasks
      .filter((task) => task.projectId === selectedProject?.id && task.boardColumnKey === columnKey)
      .forEach((task) => {
        onUpdateTask(task.id, {
          boardColumnKey: fallbackColumnKey,
          completed: fallbackColumnKey === "done",
        });
      });
  }

  async function handleArchiveProjectColumn(column: ProjectColumn) {
    if (projectColumns.length <= 1 || isLoading) {
      return;
    }

    const fallbackColumnKey = getProjectColumnFallbackKey(column.id);

    if (!fallbackColumnKey) {
      setError("Pro archivaci musi zustat aspon jeden sloupec.");
      return;
    }

    const shouldArchive = window.confirm("Archivovat sloupec " + column.title + "?");

    if (!shouldArchive) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setOpenColumnMenuId(null);

    try {
      await archiveProjectColumn(column.id);
      moveProjectColumnTasks(column.key, fallbackColumnKey);
      setProjectColumns((currentColumns) =>
        currentColumns.filter((currentColumn) => currentColumn.id !== column.id),
      );
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Sloupec se nepodarilo archivovat.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteProjectColumn(column: ProjectColumn) {
    if (projectColumns.length <= 1 || isLoading) {
      return;
    }

    const fallbackColumnKey = getProjectColumnFallbackKey(column.id);

    if (!fallbackColumnKey) {
      setError("Pro smazani musi zustat aspon jeden sloupec.");
      return;
    }

    const shouldDelete = window.confirm("Smazat sloupec " + column.title + "?");

    if (!shouldDelete) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setOpenColumnMenuId(null);

    try {
      await deleteProjectColumn(column.id);
      moveProjectColumnTasks(column.key, fallbackColumnKey);
      setProjectColumns((currentColumns) =>
        currentColumns.filter((currentColumn) => currentColumn.id !== column.id),
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Sloupec se nepodarilo smazat.");
    } finally {
      setIsLoading(false);
    }
  }
  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUserId || !trimmedProjectName || !projectTeamId || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const savedProject = editingProjectId
        ? await updateProjectInSupabase({
            description: projectDescription,
            endDate: projectEndDate || null,
            name: trimmedProjectName,
            projectId: editingProjectId,
            startDate: projectStartDate || null,
            status: projectStatus,
            teamId: projectTeamId,
          })
        : await createProjectInSupabase({
            createdBy: currentUserId,
            description: projectDescription,
            endDate: projectEndDate || null,
            name: trimmedProjectName,
            startDate: projectStartDate || null,
            teamId: projectTeamId,
          });

      setProjects((currentProjects) =>
        editingProjectId
          ? currentProjects.map((project) =>
              project.id === savedProject.id ? savedProject : project,
            )
          : [savedProject, ...currentProjects],
      );
      closeCreateProject();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : editingProjectId
            ? "Nastenku se nepodarilo ulozit."
            : "Nastenku se nepodarilo vytvorit.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteProject(project: Project) {
    const shouldDelete = window.confirm("Smazat nastenku " + project.name + "?");

    if (!shouldDelete || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await deleteProjectInSupabase(project.id);
      setProjects((currentProjects) =>
        currentProjects.filter((currentProject) => currentProject.id !== project.id),
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nastenku se nepodarilo smazat.");
    } finally {
      setIsLoading(false);
    }
  }

  const activeProjects = projects.filter((project) => project.status === "active").length;
  const plannedProjects = projects.filter((project) => project.startDate || project.endDate).length;
  const completedProjects = projects.filter((project) => project.status === "completed").length;

  if (selectedProject) {
    const composerColumn = projectColumns.find((column) => column.key === cardComposerColumnKey) ?? null;

    return (
      <>
        <ProjectDetailView
          columns={projectColumns}
          editingColumnId={editingColumnId}
          editingColumnTitle={editingColumnTitle}
          isBusy={isLoading}
          members={projectMembers}
          newColumnTitle={newColumnTitle}
          project={selectedProject}
          tasks={tasks}
          team={teamById.get(selectedProject.teamId) ?? null}
          onAddColumn={handleAddProjectColumn}
          onBack={closeProjectDetail}
          onCancelRenameColumn={handleCancelRenameProjectColumn}
          onChangeEditingColumnTitle={setEditingColumnTitle}
          onChangeNewColumnTitle={setNewColumnTitle}
          onCreateTask={handleCreateProjectTask}
          onArchiveColumn={handleArchiveProjectColumn}
          onChangeOpenColumnMenuId={setOpenColumnMenuId}
          onDeleteTask={onDeleteTask}
          onDeleteColumn={handleDeleteProjectColumn}
          onEditProject={() => openEditProject(selectedProject)}
          onOpenTask={handleOpenProjectCard}
          onOpenColumnMenuId={openColumnMenuId}
          onRenameColumn={handleRenameProjectColumn}
          onStartRenameColumn={handleStartRenameProjectColumn}
          onUpdateTask={onUpdateTask}
        />
        {cardComposerColumnKey ? (
          <ProjectCardComposerModal
            actionLabel={cardComposerTaskId ? "Ulo?it kartu" : "Add Card"}
            assigneeId={cardComposerAssigneeId}
            columnTitle={composerColumn?.title ?? "Sloupec"}
            dueDate={cardComposerDueDate}
            labelInput={cardComposerLabelInput}
            labels={cardComposerLabels}
            isEditing={Boolean(cardComposerTaskId)}
            members={projectMembers}
            note={cardComposerNote}
            priority={cardComposerPriority}
            projectName={selectedProject.name}
            subtaskTitle={cardComposerSubtaskTitle}
            subtasks={cardComposerSubtasks}
            title={cardComposerTitle}
            onAddSubtask={handleAddCardComposerSubtask}
            onAssigneeChange={setCardComposerAssigneeId}
            onClose={resetCardComposer}
            onDueDateChange={setCardComposerDueDate}
            onLabelInputChange={setCardComposerLabelInput}
            onAddLabel={handleAddCardComposerLabel}
            onLabelsChange={setCardComposerLabels}
            onNoteChange={setCardComposerNote}
            onPriorityChange={setCardComposerPriority}
            onSubtaskTitleChange={setCardComposerSubtaskTitle}
            onSubmit={handleSubmitProjectCard}
            onToggleSubtask={handleToggleCardComposerSubtask}
            onTitleChange={setCardComposerTitle}
          />
        ) : null}
      </>
    );
  }

  return (
    <section className="app-panel teams-overview projects-overview" aria-label="Přehled nástěnk">
      <div className="teams-overview__header">
        <div>
          <h2>Nástěnky</h2>
          <p>Vytvoř týmové nástěnky a posouvej práci ve sloupcích.</p>
        </div>
        <div className="teams-overview__actions">
          <button
            type="button"
            disabled={teams.length === 0}
            onClick={openCreateProject}
          >
            <FolderKanban aria-hidden="true" size={16} />
            <span>Vytvořit nástěnku</span>
          </button>
        </div>
      </div>

      <div className="teams-overview__metrics" aria-label="Metriky nástěnek">
        <TeamMetricCard label="Nástěnky" value={projects.length} tone="purple" />
        <TeamMetricCard label="Aktivní" value={activeProjects} tone="mint" />
        <TeamMetricCard label="S termínem" value={plannedProjects} tone="slate" />
        <TeamMetricCard label="Hotovo" value={completedProjects} tone="slate" />
      </div>

      {error ? <p className="teams-overview__error" role="alert">{error}</p> : null}

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
        {projects.map((project) => {
          const projectTeam = teamById.get(project.teamId);
          const dateRange = formatProjectDateRange(project.startDate, project.endDate);

          return (
            <article
              className="projects-overview__card"
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => openProjectDetail(project)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openProjectDetail(project);
                }
              }}
            >
              <div className="projects-overview__card-header">
                <span className="projects-overview__team-pill">{projectTeam?.name ?? "Tým"}</span>
                <span className="projects-overview__status">{getProjectStatusLabel(project.status)}</span>
              </div>
              <h3>{project.name}</h3>
              {project.description ? <p>{project.description}</p> : <p>Bez popisu mise.</p>}
              <div className="projects-overview__meta">
                <span>{dateRange}</span>
                <span className="projects-overview__card-actions">
                  <button
                    aria-label={"Upravit nástěnku " + project.name}
                    type="button"
                    onClick={(event) => { event.stopPropagation(); openEditProject(project); }}
                  >
                    <Pencil aria-hidden="true" size={14} />
                  </button>
                  <button
                    aria-label={"Smazat nástěnku " + project.name}
                    type="button"
                    onClick={(event) => { event.stopPropagation(); void handleDeleteProject(project); }}
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </button>
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {isCreateOpen ? (
        <div className="team-create-flow" role="presentation">
          <button
            className="team-create-flow__backdrop"
            aria-label="Zavřít vytváření nástěnky"
            type="button"
            onClick={closeCreateProject}
          />
          <form
            className="team-create-flow__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nastenka-create-title"
            onSubmit={handleCreateProject}
          >
            <div className="team-create-flow__header">
              <div>
                <span>{editingProjectId ? "Upravit nástěnku" : "Vytvořit nástěnku"}</span>
                <h2 id="nastenka-create-title">{editingProjectId ? "Upravit nástěnku" : "Nová nástěnka"}</h2>
                <p>{editingProjectId ? "Uprav cíl, termín a tým nástěnky." : "Nastav cíl, časový rámec a tým, který bude na nástěnce pracovat."}</p>
              </div>
              <button
                className="team-create-flow__close"
                aria-label="Zavřít"
                type="button"
                onClick={closeCreateProject}
              >
                <X size={18} />
              </button>
            </div>

            <div className="team-create-flow__grid">
              <section className="team-create-flow__card">
                <h3>Nástěnka</h3>
                <label className="team-create-flow__field">
                  <span>Název nástěnky</span>
                  <input
                    autoFocus
                    maxLength={80}
                    placeholder="např. Redesign klientské zóny"
                    value={projectName}
                    onChange={(event) => setProjectName(event.currentTarget.value)}
                  />
                </label>
                <label className="team-create-flow__field">
                  <span>Popis / mise</span>
                  <textarea
                    placeholder="Co má tahle nástěnka pomoct doručit?"
                    rows={4}
                    value={projectDescription}
                    onChange={(event) => setProjectDescription(event.currentTarget.value)}
                  />
                </label>
              </section>

              <section className="team-create-flow__card team-create-flow__deploy">
                <h3>Rozsah</h3>
                <label className="team-create-flow__field">
                  <span>Přiřadit týmu</span>
                  <select
                    value={projectTeamId}
                    onChange={(event) => setProjectTeamId(event.currentTarget.value)}
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="team-create-flow__field">
                  <span>Stav</span>
                  <select
                    value={projectStatus}
                    onChange={(event) => setProjectStatus(event.currentTarget.value as Project["status"])}
                  >
                    <option value="active">Aktivní</option>
                    <option value="paused">Pozastaveno</option>
                    <option value="completed">Hotovo</option>
                  </select>
                </label>
                <div className="projects-overview__date-fields">
                  <label className="team-create-flow__field">
                    <span>Od</span>
                    <input
                      type="date"
                      value={projectStartDate}
                      onChange={(event) => setProjectStartDate(event.currentTarget.value)}
                    />
                  </label>
                  <label className="team-create-flow__field">
                    <span>Do</span>
                    <input
                      type="date"
                      value={projectEndDate}
                      onChange={(event) => setProjectEndDate(event.currentTarget.value)}
                    />
                  </label>
                </div>
                <button className="team-create-flow__submit" type="submit" disabled={!trimmedProjectName || !projectTeamId || isLoading}>
                  {editingProjectId ? "Uložit nástěnku" : "Vytvořit nástěnku"}
                </button>
                <button className="team-create-flow__cancel" type="button" onClick={closeCreateProject}>
                  Zrušit
                </button>
              </section>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function ProjectCardComposerModal({
  actionLabel,
  assigneeId,
  columnTitle,
  dueDate,
  labelInput,
  labels,
  isEditing,
  members,
  note,
  priority,
  projectName,
  subtaskTitle,
  subtasks,
  title,
  onAddSubtask,
  onAssigneeChange,
  onClose,
  onDueDateChange,
  onLabelInputChange,
  onAddLabel,
  onLabelsChange,
  onNoteChange,
  onPriorityChange,
  onSubtaskTitleChange,
  onSubmit,
  onTitleChange,
  onToggleSubtask,
}: {
  actionLabel: string;
  assigneeId: string;
  columnTitle: string;
  dueDate: string;
  labelInput: string;
  labels: string;
  isEditing: boolean;
  members: TeamMember[];
  note: string;
  priority: TaskPriority;
  projectName: string;
  subtaskTitle: string;
  subtasks: TaskSubtask[];
  title: string;
  onAddSubtask: () => void;
  onAssigneeChange: (value: string) => void;
  onClose: () => void;
  onDueDateChange: (value: string) => void;
  onLabelInputChange: (value: string) => void;
  onAddLabel: (value: string) => void;
  onLabelsChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onPriorityChange: (value: TaskPriority) => void;
  onSubtaskTitleChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  onToggleSubtask: (subtaskId: string) => void;
}) {
  const previewLabels = createCardLabels(labels);

  return (
    <div className="board-card-modal" role="presentation">
      <button
        className="board-card-modal__backdrop"
        type="button"
        aria-label="Zavřít vytváření karty"
        onClick={onClose}
      />
      <form
        className="board-card-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-card-modal-title"
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }

          const target = event.target as HTMLElement;

          if (
            target instanceof HTMLTextAreaElement ||
            target.getAttribute("data-allow-enter") === "true"
          ) {
            return;
          }

          event.preventDefault();
        }}
      >
        <header className="board-card-modal__header">
          <div>
            <h2 id="board-card-modal-title">{isEditing ? "Upravit kartu" : "Vytvořit kartu"}</h2>
            <p>{isEditing ? "Uprav kartu na nástěnce " + projectName + "." : "Přidej novou kartu do nástěnky " + projectName + "."}</p>
          </div>
          <button className="board-card-modal__close" type="button" aria-label="Zavřít" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="board-card-modal__body">
          <label className="board-card-modal__field board-card-modal__field--full">
            <span>Název karty</span>
            <input
              autoFocus
              maxLength={120}
              placeholder="Např. Implementovat OAuth flow"
              value={title}
              onChange={(event) => onTitleChange(event.currentTarget.value)}
            />
          </label>

          <label className="board-card-modal__field board-card-modal__field--full">
            <span>Description</span>
            <textarea
              rows={4}
              placeholder="Briefly describe the requirements and scope..."
              value={note}
              onChange={(event) => onNoteChange(event.currentTarget.value)}
            />
          </label>

          <div className="board-card-modal__grid">
            <div className="board-card-modal__field">
              <span>Priority</span>
              <div className="board-card-modal__priority" role="group" aria-label="Priorita">
                {BOARD_CARD_PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    data-selected={priority === option}
                    onClick={() => onPriorityChange(option)}
                  >
                    {BOARD_CARD_PRIORITY_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>
            <label className="board-card-modal__field">
              <span>Due date</span>
              <input type="date" value={dueDate} onChange={(event) => onDueDateChange(event.currentTarget.value)} />
            </label>
          </div>

          <label className="board-card-modal__field board-card-modal__field--full">
            <span>Labels</span>
            <input
              data-allow-enter="true"
              placeholder="UI, Backend, Research"
              value={labelInput}
              onBlur={(event) => {
                if (event.currentTarget.value.trim()) {
                  onAddLabel(event.currentTarget.value);
                }
              }}
              onChange={(event) => onLabelInputChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== ",") {
                  return;
                }

                event.preventDefault();
                onAddLabel(event.currentTarget.value);
              }}
            />
          </label>
          {previewLabels.length > 0 ? (
            <div className="board-card-modal__labels" aria-label="Nahled stitku">
              {previewLabels.map((label) => (
                <span key={label.id} style={{ "--label-color": label.color } as CSSProperties}>
                  {label.name}
                </span>
              ))}
            </div>
          ) : null}

          <div className="board-card-modal__field board-card-modal__field--full">
            <span>Subtasks</span>
            <div className="board-card-modal__subtask-input">
              <input
                data-allow-enter="true"
                placeholder="Add a subtask..."
                value={subtaskTitle}
                onChange={(event) => onSubtaskTitleChange(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onAddSubtask();
                  }
                }}
              />
              <button type="button" onClick={onAddSubtask} disabled={!subtaskTitle.trim()}>
                Add
              </button>
            </div>
            {subtasks.length > 0 ? (
              <div className="board-card-modal__subtasks">
                {subtasks.map((subtask) => (
                  <label key={subtask.id} data-completed={subtask.completed ? "true" : "false"}>
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={() => onToggleSubtask(subtask.id)}
                      aria-label={"Oznacit podukol " + subtask.title}
                    />
                    <span>{subtask.title}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <label className="board-card-modal__field board-card-modal__field--full">
            <span>Assign member</span>
            <select value={assigneeId} onChange={(event) => onAssigneeChange(event.currentTarget.value)}>
              <option value="">Neprirazeno</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {getMemberDisplayName(member.email)}
                </option>
              ))}
            </select>
          </label>
          <div className="board-card-modal__assignees" aria-label="Clenove tymu">
            {members.slice(0, 5).map((member) => (
              <button
                key={member.userId}
                type="button"
                title={member.email}
                data-selected={assigneeId === member.userId}
                onClick={() => onAssigneeChange(assigneeId === member.userId ? "" : member.userId)}
              >
                {getMemberInitials(member.email)}
              </button>
            ))}
            <small>{columnTitle}</small>
          </div>
        </div>

        <footer className="board-card-modal__footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!title.trim()}>{actionLabel}</button>
        </footer>
      </form>
    </div>
  );
}
function ProjectDetailView({
  columns,
  editingColumnId,
  editingColumnTitle,
  isBusy,
  members,
  newColumnTitle,
  project,
  tasks,
  team,
  onAddColumn,
  onBack,
  onCancelRenameColumn,
  onChangeEditingColumnTitle,
  onChangeNewColumnTitle,
  onCreateTask,
  onArchiveColumn,
  onChangeOpenColumnMenuId,
  onDeleteTask,
  onDeleteColumn,
  onEditProject,
  onOpenTask,
  onOpenColumnMenuId,
  onRenameColumn,
  onStartRenameColumn,
  onUpdateTask,
}: {
  columns: ProjectColumn[];
  editingColumnId: string | null;
  editingColumnTitle: string;
  isBusy: boolean;
  members: TeamMember[];
  newColumnTitle: string;
  project: Project;
  tasks: Task[];
  team: Team | null;
  onAddColumn: (event: FormEvent<HTMLFormElement>) => void;
  onArchiveColumn: (column: ProjectColumn) => void;
  onBack: () => void;
  onCancelRenameColumn: () => void;
  onChangeEditingColumnTitle: (value: string) => void;
  onChangeNewColumnTitle: (value: string) => void;
  onChangeOpenColumnMenuId: (columnId: string | null) => void;
  onCreateTask: (columnKey?: Task["boardColumnKey"]) => void;
  onDeleteTask: (taskId: string) => void;
  onDeleteColumn: (column: ProjectColumn) => void;
  onOpenTask: (taskId: string) => void;
  onEditProject: () => void;
  onOpenColumnMenuId: string | null;
  onRenameColumn: (columnId: string, title: string) => void;
  onStartRenameColumn: (column: ProjectColumn) => void;
  onUpdateTask: (taskId: string, update: TaskUpdate) => void;
}) {
  const projectTasks = tasks.filter((task) => task.projectId === project.id && !task.isArchived);
  const completedCount = projectTasks.filter((task) => task.completed || task.boardColumnKey === "done").length;
  const progress = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;
  const memberById = new Map(members.map((member) => [member.userId, member]));
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropColumnKey, setDropColumnKey] = useState<Task["boardColumnKey"] | null>(null);
  const [droppedTaskId, setDroppedTaskId] = useState<string | null>(null);
  const [settledColumnKey, setSettledColumnKey] = useState<Task["boardColumnKey"] | null>(null);
  const dropAnimationTimeoutRef = useRef<number | null>(null);
  const openColumnMenuRef = useRef<HTMLDivElement | null>(null);

  function handleMoveTask(task: Task, columnKey: Task["boardColumnKey"]) {
    onUpdateTask(task.id, {
      boardColumnKey: columnKey,
      completed: columnKey === "done",
    });
  }

  function handleTaskDragStart(event: DragEvent<HTMLElement>, task: Task) {
    setDraggedTaskId(task.id);
    setDropColumnKey(task.boardColumnKey);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  }

  function handleTaskDragEnd() {
    setDraggedTaskId(null);
    setDropColumnKey(null);
  }

  function handleColumnDragOver(
    event: DragEvent<HTMLElement>,
    columnKey: Task["boardColumnKey"],
  ) {
    if (!draggedTaskId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (dropColumnKey !== columnKey) {
      setDropColumnKey(columnKey);
    }
  }

  function handleColumnDrop(
    event: DragEvent<HTMLElement>,
    columnKey: Task["boardColumnKey"],
  ) {
    event.preventDefault();

    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    const draggedTask = projectTasks.find((task) => task.id === taskId);

    setDraggedTaskId(null);
    setDropColumnKey(null);

    if (!draggedTask || draggedTask.boardColumnKey === columnKey) {
      return;
    }

    if (dropAnimationTimeoutRef.current !== null) {
      window.clearTimeout(dropAnimationTimeoutRef.current);
    }

    setDroppedTaskId(draggedTask.id);
    setSettledColumnKey(columnKey);
    dropAnimationTimeoutRef.current = window.setTimeout(() => {
      setDroppedTaskId(null);
      setSettledColumnKey(null);
      dropAnimationTimeoutRef.current = null;
    }, 360);

    handleMoveTask(draggedTask, columnKey);
  }

  useEffect(() => {
    return () => {
      if (dropAnimationTimeoutRef.current !== null) {
        window.clearTimeout(dropAnimationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!onOpenColumnMenuId) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (openColumnMenuRef.current?.contains(target)) {
        return;
      }

      onChangeOpenColumnMenuId(null);
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onChangeOpenColumnMenuId, onOpenColumnMenuId]);

  return (
    <section className="app-panel project-detail" aria-label="Board detail">
      <div className="project-detail__main">
        <header className="project-detail__header">
          <div>
            <button className="project-detail__breadcrumb" type="button" onClick={onBack}>
              Nástěnky / {team?.name ?? "Tým"}
            </button>
            <h2>{project.name}</h2>
            <div className="project-detail__meta">
              <span>{getProjectStatusLabel(project.status)}</span>
              <span>{formatProjectDateRange(project.startDate, project.endDate)}</span>
            </div>
          </div>
          <div className="project-detail__progress">
            <strong>{progress}%</strong>
            <span>Progres nástěnky</span>
            <div aria-hidden="true">
              <i style={{ width: progress + "%" }} />
            </div>
          </div>
          <button className="project-detail__edit" type="button" onClick={onEditProject}>
            Upravit nástěnku
          </button>
        </header>

        <div className="project-detail__board" aria-label="Kanban board">
          {columns.map((column) => {
            const columnTasks = projectTasks.filter((task) => task.boardColumnKey === column.key);

            return (
              <section
                className="project-detail__column"
                data-drop-target={dropColumnKey === column.key}
                data-drop-settled={settledColumnKey === column.key}
                key={column.id}
                onDragOver={(event) => handleColumnDragOver(event, column.key)}
                onDrop={(event) => handleColumnDrop(event, column.key)}
              >
                <header className="project-detail__column-head">
                  <div>
                    {editingColumnId === column.id ? (
                      <form
                        className="project-detail__column-rename"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void onRenameColumn(column.id, editingColumnTitle);
                        }}
                      >
                        <input
                          aria-label="Název sloupce"
                          autoFocus
                          maxLength={48}
                          value={editingColumnTitle}
                          onBlur={() => void onRenameColumn(column.id, editingColumnTitle)}
                          onChange={(event) => onChangeEditingColumnTitle(event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              onCancelRenameColumn();
                            }
                          }}
                        />
                      </form>
                    ) : (
                      <button
                        className="project-detail__column-title"
                        type="button"
                        onClick={() => onStartRenameColumn(column)}
                        aria-label={"Přejmenovat sloupec " + column.title}
                      >
                        <strong>{column.title}</strong>
                      </button>
                    )}
                    <span>{columnTasks.length === 1 ? "1 karta" : columnTasks.length + " karet"}</span>
                  </div>
                  <div className="project-detail__column-actions">
                    <small>{columnTasks.length}</small>
                    <div
                      className="project-detail__column-menu"
                      ref={onOpenColumnMenuId === column.id ? openColumnMenuRef : null}
                    >
                      <button
                        className="project-detail__column-menu-button"
                        type="button"
                        aria-label={"Upravit sloupec " + column.title}
                        aria-expanded={onOpenColumnMenuId === column.id}
                        onClick={() =>
                          onChangeOpenColumnMenuId(
                            onOpenColumnMenuId === column.id ? null : column.id,
                          )
                        }
                      >
                        <MoreVertical aria-hidden="true" size={16} />
                      </button>
                      {onOpenColumnMenuId === column.id ? (
                        <div className="project-detail__column-menu-content" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            disabled={isBusy || columns.length <= 1}
                            onClick={() => onArchiveColumn(column)}
                          >
                            Archivovat
                          </button>
                          <button
                            className="project-detail__column-menu-danger"
                            type="button"
                            role="menuitem"
                            disabled={isBusy || columns.length <= 1}
                            onClick={() => onDeleteColumn(column)}
                          >
                            Smazat
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </header>
                <div className="project-detail__column-list">
                  {columnTasks.length > 0 ? (
                    columnTasks.map((task) => (
                      <ProjectTaskMiniRow
                        assignee={task.assigneeId ? memberById.get(task.assigneeId) ?? null : null}
                        isDragging={draggedTaskId === task.id}
                        isSettling={droppedTaskId === task.id}
                        key={task.id}
                        task={task}
                        onDragEnd={handleTaskDragEnd}
                        onDeleteTask={onDeleteTask}
                        onDragStart={handleTaskDragStart}
                        onOpenTask={onOpenTask}
                      />
                    ))
                  ) : (
                    <p>Sem zatím nic nepadá.</p>
                  )}
                </div>
                <button
                  className="project-detail__add-card"
                  type="button"
                  onClick={() => onCreateTask(column.key)}
                >
                  <span aria-hidden="true">+</span>
                  Přidat kartu
                </button>
              </section>
            );
          })}
          <form className="project-detail__add-column" onSubmit={onAddColumn}>
            <input
              aria-label="Název nového sloupce"
              maxLength={48}
              placeholder="Nový sloupec"
              value={newColumnTitle}
              onChange={(event) => onChangeNewColumnTitle(event.currentTarget.value)}
            />
            <button type="submit" disabled={!newColumnTitle.trim() || isBusy}>
              + Přidat sloupec
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
function ProjectTaskMiniRow({
  assignee,
  isDragging,
  isSettling,
  task,
  onDragEnd,
  onDeleteTask,
  onDragStart,
  onOpenTask,
}: {
  assignee: TeamMember | null;
  isDragging: boolean;
  isSettling: boolean;
  task: Task;
  onDragEnd: () => void;
  onDeleteTask: (taskId: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, task: Task) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      setIsMenuOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isMenuOpen]);

  function handleMenuAction(action: () => void) {
    setIsMenuOpen(false);
    action();
  }

  return (
    <article
      className="project-detail__task-row"
      data-completed={task.completed || task.boardColumnKey === "done"}
      data-dragging={isDragging}
      data-settling={isSettling}
      draggable
      onDragEnd={onDragEnd}
      onDragStart={(event) => onDragStart(event, task)}
    >
      <button className="project-detail__task-open" type="button" onClick={() => onOpenTask(task.id)}>
        <span>{task.title}</span>
        <small>{assignee ? getMemberDisplayName(assignee.email) : "Bez přiřazení"}</small>
      </button>
      <div className="project-detail__task-menu" ref={menuRef}>
        <button
          className="project-detail__task-menu-button"
          type="button"
          aria-label={"Další akce pro kartu " + task.title}
          aria-expanded={isMenuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setIsMenuOpen((currentValue) => !currentValue);
          }}
        >
          <MoreVertical aria-hidden="true" size={15} />
        </button>
        {isMenuOpen ? (
          <div className="project-detail__task-menu-content" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                handleMenuAction(() => onOpenTask(task.id));
              }}
            >
              Upravit
            </button>
            <button
              className="project-detail__task-menu-danger"
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                handleMenuAction(() => onDeleteTask(task.id));
              }}
            >
              Smazat
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
function createCardLabels(value: string): TaskLabel[] {
  const names = normalizeCardLabelNames(value);

  return names.map((name, index) => ({
    id: "label-" + Date.now() + "-" + index + "-" + Math.random().toString(36).slice(2, 6),
    name,
    color: getCardLabelColor(name),
  }));
}

function normalizeCardLabelNames(value: string) {
  return value
    .split(",")
    .map((label) => label.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 5);
}

function formatCardLabelsValue(value: string) {
  return normalizeCardLabelNames(value).join(", ");
}

function appendCardLabelValue(currentValue: string, rawValue: string) {
  const names = normalizeCardLabelNames(currentValue);
  const existingNames = new Set(names.map((name) => name.toLowerCase()));

  for (const nextName of normalizeCardLabelNames(rawValue)) {
    const normalizedName = nextName.toLowerCase();

    if (existingNames.has(normalizedName) || names.length >= 5) {
      continue;
    }

    names.push(nextName);
    existingNames.add(normalizedName);
  }

  return names.join(", ");
}

function getCardLabelColor(name: string) {
  const seed = name
    .toLowerCase()
    .split("")
    .reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return BOARD_CARD_LABEL_COLORS[seed % BOARD_CARD_LABEL_COLORS.length];
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


function TeamMetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "purple" | "mint" | "slate";
}) {
  return (
    <div className="teams-overview__metric-card" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TeamsMetricCard({
  index,
  icon,
  label,
  value,
  tone,
}: {
  index: number;
  icon: ReactNode;
  label: string;
  value: number;
  tone: "purple" | "mint" | "slate" | "amber";
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="teams-metric-card"
      data-tone={tone}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
    >
      <div className="teams-metric-card__head">
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
    </motion.div>
  );
}

function getMemberDisplayName(email: string) {
  return email.split("@")[0] || email;
}

function getMemberInitials(email: string) {
  const name = getMemberDisplayName(email);
  const parts = name.split(/[._\-\s]+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function isTeamAdminRole(role: TeamMember["role"] | undefined) {
  return role === "admin";
}

function getTeamRoleLabel(role: TeamMember["role"]) {
  return isTeamAdminRole(role) ? "Admin" : "Člen";
}

function sortTeamMembers(left: TeamMember, right: TeamMember) {
  const leftRank = isTeamAdminRole(left.role) ? 0 : 1;
  const rightRank = isTeamAdminRole(right.role) ? 0 : 1;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.email.localeCompare(right.email, "cs-CZ");
}

function sortTeamInvites(left: TeamInvite, right: TeamInvite) {
  return left.email.localeCompare(right.email, "cs-CZ");
}

type DashboardOverlayProps = {
  summary: DashboardSummary;
  onClose: () => void;
};

function DashboardOverlay({ summary, onClose }: DashboardOverlayProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="dashboard-overlay" role="presentation">
      <button
        className="dashboard-overlay__backdrop"
        aria-label="Zav??t dashboard"
        type="button"
        onClick={onClose}
      />
      <section
        className="dashboard-overlay__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-title"
      >
        <div className="dashboard-overlay__header">
          <strong id="dashboard-title">{summary.headline}</strong>
          <button
            className="dashboard-overlay__close"
            aria-label="Zav??t"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="dashboard-overlay__hero">
          <div
            className="dashboard-overlay__percent"
            aria-label={`Dokon?eno ${summary.progressValue} procent`}
            style={
              {
                "--dashboard-progress": `${summary.progressValue}%`,
              } as CSSProperties
            }
          >
            {summary.progressValue}%
          </div>
          <div className="dashboard-overlay__hero-copy">
            <strong>{summary.remainingText}</strong>
            <span>{summary.progressText}</span>
          </div>
        </div>
        <div className="dashboard-overlay__metric-row">
          <DashboardMetric label="Po term?nu" value={summary.overdueCount} tone="danger" />
          <DashboardMetric label="Urgentn?" value={summary.urgentCount} tone="danger" />
          <DashboardMetric label="Dnes" value={summary.todayCount} />
          <DashboardMetric label="Hotovo" value={summary.completedCount} tone="success" />
        </div>
        <div className="dashboard-overlay__status-card" data-tone={summary.statusTone}>
          <span>{summary.statusLabel}</span>
          <p>{summary.statusText}</p>
          {summary.insights.length > 0 ? (
            <div className="dashboard-overlay__insights">
              {summary.insights.map((insight) => (
                <small key={insight}>{insight}</small>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

type DashboardSummary = {
  completedCount: number;
  headline: string;
  importantCount: number;
  insights: string[];
  overdueCount: number;
  progressValue: number;
  progressText: string;
  remainingCount: number;
  remainingText: string;
  scopeLabel: string;
  statusLabel: string;
  statusText: string;
  statusTone: "default" | "danger" | "success";
  todayCount: number;
  totalCount: number;
  urgentCount: number;
};

function getDashboardSummary(tasks: Task[], scopeLabel: string): DashboardSummary {
  const today = getTodayDateValue();
  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const overdueTasks = activeTasks.filter(
    (task) => getPrimaryTimeStatus(task, today) === "overdue",
  );
  const todayTasks = activeTasks.filter(
    (task) => getPrimaryTimeStatus(task, today) === "today",
  );
  const importantTasks = activeTasks.filter((task) => task.priority === "high");
  const urgentTasks = activeTasks.filter((task) => {
    const timeStatus = getPrimaryTimeStatus(task, today);

    return (
      timeStatus === "overdue" ||
      (timeStatus === "today" && task.priority === "high")
    );
  });
  const noDueTasks = activeTasks.filter((task) => !task.dueDate);
  const inProgressTasks = activeTasks.filter((task) => {
    const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed)
      .length;

    return completedSubtasks > 0 && completedSubtasks < task.subtasks.length;
  });
  const totalCount = tasks.length;
  const completedCount = completedTasks.length;
  const remainingCount = activeTasks.length;
  const progressValue =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const oldestOverdueDays = getOldestOverdueDays(overdueTasks, today);
  const insights: string[] = [];

  if (oldestOverdueDays > 0) {
    insights.push(`Nejstar?? skluz ?ek? ${formatDayCount(oldestOverdueDays)}.`);
  }

  if (inProgressTasks.length > 0) {
    insights.push(`${formatTaskCount(inProgressTasks.length)} rozpracovan?.`);
  }

  if (noDueTasks.length > 0) {
    insights.push(`${formatTaskCount(noDueTasks.length)} bez term?nu.`);
  }

  return {
    completedCount,
    headline: getDashboardHeadline({
      activeCount: activeTasks.length,
      completedCount,
      importantCount: importantTasks.length,
      overdueCount: overdueTasks.length,
      todayCount: todayTasks.length,
      totalCount,
    }),
    importantCount: importantTasks.length,
    insights,
    overdueCount: overdueTasks.length,
    progressValue,
    progressText: getDashboardProgressText(completedCount, totalCount),
    remainingCount,
    remainingText: getDashboardRemainingText(activeTasks.length, scopeLabel),
    scopeLabel,
    statusLabel: getDashboardStatusLabel({
      activeCount: activeTasks.length,
      overdueCount: overdueTasks.length,
      totalCount,
    }),
    statusText: getDashboardStatusText({
      activeCount: activeTasks.length,
      oldestOverdueDays,
      overdueCount: overdueTasks.length,
      scopeLabel,
      todayCount: todayTasks.length,
    }),
    statusTone: getDashboardStatusTone(activeTasks.length, overdueTasks.length),
    todayCount: todayTasks.length,
    totalCount,
    urgentCount: urgentTasks.length,
  };
}

function getCheckInSummary(tasks: Task[], scopeLabel: string): CheckInSummary {
  const today = getTodayDateValue();
  const currentHour = new Date().getHours();
  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const overdueTasks = activeTasks.filter(
    (task) => getPrimaryTimeStatus(task, today) === "overdue",
  );
  const todayTasks = activeTasks.filter(
    (task) => getPrimaryTimeStatus(task, today) === "today",
  );
  const moveCandidates = [...overdueTasks, ...todayTasks].slice(0, 8);
  const isEvening = currentHour >= 17;
  const isActive = isEvening || overdueTasks.length > 0 || todayTasks.length > 0;
  const remainingCount = activeTasks.length;

  return {
    completedCount: completedTasks.length,
    headline: getCheckInHeadline({
      isEvening,
      overdueCount: overdueTasks.length,
      remainingCount,
      todayCount: todayTasks.length,
    }),
    isActive,
    moveCandidates,
    overdueCount: overdueTasks.length,
    remainingCount,
    scopeLabel,
    subtitle: getCheckInSubtitle({
      isEvening,
      moveCount: moveCandidates.length,
      remainingCount,
      scopeLabel,
    }),
    todayRemainingCount: todayTasks.length,
    totalCount: tasks.length,
  };
}

function getCheckInHeadline({
  isEvening,
  overdueCount,
  remainingCount,
  todayCount,
}: {
  isEvening: boolean;
  overdueCount: number;
  remainingCount: number;
  todayCount: number;
}) {
  if (remainingCount === 0) {
    return "Dnes je ?isto";
  }

  if (overdueCount > 0) {
    return "Uzav?i skluz";
  }

  if (isEvening && todayCount > 0) {
    return "P?iprav z?t?ek";
  }

  return "Dne?n? stav";
}

function getCheckInSubtitle({
  isEvening,
  moveCount,
  remainingCount,
  scopeLabel,
}: {
  isEvening: boolean;
  moveCount: number;
  remainingCount: number;
  scopeLabel: string;
}) {
  if (remainingCount === 0) {
    return `V?echno aktivn? je hotov? ${scopeLabel}.`;
  }

  if (moveCount > 0 && isEvening) {
    return `Vyber, co m? p?ej?t na z?tra ${scopeLabel}.`;
  }

  if (moveCount > 0) {
    return `M?? ${formatTaskCount(moveCount)} k do?e?en? ${scopeLabel}.`;
  }

  return `${formatTaskVerb(remainingCount)} ${formatTaskCount(remainingCount)} ${scopeLabel}.`;
}

function getCheckInTaskReason(task: Task) {
  const timeStatus = getPrimaryTimeStatus(task, getTodayDateValue());

  if (timeStatus === "overdue") {
    return "po term?nu";
  }

  if (timeStatus === "today") {
    return "dnes";
  }

  if (task.priority === "high") {
    return "d?le?it?";
  }

  return "zb?v?";
}

function getDashboardHeadline({
  activeCount,
  completedCount,
  importantCount,
  overdueCount,
  todayCount,
  totalCount,
}: {
  activeCount: number;
  completedCount: number;
  importantCount: number;
  overdueCount: number;
  todayCount: number;
  totalCount: number;
}) {
  if (totalCount === 0) {
    return "Seznam je pr?zdn?";
  }

  if (activeCount === 0 && completedCount > 0) {
    return "Hotovo";
  }

  if (overdueCount > 0) {
    return "Pozor na skluz";
  }

  if (todayCount > 0) {
    return "Dnes je co d?lat";
  }

  if (importantCount > 0) {
    return "D?le?it? ?ek?";
  }

  return "V?echno je pod kontrolou";
}

function getDashboardStatusLabel({
  activeCount,
  overdueCount,
  totalCount,
}: {
  activeCount: number;
  overdueCount: number;
  totalCount: number;
}) {
  if (totalCount === 0) {
    return "Pr?zdn? seznam";
  }

  if (activeCount === 0) {
    return "?isto";
  }

  if (overdueCount > 0) {
    return "Vy?aduje pozornost";
  }

  return "Stav";
}

function getDashboardRemainingText(activeCount: number, scopeLabel: string) {
  if (activeCount === 0) {
    return scopeLabel === "v tomto seznamu"
      ? "V tomto seznamu je ?isto."
      : "V tomto pohledu je ?isto.";
  }

  return `${formatTaskVerb(activeCount)} ${formatTaskCount(activeCount)} ${scopeLabel}.`;
}

function getDashboardProgressText(completedCount: number, totalCount: number) {
  if (totalCount === 0) {
    return "Tady te? nic ne?ek?.";
  }

  if (completedCount === totalCount) {
    return "V?echno je hotovo.";
  }

  return `Hotovo ${completedCount} z ${totalCount}.`;
}

function getDashboardStatusText({
  activeCount,
  oldestOverdueDays,
  overdueCount,
  scopeLabel,
  todayCount,
}: {
  activeCount: number;
  oldestOverdueDays: number;
  overdueCount: number;
  scopeLabel: string;
  todayCount: number;
}) {
  if (activeCount === 0) {
    return scopeLabel === "v tomto seznamu"
      ? "V tomto seznamu te? nic ne?ek?."
      : "V tomto pohledu te? nic ne?ek?.";
  }

  if (overdueCount > 0) {
    return oldestOverdueDays > 0
      ? `${formatTaskCount(overdueCount)} po term?nu. Nejstar?? ?ek? ${formatDayCount(oldestOverdueDays)}.`
      : `${formatTaskCount(overdueCount)} po term?nu.`;
  }

  if (todayCount > 0) {
    return `${formatTaskCount(todayCount)} ?ek? dnes.`;
  }

  return `${formatTaskVerb(activeCount)} ${formatTaskCount(activeCount)} ${scopeLabel}.`;
}

function getDashboardStatusTone(activeCount: number, overdueCount: number) {
  if (activeCount === 0) {
    return "success";
  }

  if (overdueCount > 0) {
    return "danger";
  }

  return "default";
}

function getOldestOverdueDays(tasks: Task[], today: string) {
  return tasks.reduce((oldest, task) => {
    if (!task.dueDate) {
      return oldest;
    }

    const diffMs =
      new Date(`${today}T00:00:00`).getTime() -
      new Date(`${task.dueDate}T00:00:00`).getTime();
    const diffDays = Math.max(1, Math.round(diffMs / 86_400_000));

    return Math.max(oldest, diffDays);
  }, 0);
}

function formatDayCount(count: number) {
  if (count === 1) {
    return "1 den";
  }

  if (count >= 2 && count <= 4) {
    return `${count} dny`;
  }

  return `${count} dn?`;
}

function formatTaskCount(count: number) {
  if (count === 1) {
    return "1 ?kol";
  }

  if (count >= 2 && count <= 4) {
    return `${count} ?koly`;
  }

  return `${count} ?kol?`;
}

function formatTaskVerb(count: number) {
  return count === 1 ? "Zb?v?" : "Zb?vaj?";
}

function getTomorrowDateValue() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function DashboardMetric({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "danger" | "success";
  value: number;
}) {
  return (
    <div className="dashboard-overlay__metric" data-tone={tone}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

type CheckInSummary = {
  completedCount: number;
  headline: string;
  isActive: boolean;
  moveCandidates: Task[];
  overdueCount: number;
  remainingCount: number;
  scopeLabel: string;
  subtitle: string;
  todayRemainingCount: number;
  totalCount: number;
};

type CheckInOverlayProps = {
  summary: CheckInSummary;
  onClose: () => void;
  onCreateTask: () => void;
  onMoveToTomorrow: () => void;
};

function CheckInOverlay({
  summary,
  onClose,
  onCreateTask,
  onMoveToTomorrow,
}: CheckInOverlayProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="checkin-overlay" role="presentation">
      <button
        className="checkin-overlay__backdrop"
        aria-label="Zav??t check-in"
        type="button"
        onClick={onClose}
      />
      <section
        className="checkin-overlay__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
      >
        <div className="checkin-overlay__header">
          <div>
            <span>{summary.isActive ? "Ve?ern? check-in" : "Dne?n? stav"}</span>
            <strong id="checkin-title">{summary.headline}</strong>
          </div>
          <button
            className="checkin-overlay__close"
            aria-label="Zav??t"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="checkin-overlay__summary">
          <p>{summary.subtitle}</p>
          <div className="checkin-overlay__chips" aria-label="Rychl? souhrn">
            <span>{formatTaskCount(summary.completedCount)} hotovo</span>
            <span>{formatTaskCount(summary.remainingCount)} zb?v?</span>
            {summary.overdueCount > 0 ? (
              <span data-tone="danger">{formatTaskCount(summary.overdueCount)} po term?nu</span>
            ) : null}
          </div>
        </div>

        {summary.moveCandidates.length > 0 ? (
          <div className="checkin-overlay__action-card">
            <span>Co zb?v?</span>
            <strong>{formatTaskCount(summary.moveCandidates.length)} m??e p?ej?t na z?tra</strong>
            <div className="checkin-overlay__task-list">
              {summary.moveCandidates.slice(0, 3).map((task) => (
                <div className="checkin-overlay__task-row" key={task.id}>
                  <span>{task.title}</span>
                  <small>{getCheckInTaskReason(task)}</small>
                </div>
              ))}
              {summary.moveCandidates.length > 3 ? (
                <small>+{summary.moveCandidates.length - 3} dal??</small>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="checkin-overlay__action-card" data-tone="success">
            <span>Klid</span>
            <strong>Nic nemus?? p?esouvat</strong>
            <p>Tenhle pohled je pro dne?ek pod kontrolou.</p>
          </div>
        )}

        <div className="checkin-overlay__actions">
          {summary.moveCandidates.length > 0 ? (
            <button type="button" onClick={onMoveToTomorrow}>
              P?esunout na z?tra
            </button>
          ) : (
            <button type="button" onClick={onCreateTask}>
              P?idat ?kol
            </button>
          )}
          <button type="button" onClick={onClose}>
            Zav??t
          </button>
        </div>
      </section>
    </div>
  );
}

type FocusAssistantOverlayProps = {
  recommendation: RecommendedTask | null;
  urgentTasks: RecommendedTask[];
  deferredCount: number;
  scopeLabel: string;
  outsideHint: string | null;
  onClose: () => void;
  onSkip: () => void;
  onStart: () => void;
  onCreateTask: () => void;
};

function FocusAssistantOverlay({
  recommendation,
  urgentTasks,
  deferredCount,
  scopeLabel,
  outsideHint,
  onClose,
  onSkip,
  onStart,
  onCreateTask,
}: FocusAssistantOverlayProps) {
  const urgentSummary =
    urgentTasks.length > 0 ? getUrgentSummary(urgentTasks, scopeLabel) : null;
  const benefitSentence = recommendation
    ? getAssistantBenefitSentence(recommendation, urgentTasks.length, deferredCount)
    : null;
  const touchStartYRef = useRef<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    touchStartYRef.current = touch.clientY;
    setDragOffsetY(0);
  }

  function handleTouchMove(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    const touchStartY = touchStartYRef.current;

    if (!touch || touchStartY === null) {
      return;
    }

    const nextOffset = Math.max(touch.clientY - touchStartY, 0);
    setDragOffsetY(nextOffset);
  }

  function handleTouchEnd() {
    if (dragOffsetY > 90) {
      onClose();
      return;
    }

    touchStartYRef.current = null;
    setDragOffsetY(0);
  }

  return (
    <div className="focus-assistant" role="presentation">
      <button
        className="focus-assistant__backdrop"
        aria-label="Zav??t Focus Assistant"
        type="button"
        onClick={onClose}
      />
      <section
        className="focus-assistant__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-assistant-title"
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        style={
          dragOffsetY > 0
            ? ({
                "--focus-assistant-drag-offset": `${dragOffsetY}px`,
              } as CSSProperties)
            : undefined
        }
      >
        <div className="focus-assistant__header">
          <span className="focus-assistant__handle" aria-hidden="true" />
          <strong id="focus-assistant-title">Co d?lat te?</strong>
          <button
            className="focus-assistant__close"
            aria-label="Zav??t"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {recommendation ? (
          <div className="focus-assistant__content">
            <div className="focus-assistant__signals" aria-label="Rychl? rozhodnut?">
              {urgentSummary ? (
                <span className="focus-assistant__signal" data-tone="danger">
                  {urgentSummary}
                </span>
              ) : null}
            </div>

            <section className="focus-assistant__section focus-assistant__section--primary">
              <h2>{recommendation.task.title}</h2>
              <p className="focus-assistant__message" aria-label="D?vod doporu?en?">
                {getAssistantReasonSentence(recommendation, scopeLabel)}
              </p>
              {benefitSentence ? (
                <p className="focus-assistant__benefit">{benefitSentence}</p>
              ) : null}
              {outsideHint ? (
                <p className="focus-assistant__hint">{outsideHint}</p>
              ) : null}
              <div className="focus-assistant__actions">
                <button type="button" onClick={onStart}>
                  Za??t
                </button>
                <button type="button" onClick={onSkip}>
                  P?esko?it
                </button>
                <button type="button" onClick={onClose}>
                Zav??t
              </button>
            </div>
          </section>
          </div>
        ) : (
          <div className="focus-assistant__content focus-assistant__content--empty">
            <h2>M?? klid.</h2>
            <p className="focus-assistant__message">
              {scopeLabel === "v tomto seznamu"
                ? "V tomto seznamu te? nic neho??."
                : "V tomto pohledu te? nic neho??."}
            </p>
            <div className="focus-assistant__actions">
              <button type="button" onClick={onCreateTask}>
                P?idat ?kol
              </button>
              <button type="button" onClick={onClose}>
                Zav??t
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function getAssistantScopeLabel(
  activeView: "today" | "planned" | "important" | "all" | "user-list",
) {
  return activeView === "user-list" ? "v tomto seznamu" : "v tomto pohledu";
}

function getOutsideUrgencyHint(
  activeView: "today" | "planned" | "important" | "all" | "user-list",
  localRecommendation: RecommendedTask | null,
  globalRecommendation: RecommendedTask | null,
) {
  if (activeView !== "user-list" || !globalRecommendation) {
    return null;
  }

  if (!localRecommendation) {
    return "Mimo tento seznam m? urgentn?j?? ?kol.";
  }

  if (
    globalRecommendation.task.id !== localRecommendation.task.id &&
    globalRecommendation.bucket < localRecommendation.bucket
  ) {
    return "Mimo tento seznam m? urgentn?j?? ?kol.";
  }

  return null;
}

function getUrgentSummary(tasks: RecommendedTask[], scopeLabel: string) {
  const overdueCount = tasks.filter(
    ({ task }) => getPrimaryTimeStatus(task, getTodayDateValue()) === "overdue",
  ).length;
  const todayHighCount = tasks.filter(
    ({ task }) =>
      getPrimaryTimeStatus(task, getTodayDateValue()) === "today" &&
      task.priority === "high",
  ).length;
  const scopeSuffix = scopeLabel === "v tomto seznamu" ? "v seznamu" : "v pohledu";

  if (overdueCount > 0) {
    return `${formatCzechTaskCount(overdueCount)} ho?? ${scopeSuffix}`;
  }

  if (todayHighCount > 0) {
    return todayHighCount === 1
      ? `Dne?n? priorita ${scopeSuffix}`
      : `${todayHighCount} dne?n? priority ${scopeSuffix}`;
  }

  return tasks.length === 1
    ? `1 urgentn? ?kol ${scopeSuffix}`
    : `${tasks.length} urgentn? ?koly ${scopeSuffix}`;
}

function formatCzechTaskCount(count: number) {
  if (count === 1) {
    return "1 ?kol";
  }

  if (count >= 2 && count <= 4) {
    return `${count} ?koly`;
  }

  return `${count} ?kol?`;
}

function getTaskContextPhrase(task: Task) {
  const today = getTodayDateValue();
  const timeStatus = getPrimaryTimeStatus(task, today);

  if (timeStatus === "overdue") {
    return task.priority === "high"
      ? "Po term?nu + vysok? priorita"
      : "Po term?nu";
  }

  if (timeStatus === "today") {
    return task.priority === "high" ? "Dnes + vysok? priorita" : "Na dne?ek";
  }

  if (task.priority === "high") {
    return "Vysok? priorita";
  }

  return null;
}

function getAssistantBenefitSentence(
  recommendation: RecommendedTask,
  urgentCount: number,
  deferredCount: number,
) {
  const timeStatus = getPrimaryTimeStatus(recommendation.task, getTodayDateValue());
  const hasSubtasks = recommendation.task.subtasks.length > 0;
  const completedSubtasks = recommendation.task.subtasks.filter(
    (subtask) => subtask.completed,
  ).length;
  const openSubtasks = recommendation.task.subtasks.length - completedSubtasks;

  if (timeStatus === "overdue") {
    return urgentCount > 1
      ? "Sn??? skluz."
      : "Zav?e? skluz.";
  }

  if (timeStatus === "today" && recommendation.task.priority === "high") {
    return "Uzav?e? dne?n? prioritu.";
  }

  if (recommendation.task.priority === "high") {
    return "Nejv?t?? dopad.";
  }

  if (hasSubtasks && openSubtasks > 0) {
    return openSubtasks === 1
      ? "Jeden jasn? krok."
      : `${openSubtasks} jasn? kroky.`;
  }

  if (deferredCount > 0) {
    return "Ostatn? po?k?.";
  }

  return "Jasn? dal?? krok.";
}

function getAssistantReasonSentence(
  recommendation: RecommendedTask,
  scopeLabel: string,
) {
  const contextPhrase = getTaskContextPhrase(recommendation.task);

  if (contextPhrase) {
    return contextPhrase;
  }

  switch (recommendation.bucket) {
    case 4:
      return scopeLabel === "v tomto seznamu"
        ? "Nejd?le?it?j?? krok v seznamu"
        : "Nejd?le?it?j?? krok v pohledu";
    default:
      return scopeLabel === "v tomto seznamu"
        ? "Nejlep?? dal?? krok v seznamu"
        : "Nejlep?? dal?? krok v pohledu";
  }
}

function orderVisibleTasksForList(
  tasks: Task[],
  recommendedTasks: ReturnType<typeof getRecommendedTasks>,
) {
  const recommendationOrder = new Map(
    recommendedTasks.map(({ task }, index) => [task.id, index]),
  );
  const originalOrder = new Map(tasks.map((task, index) => [task.id, index]));

  return [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    const leftRecommendationIndex = recommendationOrder.get(left.id);
    const rightRecommendationIndex = recommendationOrder.get(right.id);

    if (
      leftRecommendationIndex !== undefined &&
      rightRecommendationIndex !== undefined &&
      leftRecommendationIndex !== rightRecommendationIndex
    ) {
      return leftRecommendationIndex - rightRecommendationIndex;
    }

    if (leftRecommendationIndex !== undefined) {
      return -1;
    }

    if (rightRecommendationIndex !== undefined) {
      return 1;
    }

    return (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0);
  });
}

function isPanelVisible(visiblePanels: VisiblePanel[], panel: VisiblePanel) {
  return visiblePanels.includes(panel);
}







