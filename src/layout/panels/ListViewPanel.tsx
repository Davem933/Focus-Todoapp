import { useEffect, useMemo, useRef, useState } from "react";
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
import { generateSubtasksWithGroq } from "../../tasks/groqService";
import { Toast } from "../../components/Toast";
import { CustomDropdown } from "../CustomDropdown";
import { ProjectCardComposerModal } from "../ProjectCardComposerModal";
import { classifyColumnState } from "./table/tableStatus";
import { CustomColumnModal } from "./table/CustomColumnModal";
import { useProjectViewFilters } from "./shared/useProjectViewFilters";
import { ListToolbar } from "./list/ListToolbar";
import { ListGroup } from "./list/ListGroup";

type ListViewPanelProps = {
  teams: Team[];
  activeTeamId: string | null;
  tasks: Task[];
  currentUserId: string | null;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onUpdateTaskShareToken: (taskId: string, token: string | null) => void;
  onCreateTaskForBoard: (projectId: string, boardColumnKey?: string) => void;
  initialPriorityFilter?: TaskPriority | null;
  onInitialPriorityFilterHandled?: () => void;
};

export function ListViewPanel({
  teams,
  activeTeamId,
  tasks,
  onUpdateTask,
  onUpdateTaskShareToken,
  onCreateTaskForBoard,
  initialPriorityFilter,
  onInitialPriorityFilterHandled,
}: ListViewPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [customColumns, setCustomColumns] = useState<ProjectCustomColumn[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<TaskCustomFieldValue[]>([]);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);

  const [closedVisible, setClosedVisible] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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
  const [isGeneratingCardSubtasks, setIsGeneratingCardSubtasks] = useState(false);
  const [cardSubtaskAiError, setCardSubtaskAiError] = useState<string | null>(null);

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
    const tasksForBoard = tasks.filter((task) => task.projectId === selectedProjectId);
    return tasksForBoard.slice().reverse();
  }, [tasks, selectedProjectId]);

  const {
    assigneeFilter,
    toggleAssigneeFilter,
    priorityFilter,
    togglePriorityFilter,
    dueFilter,
    setDueFilter,
    searchQuery,
    setSearchQuery,
    filteredTasks,
  } = useProjectViewFilters(boardTasks);

  const appliedPriorityFilterRef = useRef<TaskPriority | null>(null);

  useEffect(() => {
    if (!initialPriorityFilter || appliedPriorityFilterRef.current === initialPriorityFilter) {
      return;
    }

    appliedPriorityFilterRef.current = initialPriorityFilter;
    togglePriorityFilter(initialPriorityFilter);
    onInitialPriorityFilterHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPriorityFilter]);

  const sortedColumns = useMemo(() => columns.slice().sort((a, b) => a.position - b.position), [columns]);

  const groups = useMemo(() => {
    const visibleColumns = sortedColumns.filter(
      (column) => closedVisible || classifyColumnState(column.key, columns) !== "done",
    );
    const knownKeys = new Set(sortedColumns.map((column) => column.key));
    const baseGroups = visibleColumns.map((column) => ({
      column,
      tasks: filteredTasks.filter((task) => task.boardColumnKey === column.key),
    }));

    const orphanedTasks = filteredTasks.filter((task) => !knownKeys.has(task.boardColumnKey));

    if (orphanedTasks.length === 0) {
      return baseGroups;
    }

    const uncategorizedColumn: ProjectColumn = {
      id: "__uncategorized",
      projectId: selectedProjectId ?? "",
      key: "__uncategorized",
      title: "Nezařazeno",
      position: Number.MAX_SAFE_INTEGER,
      createdAt: "",
      updatedAt: "",
    };

    return [...baseGroups, { column: uncategorizedColumn, tasks: orphanedTasks }];
  }, [sortedColumns, columns, filteredTasks, closedVisible, selectedProjectId]);

  function toggleGroupCollapsed(columnKey: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  }

  function handleToggleSubtask(taskId: string, subtaskId: string) {
    const task = boardTasks.find((entry) => entry.id === taskId);

    if (!task) {
      return;
    }

    onUpdateTask(taskId, {
      subtasks: task.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask,
      ),
    });
  }

  async function handleAddCustomColumn(
    title: string,
    fieldType: "text" | "select",
    options: { value: string; label: string }[],
  ) {
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
    setCardSubtaskAiError(null);
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

  async function handleGenerateComposerSubtasks() {
    if (!cardComposerTitle.trim() || isGeneratingCardSubtasks) {
      return;
    }

    setIsGeneratingCardSubtasks(true);

    try {
      const generatedTitles = await generateSubtasksWithGroq(cardComposerTitle, cardComposerNote);
      const newSubtasks: TaskSubtask[] = generatedTitles.map((title) => ({
        id: createEntityId(),
        title,
        completed: false,
      }));

      setCardComposerSubtasks((current) => [...current, ...newSubtasks]);
    } catch {
      setCardSubtaskAiError("Nepodařilo se vygenerovat podúkoly. Zkuste to prosím znovu.");
    } finally {
      setIsGeneratingCardSubtasks(false);
    }
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
        <h2>Seznam</h2>
        <p>Tento tym zatim nema zadnou nastenku. Vytvorte ji v prehledu projektu.</p>
      </div>
    );
  }

  const canAddCustomColumn = customColumns.length < MAX_CUSTOM_COLUMNS_PER_PROJECT;

  return (
    <div className="app-panel list-view-panel">
      <div className="list-view-panel__header">
        <CustomDropdown
          className="table-view-panel__board-select"
          value={selectedProjectId ?? ""}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
          onChange={setSelectedProjectId}
          ariaLabel="Vyber nastenky"
        />
      </div>
      <ListToolbar
        members={members}
        closedVisible={closedVisible}
        onToggleClosedVisible={() => setClosedVisible((current) => !current)}
        assigneeFilter={assigneeFilter}
        onToggleAssigneeFilter={toggleAssigneeFilter}
        priorityFilter={priorityFilter}
        onTogglePriorityFilter={togglePriorityFilter}
        dueFilter={dueFilter}
        onDueFilterChange={setDueFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onAddTask={() => {
          if (!selectedProjectId || sortedColumns.length === 0) {
            return;
          }

          onCreateTaskForBoard(selectedProjectId, sortedColumns[0].key);
        }}
      />
      {groups.length === 0 ? (
        <div className="app-panel view-placeholder">
          <p>Tato nastenka zatim nema zadne sloupce nebo ukoly k zobrazeni.</p>
        </div>
      ) : null}
      <div className="list-view-panel__groups">
        {groups.map(({ column, tasks: groupTasks }) => (
          <ListGroup
            key={column.id}
            column={column}
            tasks={groupTasks}
            columns={columns}
            members={members}
            customColumns={customColumns}
            customFieldValues={customFieldValues}
            subtasksVisible
            isCollapsed={collapsedGroups.has(column.key)}
            canAddCustomColumn={canAddCustomColumn}
            onToggleCollapsed={toggleGroupCollapsed}
            onUpdateTask={onUpdateTask}
            onSetCustomFieldValue={handleSetCustomFieldValue}
            onOpenTask={handleOpenTaskInComposer}
            onToggleSubtask={handleToggleSubtask}
            onAddTask={(columnKey) => {
              if (!selectedProjectId) {
                return;
              }

              const targetColumnKey =
                columnKey === "__uncategorized" && sortedColumns.length > 0 ? sortedColumns[0].key : columnKey;
              onCreateTaskForBoard(selectedProjectId, targetColumnKey);
            }}
            onOpenAddColumn={() => setIsAddColumnOpen(true)}
          />
        ))}
      </div>
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
            isGeneratingSubtasks={isGeneratingCardSubtasks}
            members={members}
            note={cardComposerNote}
            priority={cardComposerPriority}
            projectName={projects.find((project) => project.id === selectedProjectId)?.name ?? ""}
            subtaskTitle={cardComposerSubtaskTitle}
            subtasks={cardComposerSubtasks}
            taskId={cardComposerTaskId}
            shareToken={tasks.find((task) => task.id === cardComposerTaskId)?.shareToken ?? null}
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
            onGenerateSubtasks={handleGenerateComposerSubtasks}
            onShareTokenChange={onUpdateTaskShareToken}
            onSubtaskTitleChange={setCardComposerSubtaskTitle}
            onSubmit={handleSubmitComposer}
            onToggleSubtask={handleToggleComposerSubtask}
            onTitleChange={setCardComposerTitle}
          />
        ) : null}
      </AnimatePresence>
      {cardSubtaskAiError ? (
        <Toast message={cardSubtaskAiError} onDismiss={() => setCardSubtaskAiError(null)} />
      ) : null}
    </div>
  );
}
