import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getProjectBreakdown } from "../projectBreakdown";
import type { ProjectBreakdownEntry } from "../projectBreakdown";
import type { Task } from "../../tasks/taskTypes";
import type { Project } from "../../projects/projectTypes";

type ProjectBreakdownWidgetProps = {
  tasks: Task[];
  projects: Project[];
  onOpenProject: (projectId: string) => void;
};

type RechartsBarClickItem = {
  payload?: ProjectBreakdownEntry;
};

export function ProjectBreakdownWidget({ tasks, projects, onOpenProject }: ProjectBreakdownWidgetProps) {
  const data = getProjectBreakdown(tasks, projects);

  if (data.length === 0) {
    return <p className="dashboard-widget__empty">Žádné aktivní úkoly.</p>;
  }

  function handleBarClick(item: RechartsBarClickItem) {
    const projectId = item.payload?.projectId;

    if (projectId) {
      onOpenProject(projectId);
    }
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
        <Bar
          dataKey="count"
          radius={[6, 6, 0, 0]}
          onClick={(item: RechartsBarClickItem) => handleBarClick(item)}
        >
          {data.map((entry) => (
            <Cell
              key={entry.projectId ?? "no-project"}
              fill={entry.projectId ? "var(--color-accent)" : "var(--color-text-secondary)"}
              style={{ cursor: entry.projectId ? "pointer" : "default" }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
