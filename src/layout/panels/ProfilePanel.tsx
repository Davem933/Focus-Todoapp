import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, LogOut, Moon, Sun, Sunrise } from "lucide-react";
import type { Project } from "../../projects/projectTypes";
import { loadProjectsForTeams } from "../../supabase/projectApi";
import type { Team } from "../../teams/teamTypes";

type ProfilePanelProps = {
  userEmail: string | null;
  userCreatedAt: string | null;
  nickname: string | null;
  teams: Team[];
  dailyBriefingProjectId: string | null;
  themeMode: "dark" | "light";
  authError: string | null;
  authMessage: string | null;
  isAuthActionLoading: boolean;
  onToggleTheme: () => void;
  onUpdateNickname: (nickname: string) => Promise<void>;
  onUpdateDailyBriefingProject: (projectId: string | null) => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function ProfilePanel({
  userEmail,
  userCreatedAt,
  nickname,
  teams,
  dailyBriefingProjectId,
  themeMode,
  authError,
  authMessage,
  isAuthActionLoading,
  onToggleTheme,
  onUpdateNickname,
  onUpdateDailyBriefingProject,
  onSignOut,
}: ProfilePanelProps) {
  const [nicknameDraft, setNicknameDraft] = useState(nickname ?? "");
  const [briefingProjectDraft, setBriefingProjectDraft] = useState(dailyBriefingProjectId ?? "");
  const [boards, setBoards] = useState<Project[]>([]);

  useEffect(() => {
    setNicknameDraft(nickname ?? "");
  }, [nickname]);

  useEffect(() => {
    setBriefingProjectDraft(dailyBriefingProjectId ?? "");
  }, [dailyBriefingProjectId]);

  useEffect(() => {
    if (teams.length === 0) {
      setBoards([]);
      return;
    }

    let isCancelled = false;

    loadProjectsForTeams(teams.map((team) => team.id))
      .then((loadedBoards) => {
        if (!isCancelled) {
          setBoards(loadedBoards);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setBoards([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [teams]);

  async function handleSubmitBriefingProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onUpdateDailyBriefingProject(briefingProjectDraft || null);
  }

  function getTeamName(teamId: string): string {
    return teams.find((team) => team.id === teamId)?.name ?? "Tým";
  }

  async function handleSubmitNickname(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onUpdateNickname(nicknameDraft);
  }

  const displayName = nickname || getEmailName(userEmail) || "Uživatel";
  const isNicknameDirty = nicknameDraft.trim() !== (nickname ?? "").trim();
  const isBriefingProjectDirty = briefingProjectDraft !== (dailyBriefingProjectId ?? "");
  const isDark = themeMode === "dark";

  return (
    <section className="app-panel profile-panel" aria-label="Profil uživatele">
      <motion.div
        className="profile-panel__hero"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
      >
        <div className="profile-panel__avatar-wrap">
          <div className="profile-panel__avatar-glow" aria-hidden="true" />
          <span className="profile-panel__avatar" aria-hidden="true">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="profile-panel__eyebrow">Profil</span>
        <h2>{displayName}</h2>
        <p>{userEmail ?? "Účet není přihlášený"}</p>
        {userCreatedAt ? (
          <span className="profile-panel__badge">
            Účet od {formatAccountDate(userCreatedAt)}
          </span>
        ) : null}
      </motion.div>

      <AnimatePresence mode="wait">
        {authMessage ? (
          <motion.p
            key="profile-message-success"
            className="profile-panel__toast"
            data-tone="success"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            {authMessage}
          </motion.p>
        ) : null}
        {authError ? (
          <motion.p
            key="profile-message-error"
            className="profile-panel__toast"
            data-tone="danger"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            {authError}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <motion.div
        className="profile-panel__list"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] as const }}
      >
        <form className="profile-panel__row" onSubmit={handleSubmitNickname}>
          <span className="profile-panel__row-label">
            <span className="profile-panel__row-title">Přezdívka</span>
            <span className="profile-panel__row-hint">Jak ti máme říkat v appce</span>
          </span>
          <span className="profile-panel__row-control profile-panel__row-control--input">
            <input
              type="text"
              maxLength={60}
              placeholder="Jak ti máme říkat?"
              value={nicknameDraft}
              onChange={(event) => setNicknameDraft(event.currentTarget.value)}
            />
            <AnimatePresence>
              {isNicknameDirty ? (
                <motion.button
                  key="save-nickname"
                  className="profile-panel__save-button"
                  type="submit"
                  aria-label="Uložit přezdívku"
                  disabled={isAuthActionLoading}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                >
                  <Check aria-hidden="true" size={15} />
                </motion.button>
              ) : null}
            </AnimatePresence>
          </span>
        </form>

        <form className="profile-panel__row" onSubmit={handleSubmitBriefingProject}>
          <span className="profile-panel__row-label">
            <span className="profile-panel__row-title">
              <Sunrise aria-hidden="true" size={14} /> Ranní shrnutí
            </span>
            <span className="profile-panel__row-hint">
              Nástěnka, ze které se generuje ranní shrnutí
            </span>
          </span>
          <span className="profile-panel__row-control profile-panel__row-control--input">
            <select
              value={briefingProjectDraft}
              onChange={(event) => setBriefingProjectDraft(event.currentTarget.value)}
            >
              <option value="">Žádná</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {getTeamName(board.teamId)} — {board.name}
                </option>
              ))}
            </select>
            <AnimatePresence>
              {isBriefingProjectDirty ? (
                <motion.button
                  key="save-briefing-project"
                  className="profile-panel__save-button"
                  type="submit"
                  aria-label="Uložit nástěnku pro ranní shrnutí"
                  disabled={isAuthActionLoading}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                >
                  <Check aria-hidden="true" size={15} />
                </motion.button>
              ) : null}
            </AnimatePresence>
          </span>
        </form>

        <div className="profile-panel__divider" />

        <div className="profile-panel__row">
          <span className="profile-panel__row-label">
            <span className="profile-panel__row-title">Tmavý režim</span>
            <span className="profile-panel__row-hint">
              {isDark ? "Zapnutý" : "Vypnutý"}
            </span>
          </span>
          <span className="profile-panel__row-control">
            <button
              className="profile-panel__switch"
              type="button"
              role="switch"
              aria-checked={isDark}
              aria-label="Přepnout tmavý režim"
              data-checked={isDark}
              onClick={onToggleTheme}
            >
              <motion.span
                className="profile-panel__switch-thumb"
                layout
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              >
                {isDark ? (
                  <Moon aria-hidden="true" size={11} />
                ) : (
                  <Sun aria-hidden="true" size={11} />
                )}
              </motion.span>
            </button>
          </span>
        </div>
      </motion.div>

      <motion.button
        className="profile-panel__danger-row"
        type="button"
        disabled={isAuthActionLoading}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const }}
        whileTap={{ scale: 0.99 }}
        onClick={() => void onSignOut()}
      >
        <LogOut aria-hidden="true" size={16} />
        <span>Odhlásit se</span>
      </motion.button>
    </section>
  );
}

function getEmailName(email: string | null) {
  if (!email) {
    return null;
  }

  return email.split("@")[0] || null;
}

function formatAccountDate(isoDate: string) {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
