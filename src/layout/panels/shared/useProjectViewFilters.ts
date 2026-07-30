import { useMemo, useState } from "react";
import type { Task, TaskPriority } from "../../../tasks/taskTypes";
import { filterProjectViewTasks } from "./projectViewFilters";
import type { ProjectViewDueFilter } from "./projectViewFilters";

export function useProjectViewFilters(tasks: Task[]) {
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<Set<TaskPriority>>(new Set());
  const [dueFilter, setDueFilter] = useState<ProjectViewDueFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  function toggleAssigneeFilter(userId: string) {
    setAssigneeFilter((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function togglePriorityFilter(priority: TaskPriority) {
    setPriorityFilter((current) => {
      const next = new Set(current);
      if (next.has(priority)) {
        next.delete(priority);
      } else {
        next.add(priority);
      }
      return next;
    });
  }

  const filteredTasks = useMemo(
    () => filterProjectViewTasks(tasks, { assigneeFilter, priorityFilter, dueFilter, searchQuery }),
    [tasks, assigneeFilter, priorityFilter, dueFilter, searchQuery],
  );

  return {
    assigneeFilter,
    toggleAssigneeFilter,
    priorityFilter,
    togglePriorityFilter,
    dueFilter,
    setDueFilter,
    searchQuery,
    setSearchQuery,
    filteredTasks,
  };
}
