import type { Task } from "../tasks/taskTypes";
import type { Project } from "../projects/projectTypes";

export type ProjectBreakdownEntry = {
  projectId: string | null;
  name: string;
  count: number;
};

const NO_PROJECT_NAME = "Bez nástěnky";
const UNKNOWN_PROJECT_NAME = "Neznámá nástěnka";

export function getProjectBreakdown(tasks: Task[], projects: Project[]): ProjectBreakdownEntry[] {
  const activeTasks = tasks.filter((task) => !task.completed && !task.isArchived);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const countByProjectId = new Map<string | null, number>();

  for (const task of activeTasks) {
    countByProjectId.set(task.projectId, (countByProjectId.get(task.projectId) ?? 0) + 1);
  }

  return Array.from(countByProjectId.entries())
    .map(([projectId, count]) => ({
      projectId,
      name: projectId ? (projectById.get(projectId)?.name ?? UNKNOWN_PROJECT_NAME) : NO_PROJECT_NAME,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
