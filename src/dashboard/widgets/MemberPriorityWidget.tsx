import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CustomDropdown } from "../../layout/CustomDropdown";
import { getPriorityBreakdown } from "../priorityBreakdown";
import { getMemberDisplayName } from "../../teams/teamMemberDisplay";
import type { Task } from "../../tasks/taskTypes";
import type { TeamMember } from "../../teams/teamTypes";

type MemberPriorityWidgetProps = {
  tasks: Task[];
  members: TeamMember[];
  selectedMemberId: string | null;
  onSelectMember: (memberId: string) => void;
};

export function MemberPriorityWidget({
  tasks,
  members,
  selectedMemberId,
  onSelectMember,
}: MemberPriorityWidgetProps) {
  if (members.length === 0) {
    return <p className="dashboard-widget__empty">V týmu nejsou žádní členové.</p>;
  }

  const memberOptions = members.map((member) => ({
    value: member.userId,
    label: getMemberDisplayName(member),
  }));

  const memberTasks = tasks.filter((task) => task.assigneeId === selectedMemberId);
  const data = getPriorityBreakdown(memberTasks).filter((entry) => entry.count > 0);

  return (
    <div className="dashboard-member-priority">
      <CustomDropdown
        value={selectedMemberId ?? ""}
        options={memberOptions}
        onChange={onSelectMember}
        ariaLabel="Vyber člena týmu"
        className="dashboard-member-priority__select"
      />
      {data.length === 0 ? (
        <p className="dashboard-widget__empty">Žádné aktivní úkoly.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.priority} fill={entry.color} />
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
      )}
    </div>
  );
}
