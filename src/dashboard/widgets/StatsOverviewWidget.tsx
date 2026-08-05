import { CalendarClock, CheckCircle2, CircleDot, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getTodayDateValue } from "../../tasks/dateUtils";
import type { Task } from "../../tasks/taskTypes";

type StatsOverviewWidgetProps = {
  tasks: Task[];
};

type StatTone = "orange" | "danger" | "success" | "purple";

type StatEntry = {
  label: string;
  value: number;
  tone: StatTone;
  Icon: LucideIcon;
};

export function StatsOverviewWidget({ tasks }: StatsOverviewWidgetProps) {
  const today = getTodayDateValue();
  const activeTasks = tasks.filter((task) => !task.completed && !task.isArchived);
  const dueTodayCount = activeTasks.filter((task) => task.dueDate === today).length;
  const overdueCount = activeTasks.filter(
    (task) => task.dueDate !== null && task.dueDate < today,
  ).length;
  const completedCount = tasks.filter((task) => task.completed && !task.isArchived).length;

  const stats: StatEntry[] = [
    { label: "Dnes", value: dueTodayCount, tone: "orange", Icon: CalendarClock },
    { label: "Po termínu", value: overdueCount, tone: "danger", Icon: TriangleAlert },
    { label: "Dokončeno", value: completedCount, tone: "success", Icon: CheckCircle2 },
    { label: "V řešení", value: activeTasks.length, tone: "purple", Icon: CircleDot },
  ];

  return (
    <div className="dashboard-stats">
      {stats.map((stat) => (
        <div className="dashboard-stats__item" data-tone={stat.tone} key={stat.label}>
          <i>
            <stat.Icon aria-hidden="true" size={16} />
          </i>
          <strong>{stat.value}</strong>
          <span>{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
