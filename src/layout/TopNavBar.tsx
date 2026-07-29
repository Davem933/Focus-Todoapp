import { FolderKanban, Moon, Sun, User, Users } from "lucide-react";
import { NotificationPopover } from "../components/ui/notification-popover";
import type { Notification } from "../components/ui/notification-popover";
import type { Team } from "../teams/teamTypes";
import type { TaskTeamCounts } from "../teams/teamCounts";

type TopNavBarProps = {
  isGlobalAdmin: boolean;
  themeMode: "dark" | "light";
  activeTeamId: string | null;
  teams: Team[];
  countsByTeamId: TaskTeamCounts;
  isTeamsOverviewOpen: boolean;
  isProjectsOverviewOpen: boolean;
  isProfileOpen: boolean;
  notifications: Notification[];
  onMarkNotificationAsRead: (id: string) => void;
  onMarkAllNotificationsAsRead: () => void;
  onSelectWorkspace: (teamId: string | null) => void;
  onOpenTeamsOverview: () => void;
  onOpenProjectsOverview: () => void;
  onToggleTheme: () => void;
  onOpenProfile: () => void;
};

export function TopNavBar({
  isGlobalAdmin,
  themeMode,
  activeTeamId,
  teams,
  countsByTeamId,
  isTeamsOverviewOpen,
  isProjectsOverviewOpen,
  isProfileOpen,
  notifications,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onSelectWorkspace,
  onOpenTeamsOverview,
  onOpenProjectsOverview,
  onToggleTheme,
  onOpenProfile,
}: TopNavBarProps) {
  const isTeamWorkspace = activeTeamId !== null;
  const teamTaskCount = Object.values(countsByTeamId.byTeamId).reduce(
    (total, count) => total + count,
    0,
  );

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

  return (
    <header className="app-shell__topnav">
      <div className="app-shell__topnav-brand">
        <h1>DoNext</h1>
        {isGlobalAdmin ? <span className="sidebar-admin-badge">Global admin</span> : null}
      </div>
      <div className="workspace-mode-switch app-shell__topnav-workspace" role="tablist" aria-label="Režim práce">
        <button
          className="workspace-mode-switch__item"
          data-selected={!isTeamWorkspace}
          role="tab"
          aria-selected={!isTeamWorkspace}
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
          data-selected={isTeamWorkspace}
          role="tab"
          aria-selected={isTeamWorkspace}
          type="button"
          onClick={selectTeamWorkspace}
        >
          <span>Workspace</span>
          <small aria-label={`${teamTaskCount} týmových úkolů`}>{teamTaskCount}</small>
        </button>
      </div>
      <nav className="app-shell__topnav-nav" aria-label="Hlavní navigace">
        <button
          className="app-shell__topnav-nav-item"
          data-selected={isTeamsOverviewOpen}
          type="button"
          onClick={onOpenTeamsOverview}
        >
          <Users aria-hidden="true" size={16} strokeWidth={1.9} />
          <span>Týmy</span>
          <span className="app-shell__topnav-nav-item-count" aria-label={`${teams.length} týmů`}>
            {teams.length}
          </span>
        </button>
        <button
          className="app-shell__topnav-nav-item"
          data-selected={isProjectsOverviewOpen}
          type="button"
          onClick={onOpenProjectsOverview}
        >
          <FolderKanban aria-hidden="true" size={16} strokeWidth={1.9} />
          <span>Nástěnky</span>
        </button>
      </nav>
      <div className="app-shell__topnav-actions">
        <button
          className="sidebar-theme-toggle"
          type="button"
          title={themeMode === "dark" ? "Světlý režim" : "Tmavý režim"}
          aria-label={themeMode === "dark" ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
          onClick={onToggleTheme}
        >
          {themeMode === "dark" ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
          <span className="sr-only">{themeMode === "dark" ? "Světlý režim" : "Tmavý režim"}</span>
        </button>
        <NotificationPopover
          notifications={notifications}
          onMarkAsRead={onMarkNotificationAsRead}
          onMarkAllAsRead={onMarkAllNotificationsAsRead}
          align="bottom"
        />
        <button
          className="sidebar-profile-button"
          type="button"
          data-active={isProfileOpen ? "true" : "false"}
          title="Profil"
          aria-label="Otevřít profil"
          onClick={onOpenProfile}
        >
          <User aria-hidden="true" size={16} />
          <span className="sr-only">Profil</span>
        </button>
      </div>
    </header>
  );
}
