import { useState } from "react";
import { ChevronRight, Maximize2 } from "lucide-react";
import type { Task, TaskUpdate } from "../../../tasks/taskTypes";
import type { ProjectColumn } from "../../../projects/projectTypes";
import type { TeamMember } from "../../../teams/teamTypes";
import { getMemberDisplayName } from "../../../teams/teamMemberDisplay";
import type { ProjectCustomColumn, TaskCustomFieldValue } from "../../../tasks/customFieldTypes";
import { CustomDropdown } from "../../CustomDropdown";
import { classifyColumnState } from "../table/tableStatus";
import { StatusBadge } from "../table/StatusBadge";
import { PriorityFlag } from "../table/PriorityFlag";
import { AssigneeAvatar } from "../table/AssigneeAvatar";
import { ListSubtaskRow } from "./ListSubtaskRow";

function formatDueDate(dueDate: string | null): { label: string; isOverdue: boolean } {
  if (!dueDate) {
    return { label: "-", isOverdue: false };
  }

  const [year, month, day] = dueDate.split("-");
  const label = day && month && year ? day + "/" + month + "/" + year.slice(2) : dueDate;
  const isOverdue = new Date(dueDate + "T23:59:59") < new Date();

  return { label, isOverdue };
}

type ListRowProps = {
  task: Task;
  columns: ProjectColumn[];
  members: TeamMember[];
  customColumns: ProjectCustomColumn[];
  customFieldValues: TaskCustomFieldValue[];
  columnCount: number;
  subtasksVisible: boolean;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onSetCustomFieldValue: (taskId: string, columnId: string, value: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
};

export function ListRow({
  task,
  columns,
  members,
  customColumns,
  customFieldValues,
  columnCount,
  subtasksVisible,
  onUpdateTask,
  onSetCustomFieldValue,
  onOpenTask,
  onToggleSubtask,
}: ListRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(task.title);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const status = classifyColumnState(task.boardColumnKey, columns);
  const assignee = members.find((member) => member.userId === task.assigneeId) ?? null;
  const due = formatDueDate(task.dueDate);
  const hasSubtasks = subtasksVisible && task.subtasks.length > 0;

  function commitName() {
    setIsEditingName(false);
    const trimmed = nameDraft.trim();

    if (trimmed && trimmed !== task.title) {
      onUpdateTask(task.id, { title: trimmed });
    } else {
      setNameDraft(task.title);
    }
  }

  return (
    <>
      <tr className="list-row">
        <td className="list-row__col-index">
          <span className="list-row__index-inner">
            {hasSubtasks ? (
              <button
                type="button"
                className="list-row__expand"
                data-expanded={isExpanded}
                onClick={() => setIsExpanded((current) => !current)}
                aria-label={isExpanded ? "Sbalit podukoly" : "Rozbalit podukoly"}
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            ) : null}
            <span className="list-row__status-dot" data-state={status} aria-hidden="true" />
          </span>
        </td>
        <td className="list-row__col-name">
          {isEditingName ? (
            <input
              className="list-row__name-input"
              autoFocus
              value={nameDraft}
              onChange={(event) => setNameDraft(event.currentTarget.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitName();
                } else if (event.key === "Escape") {
                  setNameDraft(task.title);
                  setIsEditingName(false);
                }
              }}
            />
          ) : (
            <button type="button" className="list-row__name-button" onClick={() => setIsEditingName(true)}>
              {task.title}
            </button>
          )}
          <span className="list-row__row-actions">
            <button type="button" onClick={() => onOpenTask(task.id)} aria-label="Otevrit ukol">
              <Maximize2 size={14} aria-hidden="true" />
            </button>
          </span>
        </td>
        <td>
          <CustomDropdown
            className="table-assignee-dropdown"
            value={task.assigneeId ?? ""}
            options={[
              { value: "", label: "Nepriřazeno" },
              ...members.map((member) => ({ value: member.userId, label: getMemberDisplayName(member) })),
            ]}
            onChange={(value) => onUpdateTask(task.id, { assigneeId: value || null })}
            ariaLabel="Reesitel ukolu"
            renderTriggerContent={() => <AssigneeAvatar member={assignee} />}
          />
        </td>
        <td>
          {isEditingDate ? (
            <input
              type="date"
              autoFocus
              value={task.dueDate ?? ""}
              onChange={(event) => {
                onUpdateTask(task.id, { dueDate: event.currentTarget.value || null });
              }}
              onBlur={() => setIsEditingDate(false)}
            />
          ) : (
            <button
              type="button"
              className="list-row__due-date"
              data-overdue={due.isOverdue && !task.completed}
              onClick={() => setIsEditingDate(true)}
            >
              {due.label}
            </button>
          )}
        </td>
        <td>
          <CustomDropdown
            className="table-priority-dropdown"
            value={task.priority}
            options={["none", "low", "medium", "high"].map((priority) => ({ value: priority, label: priority }))}
            onChange={(value) => onUpdateTask(task.id, { priority: value as Task["priority"] })}
            ariaLabel="Priorita ukolu"
            renderTriggerContent={() => <PriorityFlag priority={task.priority} />}
          />
        </td>
        <td>
          <StatusBadge
            columns={columns}
            columnKey={task.boardColumnKey}
            onChange={(columnKey) => onUpdateTask(task.id, { boardColumnKey: columnKey })}
          />
        </td>
        {customColumns.map((column) => {
          const currentValue =
            customFieldValues.find((value) => value.taskId === task.id && value.columnId === column.id)?.value ?? "";

          return (
            <td key={column.id}>
              {column.fieldType === "select" ? (
                <CustomDropdown
                  value={currentValue}
                  options={[{ value: "", label: "-" }, ...column.options]}
                  onChange={(value) => onSetCustomFieldValue(task.id, column.id, value || null)}
                  ariaLabel={column.title}
                />
              ) : (
                <input
                  type="text"
                  defaultValue={currentValue}
                  onBlur={(event) => onSetCustomFieldValue(task.id, column.id, event.currentTarget.value || null)}
                />
              )}
            </td>
          );
        })}
        <td className="list-row__col-add" />
      </tr>
      {hasSubtasks && isExpanded
        ? task.subtasks.map((subtask) => (
            <ListSubtaskRow
              key={subtask.id}
              subtask={subtask}
              columnCount={columnCount}
              onToggle={(subtaskId) => onToggleSubtask(task.id, subtaskId)}
            />
          ))
        : null}
    </>
  );
}
