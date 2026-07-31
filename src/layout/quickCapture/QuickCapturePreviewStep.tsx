import type { TaskPriority } from "../../tasks/taskTypes";
import { BOARD_CARD_PRIORITY_LABELS, BOARD_CARD_PRIORITY_OPTIONS } from "../../tasks/taskPriorityColors";
import type { Project } from "../../projects/projectTypes";
import type { TeamMember } from "../../teams/teamTypes";
import { getMemberDisplayName } from "../../teams/teamMemberDisplay";
import type { QuickCapturePreviewState } from "./quickCaptureTypes";

type QuickCapturePreviewStepProps = {
  preview: QuickCapturePreviewState;
  onChange: (next: QuickCapturePreviewState) => void;
  infoMessage: string | null;
  members: TeamMember[];
  boards: Project[];
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
};

export function QuickCapturePreviewStep({
  preview,
  onChange,
  infoMessage,
  members,
  boards,
  onConfirm,
  onBack,
  onCancel,
}: QuickCapturePreviewStepProps) {
  return (
    <div className="quick-capture-preview">
      {infoMessage ? <p className="quick-capture-preview__message">{infoMessage}</p> : null}

      <label className="quick-capture-preview__field">
        Název úkolu
        <input
          type="text"
          value={preview.title}
          onChange={(event) => onChange({ ...preview, title: event.currentTarget.value })}
        />
      </label>

      <label className="quick-capture-preview__field">
        Datum
        <input
          type="date"
          value={preview.dueDate}
          onChange={(event) => onChange({ ...preview, dueDate: event.currentTarget.value })}
        />
      </label>

      <label className="quick-capture-preview__field">
        Čas
        <input
          type="time"
          value={preview.dueTime}
          disabled={!preview.dueDate}
          onChange={(event) => onChange({ ...preview, dueTime: event.currentTarget.value })}
        />
      </label>

      <label className="quick-capture-preview__field">
        Priorita
        <select
          value={preview.priority}
          onChange={(event) =>
            onChange({ ...preview, priority: event.currentTarget.value as TaskPriority })
          }
        >
          {BOARD_CARD_PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {BOARD_CARD_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
      </label>

      <label className="quick-capture-preview__field">
        Řešitel
        <select
          value={preview.assigneeId}
          onChange={(event) => onChange({ ...preview, assigneeId: event.currentTarget.value })}
        >
          <option value="">Nepřiřazeno</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {getMemberDisplayName(member)}
            </option>
          ))}
        </select>
      </label>

      <label className="quick-capture-preview__field">
        Nástěnka
        <select
          value={preview.projectId}
          onChange={(event) => onChange({ ...preview, projectId: event.currentTarget.value })}
        >
          <option value="">Bez nástěnky</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </label>

      <div className="quick-capture-preview__actions">
        <button type="button" onClick={onBack}>
          Zpět
        </button>
        <button type="button" onClick={onCancel}>
          Zrušit
        </button>
        <button
          type="button"
          className="quick-capture-preview__confirm"
          onClick={onConfirm}
          disabled={!preview.title.trim()}
        >
          Přidat úkol
        </button>
      </div>
    </div>
  );
}
