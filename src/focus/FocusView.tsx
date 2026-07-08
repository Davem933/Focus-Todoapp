import { useEffect, useRef, useState } from "react";
import {
  requestTaskNotificationPermission,
  showFocusSessionNotification,
} from "../notifications/taskNotifications";
import type { Task, TaskPriority } from "../tasks/taskTypes";

const DEFAULT_FOCUS_DURATION_SECONDS = 25 * 60;
const CONTINUE_DURATION_SECONDS = 10 * 60;
const FOCUS_DURATION_OPTIONS = [5, 15, 25, 45, 60];

type TimerStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "expired"
  | "cancelled";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "Žádná",
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
};

type FocusViewProps = {
  task: Task | null;
  completedTodayCount: number;
  nextTaskTitle: string | null;
  onComplete: () => void;
  onCompleteSessionTask: () => void;
  onNextTask: () => void;
  onToggleSubtask: (subtaskId: string, completed: boolean) => void;
  onBack: () => void;
};

export function FocusView({
  task,
  completedTodayCount,
  nextTaskTitle,
  onComplete,
  onCompleteSessionTask,
  onNextTask,
  onToggleSubtask,
  onBack,
}: FocusViewProps) {
  const [selectedDurationSeconds, setSelectedDurationSeconds] = useState(
    DEFAULT_FOCUS_DURATION_SECONDS,
  );
  const [remainingSeconds, setRemainingSeconds] = useState(
    DEFAULT_FOCUS_DURATION_SECONDS,
  );
  const [timerStatus, setTimerStatus] = useState<TimerStatus>("idle");
  const [showCompletionFeedback, setShowCompletionFeedback] = useState(false);
  const hasHandledExpirationRef = useRef(false);
  const previousTimerStatusRef = useRef<TimerStatus>("idle");

  useEffect(() => {
    setSelectedDurationSeconds(DEFAULT_FOCUS_DURATION_SECONDS);
    setRemainingSeconds(DEFAULT_FOCUS_DURATION_SECONDS);
    setTimerStatus("idle");
    setShowCompletionFeedback(false);
    hasHandledExpirationRef.current = false;
    previousTimerStatusRef.current = "idle";
  }, [task?.id]);

  useEffect(() => {
    if (timerStatus !== "running" || remainingSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(timerId);
          setTimerStatus("expired");
          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [timerStatus, remainingSeconds]);

  useEffect(() => {
    if (timerStatus !== "expired" || !task || hasHandledExpirationRef.current) {
      return;
    }

    hasHandledExpirationRef.current = true;

    if (previousTimerStatusRef.current === "running") {
      playFocusEndSound();
    }

    if (document.visibilityState === "visible") {
      return;
    }

    void showFocusSessionNotification(task.title);
  }, [task, timerStatus]);

  useEffect(() => {
    previousTimerStatusRef.current = timerStatus;
  }, [timerStatus]);

  function handleSelectDuration(durationMinutes: number) {
    if (timerStatus === "running") {
      return;
    }

    const nextDurationSeconds = durationMinutes * 60;
    setSelectedDurationSeconds(nextDurationSeconds);
    setRemainingSeconds(nextDurationSeconds);
    setTimerStatus("idle");
    hasHandledExpirationRef.current = false;
  }

  function handleResetTimer() {
    setTimerStatus("idle");
    setRemainingSeconds(selectedDurationSeconds);
    hasHandledExpirationRef.current = false;
  }

  function handleStartTimer() {
    requestTaskNotificationPermission();
    hasHandledExpirationRef.current = false;
    setTimerStatus("running");
  }

  function handlePrimaryTimerAction() {
    if (timerStatus === "running") {
      setTimerStatus("paused");
      return;
    }

    handleStartTimer();
  }

  function handleCompleteTask() {
    onComplete();
  }

  function handleCompleteSessionTask() {
    setShowCompletionFeedback(true);
    onCompleteSessionTask();
    setTimerStatus("completed");
  }

  function handleContinueSession() {
    setSelectedDurationSeconds(CONTINUE_DURATION_SECONDS);
    setRemainingSeconds(CONTINUE_DURATION_SECONDS);
    hasHandledExpirationRef.current = false;
    setShowCompletionFeedback(false);
    setTimerStatus("running");
  }

  function handleCancelFocus() {
    setTimerStatus("cancelled");
    onBack();
  }

  if (!task) {
    return (
      <main className="focus-view" aria-label="Režim soustředění">
        <div className="focus-view__content">
          <h1>Úkol se nepodařilo najít</h1>
          <div className="focus-view__secondary-actions">
            <button type="button" onClick={onBack}>
              Zpět
            </button>
          </div>
        </div>
      </main>
    );
  }

  const elapsedSeconds = selectedDurationSeconds - remainingSeconds;
  const progressPercent =
    timerStatus === "expired" || timerStatus === "completed"
      ? 100
      : Math.min(
          100,
          Math.max(0, (elapsedSeconds / selectedDurationSeconds) * 100),
        );
  const isFinalFiveMinutes =
    remainingSeconds <= 5 * 60 &&
    timerStatus !== "idle" &&
    timerStatus !== "expired" &&
    timerStatus !== "completed" &&
    timerStatus !== "cancelled";
  const isTimerExpired = timerStatus === "expired";
  const isSessionCompleted = timerStatus === "completed";
  const isCompletionState = isTimerExpired || isSessionCompleted;
  const activeSubtask =
    task.subtasks.find((subtask) => !subtask.completed) ?? null;
  const areAllSubtasksCompleted =
    task.subtasks.length > 0 &&
    task.subtasks.every((subtask) => subtask.completed);
  const focusMetaItems = [
    task.dueDate
      ? `Termín ${task.dueDate}${task.dueTime ? `, ${task.dueTime}` : ""}`
      : null,
    task.priority !== "none" ? `Priorita ${PRIORITY_LABELS[task.priority]}`
      : null,
  ].filter(Boolean) as string[];
  const primaryTimerActionLabel = timerStatus === "running" ? "Pause" : "Start";

  return (
    <main className="focus-view" aria-label="Režim soustředění">
      <div
        className="focus-view__content"
        data-focus-state={isCompletionState ? "completion" : "running"}
      >
        {isCompletionState ? (
          <section
            className="focus-view__completion-screen"
            data-confirmed={showCompletionFeedback}
            role="status"
          >
            <strong className="focus-view__completion-headline">
              {showCompletionFeedback ? "✓ Hotovo" : "Skvělá práce"}
            </strong>
            <h1 className="focus-view__completion-title">{task.title}</h1>
            <p className="focus-view__completion-timer">
              {formatRemainingTime(remainingSeconds)}
            </p>
            <p className="focus-view__completion-counter">
              Dnes: <AnimatedCount value={completedTodayCount} /> hotovo
            </p>
            {showCompletionFeedback ? (
              <span className="focus-view__completion-check" aria-hidden="true">
                ✓
              </span>
            ) : null}
            <div className="focus-view__completion-actions">
              {isTimerExpired ? (
                <button
                  className="focus-view__completion-primary"
                  type="button"
                  onClick={handleCompleteSessionTask}
                >
                  Označit jako hotové
                </button>
              ) : null}
              <button type="button" onClick={handleContinueSession}>
                Pokračovat
              </button>
              {nextTaskTitle ? (
                <button
                  className="focus-view__completion-link"
                  type="button"
                  onClick={onNextTask}
                >
                  Další úkol
                </button>
              ) : null}
            </div>
          </section>
        ) : (
          <>
            <p className="focus-view__eyebrow">Režim soustředění</p>
            <h1>{task.title}</h1>
            {focusMetaItems.length > 0 ? (
              <div className="focus-view__meta">
                {focusMetaItems.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}

            {activeSubtask ? (
              <div className="focus-view__subtasks" aria-label="Aktivní podúkol">
                <label
                  className="focus-view__subtask focus-view__subtask--active"
                  data-completed={activeSubtask.completed}
                >
                  <input
                    checked={activeSubtask.completed}
                    type="checkbox"
                    onChange={(event) =>
                      onToggleSubtask(activeSubtask.id, event.currentTarget.checked)
                    }
                  />
                  <span>{activeSubtask.title}</span>
                </label>
              </div>
            ) : null}

            <section
              className="focus-view__timer"
              data-final-minutes={isFinalFiveMinutes}
              data-timer-status={timerStatus}
              aria-label="Časovač soustředění"
            >
              <div
                className="focus-view__duration-options"
                aria-label="Délka relace"
              >
                {FOCUS_DURATION_OPTIONS.map((durationMinutes) => {
                  const durationSeconds = durationMinutes * 60;

                  return (
                    <button
                      aria-pressed={selectedDurationSeconds === durationSeconds}
                      disabled={timerStatus === "running"}
                      key={durationMinutes}
                      type="button"
                      onClick={() => handleSelectDuration(durationMinutes)}
                    >
                      {durationMinutes === 5
                        ? "5 min (rychlá)"
                        : `${durationMinutes} min`}
                    </button>
                  );
                })}
              </div>
              <span>{formatRemainingTime(remainingSeconds)}</span>
              <div className="focus-view__progress" aria-label="Průběh času">
                <div style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="focus-view__timer-actions">
                <button
                  className="focus-view__primary-action"
                  type="button"
                  onClick={handlePrimaryTimerAction}
                >
                  {primaryTimerActionLabel}
                </button>
              </div>
              <div className="focus-view__secondary-actions">
                <button type="button" onClick={handleResetTimer}>
                  Reset
                </button>
                <button type="button" onClick={handleCancelFocus}>
                  Zpět
                </button>
              </div>
            </section>

            {areAllSubtasksCompleted ? (
              <div className="focus-view__actions">
                <button type="button" onClick={handleCompleteTask}>
                  Hotovo
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function AnimatedCount({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const previousValue = previousValueRef.current;

    if (previousValue === value) {
      setDisplayValue(value);
      return;
    }

    const durationMs = 300;
    const startTime = performance.now();
    let animationFrameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const nextValue = Math.round(
        previousValue + (value - previousValue) * progress,
      );

      setDisplayValue(nextValue);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(tick);
        return;
      }

      previousValueRef.current = value;
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [value]);

  return <>{displayValue}</>;
}

function formatRemainingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(
    2,
    "0",
  )}`;
}

function playFocusEndSound() {
  playBeep();
  window.setTimeout(playBeep, 280);
}

function playBeep() {
  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    const audioContext = new AudioContextConstructor();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
    oscillator.onended = () => {
      void audioContext.close();
    };
  } catch {
    // Zvuk je pouze volitelná vrstva. Režim soustředění musí fungovat i bez něj.
  }
}

