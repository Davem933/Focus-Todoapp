import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, FormEvent, MouseEvent, TouchEvent } from "react";
import { BarChart3, Bell, ChevronDown, ChevronRight, Sparkle } from "lucide-react";
import type { LayoutMode } from "../layoutTypes";
import { getTodayDateValue } from "../../tasks/dateUtils";
import {
  FALLBACK_LIST_ID,
  IMPORTANT_LIST_ID,
  PLANNED_LIST_ID,
  TODAY_LIST_ID,
} from "../../tasks/mockData";
import type {
  DailyAttentionTask,
  DailyTaskStats,
} from "../../tasks/taskDailyOverview";
import {
  getRecommendationRank,
  type FocusProgress,
  getPrimaryTimeStatus,
  type RecommendedTask,
} from "../../tasks/taskRecommendation";
import { parseTaskInput } from "../../tasks/naturalLanguageTaskParser";
import type { Task, TaskList, TaskUpdate } from "../../tasks/taskTypes";

type CreateTaskOptions = {
  dueDate?: string | null;
  dueTime?: string | null;
  note?: string;
};

type TaskVisibilityFilter = "all" | "active" | "completed";

const MIN_TASKS_FOR_WEEK_PRESSURE = 2;
const LONG_PRESS_DELAY_MS = 520;
const SWIPE_ARCHIVE_THRESHOLD_RATIO = 0.28;
const SWIPE_ARCHIVE_MAX_DISTANCE_RATIO = 0.45;
const SWIPE_START_DISTANCE = 10;
const WEEKDAY_PRESSURE_LABELS = [
  "v pondělí",
  "v úterý",
  "ve středu",
  "ve čtvrtek",
  "v pátek",
  "v sobotu",
  "v neděli",
];

type ListPanelProps = {
  tasks: Task[];
  archivedTasks: Task[];
  lists: TaskList[];
  layoutMode: LayoutMode;
  activeListId: string;
  selectedTaskId: string | null;
  dailyStats: DailyTaskStats;
  dailyFocusTasks: Task[];
  dailyAttentionTasks: DailyAttentionTask[];
  dailyAttentionHiddenCount: number;
  dailyProgress: FocusProgress;
  dailyNextTasks: Task[];
  recommendationMessage: string | null;
  recommendedTask: RecommendedTask | null;
  onOpenFocusAssistant: () => void;
  onOpenDashboard: () => void;
  onOpenCheckIn: () => void;
  onSelectTask: (taskId: string) => void;
  onCreateTask: (title: string, options?: CreateTaskOptions) => void;
  onStartRecommendedTask: () => void;
  onSkipRecommendedTask: () => void;
  onToggleTaskCompleted: (taskId: string, completed: boolean) => void;
  onUpdateTask: (taskId: string, update: TaskUpdate) => void;
  onArchiveTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
  onMoveTask: (taskId: string, listId: string) => void;
};

export function ListPanel({
  tasks,
  archivedTasks,
  lists,
  layoutMode,
  activeListId,
  selectedTaskId,
  dailyStats,
  dailyFocusTasks,
  dailyAttentionTasks,
  dailyAttentionHiddenCount,
  dailyProgress,
  dailyNextTasks,
  recommendationMessage,
  recommendedTask,
  onOpenFocusAssistant,
  onOpenDashboard,
  onOpenCheckIn,
  onSelectTask,
  onCreateTask,
  onStartRecommendedTask,
  onSkipRecommendedTask,
  onToggleTaskCompleted,
  onUpdateTask,
  onArchiveTask,
  onDeleteTask,
  canDeleteTask,
  onMoveTask,
}: ListPanelProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedWeekDate, setSelectedWeekDate] = useState<string | null>(null);
  const [isArchiveVisible, setIsArchiveVisible] = useState(false);
  const [isMobileComposerOpen, setIsMobileComposerOpen] = useState(false);
  const [taskVisibilityFilter, setTaskVisibilityFilter] =
    useState<TaskVisibilityFilter>("active");
  const [composerMessage, setComposerMessage] = useState<string | null>(null);
  const [composerMessageTone, setComposerMessageTone] = useState<
    "info" | "warning"
  >("info");
  const isDetailMode = selectedTaskId !== null;
  const activeList = lists.find((list) => list.id === activeListId);
  const title = activeList ? activeList.name : "Úkoly";
  const displayedTasks = selectedWeekDate
    ? tasks.filter((task) => task.dueDate === selectedWeekDate)
    : tasks;
  const displayedArchivedTasks = selectedWeekDate
    ? archivedTasks.filter((task) => task.dueDate === selectedWeekDate)
    : archivedTasks;
  const activeTasks = displayedTasks.filter((task) => !task.completed);
  const completedTasks = displayedTasks.filter((task) => task.completed);
  const isEmpty = activeTasks.length === 0 && completedTasks.length === 0;
  const filteredTasks =
    taskVisibilityFilter === "active"
      ? activeTasks
      : taskVisibilityFilter === "completed"
        ? completedTasks
        : displayedTasks;
  const filteredEmptyMessage = getTaskFilterEmptyMessage(
    taskVisibilityFilter,
    selectedWeekDate,
  );
  const mobileTitle = selectedWeekDate
    ? getMobileSelectedDayTitle(selectedWeekDate)
    : "Dnes";
  const isTouchCompactLayout =
    layoutMode === "mobile-list-only" ||
    layoutMode === "tablet-sidebar-list" ||
    layoutMode === "tablet-list-detail";
  const emptyStateMessage = selectedWeekDate
    ? "Pro vybraný den tu nejsou žádné úkoly"
    : getEmptyStateMessage(activeList);
  const taskComposerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isMobileComposerOpen) {
      taskComposerInputRef.current?.focus();
    }
  }, [isMobileComposerOpen]);

  useEffect(() => {
    function handleOpenComposer() {
      if (isTouchCompactLayout) {
        setIsMobileComposerOpen(true);
      }

      taskComposerInputRef.current?.focus();
    }

    window.addEventListener("app:open-task-composer", handleOpenComposer);
    return () =>
      window.removeEventListener("app:open-task-composer", handleOpenComposer);
  }, [isTouchCompactLayout]);

  useEffect(() => {
    setTaskVisibilityFilter("active");
  }, [activeListId, selectedWeekDate]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedTaskInput = parseTaskInput(newTaskTitle);

    if (!parsedTaskInput.title.trim()) {
      return;
    }

    const createTaskDueDate = parsedTaskInput.dueDate ?? selectedWeekDate;
    const createTaskDueTime = createTaskDueDate ? parsedTaskInput.dueTime : null;

    if (parsedTaskInput.hasConflict) {
      onCreateTask(parsedTaskInput.title, {
        dueDate: createTaskDueDate,
        dueTime: null,
      });
      setComposerMessage(
        getConflictCreateMessage(parsedTaskInput.message, selectedWeekDate),
      );
      setComposerMessageTone("warning");
      setNewTaskTitle("");
      return;
    }

    onCreateTask(parsedTaskInput.title, {
      dueDate: createTaskDueDate,
      dueTime: createTaskDueTime,
    });
    setComposerMessage(
      parsedTaskInput.message ??
        (selectedWeekDate ? "Použit vybraný den z týdenního přehledu." : null),
    );
    setComposerMessageTone("info");
    setNewTaskTitle("");
  }

  return (
    <section className="app-panel app-panel--list" aria-label="Seznam úkolů">
      <div className="list-panel__sticky">
        <div className="list-panel__tools" aria-label="Akce aktuálního pohledu">
          <button
            className="list-panel__assistant-button"
            type="button"
            title="Co mám dělat?"
            onClick={onOpenFocusAssistant}
          >
            <Sparkle aria-hidden="true" size={15} />
            <span>Asistent</span>
          </button>
          <button
            className="list-panel__dashboard-button"
            aria-label="Otevřít dashboard"
            type="button"
            title="Dashboard"
            onClick={onOpenDashboard}
          >
            <BarChart3 aria-hidden="true" size={16} />
            <span>Dashboard</span>
          </button>
          <button
            className="list-panel__checkin-button"
            aria-label="Otevřít check-in"
            type="button"
            title="Check-in"
            onClick={onOpenCheckIn}
          >
            <Bell aria-hidden="true" size={16} />
            <span>Check-in</span>
          </button>
        </div>
        <WeekStrip
          isCompact={isDetailMode}
          tasks={tasks}
          selectedDate={selectedWeekDate}
          onSelectDate={(date) =>
            setSelectedWeekDate((currentDate) =>
              currentDate === date ? null : date,
            )
          }
        />
      </div>
      <div className="list-panel__scroll">
        <h2 className={isDetailMode ? "list-title list-title--compact" : "list-title"}>
          <span className="list-title__desktop">{title}</span>
          <span className="list-title__mobile">{mobileTitle}</span>
        </h2>
        {selectedWeekDate ? (
          <button
            className="week-strip__clear"
            type="button"
            onClick={() => setSelectedWeekDate(null)}
          >
            Zrušit filtr dne
          </button>
        ) : null}
        {!isDetailMode ? (
          <>
          <button
            className="task-composer__mobile-trigger"
            type="button"
            onClick={() => setIsMobileComposerOpen(true)}
          >
            + Přidat úkol...
          </button>
          <form
            className="task-composer"
            data-mobile-open={isMobileComposerOpen}
            onSubmit={handleSubmit}
          >
            <input
              aria-label="Nový úkol"
              placeholder="Nový úkol"
              ref={taskComposerInputRef}
              value={newTaskTitle}
              onChange={(event) => {
                setNewTaskTitle(event.currentTarget.value);
                setComposerMessage(null);
              }}
            />
            <button type="submit">Přidat</button>
            {composerMessage ? (
              <small className="task-composer__hint" data-tone={composerMessageTone}>
                {composerMessage}
              </small>
            ) : null}
            {selectedWeekDate ? (
              <small className="task-composer__filter-hint">
                Přidáš na vybraný den
              </small>
            ) : null}
          </form>
          </>
        ) : null}
        {!isEmpty ? (
          <TaskVisibilitySegment
            activeCount={activeTasks.length}
            completedCount={completedTasks.length}
            value={taskVisibilityFilter}
            onChange={setTaskVisibilityFilter}
          />
        ) : null}
        {isEmpty ? (
          <EmptyState message={emptyStateMessage} />
        ) : filteredTasks.length === 0 ? (
          <EmptyState message={filteredEmptyMessage} hint="Změň filtr." />
        ) : (
          <TaskSection
            tasks={filteredTasks}
            isCompact={isDetailMode}
            isResponsiveCompact={isTouchCompactLayout}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onToggleTaskCompleted={onToggleTaskCompleted}
            onUpdateTask={onUpdateTask}
            onArchiveTask={onArchiveTask}
            onDeleteTask={onDeleteTask}
            canDeleteTask={canDeleteTask}
            onMoveTask={onMoveTask}
            lists={lists}
          />
        )}
        {displayedArchivedTasks.length > 0 ? (
          <section className="task-archive">
            <button
              className="task-archive__toggle"
              type="button"
              onClick={() => setIsArchiveVisible((currentValue) => !currentValue)}
            >
              {isArchiveVisible ? "Skrýt archiv" : "Zobrazit archiv"} (
              {displayedArchivedTasks.length})
            </button>
            {isArchiveVisible ? (
              <TaskSection
                title="Archiv"
                tasks={displayedArchivedTasks}
                isArchivedSection
                isCompact={isDetailMode}
                isResponsiveCompact={isTouchCompactLayout}
                selectedTaskId={selectedTaskId}
                onSelectTask={onSelectTask}
                onToggleTaskCompleted={onToggleTaskCompleted}
                onUpdateTask={onUpdateTask}
                onArchiveTask={onArchiveTask}
                onDeleteTask={onDeleteTask}
                canDeleteTask={canDeleteTask}
                onMoveTask={onMoveTask}
                lists={lists}
              />
            ) : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}

type DailyCommandCenterProps = {
  stats: DailyTaskStats;
  tasks: Task[];
  attentionTasks: DailyAttentionTask[];
  attentionHiddenCount: number;
  progress: FocusProgress;
  nextTasks: Task[];
  recommendation: RecommendedTask | null;
  message: string | null;
  isDetailOpen: boolean;
  isTouchCompactLayout: boolean;
  onOpenFocusAssistant: () => void;
  onStart: () => void;
  onSkip: () => void;
  onSelectTask: (taskId: string) => void;
};

type WeekDay = {
  count: number;
  date: string;
  dayNumber: number;
  label: string;
  pressureLabel: string;
};

function DailySummaryBar({ stats }: { stats: DailyTaskStats }) {
  return (
    <div className="daily-summary-bar" aria-label="Rychlý stav aktuálního seznamu">
      <SummaryMetric label="Po termínu" value={stats.overdueActiveCount} />
      <SummaryMetric label="Dnes" value={stats.todayActiveCount} />
      <SummaryMetric label="Důležité" value={stats.importantActiveCount} />
    </div>
  );
}

function WeekStrip({
  isCompact,
  tasks,
  selectedDate,
  onSelectDate,
}: {
  isCompact: boolean;
  tasks: Task[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const today = getTodayDateValue();
  const weekDays = getCurrentWeekDays(tasks);
  const selectedDay = weekDays.find((day) => day.date === selectedDate) ?? null;

  return (
    <section
      className="week-strip"
      data-compact={isCompact}
      aria-label="Týdenní přehled aktuálního seznamu"
    >
      <div className="week-strip__header">
        <span>Tento týden</span>
        {selectedDay ? (
          <span className="week-strip__filter-status">
            Filtr: {selectedDay.label} {selectedDay.dayNumber} ×
          </span>
        ) : null}
      </div>
      <div className="week-strip__days">
        {weekDays.map((day) => (
          <button
            aria-pressed={selectedDate === day.date}
            className="week-strip__day"
            data-has-tasks={day.count > 0}
            data-today={day.date === today}
            key={day.date}
            type="button"
            onClick={() => onSelectDate(day.date)}
          >
            <span>
              {day.label} {day.dayNumber}
            </span>
            {day.count > 0 ? <small>{day.count}</small> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function DailyCommandCenter({
  stats,
  tasks,
  attentionTasks,
  attentionHiddenCount,
  progress,
  nextTasks,
  recommendation,
  message,
  isDetailOpen,
  isTouchCompactLayout,
  onOpenFocusAssistant,
  onStart,
  onSkip,
  onSelectTask,
}: DailyCommandCenterProps) {
  const contentId = useId();
  const [isDailyCenterExpanded, setIsDailyCenterExpanded] = useState(false);
  const isDashboardExpanded = !isDetailOpen && isDailyCenterExpanded;
  const today = getTodayDateValue();
  const activeTasks = tasks.filter((task) => !task.completed);
  const todayTasks = activeTasks.filter(
    (task) => getPrimaryTimeStatus(task, today) === "today",
  );
  const importantTasks = activeTasks.filter((task) => task.priority === "high");
  const overdueTasks = activeTasks.filter(
    (task) => getPrimaryTimeStatus(task, today) === "overdue",
  );
  const hasRelevantTasks = progress.totalCount > 0;
  const hasIncompleteRelevantTasks = progress.completedCount < progress.totalCount;
  const hasCompletedRelevantTasks =
    hasRelevantTasks && !hasIncompleteRelevantTasks;
  const recommendationContextItems = recommendation
    ? getRecommendationContextItems(recommendation, today)
    : [];
  const touchStatusItems = recommendation
    ? getTouchRecommendationStatusItems(
        recommendation,
        progress.nextCompletedCount,
        progress.totalCount,
        today,
      )
    : [];
  const remainingIncompleteTaskCount = Math.max(
    progress.totalCount - progress.completedCount,
    0,
  );

  useEffect(() => {
    if (isDetailOpen) {
      setIsDailyCenterExpanded(false);
    }
  }, [isDetailOpen]);

  useEffect(() => {
    function handleOpenDailyOverview() {
      if (!isDetailOpen) {
        setIsDailyCenterExpanded(true);
      }
    }

    window.addEventListener("app:open-daily-overview", handleOpenDailyOverview);
    return () =>
      window.removeEventListener("app:open-daily-overview", handleOpenDailyOverview);
  }, [isDetailOpen]);

  function handleStartRecommendedTask() {
    setIsDailyCenterExpanded(false);
    onStart();
  }

  return (
    <section
      className="daily-command"
      aria-label="Denní centrum"
      data-expanded={isDashboardExpanded}
      data-detail-open={isDetailOpen}
      data-touch-action-first={isTouchCompactLayout ? "true" : "false"}
    >
      <div className="daily-command__summary">
        <div className="daily-command__summary-main">
          <span className="daily-command__drag-handle" aria-hidden="true" />
          <span className="daily-command__summary-title">
            {isTouchCompactLayout ? "Rychlý stav" : "Denní centrum"}
          </span>
          <span className="daily-command__summary-metrics">
            <SummaryMetric label="Po termínu" value={stats.overdueActiveCount} />
            <SummaryMetric label="Dnes" value={stats.todayActiveCount} />
            <SummaryMetric label="Důležité" value={stats.importantActiveCount} />
          </span>
        </div>
        <div className="daily-command__summary-actions">
          {!isDetailOpen ? (
            <button
              className="daily-command__assistant-cta"
              aria-label="Otevřít Focus Assistant"
              title="Co dělat teď"
              type="button"
              onClick={onOpenFocusAssistant}
            >
              <Sparkle size={16} />
              <span>{isTouchCompactLayout ? "Co dál?" : "Co mám dělat?"}</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="daily-command__body" id={contentId}>
        <div className="daily-command__body-inner">
          {isDashboardExpanded ? (
            <div className="daily-command__body-toolbar">
              <button
                className="daily-command__body-close"
                type="button"
                onClick={() => setIsDailyCenterExpanded(false)}
              >
                Skrýt detailní přehled
              </button>
            </div>
          ) : null}
          {isTouchCompactLayout ? (
            <div className="daily-command__touch-hero">
              {!hasRelevantTasks ? (
                <p className="daily-command__empty">
                  {progress.emptyStateMessage}
                </p>
              ) : hasCompletedRelevantTasks ? (
                <div className="daily-command__completion">
                  <strong>Hotovo</strong>
                  <p>{progress.completionMessage}</p>
                </div>
              ) : recommendation ? (
                <div className="daily-command__touch-recommendation">
                  <div className="daily-command__touch-meta">
                    <span className="daily-command__touch-reason">
                      {getRecommendationKeyMessage(
                        recommendation,
                        remainingIncompleteTaskCount,
                        stats,
                      )}
                    </span>
                    {touchStatusItems.length > 0 ? (
                      <div className="daily-command__touch-statuses">
                        {touchStatusItems.slice(0, 2).map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <strong className="daily-command__touch-title">
                    {recommendation.task.title}
                  </strong>
                  <div className="daily-command__actions daily-command__actions--touch">
                    <button type="button" onClick={handleStartRecommendedTask}>
                      Začít
                    </button>
                    <button type="button" onClick={onSkip}>
                      Přeskočit
                    </button>
                  </div>
                  <div className="daily-command__progress-track" aria-hidden="true">
                    <div style={{ width: `${progress.nextProgressValue}%` }} />
                  </div>
                  {nextTasks.length > 0 ? (
                    <div className="daily-command__touch-next">
                      <span>Další na řadě</span>
                      <div className="daily-command__touch-next-list">
                        {nextTasks.map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => onSelectTask(task.id)}
                          >
                            {task.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="daily-command__touch-recommendation">
                  <span className="daily-command__touch-reason">
                    {message ?? progress.emptyStateMessage}
                  </span>
                  <div className="daily-command__actions daily-command__actions--touch">
                    <button type="button" onClick={handleStartRecommendedTask} disabled>
                      Začít
                    </button>
                    <button type="button" onClick={onSkip} disabled>
                      Přeskočit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
          <div className="daily-command__pillars">
            <section className="daily-command__pillar" aria-label="Stav aktuálního pohledu">
              <h3>Stav</h3>
              <div className="daily-command__stats">
                <StatItem
                  label="Po termínu"
                  value={stats.overdueActiveCount}
                  previewTasks={overdueTasks}
                  tone="danger"
                />
                <StatItem
                  label="Dnes"
                  value={stats.todayActiveCount}
                  previewTasks={todayTasks}
                />
                <StatItem
                  label="Důležité"
                  value={stats.importantActiveCount}
                  previewTasks={importantTasks}
                />
              </div>

              {!isTouchCompactLayout && attentionTasks.length > 0 ? (
                <div className="daily-command__attention">
                  <h4>Vyžaduje pozornost</h4>
                  <div className="daily-command__attention-list">
                    {attentionTasks.map(({ task, reason }) => (
                      <button
                        key={`${reason}-${task.id}`}
                        type="button"
                        onClick={() => onSelectTask(task.id)}
                      >
                        <span>{task.title}</span>
                        <small>
                          {reason === "overdue" ? "Po termínu" : "Vysoká priorita"}
                        </small>
                      </button>
                    ))}
                    {attentionHiddenCount > 0 ? (
                      <span className="daily-command__more">
                        +{attentionHiddenCount} dalších
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            {!isTouchCompactLayout ? (
              <section
                className="daily-command__pillar daily-command__pillar--action"
                aria-label="Doporučená akce"
              >
                {!hasRelevantTasks ? (
                  <p className="daily-command__empty">
                    {progress.emptyStateMessage}
                  </p>
                ) : hasCompletedRelevantTasks ? (
                  <div className="daily-command__completion">
                    <strong>Hotovo</strong>
                    <p>{progress.completionMessage}</p>
                  </div>
                ) : (
                  <div className="daily-command__recommendation">
                    {recommendation ? (
                      <>
                        <div className="daily-command__recommendation-layout">
                          <div className="daily-command__recommendation-main">
                            <span className="daily-command__key-reason">
                              {getRecommendationKeyMessage(
                                recommendation,
                                remainingIncompleteTaskCount,
                                stats,
                              )}
                            </span>
                            <strong>{recommendation.task.title}</strong>
                            {recommendationContextItems.length > 0 ? (
                              <div className="daily-command__context-items">
                                {recommendationContextItems.slice(0, 3).map((item) => (
                                  <span key={item}>{item}</span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="daily-command__recommendation-side">
                            <div className="daily-command__actions">
                              <button
                                type="button"
                                onClick={handleStartRecommendedTask}
                              >
                                Začít
                              </button>
                              <button type="button" onClick={onSkip}>
                                Přeskočit
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="daily-command__action-impact">
                          <p>
                            {getRecommendationImpactSummary(
                              progress.nextCompletedCount,
                              progress.totalCount,
                              progress.summaryScopeLabel,
                            )}
                          </p>
                          <div className="daily-command__progress-track" aria-hidden="true">
                            <div style={{ width: `${progress.nextProgressValue}%` }} />
                          </div>
                          <small>
                            {getRecommendationImpactText(
                              recommendation,
                              progress.nextRemainingCount,
                              progress.remainingScopeLabel,
                            )}
                          </small>
                        </div>
                        {nextTasks.length > 0 ? (
                          <div className="daily-command__next">
                            <span>Další na řadě</span>
                            <div className="daily-command__next-list">
                              {nextTasks.map((task) => (
                                <button
                                  key={task.id}
                                  type="button"
                                  onClick={() => onSelectTask(task.id)}
                                >
                                  {task.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p>{message ?? progress.emptyStateMessage}</p>
                        <div className="daily-command__actions">
                          <button
                            type="button"
                            onClick={handleStartRecommendedTask}
                            disabled
                          >
                            Začít
                          </button>
                          <button type="button" onClick={onSkip} disabled>
                            Přeskočit
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            ) : null}

          </div>
          <span className="daily-command__handle" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function getCurrentWeekDays(tasks: Task[]): WeekDay[] {
  const today = new Date();
  const monday = getStartOfWeek(today);
  const countsByDate = new Map<string, number>();

  for (const task of tasks) {
    if (task.completed || !task.dueDate) {
      continue;
    }

    countsByDate.set(task.dueDate, (countsByDate.get(task.dueDate) ?? 0) + 1);
  }

  return ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((label, index) => {
    const date = addDays(monday, index);
    const dateValue = formatDateValue(date);

    return {
      count: countsByDate.get(dateValue) ?? 0,
      date: dateValue,
      dayNumber: date.getDate(),
      label,
      pressureLabel: WEEKDAY_PRESSURE_LABELS[index],
    };
  });
}

function getRecommendationWeeklyPressureText(task: Task, tasks: Task[]) {
  if (!task.dueDate) {
    return null;
  }

  const busiestDay = getClearBusiestWeekDay(getCurrentWeekDays(tasks));
  const today = getTodayDateValue();

  if (!busiestDay || busiestDay.date === today || task.dueDate !== busiestDay.date) {
    return null;
  }

  return `Pomůže snížit tlak ${busiestDay.pressureLabel}`;
}

function getRecommendationImportanceExplanationText(
  task: Task,
  tasks: Task[],
  today: string,
) {
  if (task.priority === "high") {
    return null;
  }

  const importantTasks = tasks.filter(
    (currentTask) => !currentTask.completed && currentTask.priority === "high",
  );

  if (importantTasks.length === 0) {
    return null;
  }

  const recommendedTaskRank = getRecommendationRank(task, today);
  const bestImportantTaskRank = Math.min(
    ...importantTasks.map((importantTask) =>
      getRecommendationRank(importantTask, today),
    ),
  );

  if (bestImportantTaskRank < recommendedTaskRank) {
    return null;
  }

  const hasUrgentImportantTask = importantTasks.some((importantTask) =>
    ["overdue", "today"].includes(getPrimaryTimeStatus(importantTask, today)),
  );

  return hasUrgentImportantTask
    ? "Důležité úkoly čekají na později"
    : "Důležitý úkol není na dnešek";
}

function getClearBusiestWeekDay(weekDays: WeekDay[]) {
  const sortedDays = [...weekDays].sort((left, right) => right.count - left.count);
  const busiestDay = sortedDays[0];
  const secondBusiestDay = sortedDays[1];

  if (
    !busiestDay ||
    busiestDay.count < MIN_TASKS_FOR_WEEK_PRESSURE ||
    busiestDay.count === secondBusiestDay?.count
  ) {
    return null;
  }

  return busiestDay;
}

function getStartOfWeek(date: Date) {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;

  startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  return startOfWeek;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMobileSelectedDayTitle(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Vybraný den";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
  }).format(date);
}

function getTaskDueChipTone(task: Task) {
  const timeStatus = getPrimaryTimeStatus(task, getTodayDateValue());

  if (timeStatus === "overdue") {
    return "overdue";
  }

  if (timeStatus === "today") {
    return "today";
  }

  return "default";
}

function getTaskDueChipLabel(task: Task) {
  if (!task.dueDate) {
    return null;
  }

  const today = getTodayDateValue();
  const timeStatus = getPrimaryTimeStatus(task, today);

  if (timeStatus === "overdue") {
    return "Po termínu";
  }

  if (timeStatus === "today") {
    return "Dnes";
  }

  const tomorrow = addDays(new Date(`${today}T00:00:00`), 1);

  if (task.dueDate === formatDateValue(tomorrow)) {
    return "Zítra";
  }

  const dueDate = new Date(`${task.dueDate}T00:00:00`);

  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
  }).format(dueDate);
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <span className="daily-command__summary-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

function getRecommendationKeyMessage(
  recommendation: RecommendedTask,
  relevantTaskCount: number,
  stats: DailyTaskStats,
) {
  if (recommendation.bucket <= 1) {
    return stats.overdueActiveCount > 1
      ? `Máš ${formatTaskCount(stats.overdueActiveCount)} po termínu - začni snižovat skluz`
      : "Začni tímto úkolem po termínu";
  }

  if (recommendation.bucket === 2) {
    return "Tohle je dnes nejdůležitější";
  }

  if (recommendation.bucket === 3) {
    return stats.todayActiveCount > 1
      ? `Máš ${formatTaskCount(stats.todayActiveCount)} na dnešek - začni tímto`
      : "Začni dnešní prioritou";
  }

  if (recommendation.bucket === 4 || recommendation.reasons.includes("Vysoká priorita")) {
    return stats.importantActiveCount > 1
      ? `Máš ${formatTaskCount(stats.importantActiveCount)} s vysokou prioritou - začni tím nejdůležitějším`
      : "Tohle má nejvyšší prioritu";
  }

  if (relevantTaskCount > 1) {
    return "Tímto se posuneš nejrychleji dál";
  }

  return "Začni tímto krokem";
}

function getRecommendationImpactText(
  recommendation: RecommendedTask,
  remainingCount: number,
  remainingScopeLabel: string,
) {
  if (recommendation.bucket <= 1) {
    if (remainingCount === 0) {
      return "Po termínu už nic nezůstane.";
    }

    if (remainingCount === 1) {
      return "Po termínu zůstane už jen 1 úkol.";
    }

    return `Po termínu zůstanou ještě ${remainingCount} úkoly.`;
  }

  if (recommendation.bucket === 2 || recommendation.bucket === 3) {
    if (remainingCount === 0) {
      return "Na dnešek už nic nezbude.";
    }

    if (remainingCount === 1) {
      return "Na dnešek zbude už jen 1 úkol.";
    }

    return `Na dnešek zůstanou ještě ${remainingCount} úkoly.`;
  }

  if (recommendation.bucket === 4 || recommendation.reasons.includes("Vysoká priorita")) {
    if (remainingCount === 0) {
      return "Důležité úkoly budou vyřešené.";
    }

    if (remainingCount === 1) {
      return "Pak zbude už jen 1 důležitý úkol.";
    }

    return `Pak zůstanou ještě ${remainingCount} důležité úkoly.`;
  }

  if (remainingCount === 0) {
    return `Tímto uzavřeš práci ${remainingScopeLabel}.`;
  }

  if (remainingCount === 1) {
    return `Po tomto úkolu zbude už jen 1 úkol ${remainingScopeLabel}.`;
  }

  if (remainingCount >= 2 && remainingCount <= 4) {
    return `Po tomto úkolu zůstanou ${remainingCount} úkoly ${remainingScopeLabel}.`;
  }

  return `Po tomto úkolu zbývá ${remainingCount} úkolů ${remainingScopeLabel}.`;
}

function getRecommendationImpactSummary(
  completedCount: number,
  totalCount: number,
  summaryScopeLabel: string,
) {
  return `Dokončením tohoto úkolu bude hotovo ${completedCount} z ${totalCount} ${summaryScopeLabel}.`;
}

function formatTaskCount(count: number) {
  if (count === 1) {
    return "1 úkol";
  }

  if (count >= 2 && count <= 4) {
    return `${count} úkoly`;
  }

  return `${count} úkolů`;
}

function getRecommendationContextItems(
  recommendation: RecommendedTask,
  today: string,
) {
  const task = recommendation.task;
  const contextItems: string[] = [];
  const daysOverdue = getOverdueDays(task.dueDate, today);

  if (daysOverdue !== null) {
    contextItems.push(
      daysOverdue === 1
        ? "Po termínu o 1 den"
        : `Po termínu o ${formatDayCount(daysOverdue)}`,
    );
  } else if (task.dueDate === today) {
    contextItems.push("Naplánováno na dnes");
  }

  if (task.priority === "high" && !recommendation.reasons.includes("Vysoká priorita")) {
    contextItems.push("Vysoká priorita");
  }

  if (
    task.priority === "high" &&
    recommendation.reasons.includes("Po termínu") &&
    contextItems.length < 3
  ) {
    contextItems.push("Vysoká priorita");
  }

  if (
    recommendation.reasons.includes("Z aktuálního seznamu") &&
    !contextItems.includes("Z aktuálního seznamu")
  ) {
    contextItems.push("Z aktuálního seznamu");
  }

  if (
    recommendation.reasons.includes("Na dnešek") &&
    !contextItems.includes("Naplánováno na dnes") &&
    !recommendation.reasons.includes("Vysoká priorita")
  ) {
    contextItems.push("Na dnešek");
  }

  return contextItems.slice(0, 3);
}

function getTouchRecommendationStatusItems(
  recommendation: RecommendedTask,
  completedCount: number,
  totalCount: number,
  today: string,
) {
  const items: string[] = [];
  const { task } = recommendation;
  const daysOverdue = getOverdueDays(task.dueDate, today);

  if (daysOverdue !== null) {
    items.push(daysOverdue === 1 ? "Po termínu" : `Po termínu ${daysOverdue} d`);
  } else if (task.dueDate === today) {
    items.push("Dnes");
  } else if (task.priority === "high") {
    items.push("Vysoká priorita");
  }

  if (totalCount > 0) {
    items.push(`${completedCount}/${totalCount} hotovo`);
  }

  return items;
}

function formatDayCount(count: number) {
  if (count === 1) {
    return "1 den";
  }

  if (count >= 2 && count <= 4) {
    return `${count} dny`;
  }

  return `${count} dní`;
}

function getOverdueDays(dueDate: string | null, today: string) {
  if (!dueDate || dueDate >= today) {
    return null;
  }

  const dueDateValue = new Date(`${dueDate}T00:00:00`);
  const todayValue = new Date(`${today}T00:00:00`);
  const diffMs = todayValue.getTime() - dueDateValue.getTime();
  const diffDays = Math.max(1, Math.round(diffMs / 86_400_000));

  return diffDays;
}

function StatItem({
  label,
  value,
  previewTasks,
  tone = "default",
}: {
  label: string;
  value: number;
  previewTasks: Task[];
  tone?: "default" | "danger";
}) {
  return (
    <div className="daily-command__stat" data-tone={tone}>
      <strong>{value}</strong>
      <span>{label}</span>
      {previewTasks.length > 0 ? (
        <span className="daily-command__stat-preview" role="tooltip">
          {previewTasks.slice(0, 3).map((task) => (
            <small key={task.id}>{task.title}</small>
          ))}
        </span>
      ) : null}
    </div>
  );
}

function getEmptyStateMessage(list: TaskList | undefined) {
  if (!list) {
    return "Zatím nemáš žádné úkoly";
  }

  if (list.id === TODAY_LIST_ID) {
    return "Na dnešek nemáš žádné úkoly";
  }

  if (list.id === IMPORTANT_LIST_ID) {
    return "Nemáš žádné důležité úkoly";
  }

  if (list.id === PLANNED_LIST_ID) {
    return "Nemáš žádné naplánované úkoly";
  }

  if (list.id === FALLBACK_LIST_ID) {
    return "Zatím nemáš žádné úkoly";
  }

  return "Tento seznam je zatím prázdný";
}

function EmptyState({
  hint = "Přidej první úkol.",
  message,
}: {
  hint?: string;
  message: string;
}) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      <small>{hint}</small>
    </div>
  );
}

function TaskVisibilitySegment({
  activeCount,
  completedCount,
  value,
  onChange,
}: {
  activeCount: number;
  completedCount: number;
  value: TaskVisibilityFilter;
  onChange: (filter: TaskVisibilityFilter) => void;
}) {
  const totalCount = activeCount + completedCount;
  const options: Array<{
    count: number;
    label: string;
    value: TaskVisibilityFilter;
  }> = [
    { count: totalCount, label: "Vše", value: "all" },
    { count: activeCount, label: "Aktivní", value: "active" },
    { count: completedCount, label: "Hotové", value: "completed" },
  ];

  return (
    <div className="task-filter" role="tablist" aria-label="Filtrovat úkoly">
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            aria-selected={isSelected}
            className="task-filter__option"
            data-selected={isSelected ? "true" : "false"}
            key={option.value}
            role="tab"
            type="button"
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>
            <strong>{option.count}</strong>
          </button>
        );
      })}
    </div>
  );
}

function getTaskFilterEmptyMessage(
  filter: TaskVisibilityFilter,
  selectedWeekDate: string | null,
) {
  const scope = selectedWeekDate ? "pro vybraný den" : "v tomto pohledu";

  if (filter === "active") {
    return `Žádné aktivní úkoly ${scope}`;
  }

  if (filter === "completed") {
    return `Žádné hotové úkoly ${scope}`;
  }

  return selectedWeekDate
    ? "Pro vybraný den tu nejsou žádné úkoly"
    : "Zatím nemáš žádné úkoly";
}

function getConflictCreateMessage(
  parserMessage: string | null,
  selectedWeekDate: string | null,
) {
  const baseMessage =
    parserMessage ?? "Termín není jednoznačný. Metadata nebyla automaticky použita.";

  return selectedWeekDate
    ? `${baseMessage} Použit vybraný den z týdenního přehledu.`
    : `${baseMessage} Úkol byl vytvořen bez termínu.`;
}

type TaskSectionProps = {
  isCompact?: boolean;
  isResponsiveCompact?: boolean;
  isArchivedSection?: boolean;
  title?: string;
  tasks: Task[];
  lists: TaskList[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onToggleTaskCompleted: (taskId: string, completed: boolean) => void;
  onUpdateTask: (taskId: string, update: TaskUpdate) => void;
  onArchiveTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
  onMoveTask: (taskId: string, listId: string) => void;
};

function TaskSection({
  isCompact = false,
  isResponsiveCompact = false,
  isArchivedSection = false,
  title,
  tasks,
  lists,
  selectedTaskId,
  onSelectTask,
  onToggleTaskCompleted,
  onUpdateTask,
  onArchiveTask,
  onDeleteTask,
  canDeleteTask,
  onMoveTask,
}: TaskSectionProps) {
  const [openMenu, setOpenMenu] = useState<{
    task: Task;
    x: number;
    y: number;
  } | null>(null);
  const [swipeState, setSwipeState] = useState<{
    taskId: string;
    startX: number;
    startY: number;
    rowWidth: number;
    deltaX: number;
    isSwiping: boolean;
  } | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const targetLists = lists.filter((list) => !list.isSystem && !list.isArchived);

  useEffect(() => {
    if (!openMenu) {
      return;
    }

    function handleWindowClick() {
      setOpenMenu(null);
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [openMenu]);

  if (tasks.length === 0) {
    return null;
  }

  function clearLongPressTimeout() {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function openTaskMenu(task: Task, x: number, y: number) {
    const menuWidth = 210;
    const menuHeight = 260;
    const safeX = Math.min(x, window.innerWidth - menuWidth - 12);
    const safeY = Math.min(y, window.innerHeight - menuHeight - 12);

    setOpenMenu({
      task,
      x: Math.max(12, safeX),
      y: Math.max(12, safeY),
    });
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>, task: Task) {
    event.preventDefault();
    openTaskMenu(task, event.clientX, event.clientY);
  }

  function handleMenuButtonClick(
    event: MouseEvent<HTMLButtonElement>,
    task: Task,
  ) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openTaskMenu(task, rect.right, rect.bottom + 6);
  }

  function handleTouchStart(
    event: TouchEvent<HTMLDivElement>,
    task: Task,
  ) {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    clearLongPressTimeout();
    setSwipeState({
      taskId: task.id,
      startX: touch.clientX,
      startY: touch.clientY,
      rowWidth: event.currentTarget.getBoundingClientRect().width,
      deltaX: 0,
      isSwiping: false,
    });
    longPressTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickOnce();
      openTaskMenu(task, touch.clientX, touch.clientY);
    }, LONG_PRESS_DELAY_MS);
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>, task: Task) {
    if (!swipeState || swipeState.taskId !== task.id || isArchivedSection) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;
    const absoluteDeltaX = Math.abs(deltaX);
    const absoluteDeltaY = Math.abs(deltaY);

    if (absoluteDeltaX > 8 || absoluteDeltaY > 8) {
      clearLongPressTimeout();
    }

    const isHorizontalSwipe =
      absoluteDeltaX > SWIPE_START_DISTANCE && absoluteDeltaX > absoluteDeltaY;

    if (!isHorizontalSwipe && !swipeState.isSwiping) {
      return;
    }

    if (deltaX >= 0) {
      setSwipeState((currentState) =>
        currentState && currentState.taskId === task.id
          ? { ...currentState, deltaX: 0, isSwiping: false }
          : currentState,
      );
      return;
    }

    event.preventDefault();

    const maxDistance = swipeState.rowWidth * SWIPE_ARCHIVE_MAX_DISTANCE_RATIO;
    const nextDeltaX = Math.max(deltaX, -maxDistance);

    setSwipeState((currentState) =>
      currentState && currentState.taskId === task.id
        ? { ...currentState, deltaX: nextDeltaX, isSwiping: true }
        : currentState,
    );
  }

  function resetSwipe() {
    setSwipeState((currentState) =>
      currentState ? { ...currentState, deltaX: 0, isSwiping: false } : null,
    );
    window.setTimeout(() => setSwipeState(null), 160);
  }

  function handleTouchEnd(task: Task) {
    clearLongPressTimeout();

    if (!swipeState || swipeState.taskId !== task.id) {
      return;
    }

    if (swipeState.isSwiping) {
      suppressNextClickOnce();
    }

    const threshold = swipeState.rowWidth * SWIPE_ARCHIVE_THRESHOLD_RATIO;

    if (
      !isArchivedSection &&
      swipeState.isSwiping &&
      Math.abs(swipeState.deltaX) >= threshold
    ) {
      setSwipeState(null);
      onArchiveTask(task.id);
      return;
    }

    resetSwipe();
  }

  function handleMenuAction(action: () => void) {
    action();
    setOpenMenu(null);
  }

  function suppressNextClickOnce() {
    suppressNextClickRef.current = true;
    window.setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 600);
  }

  function handleTaskClick(taskId: string) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    onSelectTask(taskId);
  }

  function handleToggleExpanded(
    event: MouseEvent<HTMLButtonElement>,
    taskId: string,
  ) {
    event.stopPropagation();
    setExpandedTaskId((currentTaskId) =>
      currentTaskId === taskId ? null : taskId,
    );
  }

  function handleToggleSubtask(task: Task, subtaskId: string, completed: boolean) {
    const subtasks = task.subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, completed } : subtask,
    );

    onUpdateTask(task.id, {
      subtasks,
      completed:
        subtasks.length > 0 && subtasks.every((subtask) => subtask.completed)
          ? true
          : task.completed,
    });
  }

  return (
    <section
      className="task-section"
      data-compact={isCompact}
      aria-label={title ?? "Aktivní úkoly"}
    >
      {title ? <h3>{title}</h3> : null}
      <div className="task-list">
        {tasks.map((task) => {
          const taskSwipeState =
            swipeState?.taskId === task.id ? swipeState : null;
          const isSelected = selectedTaskId !== null && task.id === selectedTaskId;
          const isExpanded =
            isResponsiveCompact && expandedTaskId === task.id;
          const completedSubtasksCount = task.subtasks.filter(
            (subtask) => subtask.completed,
          ).length;
          const hasSubtasks = task.subtasks.length > 0;

          return (
            <div className="task-list__swipe-shell" key={task.id}>
              {!isArchivedSection ? (
                <div className="task-list__swipe-action" aria-hidden="true">
                  Archivovat
                </div>
              ) : null}
              <div
                className={isResponsiveCompact ? "task-list__flat-group" : undefined}
                data-expanded={isExpanded ? "true" : "false"}
                data-swiping={taskSwipeState?.isSwiping ? "true" : undefined}
                onContextMenu={(event) => handleContextMenu(event, task)}
                onTouchCancel={resetSwipe}
                onTouchEnd={() => handleTouchEnd(task)}
                onTouchMove={(event) => handleTouchMove(event, task)}
                onTouchStart={(event) => handleTouchStart(event, task)}
                style={
                  taskSwipeState
                    ? { transform: `translateX(${taskSwipeState.deltaX}px)` }
                    : undefined
                }
              >
                <div
                  className="task-list__row"
                  data-selected={isSelected ? "true" : "false"}
                  data-responsive-compact={isResponsiveCompact ? "true" : "false"}
                >
                  <input
                    aria-label={`Označit úkol ${task.title} jako ${
                      task.completed ? "otevřený" : "dokončený"
                    }`}
                    checked={task.completed}
                    disabled={isArchivedSection}
                    type="checkbox"
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      onToggleTaskCompleted(task.id, event.currentTarget.checked)
                    }
                  />
                  <div className="task-list__content">
                    <button
                      className="task-list__item"
                      type="button"
                      onClick={() => handleTaskClick(task.id)}
                    >
                      <div className="task-list__primary-line">
                        <div className="task-list__headline">
                          <span className="task-list__title">{task.title}</span>
                          {task.dueDate ? (
                            <span
                              className="task-list__due-chip"
                              data-tone={getTaskDueChipTone(task)}
                            >
                              {getTaskDueChipLabel(task)}
                            </span>
                          ) : null}
                          {!isResponsiveCompact && task.labels.length > 0 ? (
                            <div className="task-list__labels task-list__labels--inline" aria-hidden="true">
                              {task.labels.slice(0, 2).map((label) => (
                                <span
                                  className="task-label-chip task-label-chip--list"
                                  key={label.id}
                                  style={{ "--label-color": label.color } as CSSProperties}
                                >
                                  {label.name}
                                </span>
                              ))}
                              {task.labels.length > 2 ? (
                                <span className="task-label-chip task-label-chip--list task-label-chip--more">
                                  +{task.labels.length - 2}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {isResponsiveCompact && hasSubtasks ? (
                          <small className="task-list__subtask-count">
                            {completedSubtasksCount}/{task.subtasks.length}
                          </small>
                        ) : !isResponsiveCompact && hasSubtasks ? (
                          <small className="task-list__subtask-count task-list__subtask-count--meta">
                            {completedSubtasksCount}/{task.subtasks.length}
                          </small>
                        ) : null}
                      </div>
                      {!isResponsiveCompact && task.subtasks.length > 0 ? (
                        <TaskProgress task={task} />
                      ) : null}
                    </button>
                  </div>
                  {isResponsiveCompact && hasSubtasks ? (
                    <button
                      aria-label={
                        isExpanded
                          ? `Skrýt podrobnosti úkolu ${task.title}`
                          : `Zobrazit podrobnosti úkolu ${task.title}`
                      }
                      className="task-list__expand-button"
                      type="button"
                      onClick={(event) => handleToggleExpanded(event, task.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown aria-hidden="true" size={16} />
                      ) : (
                        <ChevronRight aria-hidden="true" size={16} />
                      )}
                    </button>
                  ) : (
                    <button
                      aria-label={`Otevřít menu úkolu ${task.title}`}
                      className="task-list__menu-button"
                      type="button"
                      onClick={(event) => handleMenuButtonClick(event, task)}
                    >
                      <span aria-hidden="true">...</span>
                    </button>
                  )}
                </div>
                {isResponsiveCompact && hasSubtasks ? (
                  <div className="task-list__expand-shell" aria-hidden={!isExpanded}>
                    <div className="task-list__expand-inner">
                      <div className="task-list__subtasks-preview">
                        {task.subtasks.slice(0, 4).map((subtask) => (
                          <div
                            className="task-list__subtask-row"
                            data-completed={subtask.completed ? "true" : "false"}
                            key={subtask.id}
                          >
                            <input
                              aria-label={`Označit podúkol ${subtask.title} jako ${
                                subtask.completed ? "nedokončený" : "dokončený"
                              }`}
                              checked={subtask.completed}
                              type="checkbox"
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                handleToggleSubtask(
                                  task,
                                  subtask.id,
                                  event.currentTarget.checked,
                                )
                              }
                            />
                            <span>{subtask.title}</span>
                          </div>
                        ))}
                        {task.subtasks.length > 4 ? (
                          <small>+{task.subtasks.length - 4} dalších podúkolů</small>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {openMenu ? (
        <div
          className="task-context-menu"
          role="menu"
          style={{
            left: openMenu.x,
            top: openMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {!isArchivedSection ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => handleMenuAction(() => onArchiveTask(openMenu.task.id))}
            >
              Archivovat
            </button>
          ) : null}
          <div className="task-context-menu__group" role="group" aria-label="Přesunout">
            <span>Přesunout do...</span>
            {targetLists.map((list) => (
              <button
                disabled={list.id === openMenu.task.listId}
                key={list.id}
                type="button"
                role="menuitem"
                onClick={() =>
                  handleMenuAction(() => onMoveTask(openMenu.task.id, list.id))
                }
              >
                {list.name}
              </button>
            ))}
          </div>
          {canDeleteTask(openMenu.task) ? (
            <button
              className="task-context-menu__danger"
              type="button"
              role="menuitem"
              onClick={() => handleMenuAction(() => onDeleteTask(openMenu.task.id))}
            >
              Smazat
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function TaskProgress({ task }: { task: Task }) {
  const completedSubtasks = task.subtasks.filter(
    (subtask) => subtask.completed,
  ).length;
  const progress = (completedSubtasks / task.subtasks.length) * 100;
  const isComplete = completedSubtasks === task.subtasks.length;

  return (
    <div className="task-progress" data-complete={isComplete}>
      <div className="task-progress__track" aria-hidden="true">
        <div style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}





