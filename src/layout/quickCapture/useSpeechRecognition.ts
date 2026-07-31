import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecognitionStatus = "unsupported" | "idle" | "listening" | "denied" | "error";

// The Web Speech API has no official TypeScript lib defs (it's non-standard);
// these narrow local types describe only what this hook actually uses.
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};
type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | undefined {
  const globalWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };

  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition;
}

type UseSpeechRecognitionResult = {
  status: SpeechRecognitionStatus;
  transcript: string;
  start: () => void;
  stop: () => void;
};

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [status, setStatus] = useState<SpeechRecognitionStatus>(() =>
    getSpeechRecognitionConstructor() ? "idle" : "unsupported",
  );
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionConstructor) {
      setStatus("unsupported");
      return;
    }

    setTranscript("");
    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = "cs-CZ";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let combinedTranscript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        combinedTranscript += event.results[index][0].transcript;
      }

      setTranscript(combinedTranscript);
    };

    recognition.onerror = (event) => {
      setStatus(event.error === "not-allowed" ? "denied" : "error");
    };

    recognition.onend = () => {
      setStatus((currentStatus) => (currentStatus === "listening" ? "idle" : currentStatus));
    };

    recognitionRef.current = recognition;
    setStatus("listening");
    recognition.start();
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { status, transcript, start, stop };
}
