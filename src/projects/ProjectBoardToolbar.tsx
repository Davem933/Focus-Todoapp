import { useEffect, useRef, useState } from "react";
import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { ArrowUpDown, Filter, X } from "lucide-react";
import { CustomDropdown } from "../layout/CustomDropdown";
import type { DropdownOption } from "../layout/CustomDropdown";
import { getMemberDisplayName } from "../teams/teamMemberDisplay";
import type { TeamMember } from "../teams/teamTypes";
import type { TaskLabel } from "../tasks/taskTypes";
import {
  BOARD_CARD_PRIORITY_LABELS,
  BOARD_CARD_PRIORITY_OPTIONS,
  TASK_PRIORITY_COLORS as BOARD_CARD_PRIORITY_COLORS,
} from "../tasks/taskPriorityColors";
import {
  getDefaultProjectBoardPreferences,
  toggleFilterValue,
  type ProjectBoardDueFilter,
  type ProjectBoardPreferences,
  type ProjectBoardSortKey,
} from "./projectBoardPreferences";

const BOARD_DUE_FILTER_OPTIONS: { value: ProjectBoardDueFilter; label: string }[] = [
  { value: "overdue", label: "Po termínu" },
  { value: "today", label: "Dnes" },
  { value: "none", label: "Bez termínu" },
];
const BOARD_SORT_DROPDOWN_OPTIONS: DropdownOption[] = [
  { value: "manual", label: "Ruční pořadí" },
  { value: "priority", label: "Priorita, vysoká první" },
  { value: "dueDate", label: "Termín, nejbližší první" },
  { value: "title", label: "Abecedně" },
];
const BOARD_SORT_TRIGGER_LABELS: Record<ProjectBoardSortKey, string> = {
  manual: "Řadit",
  priority: "Řadit: Priorita",
  dueDate: "Řadit: Termín",
  title: "Řadit: Abecedně",
};

type ProjectBoardToolbarProps = {
  preferences: ProjectBoardPreferences;
  onPreferencesChange: Dispatch<SetStateAction<ProjectBoardPreferences>>;
  members: TeamMember[];
  availableLabels: TaskLabel[];
};

export function ProjectBoardToolbar({
  preferences,
  onPreferencesChange,
  members,
  availableLabels,
}: ProjectBoardToolbarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (filterPanelRef.current?.contains(target)) {
        return;
      }

      setIsFilterOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isFilterOpen]);

  const activeFilterCount =
    preferences.filters.assigneeIds.length +
    preferences.filters.priorities.length +
    preferences.filters.dueStatuses.length +
    preferences.filters.labelIds.length;

  function handleClearFilters(event: ReactMouseEvent) {
    event.stopPropagation();
    onPreferencesChange((current) => ({
      ...current,
      filters: getDefaultProjectBoardPreferences().filters,
    }));
  }

  return (
    <div className="project-detail__toolbar">
      <div className="project-detail__filter" ref={isFilterOpen ? filterPanelRef : null}>
        <button
          className="project-detail__filter-button"
          type="button"
          aria-expanded={isFilterOpen}
          onClick={() => setIsFilterOpen((current) => !current)}
        >
          <Filter aria-hidden="true" size={15} />
          <span>Filtr</span>
          {activeFilterCount > 0 ? (
            <span className="project-detail__filter-badge">{activeFilterCount}</span>
          ) : null}
        </button>
        {activeFilterCount > 0 ? (
          <button
            className="project-detail__filter-clear"
            type="button"
            aria-label="Zrušit filtry"
            onClick={handleClearFilters}
          >
            <X aria-hidden="true" size={12} />
          </button>
        ) : null}
        {isFilterOpen ? (
          <div className="project-detail__filter-panel" role="menu">
            <div className="project-detail__filter-section">
              <span>Přiřazeno</span>
              {members.length === 0 ? (
                <p className="project-detail__filter-empty">Nástěnka nemá žádné členy.</p>
              ) : (
                members.map((member) => (
                  <label className="project-detail__filter-option" key={member.userId}>
                    <input
                      type="checkbox"
                      checked={preferences.filters.assigneeIds.includes(member.userId)}
                      onChange={() =>
                        onPreferencesChange((current) => ({
                          ...current,
                          filters: {
                            ...current.filters,
                            assigneeIds: toggleFilterValue(
                              current.filters.assigneeIds,
                              member.userId,
                            ),
                          },
                        }))
                      }
                    />
                    <span>{getMemberDisplayName(member)}</span>
                  </label>
                ))
              )}
            </div>

            <div className="project-detail__filter-section">
              <span>Priorita</span>
              {BOARD_CARD_PRIORITY_OPTIONS.map((priorityOption) => (
                <label className="project-detail__filter-option" key={priorityOption}>
                  <input
                    type="checkbox"
                    checked={preferences.filters.priorities.includes(priorityOption)}
                    onChange={() =>
                      onPreferencesChange((current) => ({
                        ...current,
                        filters: {
                          ...current.filters,
                          priorities: toggleFilterValue(current.filters.priorities, priorityOption),
                        },
                      }))
                    }
                  />
                  <i
                    className="project-detail__filter-dot"
                    aria-hidden="true"
                    style={{ background: BOARD_CARD_PRIORITY_COLORS[priorityOption] }}
                  />
                  <span>{BOARD_CARD_PRIORITY_LABELS[priorityOption]}</span>
                </label>
              ))}
            </div>

            <div className="project-detail__filter-section">
              <span>Termín</span>
              {BOARD_DUE_FILTER_OPTIONS.map((option) => (
                <label className="project-detail__filter-option" key={option.value}>
                  <input
                    type="checkbox"
                    checked={preferences.filters.dueStatuses.includes(option.value)}
                    onChange={() =>
                      onPreferencesChange((current) => ({
                        ...current,
                        filters: {
                          ...current.filters,
                          dueStatuses: toggleFilterValue(current.filters.dueStatuses, option.value),
                        },
                      }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            {availableLabels.length > 0 ? (
              <div className="project-detail__filter-section">
                <span>Štítky</span>
                {availableLabels.map((label) => (
                  <label className="project-detail__filter-option" key={label.id}>
                    <input
                      type="checkbox"
                      checked={preferences.filters.labelIds.includes(label.id)}
                      onChange={() =>
                        onPreferencesChange((current) => ({
                          ...current,
                          filters: {
                            ...current.filters,
                            labelIds: toggleFilterValue(current.filters.labelIds, label.id),
                          },
                        }))
                      }
                    />
                    <i
                      className="project-detail__filter-dot"
                      aria-hidden="true"
                      style={{ background: label.color }}
                    />
                    <span>{label.name}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="project-detail__sort">
        <CustomDropdown
          ariaLabel="Řadit úkoly"
          className="project-detail__sort-dropdown"
          value={preferences.sort}
          options={BOARD_SORT_DROPDOWN_OPTIONS}
          onChange={(value) =>
            onPreferencesChange((current) => ({ ...current, sort: value as ProjectBoardSortKey }))
          }
          renderTriggerContent={() => (
            <span className="custom-dropdown__value">
              <ArrowUpDown aria-hidden="true" size={14} />
              {BOARD_SORT_TRIGGER_LABELS[preferences.sort]}
            </span>
          )}
        />
      </div>
    </div>
  );
}
