import { TriangleAlert } from "lucide-react";
import { getAssigneeBreakdown } from "../assigneeBreakdown";
import { OVERLOAD_THRESHOLD } from "./WorkloadWidget";
import { getTodayDateValue } from "../../tasks/dateUtils";
import { getMemberDisplayName } from "../../teams/teamMemberDisplay";
import type { Task } from "../../tasks/taskTypes";
import type { TeamMember } from "../../teams/teamTypes";

type RiskAlertsWidgetProps = {
  tasks: Task[];
  members: TeamMember[];
  onOpenTask: (taskId: string) => void;
};

const OVERDUE_LIMIT = 5;

export function RiskAlertsWidget({ tasks, members, onOpenTask }: RiskAlertsWidgetProps) {
  const today = getTodayDateValue();

  const overloadedMembers = getAssigneeBreakdown(tasks, members).filter(
    (entry) => entry.assigneeId !== null && entry.count > OVERLOAD_THRESHOLD,
  );

  const overdueTasks = tasks
    .filter((task) => !task.completed && !task.isArchived && task.dueDate !== null && task.dueDate < today)
    .slice()
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : 0))
    .slice(0, OVERDUE_LIMIT);

  const memberById = new Map(members.map((member) => [member.userId, member]));

  if (overloadedMembers.length === 0 && overdueTasks.length === 0) {
    return <p className="dashboard-widget__empty">Vše v pořádku — žádná rizika.</p>;
  }

  return (
    <div className="dashboard-risk">
      {overloadedMembers.length > 0 ? (
        <section className="dashboard-risk__section">
          <h4 className="dashboard-risk__section-title">Přetížení členové</h4>
          <ul className="dashboard-risk__list">
            {overloadedMembers.map((entry) => (
              <li className="dashboard-risk__item" key={entry.assigneeId}>
                <TriangleAlert aria-hidden="true" size={14} />
                <span>{entry.name}</span>
                <strong>{entry.count} úkolů</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {overdueTasks.length > 0 ? (
        <section className="dashboard-risk__section">
          <h4 className="dashboard-risk__section-title">Úkoly po termínu</h4>
          <ul className="dashboard-risk__list">
            {overdueTasks.map((task) => {
              const assigneeMember = task.assigneeId ? memberById.get(task.assigneeId) : null;
              const assigneeName = assigneeMember ? getMemberDisplayName(assigneeMember) : "Nepřiřazeno";

              return (
                <li className="dashboard-risk__item" key={task.id}>
                  <button
                    type="button"
                    className="dashboard-risk__item-button"
                    onClick={() => onOpenTask(task.id)}
                  >
                    <span>{task.title}</span>
                    <small>
                      {assigneeName} · {task.dueDate}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
