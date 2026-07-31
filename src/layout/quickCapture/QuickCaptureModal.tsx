import { useEffect, useState } from "react";
import { loadTeamMembers } from "../../supabase/teamApi";
import { matchAssigneeIdByName } from "../../tasks/assigneeMatch";
import { resolveQuickCapture } from "../../tasks/quickCaptureResolve";
import type { TeamMember } from "../../teams/teamTypes";
import { QuickCaptureCaptureStep } from "./QuickCaptureCaptureStep";
import { QuickCapturePreviewStep } from "./QuickCapturePreviewStep";
import type { QuickCaptureCreateOptions, QuickCapturePreviewState } from "./quickCaptureTypes";
import { useSpeechRecognition } from "./useSpeechRecognition";

type QuickCaptureModalProps = {
  activeTeamId: string | null;
  onClose: () => void;
  onCreateTask: (title: string, options?: QuickCaptureCreateOptions) => string | null;
};

type Phase = "capture" | "loading" | "preview";

export function QuickCaptureModal({ activeTeamId, onClose, onCreateTask }: QuickCaptureModalProps) {
  const [phase, setPhase] = useState<Phase>("capture");
  const [text, setText] = useState("");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuickCapturePreviewState | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const speech = useSpeechRecognition();

  useEffect(() => {
    if (speech.status === "listening") {
      setText(speech.transcript);
    }
  }, [speech.transcript, speech.status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!activeTeamId) {
      setMembers([]);
      return;
    }

    let isCancelled = false;

    loadTeamMembers(activeTeamId)
      .then((loadedMembers) => {
        if (!isCancelled) {
          setMembers(loadedMembers);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setMembers([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTeamId]);

  async function handleProcess() {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    setPhase("loading");

    const { parsed, usedAi } = await resolveQuickCapture(trimmedText, new Date());
    const assigneeId = parsed.assigneeName ? matchAssigneeIdByName(parsed.assigneeName, members) : null;

    setPreview({
      title: parsed.title,
      dueDate: parsed.dueDate ?? "",
      dueTime: parsed.dueTime ?? "",
      priority: parsed.priority,
      assigneeId: assigneeId ?? "",
    });
    setInfoMessage(
      usedAi ? null : "AI zpracování nedostupné, použit základní rozpoznávač data a času.",
    );
    setPhase("preview");
  }

  function handleConfirm() {
    if (!preview || !preview.title.trim()) {
      return;
    }

    onCreateTask(preview.title.trim(), {
      dueDate: preview.dueDate || null,
      dueTime: preview.dueDate ? preview.dueTime || null : null,
      priority: preview.priority,
      assigneeId: preview.assigneeId || null,
      teamId: activeTeamId,
    });
    onClose();
  }

  function handleBackToCapture() {
    setPhase("capture");
    setPreview(null);
  }

  return (
    <div className="quick-capture-overlay" role="presentation">
      <button
        type="button"
        className="quick-capture-overlay__backdrop"
        aria-label="Zavřít"
        onClick={onClose}
      />
      <section
        className="quick-capture-overlay__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-capture-title"
      >
        <div className="quick-capture-overlay__header">
          <strong id="quick-capture-title">Smart Quick Capture</strong>
          <button type="button" className="quick-capture-overlay__close" aria-label="Zavřít" onClick={onClose}>
            ✕
          </button>
        </div>

        {phase === "capture" ? (
          <QuickCaptureCaptureStep
            text={text}
            onTextChange={setText}
            speechStatus={speech.status}
            onStartRecording={speech.start}
            onStopRecording={speech.stop}
            onProcess={handleProcess}
          />
        ) : null}

        {phase === "loading" ? (
          <div className="quick-capture-loading" role="status">
            Zpracovávám…
          </div>
        ) : null}

        {phase === "preview" && preview ? (
          <QuickCapturePreviewStep
            preview={preview}
            onChange={setPreview}
            infoMessage={infoMessage}
            members={members}
            onConfirm={handleConfirm}
            onBack={handleBackToCapture}
            onCancel={onClose}
          />
        ) : null}
      </section>
    </div>
  );
}
