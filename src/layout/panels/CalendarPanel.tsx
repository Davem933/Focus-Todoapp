import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CustomDropdown } from "../CustomDropdown";
import type { DropdownOption } from "../CustomDropdown";
import { ProjectCardComposerModal } from "../ProjectCardComposerModal";
import { loadProjectColumns, loadProjectsForTeams } from "../../supabase/projectApi";
import { loadTeamMembers } from "../../supabase/teamApi";
import type { Project, ProjectColumn } from "../../projects/projectTypes";
import type { Team, TeamMember } from "../../teams/teamTypes";
import type { Task, TaskPriority, TaskSubtask, TaskUpdate } from "../../tasks/taskTypes";
import { getTodayDateValue } from "../../tasks/dateUtils";
import { createEntityId } from "../../tasks/idUtils";
import { appendCardLabelValue, createCardLabels } from "../../tasks/cardLabels";
import {
  CZECH_MONTH_NAMES,
  CZECH_WEEKDAY_LABELS,
  getAdjacentYearMonth,
  getCurrentYearMonth,
  getMonthMatrix,
  groupTaskIdsByDueDate,
} from "../../calendar/calendarUtils";

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

  const [projectMembers, setProjectMembers] = useState<TeamMember[]>([]);
  const [projectColumns, setProjectColumns] = useState<ProjectColumn[]>([]);
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

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  function goToPreviousMonth() {
    setYearMonth((current) => getAdjacentYearMonth(current.year, current.month, -1));
  }

  function goToNextMonth() {
    setYearMonth((current) => getAdjacentYearMonth(current.year, current.month, 1));
  }

  function goToToday() {
    setYearMonth(getCurrentYearMonth());
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

  const taskIdsByDueDate = useMemo(() => {
    if (!selectedProjectId) {
      return new Map<string, string[]>();
    }

    const projectTasks = tasks.filter((task) => task.projectId === selectedProjectId);

    return groupTaskIdsByDueDate(projectTasks);
  }, [tasks, selectedProjectId]);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const composerColumn = projectColumns.find((column) => column.key === cardComposerColumnKey) ?? null;

  function resetCardComposer() {
    setCardComposerTaskId(null);
    setCardComposerColumnKey(null);
    setCardComposerTitle("");
    setCardComposerNote("");
    setCardComposerPriority("none");
    setCardComposerDueDate("");
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
    setCardComposerLabels(task.labels.map((label) => label.name).join(", "));
    setCardComposerAssigneeId(task.assigneeId ?? "");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks(task.subtasks.map((subtask) => ({ ...subtask })));
  }

  function handleAddTask(date: string) {
    if (projectColumns.length === 0) {
      return;
    }

    setCardComposerTaskId(null);
    setCardComposerColumnKey(projectColumns[0].key);
    setCardComposerTitle("");
    setCardComposerNote("");
    setCardComposerPriority("none");
    setCardComposerDueDate(date);
    setCardComposerLabels("");
    setCardComposerLabelInput("");
    setCardComposerAssigneeId("");
    setCardComposerSubtaskTitle("");
    setCardComposerSubtasks([]);
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
        <div className="calendar-panel__nav">
          <button
            className="calendar-panel__nav-button"
            type="button"
            aria-label="Předchozí měsíc"
            onClick={goToPreviousMonth}
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <h2 className="calendar-panel__title">
            {CZECH_MONTH_NAMES[month - 1]} {year}
          </h2>
          <button
            className="calendar-panel__nav-button"
            type="button"
            aria-label="Následující měsíc"
            onClick={goToNextMonth}
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
          <button className="calendar-panel__today-button" type="button" onClick={goToToday}>
            Dnes
          </button>
        </div>
      </header>

      {error ? <p className="calendar-panel__error">{error}</p> : null}

      {!selectedProjectId ? (
        <p className="calendar-panel__empty">Vyber nástěnku pro zobrazení úkolů.</p>
      ) : (
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
