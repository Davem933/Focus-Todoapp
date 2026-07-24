import { useEffect, useMemo, useState } from "react";
import { CustomDropdown } from "../CustomDropdown";
import type { DropdownOption } from "../CustomDropdown";
import { loadProjectColumns, loadProjectsForTeams } from "../../supabase/projectApi";
import { loadTeamMembers } from "../../supabase/teamApi";
import type { Project, ProjectColumn } from "../../projects/projectTypes";
import type { Team, TeamMember } from "../../teams/teamTypes";
import type { Task } from "../../tasks/taskTypes";
import { getMemberInitials } from "../../teams/teamMemberDisplay";
import { TASK_PRIORITY_COLORS } from "../../tasks/taskPriorityColors";
import { getTodayDateValue } from "../../tasks/dateUtils";
import {
  filterProjectTasks,
  getDefaultProjectBoardPreferences,
  loadProjectBoardPreferences,
  saveProjectBoardPreferences,
  sortProjectTasks,
  type ProjectBoardPreferences,
} from "../../projects/projectBoardPreferences";
import { ProjectBoardToolbar } from "../../projects/ProjectBoardToolbar";

type TableViewPanelProps = {
  teams: Team[];
  tasks: Task[];
  onOpenTask: (projectId: string, taskId: string) => void;
};

export function TableViewPanel({ teams, tasks, onOpenTask }: TableViewPanelProps) {
  const [boards, setBoards] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [preferences, setPreferences] = useState<ProjectBoardPreferences>(
    getDefaultProjectBoardPreferences(),
  );

  useEffect(() => {
    let isCancelled = false;
    const teamIds = teams.map((team) => team.id);

    async function loadBoards() {
      setIsLoading(true);
      setError(null);

      try {
        const nextBoards = await loadProjectsForTeams(teamIds);

        if (!isCancelled) {
          setBoards(nextBoards);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setBoards([]);
          setError(
            loadError instanceof Error ? loadError.message : "Nástěnky se nepodařilo načíst.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (teamIds.length === 0) {
      setBoards([]);
      setError(null);
      return;
    }

    void loadBoards();

    return () => {
      isCancelled = true;
    };
  }, [teams]);

  useEffect(() => {
    if (selectedBoardId && !boards.some((board) => board.id === selectedBoardId)) {
      setSelectedBoardId(null);
    }
  }, [boards, selectedBoardId]);

  const selectedBoard = boards.find((board) => board.id === selectedBoardId) ?? null;

  useEffect(() => {
    if (!selectedBoard) {
      setColumns([]);
      setMembers([]);
      return;
    }

    let isCancelled = false;
    const board = selectedBoard;
    setPreferences(loadProjectBoardPreferences(board.id));

    async function loadBoardDetails() {
      setIsLoading(true);
      setError(null);

      try {
        const [nextColumns, nextMembers] = await Promise.all([
          loadProjectColumns(board.id),
          loadTeamMembers(board.teamId),
        ]);

        if (!isCancelled) {
          setColumns(nextColumns);
          setMembers(nextMembers);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setColumns([]);
          setMembers([]);
          setError(
            loadError instanceof Error ? loadError.message : "Detail nástěnky se nepodařilo načíst.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBoardDetails();

    return () => {
      isCancelled = true;
    };
  }, [selectedBoard]);

  useEffect(() => {
    if (!selectedBoard) {
      return;
    }

    saveProjectBoardPreferences(selectedBoard.id, preferences);
  }, [selectedBoard, preferences]);

  const dropdownOptions: DropdownOption[] = boards.map((board) => ({
    value: board.id,
    label: board.name,
  }));

  const boardTasks = useMemo(() => {
    if (!selectedBoard) {
      return [];
    }

    return tasks.filter((task) => task.projectId === selectedBoard.id && !task.isArchived);
  }, [tasks, selectedBoard]);

  const availableLabels = useMemo(
    () => Array.from(new Map(boardTasks.flatMap((task) => task.labels).map((label) => [label.id, label])).values()),
    [boardTasks],
  );

  const today = getTodayDateValue();
  const filteredTasks = filterProjectTasks(boardTasks, preferences.filters, today);
  const sortedTasks = sortProjectTasks(filteredTasks, preferences.sort);
  const columnByKey = new Map(columns.map((column) => [column.key, column]));
  const memberById = new Map(members.map((member) => [member.userId, member]));

  return (
    <section className="app-panel table-view" aria-label="Tabulka úkolů">
      <header className="table-view__header">
        <CustomDropdown
          value={selectedBoardId ?? ""}
          options={dropdownOptions}
          onChange={(value) => setSelectedBoardId(value)}
          placeholder="Vyber nástěnku"
          ariaLabel="Vyber nástěnku pro tabulku"
          disabled={isLoading || dropdownOptions.length === 0}
        />
      </header>

      {error ? <p className="table-view__error">{error}</p> : null}

      {!selectedBoard ? (
        <p className="table-view__empty">Vyber nástěnku pro zobrazení úkolů.</p>
      ) : (
        <>
          <ProjectBoardToolbar
            preferences={preferences}
            onPreferencesChange={setPreferences}
            members={members}
            availableLabels={availableLabels}
          />

          {sortedTasks.length === 0 ? (
            <p className="table-view__empty">Tato nástěnka nemá žádné úkoly.</p>
          ) : (
            <div className="table-view__table-wrap">
              <table className="table-view__table">
                <thead>
                  <tr>
                    <th>Název</th>
                    <th>Přiřazeno</th>
                    <th>Stav</th>
                    <th>Termín</th>
                    <th>Priorita</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task) => {
                    const assignee = task.assigneeId ? memberById.get(task.assigneeId) : null;
                    const statusLabel = columnByKey.get(task.boardColumnKey)?.title ?? task.boardColumnKey;

                    return (
                      <tr
                        className="table-view__row"
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenTask(selectedBoard.id, task.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onOpenTask(selectedBoard.id, task.id);
                          }
                        }}
                      >
                        <td className="table-view__cell-name">
                          <span
                            className="table-view__completed-dot"
                            data-completed={task.completed ? "true" : "false"}
                            aria-hidden="true"
                          />
                          <span className="table-view__title">{task.title}</span>
                        </td>
                        <td>
                          {assignee ? (
                            <span className="table-view__assignee" title={assignee.email}>
                              {getMemberInitials(assignee)}
                            </span>
                          ) : (
                            <span className="table-view__cell-empty">—</span>
                          )}
                        </td>
                        <td>{statusLabel}</td>
                        <td>{task.dueDate ?? <span className="table-view__cell-empty">—</span>}</td>
                        <td>
                          <span
                            className="table-view__priority-dot"
                            aria-hidden="true"
                            style={{ background: TASK_PRIORITY_COLORS[task.priority] }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
