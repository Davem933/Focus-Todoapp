import { useRef, useState } from "react";
import { Filter, Plus, Search } from "lucide-react";
import type { TeamMember } from "../../../teams/teamTypes";
import { getMemberDisplayName } from "../../../teams/teamMemberDisplay";
import type { TaskPriority } from "../../../tasks/taskTypes";
import { BOARD_CARD_PRIORITY_OPTIONS, BOARD_CARD_PRIORITY_LABELS } from "../../../tasks/taskPriorityColors";
import type { ProjectCustomColumn } from "../../../tasks/customFieldTypes";
import { useOutsideClick } from "./useOutsideClick";

export type TableGroupBy = "none" | "status" | "assignee" | "priority";
export type TableDueFilter = "all" | "overdue" | "no_date";

export type TableColumnVisibility = {
  assignee: boolean;
  status: boolean;
  dueDate: boolean;
  priority: boolean;
  custom: Record<string, boolean>;
};

const GROUP_BY_LABELS: Record<TableGroupBy, string> = {
  none: "Group: None",
  status: "Group: Status",
  assignee: "Group: Assignee",
  priority: "Group: Priority",
};

type TableToolbarProps = {
  members: TeamMember[];
  customColumns: ProjectCustomColumn[];
  visibility: TableColumnVisibility;
  onToggleColumnVisible: (key: string) => void;
  groupBy: TableGroupBy;
  onGroupByChange: (groupBy: TableGroupBy) => void;
  showClosed: boolean;
  onToggleShowClosed: () => void;
  assigneeFilter: Set<string>;
  onToggleAssigneeFilter: (userId: string) => void;
  priorityFilter: Set<TaskPriority>;
  onTogglePriorityFilter: (priority: TaskPriority) => void;
  dueFilter: TableDueFilter;
  onDueFilterChange: (value: TableDueFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onAddTask: () => void;
  canAddCustomColumn: boolean;
  onOpenAddColumn: () => void;
};

type OpenPopover = "group" | "shown" | "filter" | "assignee" | null;

export function TableToolbar({
  members,
  customColumns,
  visibility,
  onToggleColumnVisible,
  groupBy,
  onGroupByChange,
  showClosed,
  onToggleShowClosed,
  assigneeFilter,
  onToggleAssigneeFilter,
  priorityFilter,
  onTogglePriorityFilter,
  dueFilter,
  onDueFilterChange,
  searchQuery,
  onSearchQueryChange,
  onAddTask,
  canAddCustomColumn,
  onOpenAddColumn,
}: TableToolbarProps) {
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useOutsideClick(containerRef, openPopover !== null, () => setOpenPopover(null));

  return (
    <div className="table-toolbar" ref={containerRef}>
      <div className="table-toolbar__group">
        <button
          type="button"
          className="table-toolbar__button"
          onClick={() => setOpenPopover((current) => (current === "group" ? null : "group"))}
        >
          {GROUP_BY_LABELS[groupBy]}
        </button>
        {openPopover === "group" ? (
          <div className="table-toolbar__popover">
            {(Object.keys(GROUP_BY_LABELS) as TableGroupBy[]).map((option) => (
              <button
                key={option}
                type="button"
                className="table-toolbar__popover-option"
                data-selected={option === groupBy}
                onClick={() => {
                  onGroupByChange(option);
                  setOpenPopover(null);
                }}
              >
                {GROUP_BY_LABELS[option]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="table-toolbar__group">
        <button
          type="button"
          className="table-toolbar__button"
          onClick={() => setOpenPopover((current) => (current === "shown" ? null : "shown"))}
        >
          Shown
        </button>
        {openPopover === "shown" ? (
          <div className="table-toolbar__popover">
            <label className="table-toolbar__checkbox-row">
              <input
                type="checkbox"
                checked={visibility.assignee}
                onChange={() => onToggleColumnVisible("assignee")}
              />
              Reesitel
            </label>
            <label className="table-toolbar__checkbox-row">
              <input type="checkbox" checked={visibility.status} onChange={() => onToggleColumnVisible("status")} />
              Stav
            </label>
            <label className="table-toolbar__checkbox-row">
              <input
                type="checkbox"
                checked={visibility.dueDate}
                onChange={() => onToggleColumnVisible("dueDate")}
              />
              Terrmin
            </label>
            <label className="table-toolbar__checkbox-row">
              <input
                type="checkbox"
                checked={visibility.priority}
                onChange={() => onToggleColumnVisible("priority")}
              />
              Priorita
            </label>
            {customColumns.map((column) => (
              <label key={column.id} className="table-toolbar__checkbox-row">
                <input
                  type="checkbox"
                  checked={visibility.custom[column.id] ?? true}
                  onChange={() => onToggleColumnVisible(column.id)}
                />
                {column.title}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="table-toolbar__group">
        <button
          type="button"
          className="table-toolbar__button"
          onClick={() => setOpenPopover((current) => (current === "filter" ? null : "filter"))}
        >
          <Filter size={14} aria-hidden="true" />
          Filter
        </button>
        {openPopover === "filter" ? (
          <div className="table-toolbar__popover">
            <p className="table-toolbar__popover-heading">Priorita</p>
            {BOARD_CARD_PRIORITY_OPTIONS.map((priority) => (
              <label key={priority} className="table-toolbar__checkbox-row">
                <input
                  type="checkbox"
                  checked={priorityFilter.has(priority)}
                  onChange={() => onTogglePriorityFilter(priority)}
                />
                {BOARD_CARD_PRIORITY_LABELS[priority]}
              </label>
            ))}
            <p className="table-toolbar__popover-heading">Terrmin</p>
            <select value={dueFilter} onChange={(event) => onDueFilterChange(event.currentTarget.value as TableDueFilter)}>
              <option value="all">Vsechny</option>
              <option value="overdue">Po terminu</option>
              <option value="no_date">Bez terminu</option>
            </select>
          </div>
        ) : null}
      </div>

      <button type="button" className="table-toolbar__button" data-active={showClosed} onClick={onToggleShowClosed}>
        Closed
      </button>

      <div className="table-toolbar__group">
        <button
          type="button"
          className="table-toolbar__button"
          onClick={() => setOpenPopover((current) => (current === "assignee" ? null : "assignee"))}
        >
          Assignee
        </button>
        {openPopover === "assignee" ? (
          <div className="table-toolbar__popover">
            {members.map((member) => (
              <label key={member.userId} className="table-toolbar__checkbox-row">
                <input
                  type="checkbox"
                  checked={assigneeFilter.has(member.userId)}
                  onChange={() => onToggleAssigneeFilter(member.userId)}
                />
                {getMemberDisplayName(member)}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <label className="table-toolbar__search">
        <Search size={14} aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
          placeholder="Hledat ukoly"
        />
      </label>

      {canAddCustomColumn ? (
        <button type="button" className="table-toolbar__button" onClick={onOpenAddColumn}>
          <Plus size={14} aria-hidden="true" />
          Sloupec
        </button>
      ) : null}

      <button type="button" className="table-toolbar__add-task" onClick={onAddTask}>
        <Plus size={16} aria-hidden="true" />
        Add Task
      </button>
    </div>
  );
}
