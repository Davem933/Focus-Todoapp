import { useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { User } from "@supabase/supabase-js";
import { FocusView } from "./focus/FocusView";
import { AppShell } from "./layout/AppShell";
import {
  getNextTaskNotification,
  notifyDueTasks,
  registerNativeNotificationHandlers,
  requestTaskNotificationPermission,
  syncTaskNotifications,
  TASK_NOTIFICATION_RECEIVED_EVENT,
} from "./notifications/taskNotifications";
import { getTodayDateValue } from "./tasks/dateUtils";
import { createEntityId } from "./tasks/idUtils";
import {
  DEFAULT_TASK_LIST_ID,
  FALLBACK_LIST_ID,
  MOCK_LISTS,
  IMPORTANT_LIST_ID,
  PLANNED_LIST_ID,
  TODAY_LIST_ID,
} from "./tasks/mockData";
import { getTaskTargetListId } from "./tasks/listUtils";
import {
  getFocusScope,
  getRecommendationContext,
  getRecommendedTasks,
  type RecommendationContext,
} from "./tasks/taskRecommendation";
import { AuthWidget } from "./supabase/AuthWidget";
import {
  downloadSupabaseData,
  replaceSupabaseData,
  uploadLocalDataToSupabase,
} from "./supabase/cloudBackup";
import { supabase } from "./supabase/supabaseClient";
import {
  createTaskAssignedNotification,
  createTaskCompletedNotification,
} from "./supabase/notificationsApi";
import { useNotifications } from "./notifications/useNotifications";
import { loadTaskState, saveTaskState } from "./tasks/taskStorage";
import { buildCountsByTeamId } from "./teams/teamCounts";
import {
  acceptPendingTeamInvites,
  createTeamInSupabase,
  deleteTeamInSupabase,
  loadUserTeams,
} from "./supabase/teamApi";
import type { Team } from "./teams/teamTypes";
import type {
  Task,
  TaskLabel,
  TaskList,
  TaskPriority,
  TaskRecurrence,
  TaskSubtask,
  TaskUpdate,
} from "./tasks/taskTypes";

const LIST_NAME_MAX_LENGTH = 60;

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

type AppRouteState = {
  activeListId: string | null;
  selectedTaskId: string | null;
};

type ThemeMode = "dark" | "light";
type GlobalRole = "user" | "admin";
type UserProfile = {
  role: GlobalRole;
  nickname: string | null;
};

const THEME_STORAGE_KEY = "donext-theme-mode";
const ACTIVE_TEAM_STORAGE_KEY = "donext-active-team-id";

export function App() {
  const [initialState] = useState(loadTaskState);
  const [initialRouteState] = useState(() =>
    getRouteStateFromPath(window.location.pathname),
  );
  const initialActiveListId = getInitialActiveListId(
    initialState.lists,
    initialRouteState.activeListId,
    initialState.activeListId,
  );
  const initialSelectedTaskId = getInitialSelectedTaskId(
    initialState.tasks,
    initialRouteState.selectedTaskId,
    initialState.selectedTaskId,
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [tasks, setTasks] = useState<Task[]>(initialState.tasks);
  const [lists, setLists] = useState<TaskList[]>(initialState.lists);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(
    getInitialActiveTeamId(),
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialSelectedTaskId,
  );
  const [activeListId, setActiveListId] = useState<string>(
    initialActiveListId,
  );
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [deletedTaskUndo, setDeletedTaskUndo] = useState<Task | null>(null);
  const [archivedTaskUndo, setArchivedTaskUndo] = useState<Task | null>(null);
  const [missedNotificationTask, setMissedNotificationTask] =
    useState<Task | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authRole, setAuthRole] = useState<GlobalRole | null>(null);
  const [authNickname, setAuthNickname] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isAuthSessionChecked, setIsAuthSessionChecked] = useState(!supabase);
  const [isCloudUploadLoading, setIsCloudUploadLoading] = useState(false);
  const [isCloudReady, setIsCloudReady] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const isApplyingCloudStateRef = useRef(false);
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  const autoSyncTimeoutRef = useRef<number | null>(null);
  const hydratedUserIdRef = useRef<string | null>(null);
  const {
    notifications,
    markAsRead: handleMarkNotificationAsRead,
    markAllAsRead: handleMarkAllNotificationsAsRead,
  } = useNotifications(authUser?.id ?? null);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (activeTeamId === null) {
      localStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY);
      return;
    }

    localStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, activeTeamId);
  }, [activeTeamId]);

  useEffect(() => {
    registerNativeNotificationHandlers();
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isCancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isCancelled) {
        setAuthUser(data.session?.user ?? null);
        setAuthRole(null);
        setIsAuthSessionChecked(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthRole(null);
      setIsAuthSessionChecked(true);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      setAuthRole(null);
      setAuthNickname(null);
      return;
    }

    const currentAuthUser = authUser;
    let isCancelled = false;

    async function hydrateUserProfile() {
      try {
        const profile = await ensureUserProfile(currentAuthUser.id);

        if (!isCancelled) {
          setAuthRole(profile.role);
          setAuthNickname(profile.nickname);
        }
      } catch (error) {
        if (!isCancelled) {
          setAuthError(
            error instanceof Error ? error.message : "Nepodařilo se načíst profil uživatele.",
          );
        }
      }
    }

    void hydrateUserProfile();

    return () => {
      isCancelled = true;
    };
  }, [authUser, authRole]);

  useEffect(() => {
    if (!authUser) {
      setTeams([]);
      setIsCloudReady(false);
      setIsAutoSyncing(false);
      lastSyncedSnapshotRef.current = null;
      hydratedUserIdRef.current = null;

      if (autoSyncTimeoutRef.current !== null) {
        window.clearTimeout(autoSyncTimeoutRef.current);
        autoSyncTimeoutRef.current = null;
      }

      return;
    }

    if (hydratedUserIdRef.current === authUser.id) {
      // Supabase re-emits auth state (e.g. token refresh on tab focus) with a
      // new session/user object for the *same* account. Re-running the full
      // cloud hydrate here would clobber any local edit that hasn't reached
      // the debounced auto-sync yet, so only hydrate on an actual account
      // change.
      return;
    }

    const currentAuthUser = authUser;
    let isCancelled = false;

    async function hydrateFromCloud() {
      setIsCloudUploadLoading(true);
      setAuthError(null);

      try {
        await ensureUserProfile(currentAuthUser.id);
        const acceptedInviteCount = await acceptPendingTeamInvites();

        if (acceptedInviteCount > 0) {
          const userTeams = await loadUserTeams(currentAuthUser.id);

          if (!isCancelled) {
            setTeams(userTeams);
          }
        }

        const cloudState = await downloadSupabaseData(currentAuthUser.id);
        const hasCloudData =
          cloudState.tasks.length > 0 ||
          cloudState.lists.some((list) => !list.isSystem);

        if (isCancelled) {
          return;
        }

        hydratedUserIdRef.current = currentAuthUser.id;

        if (hasCloudData) {
          isApplyingCloudStateRef.current = true;
          setLists(cloudState.lists);
          setTasks(cloudState.tasks);
          setActiveListId(cloudState.activeListId);
          setSelectedTaskId(null);
          replaceListRoute(cloudState.activeListId);
          lastSyncedSnapshotRef.current = createCloudSyncSnapshot(
            cloudState.lists,
            cloudState.tasks,
          );
          setAuthMessage("Cloudová synchronizace je aktivní.");
          window.setTimeout(() => {
            isApplyingCloudStateRef.current = false;
          }, 0);
        } else {
          const cleanLists = MOCK_LISTS;
          const cleanTasks: Task[] = [];

          isApplyingCloudStateRef.current = true;
          setLists(cleanLists);
          setTasks(cleanTasks);
          setActiveListId(DEFAULT_TASK_LIST_ID);
          setSelectedTaskId(null);
          replaceListRoute(DEFAULT_TASK_LIST_ID);
          lastSyncedSnapshotRef.current = createCloudSyncSnapshot(
            cleanLists,
            cleanTasks,
          );
          setAuthMessage("Cloud je prázdný. Začínáš s čistým účtem.");
          window.setTimeout(() => {
            isApplyingCloudStateRef.current = false;
          }, 0);
        }

        setIsCloudReady(true);
      } catch (error) {
        if (!isCancelled) {
          setAuthError(
            error instanceof Error ? error.message : "Automatické načtení dat z cloudu selhalo.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsCloudUploadLoading(false);
        }
      }
    }

    void hydrateFromCloud();

    return () => {
      isCancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || authRole === null) {
      return;
    }

    const currentAuthUser = authUser;
    let isCancelled = false;

    async function hydrateTeams() {
      try {
        const userTeams = await loadUserTeams(currentAuthUser.id);

        if (!isCancelled) {
          setTeams(userTeams);
          setActiveTeamId((currentTeamId) => {
            if (currentTeamId && userTeams.some((team) => team.id === currentTeamId)) {
              return currentTeamId;
            }

            return userTeams[0]?.id ?? null;
          });
        }
      } catch {
        if (!isCancelled) {
          setTeams([]);
        }
      }
    }

    void hydrateTeams();

    return () => {
      isCancelled = true;
    };
  }, [authUser, authRole]);

  useEffect(() => {
    if (!supabase || !authUser || !isCloudReady || isApplyingCloudStateRef.current) {
      return;
    }

    const syncClient = supabase;
    const snapshot = createCloudSyncSnapshot(lists, tasks);

    if (snapshot === lastSyncedSnapshotRef.current) {
      return;
    }

    if (autoSyncTimeoutRef.current !== null) {
      window.clearTimeout(autoSyncTimeoutRef.current);
    }

    autoSyncTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        setIsAutoSyncing(true);
        setAuthError(null);

        try {
          const { data, error } = await syncClient.auth.getSession();

          if (error) {
            throw error;
          }

          const sessionUser = data.session?.user;

          if (!sessionUser) {
            setAuthUser(null);
            throw new Error("Relace není aktivní. Přihlas se prosím znovu.");
          }

          await replaceSupabaseData({
            lists,
            tasks,
            userId: sessionUser.id,
          });

          lastSyncedSnapshotRef.current = snapshot;
        } catch (error) {
          setAuthError(
            error instanceof Error ? error.message : "Automatické uložení dat do cloudu selhalo.",
          );
        } finally {
          setIsAutoSyncing(false);
        }
      })();
    }, 1200);

    return () => {
      if (autoSyncTimeoutRef.current !== null) {
        window.clearTimeout(autoSyncTimeoutRef.current);
        autoSyncTimeoutRef.current = null;
      }
    };
  }, [authUser, isCloudReady, lists, tasks]);

  useEffect(() => {
    function handleNativeTaskNotification(event: Event) {
      const detail = (event as CustomEvent<{ taskId?: string }>).detail;
      const task = tasks.find((currentTask) => currentTask.id === detail?.taskId);

      if (task && task.id !== selectedTaskId) {
        setMissedNotificationTask((currentTask) => currentTask ?? task);
      }
    }

    window.addEventListener(TASK_NOTIFICATION_RECEIVED_EVENT, handleNativeTaskNotification);

    return () => {
      window.removeEventListener(
        TASK_NOTIFICATION_RECEIVED_EVENT,
        handleNativeTaskNotification,
      );
    };
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    saveTaskState({
      lists,
      tasks,
      activeListId,
      selectedTaskId,
    });
  }, [activeListId, lists, selectedTaskId, tasks]);

  useEffect(() => {
    void syncTaskNotifications(tasks, lists);
  }, [lists, tasks]);

  useEffect(() => {
    function handlePopState() {
      const routeState = getRouteStateFromPath(window.location.pathname);

      if (routeState.activeListId) {
        setActiveListId(routeState.activeListId);
      }

      setSelectedTaskId(routeState.selectedTaskId);
    }

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let removeBackButtonListener: (() => void) | null = null;

    void CapacitorApp.addListener("backButton", () => {
      if (isFocusMode) {
        handleExitFocusMode();
        return;
      }

      if (selectedTaskId) {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          handleClearTaskSelection();
        }

        return;
      }

      if (window.history.length > 1) {
        window.history.back();
        return;
      }

      void CapacitorApp.exitApp();
    }).then((listener) => {
      removeBackButtonListener = () => {
        void listener.remove();
      };
    });

    return () => {
      removeBackButtonListener?.();
    };
  }, [isFocusMode, selectedTaskId]);

  useEffect(() => {
    if (!deletedTaskUndo) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDeletedTaskUndo(null);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [deletedTaskUndo]);

  useEffect(() => {
    if (!archivedTaskUndo) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setArchivedTaskUndo(null);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [archivedTaskUndo]);

  useEffect(() => {
    let timeoutId: number | null = null;
    let isCancelled = false;

    async function checkDueNotifications() {
      const results = await notifyDueTasks(tasks, lists);

      if (isCancelled) {
        return;
      }

      const fallbackTask = results.find((result) => result.shouldShowToast)?.task;

      if (fallbackTask && fallbackTask.id !== selectedTaskId) {
        setMissedNotificationTask((currentTask) => currentTask ?? fallbackTask);
      }
    }

    function scheduleNextNotification() {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }

      const nextNotification = getNextTaskNotification(tasks, lists);

      if (!nextNotification) {
        return;
      }

      const delay = Math.max(0, nextNotification.timestamp - Date.now());

      timeoutId = window.setTimeout(() => {
        void checkDueNotifications();
        scheduleNextNotification();
      }, Math.min(delay, 2_147_483_647));
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkDueNotifications();
      }
    }

    void checkDueNotifications();
    scheduleNextNotification();
    window.addEventListener("focus", checkDueNotifications);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      window.removeEventListener("focus", checkDueNotifications);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [lists, selectedTaskId, tasks]);

  function handleUpdateTask(taskId: string, update: TaskUpdate) {
    setTasks((currentTasks) => {
      let nextRecurringTask: Task | null = null;
      const updatedTasks = currentTasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        const nextTask = normalizeTaskUpdate(task, update);

        if (
          shouldCreateRecurringTask(task, nextTask, update) &&
          !hasMatchingRecurringTask(currentTasks, nextTask)
        ) {
          nextRecurringTask = createRecurringTask(nextTask);
        }

        return nextTask;
      });

      return nextRecurringTask ? [nextRecurringTask, ...updatedTasks] : updatedTasks;
    });

    if ("dueDate" in update || "dueTime" in update) {
      const currentTask = tasks.find((task) => task.id === taskId);

      if (currentTask) {
        const nextTask = normalizeTaskUpdate(currentTask, update);

        if (nextTask.dueDate && nextTask.dueTime) {
          requestTaskNotificationPermission();
        }
      }
    }

    if ("assigneeId" in update) {
      const currentTask = tasks.find((task) => task.id === taskId);

      if (currentTask) {
        const nextTask = normalizeTaskUpdate(currentTask, update);
        notifyTaskAssignment(nextTask, currentTask.assigneeId);
      }
    }

    if ("completed" in update) {
      const currentTask = tasks.find((task) => task.id === taskId);

      if (currentTask) {
        const nextTask = normalizeTaskUpdate(currentTask, update);
        notifyTaskCompletion(nextTask, currentTask.completed);
      }
    }
  }

  function notifyTaskCompletion(task: Task, previousCompleted: boolean) {
    if (
      !authUser ||
      !task.teamId ||
      !task.ownerId ||
      previousCompleted ||
      !task.completed ||
      task.ownerId === authUser.id
    ) {
      return;
    }

    createTaskCompletedNotification({
      recipientId: task.ownerId,
      actorId: authUser.id,
      taskId: isUuid(task.id) ? task.id : null,
      taskTitle: task.title,
      teamId: task.teamId,
    }).catch((error) => {
      console.error("Nepodařilo se odeslat notifikaci o dokončení úkolu", error);
    });
  }

  function notifyTaskAssignment(task: Task, previousAssigneeId: string | null) {
    if (
      !authUser ||
      !task.teamId ||
      !task.assigneeId ||
      task.assigneeId === previousAssigneeId ||
      task.assigneeId === authUser.id
    ) {
      return;
    }

    createTaskAssignedNotification({
      recipientId: task.assigneeId,
      actorId: authUser.id,
      taskId: isUuid(task.id) ? task.id : null,
      taskTitle: task.title,
      teamId: task.teamId,
    }).catch((error) => {
      console.error("Nepodařilo se odeslat notifikaci o přiřazení úkolu", error);
    });
  }

  function handleArchiveTask(taskId: string) {
    const taskToArchive = tasks.find((task) => task.id === taskId);

    if (!taskToArchive) {
      return;
    }

    setArchivedTaskUndo(taskToArchive);
    handleUpdateTask(taskId, { isArchived: true });

    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
      replaceListRoute(activeListId);
    }

    if (focusTaskId === taskId) {
      handleExitFocusMode();
    }
  }

  function handleUndoArchiveTask() {
    if (!archivedTaskUndo) {
      return;
    }

    handleUpdateTask(archivedTaskUndo.id, { isArchived: false });
    setArchivedTaskUndo(null);
  }

  function handleDeleteTask(taskId: string) {
    const taskToDelete = tasks.find((task) => task.id === taskId);

    if (!taskToDelete) {
      return;
    }

    setDeletedTaskUndo(taskToDelete);
    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId),
    );

    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
      replaceListRoute(activeListId);
    }

    if (focusTaskId === taskId) {
      handleExitFocusMode();
    }
  }

  function handleUndoDeleteTask() {
    if (!deletedTaskUndo) {
      return;
    }

    setTasks((currentTasks) => {
      if (currentTasks.some((task) => task.id === deletedTaskUndo.id)) {
        return currentTasks;
      }

      return [deletedTaskUndo, ...currentTasks];
    });
    setDeletedTaskUndo(null);
  }

  function handleCreateTask(title: string, options: CreateTaskOptions = {}) {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return null;
    }

    const targetTeamId = options.teamId !== undefined ? options.teamId : activeTeamId;
    const targetListId =
      options.teamId !== undefined
        ? getDefaultListIdForWorkspace(lists, targetTeamId)
        : getTaskTargetListId(lists, activeListId);
    const dueDate = options.dueDate ?? getNewTaskDueDate(activeListId);
    const newTask: Task = {
      id: createEntityId(),
      title: trimmedTitle,
      completed: false,
      listId: targetListId,
      dueDate,
      dueTime: dueDate ? options.dueTime ?? null : null,
      note: options.note ?? "",
      priority: options.priority ?? getNewTaskPriority(activeListId),
      recurrence: "none",
      isArchived: false,
      teamId: targetTeamId,
      assigneeId: options.assigneeId ?? null,
      ownerId: authUser?.id ?? null,
      projectId: options.projectId ?? null,
      boardColumnKey: options.boardColumnKey ?? "todo",
      labels: options.labels ?? [],
      subtasks: options.subtasks ?? [],
    };

    setTasks((currentTasks) => [newTask, ...currentTasks]);
    notifyTaskAssignment(newTask, null);

    if (newTask.dueDate && newTask.dueTime) {
      requestTaskNotificationPermission();
    }

    return newTask.id;
  }

  function handleCreateList(name: string, color?: string | null) {
    const trimmedName = normalizeListName(name);

    if (!trimmedName) {
      return null;
    }

    const newList: TaskList = {
      id: createEntityId(),
      name: trimmedName,
      isArchived: false,
      isSystem: false,
      teamId: activeTeamId,
      color: color ?? null,
    };

    setLists((currentLists) => [...currentLists, newList]);
    setActiveListId(newList.id);
    pushListRoute(newList.id);
  }

  function handleRenameList(listId: string, name: string) {
    const trimmedName = normalizeListName(name);

    if (!trimmedName) {
      return;
    }

    setLists((currentLists) =>
      currentLists.map((list) => {
        if (list.id !== listId || list.isSystem) {
          return list;
        }

        return {
          ...list,
          name: trimmedName,
        };
      }),
    );
  }

  function handleArchiveList(listId: string) {
    const list = lists.find((currentList) => currentList.id === listId);

    if (!list || list.isSystem || list.id === DEFAULT_TASK_LIST_ID) {
      return;
    }

    setLists((currentLists) =>
      currentLists.map((currentList) =>
        currentList.id === listId
          ? { ...currentList, isArchived: true }
          : currentList,
      ),
    );

    if (activeListId === listId) {
      setActiveListId(DEFAULT_TASK_LIST_ID);
      setSelectedTaskId(null);
      pushListRoute(DEFAULT_TASK_LIST_ID);
    }
  }

  function handleRestoreList(listId: string) {
    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === listId ? { ...list, isArchived: false } : list,
      ),
    );
  }

  function handleDeleteList(listId: string) {
    const list = lists.find((currentList) => currentList.id === listId);

    if (!list || list.isSystem || list.id === DEFAULT_TASK_LIST_ID) {
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.listId === listId ? { ...task, listId: DEFAULT_TASK_LIST_ID } : task,
      ),
    );
    setLists((currentLists) =>
      currentLists.filter((currentList) => currentList.id !== listId),
    );

    if (activeListId === listId) {
      setActiveListId(DEFAULT_TASK_LIST_ID);
      setSelectedTaskId(null);
      pushListRoute(DEFAULT_TASK_LIST_ID);
    }
  }

  function handleSelectList(listId: string) {
    setActiveListId(listId);
    setSelectedTaskId(null);
    pushListRoute(listId);
  }

  function handleSelectWorkspace(teamId: string | null) {
    setActiveTeamId(teamId);
    setSelectedTaskId(null);

    const nextListId = getDefaultListIdForWorkspace(lists, teamId);
    setActiveListId(nextListId);
    pushListRoute(nextListId);
  }

  function handleSelectTask(taskId: string) {
    setSelectedTaskId(taskId);
    pushTaskRoute(activeListId, taskId);
  }

  function handleClearTaskSelection() {
    setSelectedTaskId(null);
    replaceListRoute(activeListId);
  }

  function handleStartFocus(taskId: string) {
    setSelectedTaskId(taskId);
    setFocusTaskId(taskId);
    setIsFocusMode(true);
  }

  function handleCompleteFocusTask() {
    if (focusTaskId) {
      handleUpdateTask(focusTaskId, { completed: true });
    }

    setIsFocusMode(false);
    setFocusTaskId(null);
  }

  function handleCompleteFocusTaskInSession() {
    if (focusTaskId) {
      handleUpdateTask(focusTaskId, { completed: true });
    }
  }

  function handleToggleFocusSubtask(subtaskId: string, completed: boolean) {
    if (!focusTaskId) {
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id !== focusTaskId) {
          return task;
        }

        const subtasks = task.subtasks.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, completed } : subtask,
        );
        const areAllSubtasksCompleted =
          subtasks.length > 0 && subtasks.every((subtask) => subtask.completed);

        return {
          ...task,
          subtasks,
          completed: areAllSubtasksCompleted ? true : task.subtasks.length > 0 ? false : task.completed,
        };
      }),
    );
  }

  function handleExitFocusMode() {
    setIsFocusMode(false);
    setFocusTaskId(null);
  }

  function handleStartNextFocusTask() {
    const nextTask = getRecommendedTasks(
      workspaceTasks,
      getFocusScope(visibleLists, activeListId, "list"),
    ).find(
      (recommendation) =>
        recommendation.task.id !== focusTaskId && !recommendation.task.completed,
    )?.task;

    if (!nextTask) {
      handleExitFocusMode();
      return;
    }

    handleStartFocus(nextTask.id);
  }

  function handleOpenMissedNotificationTask() {
    if (!missedNotificationTask) {
      return;
    }

    setActiveTeamId(missedNotificationTask.teamId ?? null);
    setActiveListId(missedNotificationTask.listId);
    setSelectedTaskId(missedNotificationTask.id);
    pushTaskRoute(missedNotificationTask.listId, missedNotificationTask.id);
    setMissedNotificationTask(null);
  }

  async function handleSignIn(email: string, password: string) {
    if (!supabase) {
      setAuthError("Supabase není nakonfigurovaný.");
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthUser(data.session?.user ?? null);

      if (data.session?.user) {
        await ensureUserProfile(data.session.user.id);
      }

      setAuthMessage("Přihlášení proběhlo.");
    }

    setIsAuthLoading(false);
  }

  async function handleSignUp(email: string, password: string) {
    if (!supabase) {
      setAuthError("Supabase není nakonfigurovaný.");
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthUser(data.session?.user ?? null);

      if (data.session?.user) {
        const profile = await ensureUserProfile(data.session.user.id);
        setAuthRole(profile.role);
      }

      setAuthMessage(
        data.session
          ? "Účet je vytvořený a přihlášený."
          : "Účet je vytvořený. Pokud Supabase vyžaduje potvrzení, zkontroluj e-mail.",
      );
    }

    setIsAuthLoading(false);
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthUser(null);
      setAuthMessage("Odhlášeno.");
    }

    setIsAuthLoading(false);
  }

  async function handleUpdateNickname(nickname: string) {
    if (!supabase || !authUser) {
      setAuthError("Pro ulozeni prezdivky se nejdriv prihlas.");
      return;
    }

    const trimmedNickname = nickname.trim();
    setIsAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({ nickname: trimmedNickname.length > 0 ? trimmedNickname : null })
      .eq("id", authUser.id);

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthNickname(trimmedNickname.length > 0 ? trimmedNickname : null);
      setAuthMessage("Prezdivka je ulozena.");
    }

    setIsAuthLoading(false);
  }

  async function handleCreateTeam(name: string, color?: string | null, description?: string | null) {
    if (!supabase || !authUser) {
      setAuthError("Pro vytvoření týmu se nejdřív přihlas.");
      return null;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const team = await createTeamInSupabase({
        color: color ?? null,
        description: description ?? null,
        name: trimmedName,
        ownerId: authUser.id,
      });

      setTeams((currentTeams) => [team, ...currentTeams]);
      setActiveTeamId(team.id);
      setAuthMessage(`Tým ${team.name} je připravený.`);
      return team;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Vytvoření týmu selhalo.");
      return null;
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!supabase || !authUser) {
      const error = new Error("Pro smazání týmu se nejdřív přihlas.");
      setAuthError(error.message);
      throw error;
    }

    const teamToDelete = teams.find((team) => team.id === teamId) ?? null;

    if (!teamToDelete) {
      return;
    }

    const deletedTeamTaskIds = new Set(
      tasks
        .filter((task) => (task.teamId ?? null) === teamId)
        .map((task) => task.id),
    );
    const nextTeams = teams.filter((team) => team.id !== teamId);
    const nextLists = lists.filter(
      (list) => list.isSystem || (list.teamId ?? null) !== teamId,
    );
    const nextActiveTeamId =
      activeTeamId === teamId ? nextTeams[0]?.id ?? null : activeTeamId;
    const nextActiveListId = getDefaultListIdForWorkspace(
      nextLists,
      nextActiveTeamId,
    );
    const shouldResetList =
      activeTeamId === teamId ||
      !nextLists.some((list) => list.id === activeListId && !list.isArchived);
    const shouldClearSelectedTask = selectedTaskId
      ? deletedTeamTaskIds.has(selectedTaskId)
      : false;

    setIsAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      await deleteTeamInSupabase(teamId);

      setTeams(nextTeams);
      setLists(nextLists);
      setTasks((currentTasks) =>
        currentTasks.filter((task) => (task.teamId ?? null) !== teamId),
      );
      setActiveTeamId(nextActiveTeamId);

      if (shouldResetList) {
        setActiveListId(nextActiveListId);
        setSelectedTaskId(null);
        replaceListRoute(nextActiveListId);
      } else if (shouldClearSelectedTask) {
        setSelectedTaskId(null);
        replaceListRoute(activeListId);
      }

      setDeletedTaskUndo((currentTask) =>
        currentTask && (currentTask.teamId ?? null) === teamId ? null : currentTask,
      );
      setArchivedTaskUndo((currentTask) =>
        currentTask && (currentTask.teamId ?? null) === teamId ? null : currentTask,
      );
      setMissedNotificationTask((currentTask) =>
        currentTask && (currentTask.teamId ?? null) === teamId ? null : currentTask,
      );
      setAuthMessage(`Tým ${teamToDelete.name} byl smazán.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Smazání týmu selhalo.";

      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsAuthLoading(false);
    }
  }
  function handleTeamUpdated(updatedTeam: Team) {
    setTeams((currentTeams) =>
      currentTeams.map((team) => (team.id === updatedTeam.id ? updatedTeam : team)),
    );
  }

  async function handleUploadLocalDataToCloud() {
    if (!supabase) {
      setAuthError("Supabase není nakonfigurovaný.");
      return;
    }

    setIsCloudUploadLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const sessionUser = data.session?.user;

      if (!sessionUser) {
        setAuthUser(null);
        throw new Error("Relace není aktivní. Přihlas se prosím znovu.");
      }

      setAuthUser(sessionUser);
      await ensureUserProfile(sessionUser.id);

      const result = await uploadLocalDataToSupabase({
        lists,
        tasks,
        userId: sessionUser.id,
      });

      lastSyncedSnapshotRef.current = createCloudSyncSnapshot(lists, tasks);
      setIsCloudReady(true);
      setAuthMessage(
        `Nahráno: ${result.lists} seznamů, ${result.tasks} úkolů, ${result.subtasks} podúkolů, ${result.labels} štítků.`,
      );
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Nahrání do cloudu selhalo.");
    } finally {
      setIsCloudUploadLoading(false);
    }
  }

  async function handleDownloadCloudData() {
    if (!supabase) {
      setAuthError("Supabase není nakonfigurovaný.");
      return;
    }

    setIsCloudUploadLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const sessionUser = data.session?.user;

      if (!sessionUser) {
        setAuthUser(null);
        throw new Error("Relace není aktivní. Přihlas se prosím znovu.");
      }

      const cloudState = await downloadSupabaseData(sessionUser.id);

      setAuthUser(sessionUser);
      hydratedUserIdRef.current = sessionUser.id;
      isApplyingCloudStateRef.current = true;
      setLists(cloudState.lists);
      setTasks(cloudState.tasks);
      setActiveListId(cloudState.activeListId);
      setSelectedTaskId(null);
      replaceListRoute(cloudState.activeListId);
      lastSyncedSnapshotRef.current = createCloudSyncSnapshot(
        cloudState.lists,
        cloudState.tasks,
      );
      setIsCloudReady(true);
      window.setTimeout(() => {
        isApplyingCloudStateRef.current = false;
      }, 0);
      setAuthMessage(
        `Načteno z cloudu: ${cloudState.lists.filter((list) => !list.isSystem).length} seznamů a ${cloudState.tasks.length} úkolů.`,
      );
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Načtení z cloudu selhalo.");
    } finally {
      setIsCloudUploadLoading(false);
    }
  }

  async function handleSaveLocalChangesToCloud() {
    if (!supabase) {
      setAuthError("Supabase není nakonfigurovaný.");
      return;
    }

    const shouldContinue = window.confirm(
      "Tímto přepíšeš cloud aktuální lokální verzí. Pokračovat?",
    );

    if (!shouldContinue) {
      return;
    }

    setIsCloudUploadLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const sessionUser = data.session?.user;

      if (!sessionUser) {
        setAuthUser(null);
        throw new Error("Relace není aktivní. Přihlas se prosím znovu.");
      }

      setAuthUser(sessionUser);
      await ensureUserProfile(sessionUser.id);

      const result = await replaceSupabaseData({
        lists,
        tasks,
        userId: sessionUser.id,
      });

      lastSyncedSnapshotRef.current = createCloudSyncSnapshot(lists, tasks);
      setIsCloudReady(true);
      setAuthMessage(
        `Cloud uložen: ${result.lists} seznamů, ${result.tasks} úkolů, ${result.subtasks} podúkolů, ${result.labels} štítků.`,
      );
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Uložení do cloudu selhalo.");
    } finally {
      setIsCloudUploadLoading(false);
    }
  }

  const workspaceTasks = getTasksForWorkspace(tasks, activeTeamId);
  const visibleLists = getListsForWorkspace(lists, activeTeamId);
  const focusTask = workspaceTasks.find((task) => task.id === focusTaskId) ?? null;
  const recommendationContext = getRecommendationContext(visibleLists, activeListId);
  const nextFocusTask =
    getRecommendedTasks(workspaceTasks, getFocusScope(visibleLists, activeListId, "list")).find(
      (recommendation) =>
        recommendation.task.id !== focusTaskId && !recommendation.task.completed,
    )?.task ?? null;
  const today = getTodayDateValue();
  const completedTodayCount = workspaceTasks.filter(
    (task) =>
      task.completed &&
      !task.isArchived &&
      task.dueDate !== null &&
      task.dueDate <= today &&
      isCompletedTaskInCurrentScope(task, recommendationContext, visibleLists, today),
  ).length;

  if (!isAuthSessionChecked) {
    return (
      <main className="auth-screen auth-screen--loading" aria-label="Načítání DoNext">
        <section className="auth-screen__card">
          <div className="auth-screen__brand">
            <span aria-hidden="true">Do</span>
            <strong>DoNext</strong>
          </div>
          <p className="auth-screen__loading-copy">Načítám účet...</p>
        </section>
      </main>
    );
  }

  if (!authUser) {
    return (
      <AuthWidget
        authError={authError}
        authMessage={authMessage}
        isAuthLoading={isAuthLoading}
        isAutoSyncing={isAutoSyncing}
        isCloudReady={isCloudReady}
        isCloudUploadLoading={isCloudUploadLoading}
        user={authUser}
        variant="screen"
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onSignUp={handleSignUp}
        onDownloadCloudData={handleDownloadCloudData}
        onSaveLocalChanges={handleSaveLocalChangesToCloud}
        onUploadLocalData={handleUploadLocalDataToCloud}
      />
    );
  }

  if (isFocusMode) {
    return (
      <FocusView
        task={focusTask}
        completedTodayCount={completedTodayCount}
        nextTaskTitle={nextFocusTask?.title ?? null}
        onComplete={handleCompleteFocusTask}
        onCompleteSessionTask={handleCompleteFocusTaskInSession}
        onNextTask={handleStartNextFocusTask}
        onToggleSubtask={handleToggleFocusSubtask}
        onBack={handleExitFocusMode}
      />
    );
  }

  return (
    <>
      <AppShell
        tasks={workspaceTasks}
        allTasks={tasks}
        lists={visibleLists}
        allLists={lists}
        activeListId={activeListId}
        selectedTaskId={selectedTaskId}
        onSelectList={handleSelectList}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateList={handleCreateList}
        onCreateTeam={handleCreateTeam}
        onDeleteTeam={handleDeleteTeam}
        onTeamUpdated={handleTeamUpdated}
        onRenameList={handleRenameList}
        onArchiveList={handleArchiveList}
        onRestoreList={handleRestoreList}
        onDeleteList={handleDeleteList}
        onSelectTask={handleSelectTask}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onArchiveTask={handleArchiveTask}
        onDeleteTask={handleDeleteTask}
        deletedTaskUndo={deletedTaskUndo}
        onUndoDeleteTask={handleUndoDeleteTask}
        archivedTaskUndo={archivedTaskUndo}
        onUndoArchiveTask={handleUndoArchiveTask}
        missedNotificationTask={missedNotificationTask}
        onOpenMissedNotificationTask={handleOpenMissedNotificationTask}
        onDismissMissedNotification={() => setMissedNotificationTask(null)}
        onStartFocus={handleStartFocus}
        onClearTaskSelection={handleClearTaskSelection}
        activeTeamId={activeTeamId}
        teams={teams}
        themeMode={themeMode}
        currentUserId={authUser?.id ?? null}
        isGlobalAdmin={authRole === "admin"}
        notifications={notifications}
        onMarkNotificationAsRead={handleMarkNotificationAsRead}
        onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
        onToggleTheme={() =>
          setThemeMode((currentThemeMode) =>
            currentThemeMode === "dark" ? "light" : "dark",
          )
        }
        userEmail={authUser?.email ?? null}
        userCreatedAt={authUser?.created_at ?? null}
        nickname={authNickname}
        authError={authError}
        authMessage={authMessage}
        isAuthActionLoading={isAuthLoading}
        onUpdateNickname={handleUpdateNickname}
        onSignOut={handleSignOut}
      />
    </>
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function createCloudSyncSnapshot(lists: TaskList[], tasks: Task[]) {
  return JSON.stringify({
    lists: lists
      .filter((list) => !list.isSystem)
      .map((list) => ({
        id: list.id,
        color: list.color ?? null,
        isArchived: list.isArchived,
        name: list.name,
        teamId: list.teamId ?? null,
      })),
    tasks: tasks.map((task) => ({
      assigneeId: task.assigneeId,
      boardColumnKey: task.boardColumnKey,
      id: task.id,
      completed: task.completed,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      isArchived: task.isArchived,
      labels: task.labels.map((label) => ({
        id: label.id,
        color: label.color,
        name: label.name,
      })),
      listId: task.listId,
      note: task.note,
      priority: task.priority,
      projectId: task.projectId,
      recurrence: task.recurrence,
      subtasks: task.subtasks.map((subtask) => ({
        id: subtask.id,
        completed: subtask.completed,
        title: subtask.title,
      })),
      teamId: task.teamId,
      title: task.title,
    })),
  });
}

async function ensureUserProfile(userId: string): Promise<UserProfile> {
  if (!supabase) {
    throw new Error("Supabase není nakonfigurovaný.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId }, { onConflict: "id" })
    .select("role, nickname")
    .single();

  if (error) {
    throw error;
  }

  return {
    role: data.role === "admin" ? "admin" : "user",
    nickname: data.nickname ?? null,
  };
}

function getInitialThemeMode(): ThemeMode {
  const storedThemeMode = localStorage.getItem(THEME_STORAGE_KEY);

  if (storedThemeMode === "light" || storedThemeMode === "dark") {
    return storedThemeMode;
  }

  return "dark";
}

function getInitialActiveTeamId() {
  const storedTeamId = localStorage.getItem(ACTIVE_TEAM_STORAGE_KEY);

  if (!storedTeamId || storedTeamId === "personal") {
    return null;
  }

  return storedTeamId;
}

function getTasksForWorkspace(tasks: Task[], activeTeamId: string | null) {
  return tasks.filter((task) => (task.teamId ?? null) === activeTeamId);
}

function getListsForWorkspace(lists: TaskList[], activeTeamId: string | null) {
  return lists.filter(
    (list) => list.isSystem || (list.teamId ?? null) === activeTeamId,
  );
}

function getDefaultListIdForWorkspace(
  lists: TaskList[],
  activeTeamId: string | null,
) {
  const workspaceLists = getListsForWorkspace(lists, activeTeamId);

  return (
    workspaceLists.find((list) => list.id === FALLBACK_LIST_ID && !list.isArchived)?.id ??
    workspaceLists.find((list) => !list.isSystem && !list.isArchived)?.id ??
    workspaceLists.find((list) => !list.isArchived)?.id ??
    FALLBACK_LIST_ID
  );
}

function getInitialActiveListId(
  lists: TaskList[],
  routeListId: string | null,
  storedListId: string,
) {
  if (
    routeListId &&
    lists.some((list) => list.id === routeListId && !list.isArchived)
  ) {
    return routeListId;
  }

  if (lists.some((list) => list.id === storedListId && !list.isArchived)) {
    return storedListId;
  }

  return lists.find((list) => !list.isArchived)?.id ?? "";
}

function getInitialSelectedTaskId(
  tasks: Task[],
  routeTaskId: string | null,
  storedTaskId: string | null,
) {
  if (routeTaskId && tasks.some((task) => task.id === routeTaskId)) {
    return routeTaskId;
  }

  if (storedTaskId && tasks.some((task) => task.id === storedTaskId)) {
    return storedTaskId;
  }

  return null;
}

function getRouteStateFromPath(pathname: string): AppRouteState {
  const [, routeType, rawListId, taskRoute, rawTaskId] = pathname.split("/");

  if (routeType !== "list" || !rawListId) {
    return {
      activeListId: null,
      selectedTaskId: null,
    };
  }

  return {
    activeListId: decodeURIComponent(rawListId),
    selectedTaskId:
      taskRoute === "task" && rawTaskId ? decodeURIComponent(rawTaskId) : null,
  };
}

function buildListPath(listId: string) {
  return `/list/${encodeURIComponent(listId)}`;
}

function buildTaskPath(listId: string, taskId: string) {
  return `${buildListPath(listId)}/task/${encodeURIComponent(taskId)}`;
}

function pushListRoute(listId: string) {
  pushRoute(buildListPath(listId));
}

function pushTaskRoute(listId: string, taskId: string) {
  pushRoute(buildTaskPath(listId, taskId));
}

function replaceListRoute(listId: string) {
  replaceRoute(buildListPath(listId));
}

function pushRoute(path: string) {
  if (window.location.pathname === path) {
    return;
  }

  window.history.pushState(null, "", path);
}

function replaceRoute(path: string) {
  if (window.location.pathname === path) {
    return;
  }

  window.history.replaceState(null, "", path);
}

function normalizeListName(name: string) {
  return name.trim().slice(0, LIST_NAME_MAX_LENGTH);
}

function normalizeTaskUpdate(task: Task, update: TaskUpdate): Task {
  const normalizedUpdate: TaskUpdate = { ...update };

  if ("boardColumnKey" in update && update.boardColumnKey) {
    if (update.boardColumnKey === "done") {
      normalizedUpdate.completed = true;
    } else if (task.boardColumnKey === "done" && !("completed" in update)) {
      normalizedUpdate.completed = false;
    }
  }

  if ("completed" in update && typeof update.completed === "boolean" && !("boardColumnKey" in update)) {
    if (update.completed) {
      normalizedUpdate.boardColumnKey = "done";
    } else if (task.boardColumnKey === "done") {
      normalizedUpdate.boardColumnKey = "todo";
    }
  }

  const nextTask = { ...task, ...normalizedUpdate };

  if ("dueDate" in update && !update.dueDate) {
    return {
      ...nextTask,
      dueDate: null,
      dueTime: null,
    };
  }

  return {
    ...nextTask,
    dueTime: nextTask.dueDate ? nextTask.dueTime ?? null : null,
    recurrence: nextTask.recurrence ?? "none",
  };
}

function shouldCreateRecurringTask(
  previousTask: Task,
  nextTask: Task,
  update: TaskUpdate,
) {
  return (
    "completed" in update &&
    update.completed === true &&
    !previousTask.completed &&
    nextTask.completed &&
    nextTask.recurrence !== "none" &&
    nextTask.dueDate !== null
  );
}

function createRecurringTask(task: Task): Task {
  const nextDueDate = getNextRecurrenceDate(task.dueDate, task.recurrence);

  return {
    ...task,
    id: createEntityId(),
    completed: false,
    dueDate: nextDueDate,
    isArchived: false,
    subtasks: task.subtasks.map((subtask) => ({
      ...subtask,
      id: createEntityId(),
      completed: false,
    })),
  };
}

function hasMatchingRecurringTask(tasks: Task[], task: Task) {
  const nextDueDate = getNextRecurrenceDate(task.dueDate, task.recurrence);

  return tasks.some(
    (currentTask) =>
      currentTask.id !== task.id &&
      !currentTask.isArchived &&
      currentTask.listId === task.listId &&
      currentTask.title === task.title &&
      currentTask.recurrence === task.recurrence &&
      currentTask.dueDate === nextDueDate &&
      currentTask.dueTime === task.dueTime,
  );
}

function getNextRecurrenceDate(
  dueDate: string | null,
  recurrence: TaskRecurrence,
) {
  if (!dueDate || recurrence === "none") {
    return dueDate;
  }

  const today = getTodayDateValue();
  let nextDate = addRecurrenceInterval(dueDate, recurrence);

  while (nextDate <= today) {
    nextDate = addRecurrenceInterval(nextDate, recurrence);
  }

  return nextDate;
}

function addRecurrenceInterval(dateValue: string, recurrence: TaskRecurrence) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  if (recurrence === "daily") {
    date.setDate(date.getDate() + 1);
  }

  if (recurrence === "weekly") {
    date.setDate(date.getDate() + 7);
  }

  if (recurrence === "monthly") {
    date.setMonth(date.getMonth() + 1);
  }

  return formatDateValue(date);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function getNewTaskDueDate(activeListId: string) {
  if (activeListId === TODAY_LIST_ID || activeListId === PLANNED_LIST_ID) {
    return getTodayDateValue();
  }

  return null;
}

function getNewTaskPriority(activeListId: string): TaskPriority {
  if (activeListId === IMPORTANT_LIST_ID) {
    return "high";
  }

  return "none";
}

function isCompletedTaskInCurrentScope(
  task: Task,
  context: RecommendationContext,
  lists: TaskList[],
  today: string,
) {
  const list = lists.find((currentList) => currentList.id === task.listId);

  if (!list || list.isArchived) {
    return false;
  }

  if (context.activeView === "today") {
    return task.dueDate !== null && task.dueDate <= today;
  }

  if (context.activeView === "planned") {
    return task.dueDate !== null;
  }

  if (context.activeView === "important") {
    return task.priority === "high";
  }

  if (context.activeView === "all") {
    return true;
  }

  return task.listId === context.activeListId;
}





