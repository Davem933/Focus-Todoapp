import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  FolderOpen,
  Plus,
  Repeat,
  Star,
  UserRound,
} from "lucide-react";
import type { CSSProperties, ChangeEvent, FormEvent, KeyboardEvent, MouseEvent } from "react";
import { CustomDropdown } from "../CustomDropdown";
import type { DropdownOption } from "../CustomDropdown";
import { getTodayDateValue } from "../../tasks/dateUtils";
import type {
  Task,
  TaskLabel,
  TaskList,
  TaskPriority,
  TaskRecurrence,
  TaskSubtask,
  TaskUpdate,
} from "../../tasks/taskTypes";
import type { TeamMember } from "../../teams/teamTypes";
import { loadTeamMembers } from "../../supabase/teamApi";

type DetailPanelProps = {
  task: Task | null;
  lists: TaskList[];
  canDeleteTask: boolean;
  onClose: () => void;
  onUpdateTask: (taskId: string, update: TaskUpdate) => void;
  onArchiveTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
};

const PRIORITY_OPTIONS: TaskPriority[] = ["none", "low", "medium", "high"];
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "Žádná",
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
};

const RECURRENCE_OPTIONS: TaskRecurrence[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
];
const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  none: "Neopakovat",
  daily: "Denně",
  weekly: "Týdně",
  monthly: "Měsíčně",
};

const LABEL_COLORS = [
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
];

type NativePickerInput = HTMLInputElement & {
  showPicker?: () => void;
};

function getTeamMemberDisplayName(member: TeamMember) {
  const [name] = member.email.split("@");
  return name || member.email;
}

export function DetailPanel({
  task,
  lists,
  canDeleteTask,
  onClose,
  onUpdateTask,
  onArchiveTask,
  onDeleteTask,
  onStartFocus,
}: DetailPanelProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task?.title ?? "");
  const [draftNote, setDraftNote] = useState(task?.note ?? "");
  const [newLabelName, setNewLabelName] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const isCommittingSubtaskRef = useRef(false);
  const mobileNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const currentTaskId = task?.id ?? null;
  const currentTaskTeamId = task?.teamId ?? null;

  useEffect(() => {
    let isCancelled = false;

    if (!currentTaskTeamId) {
      setTeamMembers([]);
      return () => {
        isCancelled = true;
      };
    }

    const teamId = currentTaskTeamId;

    async function loadMembers() {
      try {
        const members = await loadTeamMembers(teamId);

        if (!isCancelled) {
          setTeamMembers(members);
        }
      } catch {
        if (!isCancelled) {
          setTeamMembers([]);
        }
      }
    }

    void loadMembers();

    return () => {
      isCancelled = true;
    };
  }, [currentTaskTeamId]);

  useEffect(() => {
    setIsActionMenuOpen(false);
    setIsAddingSubtask(false);
    setIsEditingNote(false);
    setIsEditingTitle(false);
    setIsAddingLabel(false);
    setDraftTitle(task?.title ?? "");
    setDraftNote(task?.note ?? "");
    setNewLabelName("");
  }, [currentTaskId]);

  useEffect(() => {
    if (isEditingNote) {
      mobileNoteTextareaRef.current?.focus();
    }
  }, [isEditingNote]);

  useEffect(() => {
    if (isAddingLabel) {
      labelInputRef.current?.focus();
    }
  }, [isAddingLabel]);

  if (!task) {
    return (
      <section className="app-panel app-panel--detail" aria-label="Detail úkolu">
        <h2>Detail úkolu</h2>
        <p>Vybraný úkol se nepodařilo najít.</p>
        <button type="button" onClick={onClose}>
          Zavřít detail
        </button>
      </section>
    );
  }

  const activeTask = task;
  const targetLists = lists.filter((list) => !list.isSystem && !list.isArchived);
  const currentList = lists.find((list) => list.id === activeTask.listId);
  const canSelectCurrentList = targetLists.some(
    (list) => list.id === activeTask.listId,
  );
  const completedSubtasks = activeTask.subtasks.filter(
    (subtask) => subtask.completed,
  );
  const visibleLabels = activeTask.labels.slice(0, 3);
  const hiddenLabelCount = Math.max(activeTask.labels.length - visibleLabels.length, 0);
  const priorityOptions: DropdownOption[] = PRIORITY_OPTIONS.map((priority) => ({
    value: priority,
    label: PRIORITY_LABELS[priority],
  }));
  const recurrenceOptions: DropdownOption[] = RECURRENCE_OPTIONS.map(
    (recurrence) => ({
      value: recurrence,
      label: RECURRENCE_LABELS[recurrence],
    }),
  );
  const assigneeOptions: DropdownOption[] = [
    { value: "", label: "Nepřiřazeno" },
    ...teamMembers.map((member) => ({
      value: member.userId,
      label: getTeamMemberDisplayName(member),
    })),
  ];
  const listOptions: DropdownOption[] = [
    ...(!canSelectCurrentList
      ? [
          {
            value: "",
            label: currentList ? `${currentList.name} (systémový)` : "Bez seznamu",
            disabled: true,
          },
        ]
      : []),
    ...targetLists.map((list) => ({
      value: list.id,
      label: list.name,
    })),
  ];

  function handleCommitNewSubtask() {
    if (isCommittingSubtaskRef.current) {
      return;
    }

    isCommittingSubtaskRef.current = true;

    const trimmedTitle = newSubtaskTitle.trim();

    if (!trimmedTitle || !task) {
      setNewSubtaskTitle("");
      setIsAddingSubtask(false);
      window.setTimeout(() => {
        isCommittingSubtaskRef.current = false;
      }, 0);
      return;
    }

    onUpdateTask(activeTask.id, {
      subtasks: [
        ...activeTask.subtasks,
        {
          id: `subtask-${Date.now()}`,
          title: trimmedTitle,
          completed: false,
        },
      ],
    });
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
    window.setTimeout(() => {
      isCommittingSubtaskRef.current = false;
    }, 0);
  }

  function handleAddSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleCommitNewSubtask();
  }

  function getSubtaskUpdate(subtasks: TaskSubtask[]): TaskUpdate {
    const areAllSubtasksCompleted =
      subtasks.length > 0 && subtasks.every((subtask) => subtask.completed);

    return {
      subtasks,
      completed: areAllSubtasksCompleted
        ? true
        : activeTask.subtasks.length > 0
          ? false
          : activeTask.completed,
    };
  }

  function handleToggleSubtask(subtaskId: string, completed: boolean) {
    if (!task) {
      return;
    }

    const subtasks = activeTask.subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, completed } : subtask,
    );

    onUpdateTask(activeTask.id, getSubtaskUpdate(subtasks));
  }

  function handleStartEditingSubtask(subtask: TaskSubtask) {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  }

  function handleCommitSubtaskEdit() {
    if (!editingSubtaskId) {
      return;
    }

    const trimmedTitle = editingSubtaskTitle.trim();

    if (trimmedTitle) {
      onUpdateTask(activeTask.id, {
        subtasks: activeTask.subtasks.map((subtask) =>
          subtask.id === editingSubtaskId
            ? { ...subtask, title: trimmedTitle }
            : subtask,
        ),
      });
    }

    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  }

  function handleCancelSubtaskEdit() {
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  }

  function handleSubtaskEditKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCommitSubtaskEdit();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelSubtaskEdit();
    }
  }

  function handleDeleteSubtask(subtaskId: string) {
    const subtasks = activeTask.subtasks.filter(
      (subtask) => subtask.id !== subtaskId,
    );

    if (editingSubtaskId === subtaskId) {
      handleCancelSubtaskEdit();
    }

    onUpdateTask(activeTask.id, getSubtaskUpdate(subtasks));
  }

  function handleAddSubtaskKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setNewSubtaskTitle("");
      setIsAddingSubtask(false);
    }
  }

  function handleNativePickerClick(event: MouseEvent<HTMLInputElement>) {
    try {
      (event.currentTarget as NativePickerInput).showPicker?.();
    } catch {
      // Some browsers expose showPicker but reject it in edge cases.
    }
  }

  function handleCommitTitleEdit() {
    if (!task) {
      return;
    }

    const trimmedTitle = draftTitle.trim();

    if (trimmedTitle && trimmedTitle !== task.title) {
      onUpdateTask(task.id, { title: trimmedTitle });
    } else {
      setDraftTitle(task.title);
    }

    setIsEditingTitle(false);
  }

  function handleTitleEditKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCommitTitleEdit();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setDraftTitle(activeTask.title);
      setIsEditingTitle(false);
    }
  }

  function handleOpenNoteEditor() {
    setDraftNote(activeTask.note ?? "");
    setIsEditingNote(true);
    setIsAddingSubtask(false);
  }

  function handleNoteChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextNote = event.currentTarget.value;
    setDraftNote(nextNote);
    onUpdateTask(activeTask.id, { note: nextNote });
  }

  function handleCloseNoteEditor() {
    onUpdateTask(activeTask.id, { note: draftNote });
    setIsEditingNote(false);
  }

  function handleNoteKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCloseNoteEditor();
    }
  }

  function handleMenuAction(action: () => void) {
    setIsActionMenuOpen(false);
    action();
  }

  function getNextLabelColor(name: string) {
    const seed = name
      .trim()
      .toLowerCase()
      .split("")
      .reduce((sum, character) => sum + character.charCodeAt(0), 0);

    return LABEL_COLORS[seed % LABEL_COLORS.length];
  }

  function handleCommitLabel() {
    if (!task) {
      return;
    }

    const trimmedName = newLabelName.trim().replace(/\s+/g, " ");

    if (!trimmedName) {
      setNewLabelName("");
      setIsAddingLabel(false);
      return;
    }

    const normalizedName = trimmedName.toLocaleLowerCase("cs-CZ");
    const existingLabels = activeTask.labels.filter(
      (label) => label.name.toLocaleLowerCase("cs-CZ") !== normalizedName,
    );

    if (existingLabels.length >= 5) {
      setNewLabelName("");
      setIsAddingLabel(false);
      return;
    }

    const nextLabel: TaskLabel = {
      id: `label-${Date.now()}`,
      name: trimmedName,
      color: getNextLabelColor(trimmedName),
    };

    onUpdateTask(activeTask.id, {
      labels: [...existingLabels, nextLabel],
    });
    setNewLabelName("");
    setIsAddingLabel(false);
  }

  function handleLabelKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCommitLabel();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setNewLabelName("");
      setIsAddingLabel(false);
    }
  }

  function renderSubtaskTitle(subtask: TaskSubtask) {
    if (editingSubtaskId === subtask.id) {
      return (
        <input
          aria-label={`Upravit podúkol ${subtask.title}`}
          autoFocus
          className="subtask-row__edit"
          value={editingSubtaskTitle}
          onBlur={handleCommitSubtaskEdit}
          onChange={(event) => setEditingSubtaskTitle(event.currentTarget.value)}
          onKeyDown={handleSubtaskEditKeyDown}
        />
      );
    }

    return (
      <button
        className="subtask-row__title"
        type="button"
        onClick={() => handleStartEditingSubtask(subtask)}
      >
        {subtask.title}
      </button>
    );
  }

  return (
    <section className="app-panel app-panel--detail" aria-label="Detail úkolu">
      <div className="detail-panel__header">
        <div className="detail-panel__mobile-topbar">
          <button
            className="detail-panel__mobile-back"
            type="button"
            aria-label="Zpět na seznam"
            onClick={onClose}
          >
            <span aria-hidden="true">←</span>
          </button>
          <div className="detail-panel__mobile-title-group">
            <input
              aria-label={
                task.completed
                  ? "Označit úkol jako otevřený"
                  : "Označit úkol jako dokončený"
              }
              checked={task.completed}
              type="checkbox"
              onChange={(event) =>
                onUpdateTask(task.id, {
                  completed: event.currentTarget.checked,
                })
              }
            />
            {isEditingTitle ? (
              <input
                aria-label="Upravit název úkolu"
                autoFocus
                className="detail-panel__mobile-title-input"
                value={draftTitle}
                onBlur={handleCommitTitleEdit}
                onChange={(event) => setDraftTitle(event.currentTarget.value)}
                onKeyDown={handleTitleEditKeyDown}
              />
            ) : (
              <button
                className="detail-panel__mobile-title"
                type="button"
                onClick={() => setIsEditingTitle(true)}
              >
                {task.title || "Bez názvu"}
              </button>
            )}
          </div>
          <button
            className="detail-panel__mobile-focus"
            type="button"
            onClick={() => onStartFocus(task.id)}
          >
            <span className="detail-panel__mobile-focus-label detail-panel__mobile-focus-label--full">
              Soustředit se
            </span>
            <span className="detail-panel__mobile-focus-label detail-panel__mobile-focus-label--short">
              Soustředit
            </span>
          </button>
          <div className="detail-panel__mobile-menu">
            <button
              className="detail-panel__mobile-menu-button"
              type="button"
              aria-label="Další akce"
              aria-expanded={isActionMenuOpen}
              onClick={() => setIsActionMenuOpen((isOpen) => !isOpen)}
            >
              <span aria-hidden="true">⋯</span>
            </button>
            {isActionMenuOpen ? (
              <div className="detail-panel__mobile-menu-content" role="menu">
                <button disabled type="button" role="menuitem">
                  Duplikovat
                </button>
                {!task.isArchived ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      handleMenuAction(() => onArchiveTask(task.id))
                    }
                  >
                    Archivovat
                  </button>
                ) : null}
                {canDeleteTask ? (
                  <button
                    className="detail-panel__mobile-menu-danger"
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      handleMenuAction(() => onDeleteTask(task.id))
                    }
                  >
                    Smazat
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="detail-panel__left">
          <button
            className="detail-panel__back-button"
            type="button"
            aria-label="Zpět na seznam"
            title="Zpět na seznam"
            onClick={onClose}
          >
            <span aria-hidden="true">←</span>
          </button>
          <div className="detail-panel__title-area">
            <p className="detail-panel__eyebrow">Detail úkolu</p>
            <label className="detail-panel__title-row">
              <input
                aria-label={
                  task.completed
                    ? "Označit úkol jako otevřený"
                    : "Označit úkol jako dokončený"
                }
                checked={task.completed}
                type="checkbox"
                onChange={(event) =>
                  onUpdateTask(task.id, { completed: event.currentTarget.checked })
                }
              />
              {isEditingTitle ? (
                <input
                  aria-label="Upravit název úkolu"
                  autoFocus
                  className="detail-panel__title-input"
                  value={draftTitle}
                  onBlur={handleCommitTitleEdit}
                  onChange={(event) => setDraftTitle(event.currentTarget.value)}
                  onKeyDown={handleTitleEditKeyDown}
                />
              ) : (
                <button
                  className="detail-panel__title-button"
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {task.title || "Bez názvu"}
                </button>
              )}
            </label>
            <button
              className="detail-panel__focus-cta"
              type="button"
              onClick={() => onStartFocus(task.id)}
            >
              Soustředit se
            </button>
          </div>
        </div>
        <div className="detail-panel__actions">
          <button type="button" onClick={() => onStartFocus(task.id)}>
            Soustředit se
          </button>
          <div className="detail-panel__desktop-menu">
            <button
              className="detail-panel__menu-button"
              type="button"
              aria-label="Další akce"
              aria-expanded={isActionMenuOpen}
              onClick={() => setIsActionMenuOpen((isOpen) => !isOpen)}
            >
              <span aria-hidden="true">⋯</span>
            </button>
            {isActionMenuOpen ? (
              <div className="detail-panel__menu-content" role="menu">
                <button disabled type="button" role="menuitem">
                  Duplikovat
                </button>
                {!task.isArchived ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleMenuAction(() => onArchiveTask(task.id))}
                  >
                    Archivovat
                  </button>
                ) : null}
                {canDeleteTask ? (
                  <button
                    className="detail-panel__menu-danger"
                    type="button"
                    role="menuitem"
                    onClick={() => handleMenuAction(() => onDeleteTask(task.id))}
                  >
                    Smazat
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="detail-panel__labels" data-empty={activeTask.labels.length === 0}>
        {visibleLabels.map((label) => (
          <span
            className="task-label-chip"
            key={label.id}
            style={
              {
                "--label-color": label.color,
              } as CSSProperties
            }
          >
            {label.name}
          </span>
        ))}
        {hiddenLabelCount > 0 ? (
          <span className="task-label-chip task-label-chip--more">
            +{hiddenLabelCount}
          </span>
        ) : null}
        {!isAddingLabel ? (
          <button
            className="task-label-add"
            type="button"
            disabled={activeTask.labels.length >= 5}
            onClick={() => setIsAddingLabel(true)}
          >
            + Přidat štítek
          </button>
        ) : (
          <input
            ref={labelInputRef}
            aria-label="Název štítku"
            className="task-label-input"
            maxLength={24}
            placeholder="Nový štítek"
            value={newLabelName}
            onBlur={handleCommitLabel}
            onChange={(event) => setNewLabelName(event.currentTarget.value)}
            onKeyDown={handleLabelKeyDown}
          />
        )}
      </div>

      <div className="detail-panel__workspace">
        <div className="detail-panel__desktop-grid">
          <section
            className="detail-section detail-section--subtasks"
            data-editing={isAddingSubtask}
            data-empty={task.subtasks.length === 0}
          >
            <div className="detail-section__header">
              <h3>Podúkoly</h3>
              {task.subtasks.length > 0 ? (
                <span>
                  {completedSubtasks.length} / {task.subtasks.length} dokončeno
                </span>
              ) : null}
            </div>
            {task.subtasks.length > 0 ? (
              <div className="subtask-list">
                {task.subtasks.map((subtask) => (
                  <div
                    className="subtask-row"
                    data-completed={subtask.completed}
                    key={subtask.id}
                  >
                    <input
                      checked={subtask.completed}
                      type="checkbox"
                      onChange={(event) =>
                        handleToggleSubtask(
                          subtask.id,
                          event.currentTarget.checked,
                        )
                      }
                    />
                    {renderSubtaskTitle(subtask)}
                    <button
                      aria-label={`Smazat podúkol ${subtask.title}`}
                      className="subtask-row__delete"
                      type="button"
                      onClick={() => handleDeleteSubtask(subtask.id)}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {!isAddingSubtask ? (
              <button
                className="detail-mobile-add detail-mobile-add--subtask"
                type="button"
                onClick={() => {
                  setIsAddingSubtask(true);
                  setIsEditingNote(false);
                }}
              >
                <span className="detail-row-icon" aria-hidden="true">
                  <Plus size={16} strokeWidth={1.9} />
                </span>
                <span>
                  {task.subtasks.length > 0
                    ? "Přidat další podúkol"
                    : "Přidat podúkol"}
                </span>
              </button>
            ) : null}
            {isAddingSubtask ? (
              <form
                className="subtask-composer"
                data-mobile-visible={isAddingSubtask}
                onSubmit={handleAddSubtask}
              >
                <input
                  aria-label="Nový podúkol"
                  autoFocus={isAddingSubtask}
                  placeholder="Nový podúkol..."
                  value={newSubtaskTitle}
                  onBlur={handleCommitNewSubtask}
                  onChange={(event) => setNewSubtaskTitle(event.currentTarget.value)}
                  onKeyDown={handleAddSubtaskKeyDown}
                />
              </form>
            ) : null}
          </section>

          <section className="detail-section detail-section--organization">
            <div className="detail-section__header">
              <h3>Organizace</h3>
            </div>
            <div className="date-time-fields">
              <label className="field date-time-field" data-has-value={Boolean(task.dueDate)}>
                <span className="detail-row-icon detail-row-icon--date" aria-hidden="true">
                  <CalendarDays size={16} strokeWidth={1.9} />
                </span>
                <span>Termín</span>
                <input
                  aria-label="Termín"
                  className="date-time-field__input"
                  type="date"
                  value={task.dueDate ?? ""}
                  onClick={handleNativePickerClick}
                  onChange={(event) =>
                    onUpdateTask(task.id, {
                      dueDate: event.currentTarget.value || null,
                      dueTime: event.currentTarget.value ? task.dueTime : null,
                    })
                  }
                />
              </label>

              <label className="field date-time-field" data-has-value={Boolean(task.dueTime)}>
                <span className="detail-row-icon detail-row-icon--time" aria-hidden="true">
                  <Clock3 size={16} strokeWidth={1.9} />
                </span>
                <span>Čas</span>
                <input
                  aria-label="Čas"
                  className="date-time-field__input"
                  type="time"
                  value={task.dueTime ?? ""}
                  onClick={handleNativePickerClick}
                  onChange={(event) =>
                    onUpdateTask(task.id, {
                      dueDate:
                        event.currentTarget.value && !task.dueDate
                          ? getTodayDateValue()
                          : task.dueDate,
                      dueTime: event.currentTarget.value || null,
                    })
                  }
                />
              </label>
            </div>

            <label className="field" data-has-value={task.recurrence !== "none"}>
              <span className="detail-row-icon detail-row-icon--recurrence" aria-hidden="true">
                <Repeat size={16} strokeWidth={1.9} />
              </span>
              <span>Opakování</span>
              <CustomDropdown
                ariaLabel="Opakování"
                options={recurrenceOptions}
                value={task.recurrence}
                onChange={(nextValue) =>
                  onUpdateTask(task.id, {
                    recurrence: nextValue as TaskRecurrence,
                  })
                }
              />
            </label>

            {task.teamId ? (
              <label className="field" data-has-value={Boolean(task.assigneeId)}>
                <span className="detail-row-icon detail-row-icon--assignee" aria-hidden="true">
                  <UserRound size={16} strokeWidth={1.9} />
                </span>
                <span>Přiřazeno</span>
                <CustomDropdown
                  ariaLabel="Přiřazeno komu"
                  disabled={teamMembers.length === 0}
                  options={assigneeOptions}
                  value={task.assigneeId ?? ""}
                  onChange={(nextValue) =>
                    onUpdateTask(task.id, {
                      assigneeId: nextValue || null,
                    })
                  }
                />
              </label>
            ) : null}


            <label className="field" data-has-value={task.priority !== "none"}>
              <span className="detail-row-icon detail-row-icon--priority" aria-hidden="true">
                <Star size={16} strokeWidth={1.9} />
              </span>
              <span>Priorita</span>
              <CustomDropdown
                ariaLabel="Priorita"
                options={priorityOptions}
                value={task.priority}
                onChange={(nextValue) =>
                  onUpdateTask(task.id, {
                    priority: nextValue as TaskPriority,
                  })
                }
              />
            </label>

            <label className="field" data-has-value="true">
              <span className="detail-row-icon detail-row-icon--list" aria-hidden="true">
                <FolderOpen size={16} strokeWidth={1.9} />
              </span>
              <span>Přesunout do...</span>
              <CustomDropdown
                ariaLabel="Přesunout do"
                disabled={targetLists.length === 0}
                options={listOptions}
                placeholder="Bez seznamu"
                value={canSelectCurrentList ? task.listId : ""}
                onChange={(nextValue) =>
                  onUpdateTask(task.id, { listId: nextValue })
                }
              />
            </label>
          </section>

          <section
            className="detail-section detail-section--note"
            data-editing={isEditingNote}
            data-empty={!task.note}
          >
            <div className="detail-section__header">
              <h3>Poznámka</h3>
            </div>
            {!task.note && !isEditingNote ? (
              <button
                className="detail-mobile-add detail-mobile-add--note"
                type="button"
                onClick={handleOpenNoteEditor}
              >
                <span className="detail-note-empty-copy">Přidat poznámku...</span>
              </button>
            ) : null}
            {task.note && !isEditingNote ? (
              <button
                className="detail-note-preview"
                type="button"
                onClick={handleOpenNoteEditor}
              >
                <span className="detail-mobile-add__value">
                  {task.note.length > 120
                    ? `${task.note.slice(0, 120)}...`
                    : task.note}
                </span>
              </button>
            ) : null}
            {isEditingNote ? (
              <label className="field detail-note-field detail-note-field--mobile detail-note-field--desktop">
                <span>Obsah poznámky</span>
                <textarea
                  ref={mobileNoteTextareaRef}
                  rows={5}
                  value={draftNote}
                  autoFocus
                  onBlur={handleCloseNoteEditor}
                  onChange={handleNoteChange}
                  onKeyDown={handleNoteKeyDown}
                />
              </label>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}




