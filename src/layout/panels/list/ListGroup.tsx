import { ChevronDown, Plus } from "lucide-react";
import type { Task, TaskUpdate } from "../../../tasks/taskTypes";
import type { ProjectColumn } from "../../../projects/projectTypes";
import type { TeamMember } from "../../../teams/teamTypes";
import type { ProjectCustomColumn, TaskCustomFieldValue } from "../../../tasks/customFieldTypes";
import { classifyColumnState } from "../table/tableStatus";
import { ListRow } from "./ListRow";

type ListGroupProps = {
  column: ProjectColumn;
  tasks: Task[];
  columns: ProjectColumn[];
  members: TeamMember[];
  customColumns: ProjectCustomColumn[];
  customFieldValues: TaskCustomFieldValue[];
  subtasksVisible: boolean;
  isCollapsed: boolean;
  canAddCustomColumn: boolean;
  onToggleCollapsed: (columnKey: string) => void;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onSetCustomFieldValue: (taskId: string, columnId: string, value: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddTask: (columnKey: string) => void;
  onOpenAddColumn: () => void;
};

export function ListGroup({
  column,
  tasks,
  columns,
  members,
  customColumns,
  customFieldValues,
  subtasksVisible,
  isCollapsed,
  canAddCustomColumn,
  onToggleCollapsed,
  onUpdateTask,
  onSetCustomFieldValue,
  onOpenTask,
  onToggleSubtask,
  onAddTask,
  onOpenAddColumn,
}: ListGroupProps) {
  const state = classifyColumnState(column.key, columns);
  // index + name + assignee + due date + priority + status + custom columns + trailing "+" column
  const columnCount = 7 + customColumns.length;

  return (
    <div className="list-group" data-collapsed={isCollapsed}>
      <button
        type="button"
        className="list-group__header"
        onClick={() => onToggleCollapsed(column.key)}
        aria-expanded={!isCollapsed}
      >
        <ChevronDown size={14} className="list-group__collapse-icon" aria-hidden="true" />
        <span className="list-group__badge" data-state={state}>
          {column.title.toUpperCase()}
        </span>
        <span className="list-group__count">{tasks.length}</span>
      </button>
      {!isCollapsed ? (
        <>
          <table className="list-table">
            <thead>
              <tr>
                <th className="list-table__col-index" />
                <th className="list-table__col-name">Nazev</th>
                <th>Řešitel</th>
                <th>Termin</th>
                <th>Priorita</th>
                <th>Stav</th>
                {customColumns.map((customColumn) => (
                  <th key={customColumn.id}>{customColumn.title}</th>
                ))}
                <th className="list-table__col-add">
                  {canAddCustomColumn ? (
                    <button type="button" onClick={onOpenAddColumn} aria-label="Pridat sloupec">
                      +
                    </button>
                  ) : null}
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <ListRow
                  key={task.id}
                  task={task}
                  columns={columns}
                  members={members}
                  customColumns={customColumns}
                  customFieldValues={customFieldValues}
                  columnCount={columnCount}
                  subtasksVisible={subtasksVisible}
                  onUpdateTask={onUpdateTask}
                  onSetCustomFieldValue={onSetCustomFieldValue}
                  onOpenTask={onOpenTask}
                  onToggleSubtask={onToggleSubtask}
                />
              ))}
            </tbody>
          </table>
          <button type="button" className="list-group__add-task" onClick={() => onAddTask(column.key)}>
            <Plus size={14} aria-hidden="true" />
            Add Task
          </button>
        </>
      ) : null}
    </div>
  );
}
