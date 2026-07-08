import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent,
  TouchEvent,
} from "react";
import {
  CalendarDays,
  Clock3,
  FolderKanban,
  Download,
  Home,
  List,
  Moon,
  Pencil,
  Star,
  Sun,
  Trash2,
  Users,
  UserPlus,
} from "lucide-react";
import {
  DEFAULT_TASK_LIST_ID,
  FALLBACK_LIST_ID,
  IMPORTANT_LIST_ID,
  PLANNED_LIST_ID,
  TODAY_LIST_ID,
} from "../../tasks/mockData";
import type { CountsByListId } from "../../tasks/taskCounts";
import type { Team, TeamInvite, TeamMember } from "../../teams/teamTypes";
import type { TaskTeamCounts } from "../../teams/teamCounts";
import type { TaskList } from "../../tasks/taskTypes";
import {
  inviteTeamMemberByEmail,
  loadTeamInvites,
  loadTeamMembers,
  removeTeamMember,
  updateTeamMemberRole,
} from "../../supabase/teamApi";

const LIST_NAME_MAX_LENGTH = 60;
const DEFAULT_LIST_COLOR = "#6d5dfc";
const LIST_SWIPE_ACTION_WIDTH = 64;
const ANDROID_APP_DOWNLOAD_URL =
  "https://drive.google.com/file/d/14TDMGTXAIU3jNxzFbyHB73vfux9VL8XI/view?usp=sharing";
const RESERVED_LIST_NAMES = new Set(["doporučeno", "doporuceno"]);
const CREATE_LIST_COLORS = [
  "#6d5dfc",
  "#22c55e",
  "#38bdf8",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#94a3b8",
];

type SidebarPanelProps = {
  lists: TaskList[];
  countsByListId: CountsByListId;
  countsByTeamId: TaskTeamCounts;
  activeListId: string;
  activeTeamId: string | null;
  teams: Team[];
  themeMode: "dark" | "light";
  currentUserId: string | null;
  isGlobalAdmin: boolean;
  onSelectList: (listId: string) => void;
  onSelectWorkspace: (teamId: string | null) => void;
  onCreateList: (name: string, color?: string | null) => void;
  onCreateTeam: (name: string) => void;
  onRenameList: (listId: string, name: string) => void;
  onArchiveList: (listId: string) => void;
  onRestoreList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onToggleTheme: () => void;
  onOpenWorkspaceHome: () => void;
  onOpenTeamsOverview: () => void;
  onOpenProjectsOverview: () => void;
  isWorkspaceHomeOpen: boolean;
  isTeamsOverviewOpen: boolean;
  isProjectsOverviewOpen: boolean;
  isMobileDrawer?: boolean;
  useTouchListActions?: boolean;
};

type ListNavRowProps = {
  activeListId: string;
  editingListId: string | null;
  editingListName: string;
  isArchivedSection: boolean;
  list: TaskList;
  count: number;
  openMenuListId: string | null;
  onArchiveList: (listId: string) => void;
  onCommitRename: (list: TaskList) => void;
  onDeleteList: (listId: string) => void;
  onRenameKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    list: TaskList,
  ) => void;
  onRestoreList: (listId: string) => void;
  onSelectList: (listId: string) => void;
  onStartRename: (list: TaskList) => void;
  onToggleMenu: (listId: string) => void;
  onUpdateEditingName: (name: string) => void;
  isMobileDrawer: boolean;
  useTouchListActions: boolean;
};

type SystemListIconProps = {
  listId: string;
};

type ListSwipeAction = "edit" | "delete";

export function SidebarPanel({
  lists,
  countsByListId,
  countsByTeamId,
  activeListId,
  activeTeamId,
  teams,
  themeMode,
  currentUserId,
  isGlobalAdmin,
  onSelectList,
  onSelectWorkspace,
  onCreateList,
  onCreateTeam,
  onRenameList,
  onArchiveList,
  onRestoreList,
  onDeleteList,
  onToggleTheme,
  onOpenWorkspaceHome,
  onOpenTeamsOverview,
  onOpenProjectsOverview,
  isWorkspaceHomeOpen,
  isTeamsOverviewOpen,
  isProjectsOverviewOpen,
  isMobileDrawer = false,
  useTouchListActions = isMobileDrawer,
}: SidebarPanelProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState<string | null>(null);
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [isTeamMembersDialogOpen, setIsTeamMembersDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [teamMembersError, setTeamMembersError] = useState<string | null>(null);
  const [isTeamMembersLoading, setIsTeamMembersLoading] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [openMenuListId, setOpenMenuListId] = useState<string | null>(null);
  const trimmedNewListName = newListName.trim();
  const trimmedNewTeamName = newTeamName.trim();
  const trimmedNewMemberEmail = newMemberEmail.trim();
  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;
  const currentTeamMember = currentUserId
    ? teamMembers.find((member) => member.userId === currentUserId) ?? null
    : null;
  const canManageActiveTeam = Boolean(
    activeTeam &&
      currentUserId &&
      (isGlobalAdmin ||
        isTeamAdminRole(currentTeamMember?.role) ||
        (teamMembers.length === 0 && activeTeam.ownerId === currentUserId)),
  );
  const isReservedNewListName = isReservedListName(trimmedNewListName);

  useEffect(() => {
    if (!openMenuListId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Element && target.closest(".list-menu")) {
        return;
      }

      setOpenMenuListId(null);
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuListId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuListId]);

  useEffect(() => {
    if (!isTeamMembersDialogOpen || !activeTeamId) {
      return;
    }

    void refreshTeamMembers(activeTeamId);
  }, [activeTeamId, isTeamMembersDialogOpen]);

  const systemLists = lists.filter(
    (list) => list.isSystem && !list.isArchived && !isReservedListName(list.name),
  );
  const userLists = lists.filter(
    (list) =>
      !list.isSystem &&
      !list.isArchived &&
      (list.teamId ?? null) === activeTeamId &&
      list.id !== DEFAULT_TASK_LIST_ID &&
      !isReservedListName(list.name),
  );
  const archivedLists = lists.filter(
    (list) =>
      !list.isSystem &&
      list.isArchived &&
      (list.teamId ?? null) === activeTeamId &&
      list.id !== DEFAULT_TASK_LIST_ID &&
      !isReservedListName(list.name),
  );

  function closeCreateDialog() {
    setIsCreateDialogOpen(false);
    setNewListName("");
    setNewListColor(null);
  }

  function closeCreateTeamDialog() {
    setIsCreateTeamDialogOpen(false);
    setNewTeamName("");
  }

  function closeTeamMembersDialog() {
    setIsTeamMembersDialogOpen(false);
    setNewMemberEmail("");
    setTeamMembersError(null);
  }

  function openTeamMembersDialog() {
    if (!activeTeamId) {
      return;
    }

    setIsTeamMembersDialogOpen(true);
    setIsCreateDialogOpen(false);
    setIsCreateTeamDialogOpen(false);
    setOpenMenuListId(null);
    setEditingListId(null);
    setEditingListName("");
  }

  async function refreshTeamMembers(teamId: string) {
    setIsTeamMembersLoading(true);
    setTeamMembersError(null);

    try {
      const [members, invites] = await Promise.all([
        loadTeamMembers(teamId),
        loadTeamInvites(teamId),
      ]);
      setTeamMembers(members);
      setTeamInvites(invites);
    } catch (error) {
      setTeamMembersError(
        error instanceof Error ? error.message : "Nepodařilo se načíst členy týmu.",
      );
    } finally {
      setIsTeamMembersLoading(false);
    }
  }

  function openCreateDialog() {
    setIsCreateDialogOpen(true);
    setIsCreateTeamDialogOpen(false);
    setOpenMenuListId(null);
    setEditingListId(null);
    setEditingListName("");
  }

  function openCreateTeamDialog() {
    setIsCreateTeamDialogOpen(true);
    setIsCreateDialogOpen(false);
    setOpenMenuListId(null);
    setEditingListId(null);
    setEditingListName("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedNewListName || isReservedNewListName) {
      return;
    }

    onCreateList(trimmedNewListName, newListColor);
    closeCreateDialog();
  }

  function handleSubmitTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedNewTeamName) {
      return;
    }

    onCreateTeam(trimmedNewTeamName);
    closeCreateTeamDialog();
  }

  async function handleSubmitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeTeamId || !trimmedNewMemberEmail || !canManageActiveTeam) {
      return;
    }

    setIsTeamMembersLoading(true);
    setTeamMembersError(null);

    try {
      const result = await inviteTeamMemberByEmail({
        email: trimmedNewMemberEmail,
        teamId: activeTeamId,
      });

      if (result.kind === "member") {
        setTeamMembers((currentMembers) => {
          const withoutDuplicate = currentMembers.filter(
            (currentMember) => currentMember.userId !== result.member.userId,
          );

          return [...withoutDuplicate, result.member].sort(sortTeamMembers);
        });
        setTeamInvites((currentInvites) =>
          currentInvites.filter(
            (invite) => invite.email.toLowerCase() !== result.member.email.toLowerCase(),
          ),
        );
      } else {
        setTeamInvites((currentInvites) => {
          const withoutDuplicate = currentInvites.filter(
            (invite) => invite.id !== result.invite.id,
          );

          return [...withoutDuplicate, result.invite].sort(sortTeamInvites);
        });
      }

      setNewMemberEmail("");
    } catch (error) {
      setTeamMembersError(
        error instanceof Error ? error.message : "Člena se nepodařilo přidat.",
      );
    } finally {
      setIsTeamMembersLoading(false);
    }
  }

  async function handleRemoveMember(member: TeamMember) {
    if (!activeTeamId || !canManageActiveTeam) {
      return;
    }

    const shouldRemove = window.confirm("Odebrat člena " + member.email + " z týmu?");

    if (!shouldRemove) {
      return;
    }

    setIsTeamMembersLoading(true);
    setTeamMembersError(null);

    try {
      await removeTeamMember({ teamId: activeTeamId, userId: member.userId });
      setTeamMembers((currentMembers) =>
        currentMembers.filter((currentMember) => currentMember.userId !== member.userId),
      );
    } catch (error) {
      setTeamMembersError(
        error instanceof Error ? error.message : "Člena se nepodařilo odebrat.",
      );
    } finally {
      setIsTeamMembersLoading(false);
    }
  }

  async function handleChangeMemberRole(member: TeamMember, role: "admin" | "member") {
    if (!activeTeamId || !canManageActiveTeam || member.role === role) {
      return;
    }

    setIsTeamMembersLoading(true);
    setTeamMembersError(null);

    try {
      const updatedMember = await updateTeamMemberRole({
        role,
        teamId: activeTeamId,
        userId: member.userId,
      });

      setTeamMembers((currentMembers) =>
        currentMembers
          .map((currentMember) =>
            currentMember.userId === updatedMember.userId ? updatedMember : currentMember,
          )
          .sort(sortTeamMembers),
      );
    } catch (error) {
      setTeamMembersError(
        error instanceof Error ? error.message : "Roli člena se nepodařilo změnit.",
      );
    } finally {
      setIsTeamMembersLoading(false);
    }
  }

  function handleCreateKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape") {
      return;
    }

    closeCreateDialog();
  }

  function startRename(list: TaskList) {
    if (list.isSystem) {
      return;
    }

    setEditingListId(list.id);
    setEditingListName(list.name);
    setOpenMenuListId(null);
    closeCreateDialog();
  }

  function cancelRename() {
    setEditingListId(null);
    setEditingListName("");
  }

  function commitRename(list: TaskList) {
    const trimmedName = editingListName.trim();

    if (trimmedName && trimmedName !== list.name) {
      onRenameList(list.id, trimmedName);
    }

    cancelRename();
  }

  function handleRenameKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    list: TaskList,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename(list);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  }

  function toggleMenu(listId: string) {
    setOpenMenuListId((currentListId) =>
      currentListId === listId ? null : listId,
    );
  }

  function archiveList(listId: string) {
    onArchiveList(listId);
    setOpenMenuListId(null);
  }

  function restoreList(listId: string) {
    onRestoreList(listId);
    setOpenMenuListId(null);
  }

  function deleteList(listId: string) {
    onDeleteList(listId);
    setOpenMenuListId(null);
  }

  function selectTeamWorkspace() {
    if (activeTeamId !== null) {
      return;
    }

    const firstTeam = teams[0];

    if (firstTeam) {
      onSelectWorkspace(firstTeam.id);
      return;
    }

    onOpenTeamsOverview();
  }

  const isTeamWorkspace = activeTeamId !== null;
  const teamTaskCount = Object.values(countsByTeamId.byTeamId).reduce(
    (total, count) => total + count,
    0,
  );

  return (
    <>
      <aside
        className="app-panel app-panel--sidebar"
        aria-label="Navigace a seznamy"
        data-mobile-drawer={isMobileDrawer}
        data-touch-actions={useTouchListActions}
      >
        <div className="sidebar-header">
          <div className="sidebar-header__title-row">
            <h1>DoNext</h1>
            {isGlobalAdmin ? <span className="sidebar-admin-badge">Global admin</span> : null}
          </div>
        </div>
        <div className="sidebar-content">
          <div className="sidebar-content__top">
            <section className="list-section workspace-section" aria-label="Pracovní prostor">
              <h2>Pracovní prostor</h2>
              <div className="workspace-mode-switch" role="tablist" aria-label="Režim práce">
                <button
                  className="workspace-mode-switch__item"
                  data-selected={!isTeamWorkspace && !isTeamsOverviewOpen && !isProjectsOverviewOpen}
                  role="tab"
                  aria-selected={!isTeamWorkspace && !isTeamsOverviewOpen && !isProjectsOverviewOpen}
                  type="button"
                  onClick={() => onSelectWorkspace(null)}
                >
                  <span>Osobní</span>
                  <small aria-label={`${countsByTeamId.personal} osobních úkolů`}>
                    {countsByTeamId.personal}
                  </small>
                </button>
                <button
                  className="workspace-mode-switch__item"
                  data-selected={isTeamWorkspace || isTeamsOverviewOpen || isProjectsOverviewOpen}
                  role="tab"
                  aria-selected={isTeamWorkspace || isTeamsOverviewOpen || isProjectsOverviewOpen}
                  type="button"
                  onClick={selectTeamWorkspace}
                >
                  <span>Workspace</span>
                  <small aria-label={`${teamTaskCount} týmových úkolů`}>
                    {teamTaskCount}
                  </small>
                </button>
              </div>
              {isTeamWorkspace || isWorkspaceHomeOpen || isTeamsOverviewOpen || isProjectsOverviewOpen ? (
                <nav className="list-nav workspace-nav" aria-label="Nabídka workspace">
                  <button
                    className="list-nav__item workspace-nav__item"
                    data-selected={isWorkspaceHomeOpen}
                    type="button"
                    onClick={onOpenWorkspaceHome}
                  >
                    <span className="list-nav__main">
                      <span className="workspace-nav__icon" aria-hidden="true">
                        <Home size={16} strokeWidth={1.9} />
                      </span>
                      <span className="list-nav__name">Domů</span>
                    </span>
                  </button>
                  <button
                    className="list-nav__item workspace-nav__item"
                    data-selected={isTeamsOverviewOpen}
                    type="button"
                    onClick={onOpenTeamsOverview}
                  >
                    <span className="list-nav__main">
                      <span className="workspace-nav__icon" aria-hidden="true">
                        <Users size={16} strokeWidth={1.9} />
                      </span>
                      <span className="list-nav__name">Týmy</span>
                    </span>
                    <span className="list-nav__meta" aria-label={`${teams.length} týmů`}>
                      {teams.length}
                    </span>
                  </button>
                  <button
                    className="list-nav__item workspace-nav__item"
                    data-selected={isProjectsOverviewOpen}
                    type="button"
                    onClick={onOpenProjectsOverview}
                  >
                    <span className="list-nav__main">
                      <span className="workspace-nav__icon" aria-hidden="true">
                        <FolderKanban size={16} strokeWidth={1.9} />
                      </span>
                      <span className="list-nav__name">Nástěnky</span>
                    </span>
                  </button>
                </nav>
              ) : null}
            </section>
            {!isTeamWorkspace && !isTeamsOverviewOpen && !isProjectsOverviewOpen ? (
            <section
              className="list-section list-section--system"
              aria-label={isTeamWorkspace ? "Týmové pohledy" : "Osobní pohledy"}
            >
              <h2>{isTeamWorkspace ? "Týmové pohledy" : "Osobní pohledy"}</h2>
              <nav className="list-nav" aria-label={isTeamWorkspace ? "Týmové pohledy" : "Osobní pohledy"}>
                {systemLists.map((list) => (
                  <ListNavRow
                    activeListId={activeListId}
                    count={countsByListId[list.id] ?? 0}
                    editingListId={editingListId}
                    editingListName={editingListName}
                    isArchivedSection={false}
                    isMobileDrawer={isMobileDrawer}
                    key={list.id}
                    list={list}
                    openMenuListId={openMenuListId}
                    onArchiveList={archiveList}
                    onCommitRename={commitRename}
                    onDeleteList={deleteList}
                    onRenameKeyDown={handleRenameKeyDown}
                    onRestoreList={restoreList}
                    onSelectList={onSelectList}
                    onStartRename={startRename}
                    onToggleMenu={toggleMenu}
                    onUpdateEditingName={setEditingListName}
                    useTouchListActions={useTouchListActions}
                  />
                ))}
              </nav>
            </section>
            ) : null}
          </div>
          {!isTeamWorkspace && !isTeamsOverviewOpen && !isProjectsOverviewOpen ? (
          <div className="sidebar-content__scroll">
            <section className="list-section" aria-label={activeTeamId ? "Týmové seznamy" : "Moje seznamy"}>
              <h2>{activeTeamId ? "Týmové seznamy" : "Moje seznamy"}</h2>
              {userLists.length > 0 ? (
                <nav className="list-nav" aria-label="Moje seznamy">
                  {userLists.map((list) => (
                    <ListNavRow
                      activeListId={activeListId}
                      count={countsByListId[list.id] ?? 0}
                      editingListId={editingListId}
                      editingListName={editingListName}
                      isArchivedSection={false}
                      isMobileDrawer={isMobileDrawer}
                      key={list.id}
                      list={list}
                      openMenuListId={openMenuListId}
                      onArchiveList={archiveList}
                      onCommitRename={commitRename}
                      onDeleteList={deleteList}
                      onRenameKeyDown={handleRenameKeyDown}
                      onRestoreList={restoreList}
                      onSelectList={onSelectList}
                      onStartRename={startRename}
                      onToggleMenu={toggleMenu}
                      onUpdateEditingName={setEditingListName}
                      useTouchListActions={useTouchListActions}
                    />
                  ))}
                </nav>
              ) : null}
            </section>
            {archivedLists.length > 0 ? (
              <section className="list-section archive-section" aria-label="Archiv">
                <h2>Archiv</h2>
                <div className="list-nav">
                  {archivedLists.map((list) => (
                    <ListNavRow
                      activeListId={activeListId}
                      count={countsByListId[list.id] ?? 0}
                      editingListId={editingListId}
                      editingListName={editingListName}
                      isArchivedSection
                      isMobileDrawer={isMobileDrawer}
                      key={list.id}
                      list={list}
                      openMenuListId={openMenuListId}
                      onArchiveList={archiveList}
                      onCommitRename={commitRename}
                      onDeleteList={deleteList}
                      onRenameKeyDown={handleRenameKeyDown}
                      onRestoreList={restoreList}
                      onSelectList={onSelectList}
                      onStartRename={startRename}
                      onToggleMenu={toggleMenu}
                      onUpdateEditingName={setEditingListName}
                      useTouchListActions={useTouchListActions}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
          ) : null}
        </div>
        <div className="sidebar-actions">
          <div className="sidebar-actions__tools">
            <button
              className="sidebar-theme-toggle"
              type="button"
              title={themeMode === "dark" ? "Světlý režim" : "Tmavý režim"}
              aria-label={
                themeMode === "dark"
                  ? "Přepnout na světlý režim"
                  : "Přepnout na tmavý režim"
              }
              onClick={onToggleTheme}
            >
              {themeMode === "dark" ? (
                <Sun aria-hidden="true" size={16} />
              ) : (
                <Moon aria-hidden="true" size={16} />
              )}
              <span className="sr-only">
                {themeMode === "dark" ? "Světlý režim" : "Tmavý režim"}
              </span>
            </button>
            <a
              className="sidebar-android-download"
              href={ANDROID_APP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              title="Stáhnout aplikaci pro Android"
              aria-label="Stáhnout aplikaci pro Android"
            >
              <Download aria-hidden="true" size={16} />
              <span className="sr-only">Android</span>
            </a>
          </div>
{!isTeamWorkspace && !isTeamsOverviewOpen && !isProjectsOverviewOpen ? (
            <button
              className="list-nav__item list-nav__item--create"
              type="button"
              onClick={openCreateDialog}
            >
              {isTeamWorkspace ? "Nový týmový seznam" : "Nový seznam"}
            </button>
          ) : null}
        </div>
      </aside>

      {isCreateTeamDialogOpen ? (
        <div className="list-create-dialog" role="presentation">
          <button
            className="list-create-dialog__backdrop"
            aria-label="Zavřít vytváření týmu"
            onClick={closeCreateTeamDialog}
          />
          <div
            className="list-create-dialog__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-team-title"
          >
            <form className="list-create-form" onSubmit={handleSubmitTeam}>
              <div className="list-create-form__header">
                <h2 id="create-team-title">Nový tým</h2>
                <p>Vytvoří nový pracovní prostor pod stejným účtem.</p>
              </div>
              <label className="list-create-form__field">
                <span>Název</span>
                <input
                  aria-label="Název týmu"
                  autoFocus
                  maxLength={LIST_NAME_MAX_LENGTH}
                  placeholder="Například Práce"
                  value={newTeamName}
                  onChange={(event) => setNewTeamName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      closeCreateTeamDialog();
                    }
                  }}
                />
              </label>
              <div className="list-create-form__actions">
                <button type="button" onClick={closeCreateTeamDialog}>
                  Zrušit
                </button>
                <button type="submit" disabled={!trimmedNewTeamName}>
                  Vytvořit
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {isTeamMembersDialogOpen && activeTeam ? (
        <div className="list-create-dialog" role="presentation">
          <button
            className="list-create-dialog__backdrop"
            aria-label="Zavřít cleny týmů"
            type="button"
            onClick={closeTeamMembersDialog}
          />
          <div
            className="list-create-dialog__card team-members-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-members-title"
          >
            <div className="list-create-form team-members-form">
              <div className="list-create-form__header">
                <h2 id="team-members-title">Členové týmu</h2>
                <p>{activeTeam.name}</p>
              </div>

              <div className="team-members-list" aria-live="polite">
                {isTeamMembersLoading && teamMembers.length === 0 && teamInvites.length === 0 ? (
                  <p className="team-members-empty">Načítám členy...</p>
                ) : null}
                {!isTeamMembersLoading && teamMembers.length === 0 && teamInvites.length === 0 ? (
                  <p className="team-members-empty">Zatím tu nejsou žádní členové ani pozvánky.</p>
                ) : null}
                {teamMembers.map((member) => {
                  const memberIsAdmin = isTeamAdminRole(member.role);
                  const nextRole = memberIsAdmin ? "member" : "admin";

                  return (
                    <div className="team-member-row" key={member.userId}>
                      <div>
                        <strong>{member.email}</strong>
                        <span>{getTeamRoleLabel(member.role)}</span>
                      </div>
                      {canManageActiveTeam ? (
                        <div className="team-member-row__actions">
                          <button
                            type="button"
                            disabled={isTeamMembersLoading}
                            onClick={() => void handleChangeMemberRole(member, nextRole)}
                          >
                            {memberIsAdmin ? "Změnit na člena" : "Nastavit jako admina"}
                          </button>
                          <button
                            type="button"
                            disabled={isTeamMembersLoading}
                            onClick={() => void handleRemoveMember(member)}
                          >
                            Odebrat
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {teamInvites.length > 0 ? (
                  <div className="team-members-subtitle">Čekají na registraci</div>
                ) : null}
                {teamInvites.map((invite) => (
                  <div className="team-member-row" data-pending="true" key={invite.id}>
                    <div>
                      <strong>{invite.email}</strong>
                      <span>Pozvánka čeká</span>
                    </div>
                  </div>
                ))}
              </div>

              {canManageActiveTeam ? (
                <form className="team-member-add" onSubmit={handleSubmitMember}>
                  <label className="list-create-form__field">
                    <span>Přidat člena e-mailem</span>
                    <input
                      autoComplete="email"
                      inputMode="email"
                      placeholder="email@firma.cz"
                      type="email"
                      value={newMemberEmail}
                      onChange={(event) => setNewMemberEmail(event.currentTarget.value)}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!trimmedNewMemberEmail || isTeamMembersLoading}
                  >
                    Přidat
                  </button>
                </form>
              ) : (
                <p className="team-members-empty">Členy může spravovat vlastník týmu.</p>
              )}

              {teamMembersError ? (
                <p className="team-members-error" role="alert">{teamMembersError}</p>
              ) : null}

              <div className="list-create-form__actions">
                <button type="button" onClick={closeTeamMembersDialog}>
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {isCreateDialogOpen ? (
        <div className="list-create-dialog" role="presentation">
          <button
            className="list-create-dialog__backdrop"
            aria-label="Zavřít vytvoření seznamu"
            type="button"
            onClick={closeCreateDialog}
          />
          <div
            className="list-create-dialog__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-list-title"
          >
            <form className="list-create-form" onSubmit={handleSubmit}>
              <div className="list-create-form__header">
                <h2 id="create-list-title">Nový seznam</h2>
                <p>Pojmenuj seznam a případně mu dej barvu.</p>
              </div>
              <label className="list-create-form__field">
                <span>Název</span>
                <input
                  aria-label="Název seznamu"
                  autoFocus
                  maxLength={LIST_NAME_MAX_LENGTH}
                  placeholder="Např. Práce nebo Nákup"
                  value={newListName}
                  onChange={(event) => setNewListName(event.currentTarget.value)}
                  onKeyDown={handleCreateKeyDown}
                />
                {isReservedNewListName ? (
                  <small>Tento název je vyhrazený.</small>
                ) : null}
              </label>
              <div className="list-create-form__field">
                <span>Barva</span>
                <div className="list-color-grid" role="list" aria-label="Výběr barvy">
                  <button
                    className="list-color-option list-color-option--default"
                    data-selected={newListColor === null}
                    type="button"
                    onClick={() => setNewListColor(null)}
                  >
                    <span className="list-color-option__swatch" aria-hidden="true" />
                    <span className="list-color-option__label">Výchozí</span>
                  </button>
                  {CREATE_LIST_COLORS.map((color) => (
                    <button
                      key={color}
                      className="list-color-option"
                      data-selected={newListColor === color}
                      style={{ "--list-color": color } as CSSProperties}
                      type="button"
                      onClick={() => setNewListColor(color)}
                    >
                      <span className="list-color-option__swatch" aria-hidden="true" />
                      <span className="sr-only">Vybrat barvu {color}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="list-create-form__actions">
                <button type="button" onClick={closeCreateDialog}>
                  Zrušit
                </button>
                <button type="submit" disabled={!trimmedNewListName || isReservedNewListName}>
                  Vytvořit
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ListNavRow({
  activeListId,
  editingListId,
  editingListName,
  isArchivedSection,
  list,
  count,
  openMenuListId,
  onArchiveList,
  onCommitRename,
  onDeleteList,
  onRenameKeyDown,
  onRestoreList,
  onSelectList,
  onStartRename,
  onToggleMenu,
  onUpdateEditingName,
  isMobileDrawer,
  useTouchListActions,
}: ListNavRowProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [revealedSwipeAction, setRevealedSwipeAction] =
    useState<ListSwipeAction | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);
  const swipeOffsetRef = useRef(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isSwipingRef = useRef(false);
  const listColor = list.color ?? DEFAULT_LIST_COLOR;
  const canSwipeEdit =
    useTouchListActions &&
    !list.isSystem &&
    !isArchivedSection &&
    list.id !== DEFAULT_TASK_LIST_ID;

  function clearLongPressTimeout() {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function closeSwipeActions() {
    setRevealedSwipeAction(null);
    setSwipePosition(0);
  }

  function setSwipePosition(nextOffset: number) {
    swipeOffsetRef.current = nextOffset;
    setSwipeOffset(nextOffset);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!useTouchListActions || list.isSystem || list.id === DEFAULT_TASK_LIST_ID) {
      return;
    }

    const touch = event.touches[0];

    if (touch) {
      touchStartXRef.current = touch.clientX;
      touchStartYRef.current = touch.clientY;
      isSwipingRef.current = false;
    }

    clearLongPressTimeout();
    longPressTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = true;
      onToggleMenu(list.id);
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 600);
    }, 520);
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!canSwipeEdit || touchStartXRef.current === null || touchStartYRef.current === null) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    if (Math.abs(deltaY) > Math.abs(deltaX) && !isSwipingRef.current) {
      return;
    }

    if (Math.abs(deltaX) > 8 || isSwipingRef.current) {
      event.stopPropagation();
      clearLongPressTimeout();
      isSwipingRef.current = true;
      setSwipePosition(
        Math.max(
          -LIST_SWIPE_ACTION_WIDTH,
          Math.min(LIST_SWIPE_ACTION_WIDTH, deltaX),
        ),
      );
    }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    clearLongPressTimeout();

    if (isSwipingRef.current) {
      event.stopPropagation();
      const shouldRevealDelete = swipeOffsetRef.current < -40;
      const shouldRevealEdit = swipeOffsetRef.current > 40;
      const nextAction = shouldRevealDelete
        ? "delete"
        : shouldRevealEdit
          ? "edit"
          : null;

      setRevealedSwipeAction(nextAction);
      setSwipePosition(
        nextAction === "delete"
          ? -LIST_SWIPE_ACTION_WIDTH
          : nextAction === "edit"
            ? LIST_SWIPE_ACTION_WIDTH
            : 0,
      );
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 260);
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isSwipingRef.current = false;
  }

  function handleTouchCancel(event: TouchEvent<HTMLDivElement>) {
    if (isSwipingRef.current) {
      event.stopPropagation();
    }

    clearLongPressTimeout();
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isSwipingRef.current = false;
    setSwipePosition(
      revealedSwipeAction === "delete"
        ? -LIST_SWIPE_ACTION_WIDTH
        : revealedSwipeAction === "edit"
          ? LIST_SWIPE_ACTION_WIDTH
          : 0,
    );
  }

  function handleSelectList() {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    if (revealedSwipeAction) {
      closeSwipeActions();
      return;
    }

    onSelectList(list.id);
  }

  function handleSwipeRename() {
    closeSwipeActions();
    onStartRename(list);
  }

  function handleSwipeDelete() {
    const shouldDelete = window.confirm(`Trvale smazat seznam "${list.name}"?`);

    if (!shouldDelete) {
      return;
    }

    closeSwipeActions();
    onDeleteList(list.id);
  }

  if (editingListId === list.id) {
    return (
      <div className="list-rename">
        <input
          aria-label={`Přejmenovat seznam ${list.name}`}
          autoFocus
          maxLength={LIST_NAME_MAX_LENGTH}
          value={editingListName}
          onBlur={() => onCommitRename(list)}
          onChange={(event) => onUpdateEditingName(event.currentTarget.value)}
          onKeyDown={(event) => onRenameKeyDown(event, list)}
        />
      </div>
    );
  }

  return (
    <div
      className="list-nav__row"
      data-swipe-revealed={revealedSwipeAction ? "true" : "false"}
      data-swipe-action={revealedSwipeAction ?? "none"}
      onTouchCancel={handleTouchCancel}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
    >
      {canSwipeEdit ? (
        <div
          className="list-nav__swipe-actions list-nav__swipe-actions--edit"
          aria-hidden={revealedSwipeAction !== "edit"}
        >
          <button
            aria-label={`Přejmenovat seznam ${list.name}`}
            tabIndex={revealedSwipeAction === "edit" ? 0 : -1}
            title="Přejmenovat"
            type="button"
            onClick={handleSwipeRename}
          >
            <Pencil aria-hidden="true" size={17} />
          </button>
        </div>
      ) : null}
      {canSwipeEdit ? (
        <div
          className="list-nav__swipe-actions list-nav__swipe-actions--delete"
          aria-hidden={revealedSwipeAction !== "delete"}
        >
          <button
            aria-label={`Trvale smazat seznam ${list.name}`}
            tabIndex={revealedSwipeAction === "delete" ? 0 : -1}
            title="Smazat"
            type="button"
            onClick={handleSwipeDelete}
          >
            <Trash2 aria-hidden="true" size={17} />
          </button>


        </div>
      ) : null}
      <button
        className="list-nav__item"
        data-selected={list.id === activeListId}
        style={
          {
            "--list-color": listColor,
            "--swipe-offset": `${swipeOffset}px`,
          } as CSSProperties
        }
        title={list.name}
        type="button"
        onClick={handleSelectList}
      >
        <span className="list-nav__main">
          {list.isSystem ? (
            <span className="list-nav__icon" aria-hidden="true">
              <SystemListIcon listId={list.id} />
            </span>
          ) : (
            <span className="list-nav__dot" aria-hidden="true" />
          )}
          <span className="list-nav__name">{list.name}</span>
        </span>
        <span className="list-nav__meta" aria-label={`${count} aktivních úkolů`}>
          {count}
        </span>
      </button>
      {!list.isSystem && list.id !== DEFAULT_TASK_LIST_ID ? (
        <div className="list-menu">
          {!useTouchListActions ? (
            <button
              className="list-nav__action"
              aria-expanded={openMenuListId === list.id}
              aria-label={`Akce seznamu ${list.name}`}
              type="button"
              onClick={() => onToggleMenu(list.id)}
            >
              ...
            </button>
          ) : null}
          {openMenuListId === list.id ? (
            <div className="list-menu__content">
              {!isArchivedSection ? (
                <>
                  <button type="button" onClick={() => onStartRename(list)}>
                    Přejmenovat
                  </button>
                  <button type="button" onClick={() => onArchiveList(list.id)}>
                    Archivovat
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => onRestoreList(list.id)}>
                  Obnovit
                </button>
              )}
              <button type="button" onClick={() => onDeleteList(list.id)}>
                Smazat
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SystemListIcon({ listId }: SystemListIconProps) {
  switch (listId) {
    case TODAY_LIST_ID:
      return <CalendarDays size={16} strokeWidth={1.9} />;
    case IMPORTANT_LIST_ID:
      return <Star size={16} strokeWidth={1.9} />;
    case PLANNED_LIST_ID:
      return <Clock3 size={16} strokeWidth={1.9} />;
    case FALLBACK_LIST_ID:
    default:
      return <List size={16} strokeWidth={1.9} />;
  }
}

function isReservedListName(name: string) {
  const normalizedName = name
    .trim()
    .toLocaleLowerCase("cs-CZ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return RESERVED_LIST_NAMES.has(normalizedName);
}

function sortTeamMembers(left: TeamMember, right: TeamMember) {
  const leftRank = isTeamAdminRole(left.role) ? 0 : 1;
  const rightRank = isTeamAdminRole(right.role) ? 0 : 1;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.email.localeCompare(right.email, "cs-CZ");
}

function isTeamAdminRole(role: TeamMember["role"] | undefined) {
  return role === "admin";
}

function getTeamRoleLabel(role: TeamMember["role"]) {
  return isTeamAdminRole(role) ? "Admin" : "Člen";
}

function sortTeamInvites(left: TeamInvite, right: TeamInvite) {
  return left.email.localeCompare(right.email, "cs-CZ");
}
