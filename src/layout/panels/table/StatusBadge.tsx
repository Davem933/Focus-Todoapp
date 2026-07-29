import { CustomDropdown } from "../../CustomDropdown";
import type { ProjectColumn } from "../../../projects/projectTypes";
import { classifyColumnState } from "./tableStatus";

type StatusBadgeProps = {
  columns: ProjectColumn[];
  columnKey: string;
  onChange: (columnKey: string) => void;
};

export function StatusBadge({ columns, columnKey, onChange }: StatusBadgeProps) {
  const activeColumn = columns.find((column) => column.key === columnKey) ?? null;
  const state = classifyColumnState(columnKey, columns);
  const label = (activeColumn?.title ?? columnKey).toUpperCase();

  return (
    <CustomDropdown
      className="table-status-badge"
      value={columnKey}
      options={columns.map((column) => ({ value: column.key, label: column.title }))}
      onChange={onChange}
      ariaLabel={"Stav ukolu: " + label}
      renderTriggerContent={() => (
        <span className="table-status-badge__pill" data-state={state}>
          {label}
        </span>
      )}
    />
  );
}
