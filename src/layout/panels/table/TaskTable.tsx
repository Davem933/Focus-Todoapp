import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Task, TaskUpdate } from "../../../tasks/taskTypes";
import type { ProjectColumn } from "../../../projects/projectTypes";
import type { TeamMember } from "../../../teams/teamTypes";
import { getMemberDisplayName } from "../../../teams/teamMemberDisplay";
import type { ProjectCustomColumn, TaskCustomFieldValue } from "../../../tasks/customFieldTypes";
import { CustomDropdown } from "../../CustomDropdown";
import type { TableColumnVisibility, TableGroupBy } from "./TableToolbar";
import { classifyColumnState } from "./tableStatus";
import { StatusBadge } from "./StatusBadge";
import { PriorityFlag } from "./PriorityFlag";
import { AssigneeAvatar } from "./AssigneeAvatar";

type TaskTableProps = {
  tasks: Task[];
  columns: ProjectColumn[];
  members: TeamMember[];
  customColumns: ProjectCustomColumn[];
  customFieldValues: TaskCustomFieldValue[];
  visibility: TableColumnVisibility;
  groupBy: TableGroupBy;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onSetCustomFieldValue: (taskId: string, columnId: string, value: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
};

function formatDueDate(dueDate: string | null): { label: string; isOverdue: boolean } {
  if (!dueDate) {
    return { label: "-", isOverdue: false };
  }

  const [year, month, day] = dueDate.split("-");
  const label = day && month && year ? day + "/" + month + "/" + year.slice(2) : dueDate;
  const isOverdue = new Date(dueDate + "T23:59:59") < new Date();

  return { label, isOverdue };
}

function groupTasks(tasks: Task[], groupBy: TableGroupBy, columns: ProjectColumn[], members: TeamMember[]) {
  if (groupBy === "none") {
    return [{ key: "all", title: null as string | null, tasks }];
  }

  const groups = new Map<string, { title: string; tasks: Task[] }>();

  for (const task of tasks) {
    let key: string;
    let title: string;

    if (groupBy === "status") {
      key = task.boardColumnKey;
      title = columns.find((column) => column.key === task.boardColumnKey)?.title ?? task.boardColumnKey;
    } else if (groupBy === "assignee") {
      key = task.assigneeId ?? "none";
      title = task.assigneeId
        ? getMemberDisplayName(members.find((member) => member.userId === task.assigneeId) ?? { email: task.assigneeId })
        : "Nepriřazeno";
    } else {
      key = task.priority;
      title = task.priority;
    }

    if (!groups.has(key)) {
      groups.set(key, { title, tasks: [] });
    }

    groups.get(key)!.tasks.push(task);
  }

  return Array.from(groups.entries()).map(([key, group]) => ({ key, title: group.title, tasks: group.tasks }));
}

export function TaskTable({
  tasks,
  columns,
  members,
  customColumns,
  customFieldValues,
  visibility,
  groupBy,
  onUpdateTask,
  onSetCustomFieldValue,
  onOpenTask,
  onDeleteTask,
  canDeleteTask,
}: TaskTableProps) {
  const groups = groupTasks(tasks, groupBy, columns, members);
  let rowNumber = 0;

  return (
    <div className="task-table__scroll">
      <table className="task-table">
        <thead>
          <tr>
            <th className="task-table__col-index">#</th>
            <th className="task-table__col-name">Nazev</th>
            {visibility.assignee ? <th>Řešitel</th> : null}
            {visibility.status ? <th>Stav</th> : null}
            {visibility.dueDate ? <th>Termin</th> : null}
            {visibility.priority ? <th>Priorita</th> : null}
            {customColumns
              .filter((column) => visibility.custom[column.id] ?? true)
              .map((column) => (
                <th key={column.id}>{column.title}</th>
              ))}
            <th className="task-table__col-add">+</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <TaskTableGroup
              key={group.key}
              title={group.title}
              tasks={group.tasks}
              columns={columns}
              members={members}
              customColumns={customColumns}
              customFieldValues={customFieldValues}
              visibility={visibility}
              startIndex={(rowNumber += group.tasks.length) - group.tasks.length}
              onUpdateTask={onUpdateTask}
              onSetCustomFieldValue={onSetCustomFieldValue}
              onOpenTask={onOpenTask}
              onDeleteTask={onDeleteTask}
              canDeleteTask={canDeleteTask}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskTableGroup({
  title,
  tasks,
  columns,
  members,
  customColumns,
  customFieldValues,
  visibility,
  startIndex,
  onUpdateTask,
  onSetCustomFieldValue,
  onOpenTask,
  onDeleteTask,
  canDeleteTask,
}: {
  title: string | null;
  tasks: Task[];
  columns: ProjectColumn[];
  members: TeamMember[];
  customColumns: ProjectCustomColumn[];
  customFieldValues: TaskCustomFieldValue[];
  visibility: TableColumnVisibility;
  startIndex: number;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onSetCustomFieldValue: (taskId: string, columnId: string, value: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
}) {
  const visibleCustomColumns = customColumns.filter((column) => visibility.custom[column.id] ?? true);
  const columnCount =
    2 +
    (visibility.assignee ? 1 : 0) +
    (visibility.status ? 1 : 0) +
    (visibility.dueDate ? 1 : 0) +
    (visibility.priority ? 1 : 0) +
    visibleCustomColumns.length +
    1;

  return (
    <>
      {title !== null ? (
        <tr className="task-table__group-header">
          <td colSpan={columnCount}>
            {title} <span className="task-table__group-count">({tasks.length})</span>
          </td>
        </tr>
      ) : null}
      {tasks.map((task, index) => (
        <TaskTableRow
          key={task.id}
          task={task}
          rowNumber={startIndex + index + 1}
          columns={columns}
          members={members}
          customColumns={visibleCustomColumns}
          customFieldValues={customFieldValues}
          visibility={visibility}
          onUpdateTask={onUpdateTask}
          onSetCustomFieldValue={onSetCustomFieldValue}
          onOpenTask={onOpenTask}
          onDeleteTask={onDeleteTask}
          canDeleteTask={canDeleteTask}
        />
      ))}
    </>
  );
}

function TaskTableRow({
  task,
  rowNumber,
  columns,
  members,
  customColumns,
  customFieldValues,
  visibility,
  onUpdateTask,
  onSetCustomFieldValue,
  onOpenTask,
  onDeleteTask,
  canDeleteTask,
}: {
  task: Task;
  rowNumber: number;
  columns: ProjectColumn[];
  members: TeamMember[];
  customColumns: ProjectCustomColumn[];
  customFieldValues: TaskCustomFieldValue[];
  visibility: TableColumnVisibility;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onSetCustomFieldValue: (taskId: string, columnId: string, value: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(task.title);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const status = classifyColumnState(task.boardColumnKey, columns);
  const assignee = members.find((member) => member.userId === task.assigneeId) ?? null;
  const due = formatDueDate(task.dueDate);

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
    <tr className="task-table__row">
      <td className="task-table__col-index">
        <span className="task-table__row-number">{rowNumber}</span>
        <span className="task-table__status-dot" data-state={status} aria-hidden="true" />
      </td>
      <td className="task-table__col-name">
        {isEditingName ? (
          <input
            className="task-table__name-input"
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
          <button type="button" className="task-table__name-button" onClick={() => setIsEditingName(true)}>
            {task.title}
          </button>
        )}
        <span className="task-table__row-actions">
          <button type="button" onClick={() => onOpenTask(task.id)}>
            Otevřit
          </button>
          {canDeleteTask(task) ? (
            <button type="button" onClick={() => onDeleteTask(task.id)} aria-label="Smazat ukol">
              <Trash2 size={14} aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </td>
      {visibility.assignee ? (
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
      ) : null}
      {visibility.status ? (
        <td>
          <StatusBadge
            columns={columns}
            columnKey={task.boardColumnKey}
            onChange={(columnKey) => onUpdateTask(task.id, { boardColumnKey: columnKey })}
          />
        </td>
      ) : null}
      {visibility.dueDate ? (
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
              className="task-table__due-date"
              data-overdue={due.isOverdue && !task.completed}
              onClick={() => setIsEditingDate(true)}
            >
              {due.label}
            </button>
          )}
        </td>
      ) : null}
      {visibility.priority ? (
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
      ) : null}
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
      <td className="task-table__col-add" />
    </tr>
  );
}
