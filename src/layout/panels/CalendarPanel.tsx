import { useEffect, useMemo, useState } from "react";
import { CustomDropdown } from "../CustomDropdown";
import type { DropdownOption } from "../CustomDropdown";
import { loadProjectsForTeams } from "../../supabase/projectApi";
import type { Project } from "../../projects/projectTypes";
import type { Team } from "../../teams/teamTypes";
import type { Task } from "../../tasks/taskTypes";
import {
  CZECH_MONTH_NAMES,
  CZECH_WEEKDAY_LABELS,
  getCurrentYearMonth,
  getMonthMatrix,
  groupTaskIdsByDueDate,
} from "../../calendar/calendarUtils";

type CalendarPanelProps = {
  teams: Team[];
  tasks: Task[];
};

export function CalendarPanel({ teams, tasks }: CalendarPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { year, month } = useMemo(() => getCurrentYearMonth(), []);

  useEffect(() => {
    let isCancelled = false;
    const teamIds = teams.map((team) => team.id);

    async function loadProjects() {
      setIsLoading(true);
      setError(null);

      try {
        const nextProjects = await loadProjectsForTeams(teamIds);

        if (!isCancelled) {
          setProjects(nextProjects);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setProjects([]);
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
      setProjects([]);
      setError(null);
      return;
    }

    void loadProjects();

    return () => {
      isCancelled = true;
    };
  }, [teams]);

  useEffect(() => {
    if (selectedProjectId && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [projects, selectedProjectId]);

  const dropdownOptions: DropdownOption[] = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month]);

  const taskIdsByDueDate = useMemo(() => {
    if (!selectedProjectId) {
      return new Map<string, string[]>();
    }

    const projectTasks = tasks.filter((task) => task.projectId === selectedProjectId);

    return groupTaskIdsByDueDate(projectTasks);
  }, [tasks, selectedProjectId]);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  return (
    <div className="calendar-panel">
      <header className="calendar-panel__header">
        <CustomDropdown
          value={selectedProjectId ?? ""}
          options={dropdownOptions}
          onChange={(value) => setSelectedProjectId(value)}
          placeholder="Vyber nástěnku"
          ariaLabel="Vyber nástěnku pro kalendář"
          disabled={isLoading || dropdownOptions.length === 0}
        />
        <h2 className="calendar-panel__title">
          {CZECH_MONTH_NAMES[month - 1]} {year}
        </h2>
      </header>

      {error ? <p className="calendar-panel__error">{error}</p> : null}

      {!selectedProjectId ? (
        <p className="calendar-panel__empty">Vyber nástěnku pro zobrazení úkolů.</p>
      ) : (
        <div className="calendar-panel__grid">
          <div className="calendar-panel__weekdays">
            {CZECH_WEEKDAY_LABELS.map((label) => (
              <span key={label} className="calendar-panel__weekday">
                {label}
              </span>
            ))}
          </div>
          {weeks.map((week, weekIndex) => (
            <div className="calendar-panel__week" key={weekIndex}>
              {week.map((day, dayIndex) => (
                <div
                  className="calendar-panel__day"
                  key={day?.date ?? `empty-${weekIndex}-${dayIndex}`}
                  data-empty={day ? "false" : "true"}
                >
                  {day ? (
                    <>
                      <span className="calendar-panel__day-number">{day.dayOfMonth}</span>
                      <div className="calendar-panel__day-tasks">
                        {(taskIdsByDueDate.get(day.date) ?? []).map((taskId) => {
                          const task = taskById.get(taskId);

                          return task ? (
                            <span
                              className="calendar-panel__task"
                              key={taskId}
                              title={task.title}
                            >
                              {task.title}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
