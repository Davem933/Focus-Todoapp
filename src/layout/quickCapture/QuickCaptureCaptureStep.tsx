import { Mic, Square } from "lucide-react";
import type { SpeechRecognitionStatus } from "./useSpeechRecognition";

type QuickCaptureCaptureStepProps = {
  text: string;
  onTextChange: (value: string) => void;
  speechStatus: SpeechRecognitionStatus;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onProcess: () => void;
};

export function QuickCaptureCaptureStep({
  text,
  onTextChange,
  speechStatus,
  onStartRecording,
  onStopRecording,
  onProcess,
}: QuickCaptureCaptureStepProps) {
  const isListening = speechStatus === "listening";
  const canRecord = speechStatus !== "unsupported";

  return (
    <div className="quick-capture-capture">
      {canRecord ? (
        <button
          type="button"
          className="quick-capture-capture__record-button"
          data-listening={isListening ? "true" : "false"}
          aria-label={isListening ? "Zastavit nahrávání" : "Spustit nahrávání"}
          onClick={isListening ? onStopRecording : onStartRecording}
        >
          {isListening ? <Square size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          {isListening ? "Poslouchám…" : "Nahrávat"}
        </button>
      ) : (
        <p className="quick-capture-capture__hint">
          Rozpoznávání hlasu není v tomto prohlížeči podporováno. Napište úkol do pole níže.
        </p>
      )}

      {speechStatus === "denied" ? (
        <p className="quick-capture-capture__hint" role="alert">
          Přístup k mikrofonu byl zamítnut. Použijte prosím textové pole.
        </p>
      ) : null}

      {speechStatus === "error" ? (
        <p className="quick-capture-capture__hint" role="alert">
          Rozpoznávání hlasu selhalo. Zkuste to znovu nebo napište úkol ručně.
        </p>
      ) : null}

      <textarea
        className="quick-capture-capture__textarea"
        value={text}
        onChange={(event) => onTextChange(event.currentTarget.value)}
        placeholder="Např. Připomeň mi zítra v 10 ráno poslat fakturu Petrovi a dej tomu vysokou prioritu"
        rows={4}
      />

      <div className="quick-capture-capture__actions">
        <button
          type="button"
          className="quick-capture-capture__submit"
          onClick={onProcess}
          disabled={!text.trim()}
        >
          Zpracovat
        </button>
      </div>
    </div>
  );
}
