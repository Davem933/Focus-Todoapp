import { useEffect } from "react";

type ToastProps = {
  message: string;
  onDismiss: () => void;
};

const AUTO_DISMISS_MS = 4000;

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeoutId);
  }, [message, onDismiss]);

  return (
    <div className="app-toast" role="alert">
      <span>{message}</span>
      <button type="button" className="app-toast__close" aria-label="Zavřít" onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}
