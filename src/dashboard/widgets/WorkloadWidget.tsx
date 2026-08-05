import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAssigneeBreakdown } from "../assigneeBreakdown";
import type { Task } from "../../tasks/taskTypes";
import type { TeamMember } from "../../teams/teamTypes";

type WorkloadWidgetProps = {
  tasks: Task[];
  members: TeamMember[];
};

const OVERLOAD_THRESHOLD = 8;
const WARNING_THRESHOLD = 5;

function getWorkloadColor(assigneeId: string | null, count: number): string {
  if (assigneeId === null) {
    return "var(--color-text-secondary)";
  }

  if (count > OVERLOAD_THRESHOLD) {
    return "#f43f5e";
  }

  if (count >= WARNING_THRESHOLD) {
    return "#fbbf24";
  }

  return "var(--color-accent)";
}

export function WorkloadWidget({ tasks, members }: WorkloadWidgetProps) {
  const data = getAssigneeBreakdown(tasks, members);

  if (data.length === 0) {
    return <p className="dashboard-widget__empty">Žádné aktivní úkoly.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="name"
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
            <Cell key={entry.assigneeId ?? "unassigned"} fill={getWorkloadColor(entry.assigneeId, entry.count)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
