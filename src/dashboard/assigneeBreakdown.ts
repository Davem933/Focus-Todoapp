import { getMemberDisplayName } from "../teams/teamMemberDisplay";
import type { Task } from "../tasks/taskTypes";
import type { TeamMember } from "../teams/teamTypes";

export type AssigneeBreakdownEntry = {
  assigneeId: string | null;
  name: string;
  count: number;
};

const UNASSIGNED_LABEL = "Nepřiřazeno";

const CHART_COLORS = [
  "#6d5dfc",
  "#38bdf8",
  "#f59e0b",
  "#22c55e",
  "#f43f5e",
  "#c4b5fd",
  "#fbbf24",
  "#2dd4bf",
];

export function getAssigneeBreakdown(tasks: Task[], members: TeamMember[]): AssigneeBreakdownEntry[] {
  const activeTasks = tasks.filter((task) => !task.completed && !task.isArchived);
  const memberById = new Map(members.map((member) => [member.userId, member]));
  const countByAssignee = new Map<string | null, number>();

  for (const task of activeTasks) {
    countByAssignee.set(task.assigneeId, (countByAssignee.get(task.assigneeId) ?? 0) + 1);
  }

  return Array.from(countByAssignee.entries())
    .map(([assigneeId, count]) => {
      const member = assigneeId ? memberById.get(assigneeId) : null;

      return {
        assigneeId,
        name: member ? getMemberDisplayName(member) : UNASSIGNED_LABEL,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function getAssigneeChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
