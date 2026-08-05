import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getPriorityBreakdown } from "../priorityBreakdown";
import type { Task } from "../../tasks/taskTypes";

type PriorityBreakdownWidgetProps = {
  tasks: Task[];
};

export function PriorityBreakdownWidget({ tasks }: PriorityBreakdownWidgetProps) {
  const data = getPriorityBreakdown(tasks);
  const activeCount = data.reduce((sum, entry) => sum + entry.count, 0);

  if (activeCount === 0) {
    return <p className="dashboard-widget__empty">Žádné aktivní úkoly.</p>;
  }

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
