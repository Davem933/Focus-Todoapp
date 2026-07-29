import type { ProjectColumn } from "../../../projects/projectTypes";

export type TableRowStatus = "todo" | "in-progress" | "done";

export function classifyColumnState(columnKey: string, columns: ProjectColumn[]): TableRowStatus {
  if (columnKey === "done") {
    return "done";
  }

  const index = columns.findIndex((column) => column.key === columnKey);

  if (index <= 0) {
    return "todo";
  }

  return "in-progress";
}
