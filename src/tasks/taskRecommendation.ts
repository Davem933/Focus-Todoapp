import { getTodayDateValue } from "./dateUtils";
import {
  FALLBACK_LIST_ID,
  IMPORTANT_LIST_ID,
  PLANNED_LIST_ID,
  TODAY_LIST_ID,
} from "./mockData";
import type { Task, TaskList, TaskPriority } from "./taskTypes";

export type ActiveView =
  | "today"
  | "planned"
  | "important"
  | "all"
  | "user-list";

export type PrimaryTimeStatus =
  | "overdue"
  | "today"
  | "upcoming"
  | "no_due_date";

export type RecommendationContext = {
  activeView: ActiveView;
  activeListId: string;
  lists: TaskList[];
};

export type FocusScopeMode = "global" | "list";

export type FocusScope = RecommendationContext & {
  mode: FocusScopeMode;
};

export type RecommendedTask = {
  task: Task;
  score: number;
  reasons: string[];
  bucket: number;
};

export type FocusProgress = {
  totalCount: number;
  completedCount: number;
  nextCompletedCount: number;
  nextRemainingCount: number;
  nextProgressValue: number;
  summaryScopeLabel: string;
  remainingScopeLabel: string;
  emptyStateMessage: string;
  completionMessage: string;
};

type TaskUrgency = "overdue" | "today" | "tomorrow" | "future" | "no_due_date";

type TaskScoreContext = FocusScope & {
  today: string;
};

const PRIORITY_SCORES: Record<TaskPriority, number> = {
  high: 50,
  medium: 30,
  low: 10,
  none: 0,
};

const URGENCY_SCORES: Record<TaskUrgency, number> = {
  overdue: 80,
  today: 50,
  tomorrow: 20,
  future: 5,
  no_due_date: 0,
};

export function getRecommendationContext(
  lists: TaskList[],
  activeListId: string,
): RecommendationContext {
  return {
    activeView: getActiveView(activeListId),
    activeListId,
    lists,
  };
}

export function getFocusScope(
  lists: TaskList[],
  activeListId: string,
  mode: FocusScopeMode,
): FocusScope {
  return {
    ...getRecommendationContext(lists, activeListId),
    mode,
  };
}

export function getTaskScore(task: Task, context: TaskScoreContext) {
  if (task.completed || task.isArchived) {
    return 0;
  }

  const urgency = getTaskUrgency(task, context.today);
  const urgencyWeight = context.mode === "global" ? 1.2 : 0.8;
  const priorityWeight = context.mode === "global" ? 1 : 1.2;
  const baseScore =
    URGENCY_SCORES[urgency] * urgencyWeight +
    PRIORITY_SCORES[task.priority] * priorityWeight;

  return Math.round(
    baseScore + getTaskBonuses(task, context) - getTaskPenalties(task),
  );
}

export function getRecommendedTasks(tasks: Task[], scope: FocusScope) {
  const today = getTodayDateValue();
  const scoreContext = { ...scope, today };
  const originalOrderByTaskId = new Map(
    tasks.map((task, index) => [task.id, index]),
  );

  return getFocusScopeTasks(tasks, scope)
    .map((task) => ({ task, index: originalOrderByTaskId.get(task.id) ?? 0 }))
    .map(({ task, index }) => ({
      task,
      bucket: getRecommendationBucket(task, today),
      dueTimeOrder: getDueTimeOrder(task),
      score: getTaskScore(task, scoreContext),
      reasons: getTaskRecommendationReasons(task, scoreContext),
      index,
    }))
    .sort((left, right) => {
      const bucketDifference = left.bucket - right.bucket;

      if (bucketDifference !== 0) {
        return bucketDifference;
      }

      const scoreDifference = right.score - left.score;

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const dueTimeDifference = left.dueTimeOrder - right.dueTimeOrder;

      if (dueTimeDifference !== 0) {
        return dueTimeDifference;
      }

      return left.index - right.index;
    })
    .map(({ task, score, reasons, bucket }) => ({
      task,
      score,
      reasons,
      bucket,
    }));
}

export function getFocusScopeTasks(
  tasks: Task[],
  scope: FocusScope,
  options: { includeCompleted?: boolean } = {},
) {
  const today = getTodayDateValue();

  return tasks.filter((task) =>
    isTaskInFocusScope(task, { ...scope, today }, options.includeCompleted ?? false),
  );
}

export function getFocusProgress(
  tasks: Task[],
  scope: FocusScope,
  recommendedTaskId: string | null,
): FocusProgress {
  const scopedTasks = getFocusScopeTasks(tasks, scope, { includeCompleted: true });
  const completedCount = scopedTasks.filter((task) => task.completed).length;
  const recommendedTask = scopedTasks.find((task) => task.id === recommendedTaskId);
  const nextCompletedCount =
    recommendedTask && !recommendedTask.completed
      ? Math.min(completedCount + 1, scopedTasks.length)
      : completedCount;
  const nextRemainingCount = Math.max(scopedTasks.length - nextCompletedCount, 0);
  const nextProgressValue =
    scopedTasks.length > 0 ? (nextCompletedCount / scopedTasks.length) * 100 : 0;
  const scopeCopy = getScopeCopy(scope.mode);

  return {
    totalCount: scopedTasks.length,
    completedCount,
    nextCompletedCount,
    nextRemainingCount,
    nextProgressValue,
    summaryScopeLabel: scopeCopy.summaryScopeLabel,
    remainingScopeLabel: scopeCopy.remainingScopeLabel,
    emptyStateMessage: scopeCopy.emptyStateMessage,
    completionMessage: scopeCopy.completionMessage,
  };
}

export function getVisibleTasksForCurrentView(
  tasks: Task[],
  context: RecommendationContext,
  today = getTodayDateValue(),
) {
  return tasks.filter((task) =>
    isTaskInRecommendationContext(task, context, today),
  );
}

export function isTaskInRecommendationContext(
  task: Task,
  context: RecommendationContext,
  today = getTodayDateValue(),
) {
  return isTaskInFocusScope(
    task,
    { ...context, mode: "list", today },
    false,
  );
}

export function getTaskRecommendationReasons(
  task: Task,
  context: TaskScoreContext,
) {
  const reasons: string[] = [];
  const timeStatus = getPrimaryTimeStatus(task, context.today);

  if (timeStatus === "overdue") {
    reasons.push("Po termínu");
  }

  if (timeStatus === "today") {
    reasons.push("Na dnešek");
  }

  if (task.priority === "high") {
    reasons.push("Vysoká priorita");
  }

  if (context.mode === "list" && task.listId === context.activeListId) {
    reasons.push("Z aktuálního seznamu");
  }

  return reasons;
}

export function getTaskReasons(task: Task, context: RecommendationContext) {
  return getTaskRecommendationReasons(task, {
    ...context,
    mode: "list",
    today: getTodayDateValue(),
  });
}

export function getPrimaryTimeStatus(
  task: Task,
  today = getTodayDateValue(),
): PrimaryTimeStatus {
  if (!task.dueDate) {
    return "no_due_date";
  }

  if (task.dueDate < today) {
    return "overdue";
  }

  if (task.dueDate === today) {
    if (task.dueTime && isTimeBeforeNow(task.dueTime)) {
      return "overdue";
    }

    return "today";
  }

  return "upcoming";
}

export function getRecommendationRank(task: Task, today: string) {
  return getRecommendationBucket(task, today);
}

function getActiveView(activeListId: string): ActiveView {
  if (activeListId === TODAY_LIST_ID) {
    return "today";
  }

  if (activeListId === PLANNED_LIST_ID) {
    return "planned";
  }

  if (activeListId === IMPORTANT_LIST_ID) {
    return "important";
  }

  if (activeListId === FALLBACK_LIST_ID) {
    return "all";
  }

  return "user-list";
}

function getRecommendationBucket(task: Task, today: string) {
  const timeStatus = getPrimaryTimeStatus(task, today);
  const isImportant = task.priority === "high";

  if (timeStatus === "overdue") {
    return isImportant ? 0 : 1;
  }

  if (timeStatus === "today") {
    return isImportant ? 2 : 3;
  }

  if (isImportant && timeStatus === "no_due_date") {
    return 4;
  }

  return 5;
}

function getDueTimeOrder(task: Task) {
  if (!task.dueDate) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timestamp = new Date(`${task.dueDate}T${task.dueTime ?? "23:59"}`).getTime();

  if (Number.isNaN(timestamp)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return timestamp;
}

function getTaskUrgency(task: Task, today: string): TaskUrgency {
  const timeStatus = getPrimaryTimeStatus(task, today);

  if (timeStatus === "overdue") {
    return "overdue";
  }

  if (timeStatus === "today") {
    return "today";
  }

  if (!task.dueDate) {
    return "no_due_date";
  }

  return task.dueDate === getTomorrowDateValue(today) ? "tomorrow" : "future";
}

function getTaskBonuses(task: Task, context: TaskScoreContext) {
  let score = 0;
  const completedSubtaskCount = task.subtasks.filter(
    (subtask) => subtask.completed,
  ).length;
  const incompleteSubtaskCount = task.subtasks.length - completedSubtaskCount;

  if (context.mode === "list" && task.listId === context.activeListId) {
    score += 15;
  }

  if (task.subtasks.length > 0) {
    score += 10;
  }

  if (completedSubtaskCount > 0 && incompleteSubtaskCount > 0) {
    score += 15;
  }

  return score;
}

function getTaskPenalties(task: Task) {
  const incompleteSubtaskCount = task.subtasks.filter(
    (subtask) => !subtask.completed,
  ).length;

  let penalty = 0;

  if (incompleteSubtaskCount >= 4) {
    penalty += 10;
  }

  return penalty;
}

function isTaskInFocusScope(
  task: Task,
  context: TaskScoreContext,
  includeCompleted: boolean,
) {
  if (!isTaskInAvailableList(task, context.lists, includeCompleted)) {
    return false;
  }

  if (context.mode === "global") {
    return isTaskInGlobalScope(task, context.today);
  }

  return isTaskInListScope(task, context);
}

function isTaskInGlobalScope(task: Task, today: string) {
  const timeStatus = getPrimaryTimeStatus(task, today);

  return (
    timeStatus === "overdue" ||
    timeStatus === "today" ||
    task.priority === "high"
  );
}

function isTaskInListScope(task: Task, context: RecommendationContext) {
  if (context.activeView === "today") {
    return task.dueDate !== null && task.dueDate <= getTodayDateValue();
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

function isTaskInAvailableList(
  task: Task,
  lists: TaskList[],
  includeCompleted: boolean,
) {
  if (task.isArchived || (!includeCompleted && task.completed)) {
    return false;
  }

  const list = lists.find((currentList) => currentList.id === task.listId);

  return Boolean(list && !list.isArchived);
}

function getScopeCopy(mode: FocusScopeMode) {
  if (mode === "global") {
    return {
      summaryScopeLabel: "důležitých úkolů",
      remainingScopeLabel: "z důležitých úkolů",
      emptyStateMessage: "Zrovna nemáš žádné důležité úkoly.",
      completionMessage: "Důležité úkoly máš hotové.",
    };
  }

  return {
    summaryScopeLabel: "úkolů v tomto seznamu",
    remainingScopeLabel: "v tomto seznamu",
    emptyStateMessage: "V tomto seznamu nemáš žádné aktivní úkoly.",
    completionMessage: "V tomto seznamu máš hotovo.",
  };
}

function getTomorrowDateValue(today: string) {
  const value = new Date(`${today}T00:00:00`);
  value.setDate(value.getDate() + 1);

  return value.toISOString().slice(0, 10);
}

function isTimeBeforeNow(dueTime: string) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;

  return dueTime < currentTime;
}
