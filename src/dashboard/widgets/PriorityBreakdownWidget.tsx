import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TASK_PRIORITY_COLORS, BOARD_CARD_PRIORITY_LABELS } from "../../tasks/taskPriorityColors";
import type { Task, TaskPriority } from "../../tasks/taskTypes";

type PriorityBreakdownWidgetProps = {
  tasks: Task[];
};

const PRIORITY_ORDER: TaskPriority[] = ["none", "low", "medium", "high"];

export function PriorityBreakdownWidget({ tasks }: PriorityBreakdownWidgetProps) {
  const activeTasks = tasks.filter((task) => !task.completed && !task.isArchived);

  if (activeTasks.length === 0) {
    return <p className="dashboard-widget__empty">Žádné aktivní úkoly.</p>;
  }

  const data = PRIORITY_ORDER.map((priority) => ({
    priority,
    label: BOARD_CARD_PRIORITY_LABELS[priority],
    count: activeTasks.filter((task) => task.priority === priority).length,
    color: TASK_PRIORITY_COLORS[priority],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
          axisLine={{ stroke: "var(--color-border)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text-primary)",
          }}
          cursor={{ fill: "var(--color-background-card-hover)" }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.priority} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
