import { useRef, useState } from "react";
import { Filter, Plus, Search } from "lucide-react";
import type { TeamMember } from "../../../teams/teamTypes";
import { getMemberDisplayName } from "../../../teams/teamMemberDisplay";
import type { TaskPriority } from "../../../tasks/taskTypes";
import { BOARD_CARD_PRIORITY_OPTIONS, BOARD_CARD_PRIORITY_LABELS } from "../../../tasks/taskPriorityColors";
import { useOutsideClick } from "../table/useOutsideClick";
import type { ProjectViewDueFilter } from "../shared/projectViewFilters";

type ListToolbarProps = {
  members: TeamMember[];
  closedVisible: boolean;
  onToggleClosedVisible: () => void;
  assigneeFilter: Set<string>;
  onToggleAssigneeFilter: (userId: string) => void;
  priorityFilter: Set<TaskPriority>;
  onTogglePriorityFilter: (priority: TaskPriority) => void;
  dueFilter: ProjectViewDueFilter;
  onDueFilterChange: (value: ProjectViewDueFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onAddTask: () => void;
};

type OpenPopover = "filter" | "assignee" | null;

export function ListToolbar({
  members,
  closedVisible,
  onToggleClosedVisible,
  assigneeFilter,
  onToggleAssigneeFilter,
  priorityFilter,
  onTogglePriorityFilter,
  dueFilter,
  onDueFilterChange,
  searchQuery,
  onSearchQueryChange,
  onAddTask,
}: ListToolbarProps) {
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useOutsideClick(containerRef, openPopover !== null, () => setOpenPopover(null));

  return (
    <div className="list-toolbar" ref={containerRef}>
      <span className="list-toolbar__button list-toolbar__button--static">Group: Status</span>

      <div className="list-toolbar__group">
        <button
          type="button"
          className="list-toolbar__button"
          onClick={() => setOpenPopover((current) => (current === "filter" ? null : "filter"))}
        >
          <Filter size={14} aria-hidden="true" />
          Filter
        </button>
        {openPopover === "filter" ? (
          <div className="list-toolbar__popover">
            <p className="list-toolbar__popover-heading">Priorita</p>
            {BOARD_CARD_PRIORITY_OPTIONS.map((priority) => (
              <label key={priority} className="list-toolbar__checkbox-row">
                <input
                  type="checkbox"
                  checked={priorityFilter.has(priority)}
                  onChange={() => onTogglePriorityFilter(priority)}
                />
                {BOARD_CARD_PRIORITY_LABELS[priority]}
              </label>
            ))}
            <p className="list-toolbar__popover-heading">Terrmin</p>
            <select
              value={dueFilter}
              onChange={(event) => onDueFilterChange(event.currentTarget.value as ProjectViewDueFilter)}
            >
              <option value="all">Vsechny</option>
              <option value="overdue">Po terminu</option>
              <option value="no_date">Bez terminu</option>
            </select>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="list-toolbar__button"
        data-active={closedVisible}
        onClick={onToggleClosedVisible}
      >
        Closed
      </button>

      <div className="list-toolbar__group">
        <button
          type="button"
          className="list-toolbar__button"
          onClick={() => setOpenPopover((current) => (current === "assignee" ? null : "assignee"))}
        >
          Assignee
        </button>
        {openPopover === "assignee" ? (
          <div className="list-toolbar__popover">
            {members.map((member) => (
              <label key={member.userId} className="list-toolbar__checkbox-row">
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

      <label className="list-toolbar__search">
        <Search size={14} aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
          placeholder="Hledat ukoly"
        />
      </label>

      <button type="button" className="list-toolbar__add-task" onClick={onAddTask}>
        <Plus size={16} aria-hidden="true" />
        Add Task
      </button>
    </div>
  );
}
