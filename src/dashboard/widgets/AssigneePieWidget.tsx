import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getAssigneeBreakdown, getAssigneeChartColor } from "../assigneeBreakdown";
import type { Task } from "../../tasks/taskTypes";
import type { TeamMember } from "../../teams/teamTypes";

type AssigneePieWidgetProps = {
  tasks: Task[];
  members: TeamMember[];
};

export function AssigneePieWidget({ tasks, members }: AssigneePieWidgetProps) {
  const data = getAssigneeBreakdown(tasks, members);

  if (data.length === 0) {
    return <p className="dashboard-widget__empty">Žádné aktivní úkoly.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
          {data.map((entry, index) => (
            <Cell key={entry.assigneeId ?? "unassigned"} fill={getAssigneeChartColor(index)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text-primary)",
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          wrapperStyle={{ color: "var(--color-text-secondary)", fontSize: "0.8rem" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
