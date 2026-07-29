import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Filter, Plus, X } from "lucide-react";
import { CustomDropdown } from "../CustomDropdown";
import type { DropdownOption } from "../CustomDropdown";
import { ProjectCardComposerModal } from "../ProjectCardComposerModal";
import { loadProjectColumns, loadProjectsForTeams } from "../../supabase/projectApi";
import { loadTeamMembers } from "../../supabase/teamApi";
import type { Project, ProjectColumn } from "../../projects/projectTypes";
import { toggleFilterValue } from "../../projects/projectBoardPreferences";
import { getMemberDisplayName } from "../../teams/teamMemberDisplay";
import type { Team, TeamMember } from "../../teams/teamTypes";
import type { Task, TaskPriority, TaskSubtask, TaskUpdate } from "../../tasks/taskTypes";
import { getTodayDateValue } from "../../tasks/dateUtils";
import { createEntityId } from "../../tasks/idUtils";
import { appendCardLabelValue, createCardLabels } from "../../tasks/cardLabels";
import {
  BOARD_CARD_PRIORITY_LABELS,
  BOARD_CARD_PRIORITY_OPTIONS,
  TASK_PRIORITY_COLORS as BOARD_CARD_PRIORITY_COLORS,
} from "../../tasks/taskPriorityColors";
import {
  CZECH_MONTH_NAMES,
  CZECH_WEEKDAY_LABELS,
  getAdjacentYearMonth,
  getCurrentYearMonth,
  getDateRange,
  getMonthMatrix,
  getWeekdayFullName,
  getWeekdayIndex,
  groupTaskIdsByDueDate,
  shiftDate,
} from "../../calendar/calendarUtils";

type CalendarViewMode = "day" | "4day" | "week" | "month";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const VIEW_MODE_DAY_COUNTS: Record<Exclude<CalendarViewMode, "month">, number> = {
  day: 1,
  "4day": 4,
  week: 7,
};

const VIEW_MODE_OPTIONS: DropdownOption[] = [
  { value: "day", label: "Den" },
  { value: "4day", label: "4 dny" },
  { value: "week", label: "Týden" },
  { value: "month", label: "Měsíc" },
];

type CalendarPanelProps = {
  teams: Team[];
  tasks: Task[];
  onCreateTask: (title: string, options?: TaskUpdate) => string | null;
  onUpdateTask: (taskId: string, update: TaskUpdate) => void;
};

export function CalendarPanel({ teams, tasks, onCreateTask, onUpdateTask }: CalendarPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [{ year, month }, setYearMonth] = useState(() => getCurrentYearMonth());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => getTodayDateValue());

  const [projectMembers, setProjectMembers] = useState<TeamMember[]>([]);
  const [projectColumns, setProjectColumns] = useState<ProjectColumn[]>([]);
  const [cardComposerTaskId, setCardComposerTaskId] = useState<string | null>(null);
  const [cardComposerColumnKey, setCardComposerColumnKey] = useState<Task["boardColumnKey"] | null>(null);
  const [cardComposerTitle, setCardComposerTitle] = useState("");
  const [cardComposerNote, setCardComposerNote] = useState("");
  const [cardComposerPriority, setCardComposerPriority] = useState<TaskPriority>("none");
  const [cardComposerDueDate, setCardComposerDueDate] = useState("");
  const [cardComposerDueTime, setCardComposerDueTime] = useState("");
  const [cardComposerLabels, setCardComposerLabels] = useState("");
  const [cardComposerLabelInput, setCardComposerLabelInput] = useState("");
  const [cardComposerAssigneeId, setCardComposerAssigneeId] = useState("");
  const [cardComposerSubtaskTitle, setCardComposerSubtaskTitle] = useState("");
  const [cardComposerSubtasks, setCardComposerSubtasks] = useState<TaskSubtask[]>([]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAssigneeIds, setFilterAssigneeIds] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<TaskPriority[]>([]);
  const [showCompletedTasks, setShowCompletedTasks] = useState(true);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const hourlyBodyRef = useRef<HTMLDivElement | null>(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (filterPanelRef.current?.contains(target)) {
        return;
      }

      setIsFilterOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isFilterOpen]);

  function goToPrevious() {
    if (viewMode === "month") {
      setYearMonth((current) => getAdjacentYearMonth(current.year, current.month, -1));
      return;
    }

    setAnchorDate((current) => shiftDate(current, -VIEW_MODE_DAY_COUNTS[viewMode]));
  }

  function goToNext() {
    if (viewMode === "month") {
      setYearMonth((current) => getAdjacentYearMonth(current.year, current.month, 1));
      return;
    }

    setAnchorDate((current) => shiftDate(current, VIEW_MODE_DAY_COUNTS[viewMode]));
  }

  function goToToday() {
    setYearMonth(getCurrentYearMonth());
    setAnchorDate(getTodayDateValue());
  }

  function handleViewModeChange(nextViewMode: CalendarViewMode) {
    if (viewMode === "month" && nextViewMode !== "month") {
      const currentYearMonth = getCurrentYearMonth();
      const isCurrentMonth = year === currentYearMonth.year && month === currentYearMonth.month;

      setAnchorDate(
        isCurrentMonth ? getTodayDateValue() : `${year}-${String(month).padStart(2, "0")}-01`,
      );
    } else if (viewMode !== "month" && nextViewMode === "month") {
      const [anchorYear, anchorMonth] = anchorDate.split("-");

      setYearMonth({ year: Number(anchorYear), month: Number(anchorMonth) });
    }

    setViewMode(nextViewMode);
  }

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
          setError(
            loadError instanceof Error ? loadError.message : "Nástěnky se nepodařilo načíst.",
          );
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
    if (selectedProjectId && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    let isCancelled = false;

    if (!selectedProject) {
      setProjectMembers([]);
      setProjectColumns([]);
      return;
    }

    const project = selectedProject;

    async function loadProjectExtras() {
      try {
        const [members, columns] = await Promise.all([
          loadTeamMembers(project.teamId),
          loadProjectColumns(project.id),
        ]);

        if (!isCancelled) {
          setProjectMembers(members);
          setProjectColumns(columns);
        }
      } catch {
        if (!isCancelled) {
          setProjectMembers([]);
          setProjectColumns([]);
        }
      }
    }

    void loadProjectExtras();

    return () => {
      isCancelled = true;
    };
  }, [selectedProject]);

  const dropdownOptions: DropdownOption[] = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const today = getTodayDateValue();

  const visibleDays = useMemo(() => {
    if (viewMode === "month") {
      return [];
    }

    return getDateRange(anchorDate, VIEW_MODE_DAY_COUNTS[viewMode]);
  }, [viewMode, anchorDate]);

  const headerTitle = useMemo(() => {
    if (viewMode === "month") {
      return `${CZECH_MONTH_NAMES[month - 1]} ${year}`;
    }

    const firstDay = visibleDays[0];
    const lastDay = visibleDays[visibleDays.length - 1];
    const [firstYear, firstMonthStr, firstDayStr] = firstDay.split("-");
    const [lastYear, lastMonthStr, lastDayStr] = lastDay.split("-");

    if (viewMode === "day") {
      return `${getWeekdayFullName(firstDay)} ${Number(firstDayStr)}. ${CZECH_MONTH_NAMES[Number(firstMonthStr) - 1]} ${firstYear}`;
    }

    if (firstMonthStr === lastMonthStr && firstYear === lastYear) {
      return `${Number(firstDayStr)}. – ${Number(lastDayStr)}. ${CZECH_MONTH_NAMES[Number(lastMonthStr) - 1]} ${lastYear}`;
    }

    const firstPart = `${Number(firstDayStr)}. ${CZECH_MONTH_NAMES[Number(firstMonthStr) - 1]}${firstYear === lastYear ? "" : ` ${firstYear}`}`;
    const lastPart = `${Number(lastDayStr)}. ${CZECH_MONTH_NAMES[Number(lastMonthStr) - 1]} ${lastYear}`;

    return `${firstPart} – ${lastPart}`;
  }, [viewMode, year, month, visibleDays]);

  useEffect(() => {
    if (viewMode === "month" || !hourlyBodyRef.current) {
      return;
    }

    const scrollToHour = visibleDays.includes(today) ? new Date().getHours() : 8;
    const rowHeight = hourlyBodyRef.current.scrollHeight / HOURS.length;

    hourlyBodyRef.current.scrollTop = Math.max(0, (scrollToHour - 1) * rowHeight);
  }, [viewMode, anchorDate, visibleDays, today, selectedProjectId]);

  const filteredProjectTasks = useMemo(() => {
    if (!selectedProjectId) {
      return [];
    }

    return tasks.filter((task) => {
      if (task.projectId !== selectedProjectId) {
        return false;
      }

      if (!showCompletedTasks && task.completed) {
        return false;
      }

      if (
        filterAssigneeIds.length > 0 &&
        (!task.assigneeId || !filterAssigneeIds.includes(task.assigneeId))
      ) {
        return false;
      }

      if (filterPriorities.length > 0 && !filterPriorities.includes(task.priority)) {
        return false;
      }

      return true;
    });
  }, [tasks, selectedProjectId, filterAssigneeIds, filterPriorities, showCompletedTasks]);

  const taskIdsByDueDate = useMemo(
    () => groupTaskIdsByDueDate(filteredProjectTasks),
    [filteredProjectTasks],
  );

  const tasksByDueDate = useMemo(() => {
    const map = new Map<string, Task[]>();

    for (const task of filteredProjectTasks) {
      if (!task.dueDate) {
        continue;
      }

      const existing = map.get(task.dueDate);

      if (existing) {
        existing.push(task);
      } else {
        map.set(task.dueDate, [task]);
      }
    }

    return map;
  }, [filteredProjectTasks]);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const composerColumn = projectColumns.find((column) => column.key === cardComposerColumnKey) ?? null;
  const activeFilterCount =
    filterAssigneeIds.length + filterPriorities.length + (showCompletedTasks ? 0 : 1);

  function getTasksForDate(date: string) {
    return tasksByDueDate.get(date) ?? [];
  }

  function getTaskHour(task: Task): number | null {
    if (!task.dueTime) {
      return null;
    }

    const hour = Number(task.dueTime.split(":")[0]);

    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
  }

  function handleClearFilters() {
    setFilterAssigneeIds([]);
    setFilterPriorities([]);
    setShowCompletedTasks(true);
  }

  function resetCardComposer() {
    setCardComposerTaskId(null);
    setCardComposerColumnKey(null);
    setCardComposerTitle("");
    setCardComposerNote("");
    setCardComposerPriority("none");
    setCardComposerDueDate("");
    setCardComposerDueTime("");
    setCardComposerLabels("");
    setCardComposerLabelInput("");
    setCardComposerAssigneeId("");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks([]);
  }

  function handleOpenTask(taskId: string) {
    const task = taskById.get(taskId);

    if (!task) {
      return;
    }

    setCardComposerTaskId(task.id);
    setCardComposerColumnKey(task.boardColumnKey);
    setCardComposerTitle(task.title);
    setCardComposerNote(task.note);
    setCardComposerPriority(task.priority);
    setCardComposerDueDate(task.dueDate ?? "");
    setCardComposerDueTime(task.dueTime ?? "");
    setCardComposerLabels(task.labels.map((label) => label.name).join(", "));
    setCardComposerAssigneeId(task.assigneeId ?? "");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks(task.subtasks.map((subtask) => ({ ...subtask })));
  }

  function handleAddTask(date: string, dueTime?: string) {
    if (projectColumns.length === 0) {
      return;
    }

    setCardComposerTaskId(null);
    setCardComposerColumnKey(projectColumns[0].key);
    setCardComposerTitle("");
    setCardComposerNote("");
    setCardComposerPriority("none");
    setCardComposerDueDate(date);
    setCardComposerDueTime(dueTime ?? "");
    setCardComposerLabels("");
    setCardComposerLabelInput("");
    setCardComposerAssigneeId("");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks([]);
  }

  function handleAddTaskAtHour(date: string, hour: number) {
    handleAddTask(date, `${String(hour).padStart(2, "0")}:00`);
  }

  function handleAddComposerSubtask() {
    const title = cardComposerSubtaskTitle.trim();

    if (!title) {
      return;
    }

    setCardComposerSubtasks((current) => [
      ...current,
      { id: createEntityId(), title, completed: false },
    ]);
    setCardComposerSubtaskTitle("");
  }

  function handleToggleComposerSubtask(subtaskId: string) {
    setCardComposerSubtasks((current) =>
      current.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask,
      ),
    );
  }

  function handleAddComposerLabel(rawValue: string) {
    setCardComposerLabels(appendCardLabelValue(cardComposerLabels, rawValue));
    setCardComposerLabelInput("");
  }

  function handleSubmitComposer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject || !cardComposerColumnKey || !cardComposerTitle.trim()) {
      return;
    }

    const update: TaskUpdate = {
      assigneeId: cardComposerAssigneeId || null,
      boardColumnKey: cardComposerColumnKey,
      dueDate: cardComposerDueDate || null,
      dueTime: cardComposerDueTime || null,
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

  return (
    <div className="calendar-panel">
      <header className="calendar-panel__header">
        <CustomDropdown
          value={selectedProjectId ?? ""}
          options={dropdownOptions}
          onChange={(value) => setSelectedProjectId(value)}
          placeholder="Vyber nástěnku"
          ariaLabel="Vyber nástěnku pro kalendář"
          disabled={isLoading || dropdownOptions.length === 0}
        />
        {selectedProjectId ? (
          <>
            <div className="project-detail__filter" ref={isFilterOpen ? filterPanelRef : null}>
              <button
                className="project-detail__filter-button"
                type="button"
                aria-expanded={isFilterOpen}
                onClick={() => setIsFilterOpen((current) => !current)}
              >
                <Filter aria-hidden="true" size={15} />
                <span>Filtr</span>
                {activeFilterCount > 0 ? (
                  <span className="project-detail__filter-badge">{activeFilterCount}</span>
                ) : null}
              </button>
              {activeFilterCount > 0 ? (
                <button
                  className="project-detail__filter-clear"
                  type="button"
                  aria-label="Zrušit filtry"
                  onClick={handleClearFilters}
                >
                  <X aria-hidden="true" size={12} />
                </button>
              ) : null}
              {isFilterOpen ? (
                <div className="project-detail__filter-panel" role="menu">
                  <div className="project-detail__filter-section">
                    <span>Přiřazeno</span>
                    {projectMembers.length === 0 ? (
                      <p className="project-detail__filter-empty">Nástěnka nemá žádné členy.</p>
                    ) : (
                      projectMembers.map((member) => (
                        <label className="project-detail__filter-option" key={member.userId}>
                          <input
                            type="checkbox"
                            checked={filterAssigneeIds.includes(member.userId)}
                            onChange={() =>
                              setFilterAssigneeIds((current) => toggleFilterValue(current, member.userId))
                            }
                          />
                          <span>{getMemberDisplayName(member)}</span>
                        </label>
                      ))
                    )}
                  </div>

                  <div className="project-detail__filter-section">
                    <span>Priorita</span>
                    {BOARD_CARD_PRIORITY_OPTIONS.map((priorityOption) => (
                      <label className="project-detail__filter-option" key={priorityOption}>
                        <input
                          type="checkbox"
                          checked={filterPriorities.includes(priorityOption)}
                          onChange={() =>
                            setFilterPriorities((current) => toggleFilterValue(current, priorityOption))
                          }
                        />
                        <i
                          className="project-detail__filter-dot"
                          aria-hidden="true"
                          style={{ background: BOARD_CARD_PRIORITY_COLORS[priorityOption] }}
                        />
                        <span>{BOARD_CARD_PRIORITY_LABELS[priorityOption]}</span>
                      </label>
                    ))}
                  </div>

                  <div className="project-detail__filter-section">
                    <span>Stav</span>
                    <label className="project-detail__filter-option">
                      <input
                        type="checkbox"
                        checked={showCompletedTasks}
                        onChange={() => setShowCompletedTasks((current) => !current)}
                      />
                      <span>Zobrazit dokončené úkoly</span>
                    </label>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="calendar-panel__nav">
              <CustomDropdown
                className="calendar-panel__view-dropdown"
                value={viewMode}
                options={VIEW_MODE_OPTIONS}
                onChange={(value) => handleViewModeChange(value as CalendarViewMode)}
                ariaLabel="Vyber zobrazení kalendáře"
              />
              <button
                className="calendar-panel__nav-button"
                type="button"
                aria-label="Předchozí"
                onClick={goToPrevious}
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
              <h2 className="calendar-panel__title">{headerTitle}</h2>
              <button
                className="calendar-panel__nav-button"
                type="button"
                aria-label="Následující"
                onClick={goToNext}
              >
                <ChevronRight size={16} strokeWidth={2} />
              </button>
              <button className="calendar-panel__today-button" type="button" onClick={goToToday}>
                Dnes
              </button>
            </div>
          </>
        ) : null}
      </header>

      {error ? <p className="calendar-panel__error">{error}</p> : null}

      {!selectedProjectId ? (
        <p className="calendar-panel__empty">Vyber nástěnku pro zobrazení úkolů.</p>
      ) : viewMode === "month" ? (
        <div className="calendar-panel__grid">
          <div className="calendar-panel__weekdays">
            {CZECH_WEEKDAY_LABELS.map((label) => (
              <span key={label} className="calendar-panel__weekday">
                {label}
              </span>
            ))}
          </div>
          {weeks.map((week, weekIndex) => (
            <div className="calendar-panel__week" key={weekIndex}>
              {week.map((day) => (
                <div
                  className="calendar-panel__day"
                  key={day.date}
                  data-today={day.date === today ? "true" : "false"}
                >
                  <div className="calendar-panel__day-header">
                    <span className="calendar-panel__day-number">{day.dayOfMonth}</span>
                    <button
                      className="calendar-panel__day-add-button"
                      type="button"
                      aria-label={"Přidat úkol na den " + day.dayOfMonth}
                      onClick={() => handleAddTask(day.date)}
                      disabled={projectColumns.length === 0}
                    >
                      <Plus size={12} strokeWidth={2.4} />
                    </button>
                  </div>
                  <div className="calendar-panel__day-tasks">
                    {(taskIdsByDueDate.get(day.date) ?? []).map((taskId) => {
                      const task = taskById.get(taskId);

                      return task ? (
                        <button
                          className="calendar-panel__task"
                          key={taskId}
                          type="button"
                          title={task.title}
                          onClick={() => handleOpenTask(taskId)}
                        >
                          {task.title}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="calendar-panel__hourly-grid">
          <div className="calendar-panel__hourly-day-headers">
            <div className="calendar-panel__hourly-time-gutter" />
            {visibleDays.map((day) => (
              <div
                className="calendar-panel__hourly-day-header"
                key={day}
                data-today={day === today ? "true" : "false"}
              >
                <span>{CZECH_WEEKDAY_LABELS[getWeekdayIndex(day)]}</span>
                <span>{Number(day.split("-")[2])}</span>
              </div>
            ))}
          </div>
          <div className="calendar-panel__all-day-row">
            <div className="calendar-panel__hourly-time-gutter">Celý den</div>
            {visibleDays.map((day) => (
              <div className="calendar-panel__all-day-cell" key={day}>
                {getTasksForDate(day)
                  .filter((task) => getTaskHour(task) === null)
                  .map((task) => (
                    <button
                      className="calendar-panel__task"
                      key={task.id}
                      type="button"
                      title={task.title}
                      onClick={() => handleOpenTask(task.id)}
                    >
                      {task.title}
                    </button>
                  ))}
              </div>
            ))}
          </div>
          <div className="calendar-panel__hourly-body" ref={hourlyBodyRef}>
            {HOURS.map((hour) => (
              <div className="calendar-panel__hour-row" key={hour}>
                <div className="calendar-panel__hour-label">{String(hour).padStart(2, "0")}:00</div>
                {visibleDays.map((day) => {
                  const hourTasks = getTasksForDate(day).filter(
                    (task) => getTaskHour(task) === hour,
                  );

                  return (
                    <div className="calendar-panel__hour-cell" key={day}>
                      <button
                        className="calendar-panel__hour-add-button"
                        type="button"
                        aria-label={`Přidat úkol na ${day} v ${String(hour).padStart(2, "0")}:00`}
                        onClick={() => handleAddTaskAtHour(day, hour)}
                        disabled={projectColumns.length === 0}
                      >
                        <Plus size={10} strokeWidth={2.4} />
                      </button>
                      {hourTasks.map((task) => (
                        <button
                          className="calendar-panel__timed-task"
                          key={task.id}
                          type="button"
                          title={task.title}
                          onClick={() => handleOpenTask(task.id)}
                        >
                          {task.title}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {cardComposerColumnKey && selectedProject ? (
          <ProjectCardComposerModal
            actionLabel={cardComposerTaskId ? "Uložit kartu" : "Přidat kartu"}
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
            onAddSubtask={handleAddComposerSubtask}
            onAssigneeChange={setCardComposerAssigneeId}
            onClose={resetCardComposer}
            onDueDateChange={setCardComposerDueDate}
            onLabelInputChange={setCardComposerLabelInput}
            onAddLabel={handleAddComposerLabel}
            onLabelsChange={setCardComposerLabels}
            onNoteChange={setCardComposerNote}
            onPriorityChange={setCardComposerPriority}
            onSubtaskTitleChange={setCardComposerSubtaskTitle}
            onSubmit={handleSubmitComposer}
            onToggleSubtask={handleToggleComposerSubtask}
            onTitleChange={setCardComposerTitle}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
