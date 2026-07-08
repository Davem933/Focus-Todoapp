import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Task, TaskList } from "../tasks/taskTypes";

const SHOWN_NOTIFICATION_KEYS_STORAGE = "focus-todo-shown-task-notifications";
const NATIVE_TASK_NOTIFICATION_ID_OFFSET = 100_000;
const NATIVE_FOCUS_NOTIFICATION_ID = 900_001;
const NATIVE_REMINDER_CHANNEL_ID = "donext-reminders-v3";
const NATIVE_NOTIFICATION_SMALL_ICON = "ic_stat_donext";
const NATIVE_NOTIFICATION_LARGE_ICON = "ic_launcher_foreground";
const NATIVE_NOTIFICATION_ICON_COLOR = "#7C5CFF";
const MAX_NATIVE_SCHEDULED_TASK_NOTIFICATIONS = 64;

export const TASK_NOTIFICATION_RECEIVED_EVENT = "donext-task-notification-received";

let hasRegisteredNativeNotificationHandlers = false;
let hasEnsuredNativeNotificationChannel = false;
let hasRequestedExactAlarmSettings = false;

export type TaskNotificationResult = {
  delivered: boolean;
  shouldShowToast: boolean;
  task: Task;
};

export function getTaskNotificationTimestamp(task: Task) {
  if (!task.dueDate || !task.dueTime) {
    return null;
  }

  const timestamp = new Date(`${task.dueDate}T${task.dueTime}`).getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isTaskNotificationCandidate(task: Task, lists: TaskList[]) {
  const list = lists.find((currentList) => currentList.id === task.listId);

  return Boolean(
    list &&
      !list.isArchived &&
      !task.completed &&
      !task.isArchived &&
      task.dueDate &&
      task.dueTime &&
      getTaskNotificationTimestamp(task) !== null,
  );
}

export function getNextTaskNotification(tasks: Task[], lists: TaskList[]) {
  const now = Date.now();

  return tasks
    .filter((task) => isTaskNotificationCandidate(task, lists))
    .map((task) => ({
      task,
      timestamp: getTaskNotificationTimestamp(task) ?? Number.MAX_SAFE_INTEGER,
    }))
    .filter(({ task, timestamp }) => timestamp > now && !wasTaskNotificationShown(task))
    .sort((left, right) => left.timestamp - right.timestamp)[0];
}

export function registerNativeNotificationHandlers() {
  if (!isNativeNotificationPlatform() || hasRegisteredNativeNotificationHandlers) {
    return;
  }

  hasRegisteredNativeNotificationHandlers = true;
  void ensureNativeNotificationChannel();

  void LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const url = event.notification.extra?.url;

    if (typeof url !== "string") {
      return;
    }

    window.focus();
    window.history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  void LocalNotifications.addListener("localNotificationReceived", (notification) => {
    const extra = notification.extra;

    if (extra?.kind !== "task-due") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(TASK_NOTIFICATION_RECEIVED_EVENT, {
        detail: {
          listId: extra.listId,
          taskId: extra.taskId,
          url: extra.url,
        },
      }),
    );
  });
}

export async function syncTaskNotifications(tasks: Task[], lists: TaskList[]) {
  if (!isNativeNotificationPlatform()) {
    return;
  }

  await ensureNativeNotificationReadiness({ requestExactAlarmSetting: false });

  const permissionState = await LocalNotifications.checkPermissions();
  const nextPermissionState =
    permissionState.display === "granted"
      ? permissionState
      : await LocalNotifications.requestPermissions();

  if (nextPermissionState.display !== "granted") {
    return;
  }

  await cancelPendingTaskNotifications();

  const now = Date.now();
  const scheduledTasks = tasks
    .filter((task) => isTaskNotificationCandidate(task, lists))
    .map((task) => ({
      task,
      timestamp: getTaskNotificationTimestamp(task) ?? Number.MAX_SAFE_INTEGER,
    }))
    .filter(({ task, timestamp }) => timestamp > now && !wasTaskNotificationShown(task))
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(0, MAX_NATIVE_SCHEDULED_TASK_NOTIFICATIONS);

  if (scheduledTasks.length === 0) {
    return;
  }

  await LocalNotifications.schedule({
    notifications: scheduledTasks.map(({ task, timestamp }) => ({
      id: getNativeTaskNotificationId(task),
      title: "Je čas na úkol",
      body: getTaskNotificationBody(task),
      channelId: NATIVE_REMINDER_CHANNEL_ID,
      smallIcon: NATIVE_NOTIFICATION_SMALL_ICON,
      largeIcon: NATIVE_NOTIFICATION_LARGE_ICON,
      iconColor: NATIVE_NOTIFICATION_ICON_COLOR,
      schedule: { at: new Date(timestamp), allowWhileIdle: true },
      extra: {
        kind: "task-due",
        listId: task.listId,
        notificationKey: getTaskNotificationKey(task),
        taskId: task.id,
        url: getTaskNotificationUrl(task),
      },
    })),
  });
}

export async function notifyDueTasks(tasks: Task[], lists: TaskList[]) {
  const now = Date.now();
  const dueTasks = tasks.filter((task) => {
    const timestamp = getTaskNotificationTimestamp(task);

    return (
      isTaskNotificationCandidate(task, lists) &&
      timestamp !== null &&
      timestamp <= now &&
      !wasTaskNotificationShown(task)
    );
  });
  const results: TaskNotificationResult[] = [];
  const task = dueTasks
    .map((currentTask) => ({
      task: currentTask,
      timestamp: getTaskNotificationTimestamp(currentTask) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => left.timestamp - right.timestamp)[0]?.task;

  if (task && claimTaskNotification(task)) {
    const delivered = await showTaskNotification(task);

    results.push({
      task,
      delivered,
      shouldShowToast: !delivered,
    });
  }

  return results;
}

export function requestTaskNotificationPermission() {
  if (isNativeNotificationPlatform()) {
    void ensureNativeNotificationReadiness({ requestExactAlarmSetting: true }).catch(
      () => undefined,
    );
    return;
  }

  if (!("Notification" in window) || Notification.permission !== "default") {
    return;
  }

  Notification.requestPermission().catch(() => {
    // Notifikace jsou doplněk. Aplikace musí fungovat i bez oprávnění.
  });
}

export async function showFocusSessionNotification(taskTitle: string) {
  const body = taskTitle
    ? `Úkol čeká na další krok: ${truncateNotificationText(taskTitle)}`
    : "Úkol čeká na další krok";

  if (isNativeNotificationPlatform()) {
    const delivered = await showNativeNotification({
      id: NATIVE_FOCUS_NOTIFICATION_ID,
      title: "Režim soustředění skončil",
      body,
      extra: { kind: "focus-session" },
    });

    return delivered;
  }

  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  const notification = new Notification("Režim soustředění skončil", {
    body,
    tag: "focus-session-expired",
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  return true;
}

function wasTaskNotificationShown(task: Task) {
  return getShownNotificationKeys().has(getTaskNotificationKey(task));
}

function claimTaskNotification(task: Task) {
  const keys = getShownNotificationKeys();
  const notificationKey = getTaskNotificationKey(task);

  if (keys.has(notificationKey)) {
    return false;
  }

  keys.add(notificationKey);
  window.localStorage.setItem(
    SHOWN_NOTIFICATION_KEYS_STORAGE,
    JSON.stringify([...keys].slice(-250)),
  );

  return true;
}

async function showTaskNotification(task: Task) {
  if (isNativeNotificationPlatform()) {
    return showNativeNotification({
      id: getNativeTaskNotificationId(task),
      title: "Je čas na úkol",
      body: getTaskNotificationBody(task),
      extra: {
        kind: "task-due",
        listId: task.listId,
        notificationKey: getTaskNotificationKey(task),
        taskId: task.id,
        url: getTaskNotificationUrl(task),
      },
    });
  }

  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  const url = getTaskNotificationUrl(task);
  const notificationOptions: NotificationOptions = {
    body: getTaskNotificationBody(task),
    data: { url },
    icon: "/icons/icon-192.svg",
    tag: getTaskNotificationKey(task),
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();

      if (registration) {
        await registration.showNotification("Je čas na úkol", notificationOptions);
        return true;
      }
    }

    const notification = new Notification("Je čas na úkol", notificationOptions);
    notification.onclick = () => {
      window.focus();
      window.history.pushState(null, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
      notification.close();
    };

    return true;
  } catch {
    return false;
  }
}

function getTaskNotificationBody(task: Task) {
  const formattedSchedule = formatTaskNotificationSchedule(task);

  return formattedSchedule
    ? `${formattedSchedule} • ${task.title}`
    : task.title;
}

function formatTaskNotificationSchedule(task: Task) {
  if (!task.dueDate && !task.dueTime) {
    return null;
  }

  if (!task.dueDate) {
    return task.dueTime ? `Čas ${formatNotificationTime(task.dueTime)}` : null;
  }

  const formattedDate = formatNotificationDate(task.dueDate);
  const formattedTime = task.dueTime ? formatNotificationTime(task.dueTime) : null;

  return formattedTime ? `${formattedDate} v ${formattedTime}` : formattedDate;
}

function formatNotificationDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-");

  if (!year || !month || !day) {
    return dateValue;
  }

  return `${day}.${month}.${year}`;
}

function formatNotificationTime(timeValue: string) {
  const [hours, minutes] = timeValue.split(":");

  if (!hours || !minutes) {
    return timeValue;
  }

  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function getTaskNotificationKey(task: Task) {
  return `${task.id}:${task.dueDate ?? ""}:${task.dueTime ?? ""}`;
}

function getTaskNotificationUrl(task: Task) {
  return `/list/${encodeURIComponent(task.listId)}/task/${encodeURIComponent(task.id)}`;
}

function isNativeNotificationPlatform() {
  return Capacitor.isNativePlatform();
}

async function showNativeNotification({
  body,
  extra,
  id,
  title,
}: {
  body: string;
  extra?: Record<string, unknown>;
  id: number;
  title: string;
}) {
  try {
    await ensureNativeNotificationReadiness({ requestExactAlarmSetting: false });

    const permissionState = await LocalNotifications.checkPermissions();
    const nextPermissionState =
      permissionState.display === "granted"
        ? permissionState
        : await LocalNotifications.requestPermissions();

    if (nextPermissionState.display !== "granted") {
      return false;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          channelId: NATIVE_REMINDER_CHANNEL_ID,
          smallIcon: NATIVE_NOTIFICATION_SMALL_ICON,
          largeIcon: NATIVE_NOTIFICATION_LARGE_ICON,
          iconColor: NATIVE_NOTIFICATION_ICON_COLOR,
          extra,
        },
      ],
    });

    return true;
  } catch {
    return false;
  }
}

async function ensureNativeNotificationReadiness({
  requestExactAlarmSetting,
}: {
  requestExactAlarmSetting: boolean;
}) {
  await ensureNativeNotificationChannel();

  const permissionState = await LocalNotifications.checkPermissions();

  if (permissionState.display !== "granted") {
    await LocalNotifications.requestPermissions();
  }

  if (!requestExactAlarmSetting || hasRequestedExactAlarmSettings) {
    return;
  }

  hasRequestedExactAlarmSettings = true;

  try {
    const exactAlarmState = await LocalNotifications.checkExactNotificationSetting();

    if (exactAlarmState.exact_alarm !== "granted") {
      await LocalNotifications.changeExactNotificationSetting();
    }
  } catch {
    // Exact alarms are Android-only and may be unavailable on older devices.
  }
}

async function ensureNativeNotificationChannel() {
  if (!isNativeNotificationPlatform() || hasEnsuredNativeNotificationChannel) {
    return;
  }

  hasEnsuredNativeNotificationChannel = true;

  try {
    await LocalNotifications.createChannel({
      id: NATIVE_REMINDER_CHANNEL_ID,
      name: "DoNext připomínky",
      description: "Připomínky úkolů a režimu soustředění",
      importance: 5,
      visibility: 1,
      lights: true,
      lightColor: NATIVE_NOTIFICATION_ICON_COLOR,
      vibration: true,
    });
  } catch {
    hasEnsuredNativeNotificationChannel = false;
  }
}

async function cancelPendingTaskNotifications() {
  const pendingNotifications = await LocalNotifications.getPending();
  const taskNotifications = pendingNotifications.notifications.filter(
    (notification) => notification.id >= NATIVE_TASK_NOTIFICATION_ID_OFFSET,
  );

  if (taskNotifications.length === 0) {
    return;
  }

  await LocalNotifications.cancel({
    notifications: taskNotifications.map((notification) => ({ id: notification.id })),
  });
}

function getNativeTaskNotificationId(task: Task) {
  return NATIVE_TASK_NOTIFICATION_ID_OFFSET + stableNumberHash(getTaskNotificationKey(task));
}

function stableNumberHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 800_000;
  }

  return hash;
}

function truncateNotificationText(text: string) {
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function getShownNotificationKeys() {
  try {
    const parsedKeys = JSON.parse(
      window.localStorage.getItem(SHOWN_NOTIFICATION_KEYS_STORAGE) ?? "[]",
    );

    return new Set(
      Array.isArray(parsedKeys)
        ? parsedKeys.filter((key): key is string => typeof key === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

