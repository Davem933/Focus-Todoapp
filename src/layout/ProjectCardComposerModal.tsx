import type { CSSProperties, FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { CustomDropdown } from "./CustomDropdown";
import { createCardLabels } from "../tasks/cardLabels";
import type { TaskPriority, TaskSubtask } from "../tasks/taskTypes";
import {
  BOARD_CARD_PRIORITY_DROPDOWN_OPTIONS,
  BOARD_CARD_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS as BOARD_CARD_PRIORITY_COLORS,
} from "../tasks/taskPriorityColors";
import { getMemberDisplayName, getMemberInitials } from "../teams/teamMemberDisplay";
import type { TeamMember } from "../teams/teamTypes";

export function ProjectCardComposerModal({
  actionLabel,
  assigneeId,
  columnTitle,
  dueDate,
  labelInput,
  labels,
  isEditing,
  members,
  note,
  priority,
  projectName,
  subtaskTitle,
  subtasks,
  title,
  onAddSubtask,
  onAssigneeChange,
  onClose,
  onDueDateChange,
  onLabelInputChange,
  onAddLabel,
  onLabelsChange,
  onNoteChange,
  onPriorityChange,
  onSubtaskTitleChange,
  onSubmit,
  onTitleChange,
  onToggleSubtask,
}: {
  actionLabel: string;
  assigneeId: string;
  columnTitle: string;
  dueDate: string;
  labelInput: string;
  labels: string;
  isEditing: boolean;
  members: TeamMember[];
  note: string;
  priority: TaskPriority;
  projectName: string;
  subtaskTitle: string;
  subtasks: TaskSubtask[];
  title: string;
  onAddSubtask: () => void;
  onAssigneeChange: (value: string) => void;
  onClose: () => void;
  onDueDateChange: (value: string) => void;
  onLabelInputChange: (value: string) => void;
  onAddLabel: (value: string) => void;
  onLabelsChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onPriorityChange: (value: TaskPriority) => void;
  onSubtaskTitleChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  onToggleSubtask: (subtaskId: string) => void;
}) {
  const previewLabels = createCardLabels(labels);
  const prefersReducedMotion = useReducedMotion();

  function fieldMotion(index: number) {
    if (prefersReducedMotion) {
      return {};
    }

    return {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.28, delay: 0.045 * index, ease: [0.16, 1, 0.3, 1] as const },
    };
  }

  return (
    <div className="board-card-modal" role="presentation">
      <motion.button
        className="board-card-modal__backdrop"
        type="button"
        aria-label="Zavřít vytváření karty"
        onClick={onClose}
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.18 }}
      />
      <motion.form
        className="board-card-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-card-modal-title"
        onSubmit={onSubmit}
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.97, y: 10 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }

          const target = event.target as HTMLElement;

          if (
            target instanceof HTMLTextAreaElement ||
            target.getAttribute("data-allow-enter") === "true"
          ) {
            return;
          }

          event.preventDefault();
        }}
      >
        <header className="board-card-modal__header">
          <div>
            <h2 id="board-card-modal-title">{isEditing ? "Upravit kartu" : "Vytvořit kartu"}</h2>
            <p>{isEditing ? "Uprav kartu na nástěnce " + projectName + "." : "Přidej novou kartu do nástěnky " + projectName + "."}</p>
          </div>
          <motion.button
            className="board-card-modal__close"
            type="button"
            aria-label="Zavřít"
            onClick={onClose}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.06, rotate: 90 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
            transition={{ duration: 0.18 }}
          >
            <X size={18} />
          </motion.button>
        </header>

        <div className="board-card-modal__body">
          <motion.label className="board-card-modal__field board-card-modal__field--full" {...fieldMotion(0)}>
            <span>Název karty</span>
            <input
              autoFocus
              maxLength={120}
              placeholder="Např. Implementovat OAuth flow"
              value={title}
              onChange={(event) => onTitleChange(event.currentTarget.value)}
            />
          </motion.label>

          <motion.label className="board-card-modal__field board-card-modal__field--full" {...fieldMotion(1)}>
            <span>Description</span>
            <textarea
              rows={4}
              placeholder="Briefly describe the requirements and scope..."
              value={note}
              onChange={(event) => onNoteChange(event.currentTarget.value)}
            />
          </motion.label>

          <motion.div className="board-card-modal__grid" {...fieldMotion(2)}>
            <div className="board-card-modal__field">
              <span>Priority</span>
              <CustomDropdown
                ariaLabel="Priorita"
                className="board-card-modal__priority-dropdown"
                value={priority}
                options={BOARD_CARD_PRIORITY_DROPDOWN_OPTIONS}
                onChange={(value) => onPriorityChange(value as TaskPriority)}
                renderTriggerContent={(option) => (
                  <span className="board-card-modal__priority-value">
                    <span
                      className="board-card-modal__priority-dot"
                      aria-hidden="true"
                      style={{ "--priority-color": BOARD_CARD_PRIORITY_COLORS[priority] } as CSSProperties}
                    />
                    <span>{option?.label ?? BOARD_CARD_PRIORITY_LABELS.none}</span>
                  </span>
                )}
                renderOptionContent={(option) => (
                  <span className="board-card-modal__priority-value">
                    <span
                      className="board-card-modal__priority-dot"
                      aria-hidden="true"
                      style={{ "--priority-color": BOARD_CARD_PRIORITY_COLORS[option.value as TaskPriority] } as CSSProperties}
                    />
                    <span>{option.label}</span>
                  </span>
                )}
              />
            </div>
            <label className="board-card-modal__field">
              <span>Due date</span>
              <input type="date" value={dueDate} onChange={(event) => onDueDateChange(event.currentTarget.value)} />
            </label>
          </motion.div>

          <motion.label className="board-card-modal__field board-card-modal__field--full" {...fieldMotion(3)}>
            <span>Labels</span>
            <input
              data-allow-enter="true"
              placeholder="UI, Backend, Research"
              value={labelInput}
              onBlur={(event) => {
                if (event.currentTarget.value.trim()) {
                  onAddLabel(event.currentTarget.value);
                }
              }}
              onChange={(event) => onLabelInputChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== ",") {
                  return;
                }

                event.preventDefault();
                onAddLabel(event.currentTarget.value);
              }}
            />
          </motion.label>
          {previewLabels.length > 0 ? (
            <div className="board-card-modal__labels" aria-label="Nahled stitku">
              <AnimatePresence initial={false}>
                {previewLabels.map((label) => (
                  <motion.span
                    key={label.id}
                    style={{ "--label-color": label.color } as CSSProperties}
                    layout
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.16 }}
                  >
                    {label.name}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          ) : null}

          <motion.div className="board-card-modal__field board-card-modal__field--full" {...fieldMotion(4)}>
            <span>Subtasks</span>
            <div className="board-card-modal__subtask-input">
              <input
                data-allow-enter="true"
                placeholder="Add a subtask..."
                value={subtaskTitle}
                onChange={(event) => onSubtaskTitleChange(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onAddSubtask();
                  }
                }}
              />
              <motion.button
                type="button"
                onClick={onAddSubtask}
                disabled={!subtaskTitle.trim()}
                whileTap={prefersReducedMotion || !subtaskTitle.trim() ? undefined : { scale: 0.94 }}
              >
                Add
              </motion.button>
            </div>
            {subtasks.length > 0 ? (
              <div className="board-card-modal__subtasks">
                <AnimatePresence initial={false}>
                  {subtasks.map((subtask) => (
                    <motion.label
                      key={subtask.id}
                      data-completed={subtask.completed ? "true" : "false"}
                      layout
                      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.16 }}
                    >
                      <input
                        type="checkbox"
                        checked={subtask.completed}
                        onChange={() => onToggleSubtask(subtask.id)}
                        aria-label={"Oznacit podukol " + subtask.title}
                      />
                      <span>{subtask.title}</span>
                    </motion.label>
                  ))}
                </AnimatePresence>
              </div>
            ) : null}
          </motion.div>

          <motion.label className="board-card-modal__field board-card-modal__field--full" {...fieldMotion(5)}>
            <span>Assign member</span>
            <select value={assigneeId} onChange={(event) => onAssigneeChange(event.currentTarget.value)}>
              <option value="">Neprirazeno</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {getMemberDisplayName(member)}
                </option>
              ))}
            </select>
          </motion.label>
          <motion.div className="board-card-modal__assignees" aria-label="Clenove tymu" {...fieldMotion(6)}>
            {members.slice(0, 5).map((member) => (
              <motion.button
                key={member.userId}
                type="button"
                title={member.email}
                data-selected={assigneeId === member.userId}
                onClick={() => onAssigneeChange(assigneeId === member.userId ? "" : member.userId)}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
              >
                {getMemberInitials(member)}
              </motion.button>
            ))}
            <small>{columnTitle}</small>
          </motion.div>
        </div>

        <footer className="board-card-modal__footer">
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
          >
            Cancel
          </motion.button>
          <motion.button
            type="submit"
            disabled={!title.trim()}
            whileHover={prefersReducedMotion || !title.trim() ? undefined : { scale: 1.02 }}
            whileTap={prefersReducedMotion || !title.trim() ? undefined : { scale: 0.97 }}
          >
            {actionLabel}
          </motion.button>
        </footer>
      </motion.form>
    </div>
  );
}
