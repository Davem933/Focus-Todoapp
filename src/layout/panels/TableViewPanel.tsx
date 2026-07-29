import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence } from "framer-motion";
import type { Task, TaskPriority, TaskSubtask, TaskUpdate } from "../../tasks/taskTypes";
import type { Project, ProjectColumn } from "../../projects/projectTypes";
import type { Team, TeamMember } from "../../teams/teamTypes";
import type { ProjectCustomColumn, TaskCustomFieldValue } from "../../tasks/customFieldTypes";
import { loadProjectsForTeams, loadProjectColumns } from "../../supabase/projectApi";
import { loadTeamMembers } from "../../supabase/teamApi";
import {
  createCustomColumn,
  loadCustomColumns,
  loadCustomFieldValues,
  setCustomFieldValue,
  MAX_CUSTOM_COLUMNS_PER_PROJECT,
} from "../../supabase/projectCustomColumnApi";
import { createEntityId } from "../../tasks/idUtils";
import { appendCardLabelValue, createCardLabels } from "../../tasks/cardLabels";
import { CustomDropdown } from "../CustomDropdown";
import { ProjectCardComposerModal } from "../ProjectCardComposerModal";
import { TableToolbar } from "./table/TableToolbar";
import type { TableColumnVisibility, TableDueFilter, TableGroupBy } from "./table/TableToolbar";
import { TaskTable } from "./table/TaskTable";
import { CustomColumnModal } from "./table/CustomColumnModal";

type TableViewPanelProps = {
  teams: Team[];
  activeTeamId: string | null;
  tasks: Task[];
  currentUserId: string | null;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onCreateTaskForBoard: (projectId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
};

const DEFAULT_VISIBILITY: TableColumnVisibility = {
  assignee: true,
  status: true,
  dueDate: true,
  priority: true,
  custom: {},
};

export function TableViewPanel({
  teams,
  activeTeamId,
  tasks,
  onUpdateTask,
  onCreateTaskForBoard,
  onDeleteTask,
  canDeleteTask,
}: TableViewPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [customColumns, setCustomColumns] = useState<ProjectCustomColumn[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<TaskCustomFieldValue[]>([]);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);

  const [visibility, setVisibility] = useState<TableColumnVisibility>(DEFAULT_VISIBILITY);
  const [groupBy, setGroupBy] = useState<TableGroupBy>("none");
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<Set<TaskPriority>>(new Set());
  const [dueFilter, setDueFilter] = useState<TableDueFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    if (!activeTeamId) {
      setProjects([]);
      return;
    }

    loadProjectsForTeams([activeTeamId]).then(setProjects).catch(() => setProjects([]));
  }, [activeTeamId]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setColumns([]);
      setCustomColumns([]);
      setCustomFieldValues([]);
      return;
    }

    loadProjectColumns(selectedProjectId).then(setColumns).catch(() => setColumns([]));
    loadCustomColumns(selectedProjectId).then(setCustomColumns).catch(() => setCustomColumns([]));
    loadCustomFieldValues(selectedProjectId).then(setCustomFieldValues).catch(() => setCustomFieldValues([]));
  }, [selectedProjectId]);

  useEffect(() => {
    const project = projects.find((entry) => entry.id === selectedProjectId);

    if (!project) {
      setMembers([]);
      return;
    }

    loadTeamMembers(project.teamId).then(setMembers).catch(() => setMembers([]));
  }, [projects, selectedProjectId]);

  const boardTasks = useMemo(() => {
    // Global task state is newest-first (App.tsx prepends new tasks), but the
    // table should show new tasks at the bottom, so reverse to oldest-first.
    const tasksForBoard = tasks.filter((task) => task.projectId === selectedProjectId);
    return tasksForBoard.slice().reverse();
  }, [tasks, selectedProjectId]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return boardTasks.filter((task) => {
      if (assigneeFilter.size > 0 && (!task.assigneeId || !assigneeFilter.has(task.assigneeId))) {
        return false;
      }

      if (priorityFilter.size > 0 && !priorityFilter.has(task.priority)) {
        return false;
      }

      if (dueFilter === "overdue" && !(task.dueDate && new Date(task.dueDate + "T23:59:59") < new Date() && !task.completed)) {
        return false;
      }

      if (dueFilter === "no_date" && task.dueDate) {
        return false;
      }

      if (query && !task.title.toLowerCase().includes(query)) {
        return false;
      }

      return true;
    });
  }, [boardTasks, assigneeFilter, priorityFilter, dueFilter, searchQuery]);

  function toggleAssigneeFilter(userId: string) {
    setAssigneeFilter((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function togglePriorityFilter(priority: TaskPriority) {
    setPriorityFilter((current) => {
      const next = new Set(current);
      if (next.has(priority)) {
        next.delete(priority);
      } else {
        next.add(priority);
      }
      return next;
    });
  }

  function toggleColumnVisible(key: string) {
    setVisibility((current) => {
      if (key === "assignee" || key === "status" || key === "dueDate" || key === "priority") {
        return { ...current, [key]: !current[key] };
      }

      return { ...current, custom: { ...current.custom, [key]: !(current.custom[key] ?? true) } };
    });
  }

  async function handleAddCustomColumn(title: string, fieldType: "text" | "select", options: { value: string; label: string }[]) {
    if (!selectedProjectId) {
      return;
    }

    const created = await createCustomColumn(selectedProjectId, title, fieldType, options);
    setCustomColumns((current) => [...current, created]);
    setIsAddColumnOpen(false);
  }

  async function handleSetCustomFieldValue(taskId: string, columnId: string, value: string | null) {
    await setCustomFieldValue(taskId, columnId, value);
    setCustomFieldValues((current) => {
      const withoutExisting = current.filter((entry) => !(entry.taskId === taskId && entry.columnId === columnId));
      return [...withoutExisting, { taskId, columnId, value }];
    });
  }

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

  function handleOpenTaskInComposer(taskId: string) {
    const task = boardTasks.find((entry) => entry.id === taskId);

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

  function handleAddComposerSubtask() {
    const title = cardComposerSubtaskTitle.trim();

    if (!title) {
      return;
    }

    setCardComposerSubtasks((current) => [...current, { id: createEntityId(), title, completed: false }]);
    setCardComposerSubtaskTitle("");
  }

  function handleToggleComposerSubtask(subtaskId: string) {
    setCardComposerSubtasks((current) =>
      current.map((subtask) => (subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask)),
    );
  }

  function handleAddComposerLabel(rawValue: string) {
    setCardComposerLabels(appendCardLabelValue(cardComposerLabels, rawValue));
    setCardComposerLabelInput("");
  }

  function handleSubmitComposer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

    if (!cardComposerTaskId || !selectedProject || !cardComposerColumnKey || !cardComposerTitle.trim()) {
      return;
    }

    onUpdateTask(cardComposerTaskId, {
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
    });
    resetCardComposer();
  }

  if (projects.length === 0) {
    return (
      <div className="app-panel view-placeholder">
        <h2>Tabulka</h2>
        <p>Tento tym zatim nema zadnou nastenku. Vytvorte ji v prehledu projektu.</p>
      </div>
    );
  }

  return (
    <div className="app-panel table-view-panel">
      <div className="table-view-panel__header">
        <CustomDropdown
          className="table-view-panel__board-select"
          value={selectedProjectId ?? ""}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
          onChange={setSelectedProjectId}
          ariaLabel="Vyber nastenky"
        />
      </div>
      <TableToolbar
        members={members}
        customColumns={customColumns}
        visibility={visibility}
        onToggleColumnVisible={toggleColumnVisible}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        assigneeFilter={assigneeFilter}
        onToggleAssigneeFilter={toggleAssigneeFilter}
        priorityFilter={priorityFilter}
        onTogglePriorityFilter={togglePriorityFilter}
        dueFilter={dueFilter}
        onDueFilterChange={setDueFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onAddTask={() => selectedProjectId && onCreateTaskForBoard(selectedProjectId)}
      />
      <TaskTable
        tasks={filteredTasks}
        columns={columns}
        members={members}
        customColumns={customColumns}
        customFieldValues={customFieldValues}
        visibility={visibility}
        groupBy={groupBy}
        onUpdateTask={onUpdateTask}
        onSetCustomFieldValue={handleSetCustomFieldValue}
        onOpenTask={handleOpenTaskInComposer}
        onDeleteTask={onDeleteTask}
        canDeleteTask={canDeleteTask}
        canAddCustomColumn={customColumns.length < MAX_CUSTOM_COLUMNS_PER_PROJECT}
        onOpenAddColumn={() => setIsAddColumnOpen(true)}
      />
      {isAddColumnOpen ? (
        <CustomColumnModal onClose={() => setIsAddColumnOpen(false)} onSubmit={handleAddCustomColumn} />
      ) : null}
      <AnimatePresence>
        {cardComposerTaskId && cardComposerColumnKey ? (
          <ProjectCardComposerModal
            actionLabel="Ulozit kartu"
            assigneeId={cardComposerAssigneeId}
            columnTitle={columns.find((column) => column.key === cardComposerColumnKey)?.title ?? "Sloupec"}
            dueDate={cardComposerDueDate}
            labelInput={cardComposerLabelInput}
            labels={cardComposerLabels}
            isEditing
            members={members}
            note={cardComposerNote}
            priority={cardComposerPriority}
            projectName={projects.find((project) => project.id === selectedProjectId)?.name ?? ""}
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
