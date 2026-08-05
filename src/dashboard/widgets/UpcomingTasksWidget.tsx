import { Circle } from "lucide-react";
import type { Task } from "../../tasks/taskTypes";

type UpcomingTasksWidgetProps = {
  tasks: Task[];
  onToggleTaskCompleted: (taskId: string, completed: boolean) => void;
  onOpenTask: (taskId: string) => void;
};

const UPCOMING_LIMIT = 6;

export function UpcomingTasksWidget({ tasks, onToggleTaskCompleted, onOpenTask }: UpcomingTasksWidgetProps) {
  const upcoming = tasks
    .filter((task) => !task.completed && !task.isArchived)
    .slice()
    .sort((a, b) => {
      if (a.dueDate === b.dueDate) {
        return 0;
      }
      if (a.dueDate === null) {
        return 1;
      }
      if (b.dueDate === null) {
        return -1;
      }
      return a.dueDate < b.dueDate ? -1 : 1;
    })
    .slice(0, UPCOMING_LIMIT);

  if (upcoming.length === 0) {
    return <p className="dashboard-widget__empty">Žádné nadcházející úkoly.</p>;
  }

  return (
    <ul className="dashboard-upcoming">
      {upcoming.map((task) => (
        <li className="dashboard-upcoming__item" key={task.id}>
          <button
            type="button"
            className="dashboard-upcoming__checkbox"
            aria-label={`Dokončit ${task.title}`}
            onClick={() => onToggleTaskCompleted(task.id, true)}
          >
            <Circle aria-hidden="true" size={16} />
          </button>
          <button type="button" className="dashboard-upcoming__title" onClick={() => onOpenTask(task.id)}>
            <span>{task.title}</span>
            {task.dueDate ? <small>{task.dueDate}</small> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
