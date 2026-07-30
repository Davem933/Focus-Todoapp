import type { TaskSubtask } from "../../../tasks/taskTypes";

type ListSubtaskRowProps = {
  subtask: TaskSubtask;
  columnCount: number;
  onToggle: (subtaskId: string) => void;
};

export function ListSubtaskRow({ subtask, columnCount, onToggle }: ListSubtaskRowProps) {
  return (
    <tr className="list-subtask-row">
      <td className="list-subtask-row__cell" colSpan={columnCount}>
        <label className="list-subtask-row__label">
          <input type="checkbox" checked={subtask.completed} onChange={() => onToggle(subtask.id)} />
          <span className="list-subtask-row__title" data-completed={subtask.completed}>
            {subtask.title}
          </span>
        </label>
      </td>
    </tr>
  );
}
