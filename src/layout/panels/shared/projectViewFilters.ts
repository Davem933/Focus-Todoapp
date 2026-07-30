import type { Task, TaskPriority } from "../../../tasks/taskTypes";

export type ProjectViewDueFilter = "all" | "overdue" | "no_date";

export type ProjectViewFilterState = {
  assigneeFilter: Set<string>;
  priorityFilter: Set<TaskPriority>;
  dueFilter: ProjectViewDueFilter;
  searchQuery: string;
};

export function filterProjectViewTasks(tasks: Task[], filters: ProjectViewFilterState): Task[] {
  const query = filters.searchQuery.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.assigneeFilter.size > 0 && (!task.assigneeId || !filters.assigneeFilter.has(task.assigneeId))) {
      return false;
    }

    if (filters.priorityFilter.size > 0 && !filters.priorityFilter.has(task.priority)) {
      return false;
    }

    if (
      filters.dueFilter === "overdue" &&
      !(task.dueDate && new Date(task.dueDate + "T23:59:59") < new Date() && !task.completed)
    ) {
      return false;
    }

    if (filters.dueFilter === "no_date" && task.dueDate) {
      return false;
    }

    if (query && !task.title.toLowerCase().includes(query)) {
      return false;
    }

    return true;
  });
}
