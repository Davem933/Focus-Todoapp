import type { Task } from '../tasks/taskTypes';

export type TaskTeamCounts = {
  personal: number;
  byTeamId: Record<string, number>;
};

type TaskWithTeamId = Task & {
  teamId?: string | null;
};

export function buildCountsByTeamId(tasks: TaskWithTeamId[]): TaskTeamCounts {
  const counts: TaskTeamCounts = {
    personal: 0,
    byTeamId: {},
  };

  for (const task of tasks) {
    const teamId = task.teamId ?? null;

    if (!teamId) {
      counts.personal += 1;
      continue;
    }

    counts.byTeamId[teamId] = (counts.byTeamId[teamId] ?? 0) + 1;
  }

  return counts;
}

