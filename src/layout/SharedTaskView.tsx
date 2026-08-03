import { useEffect, useState } from "react";
import { fetchSharedTask } from "../supabase/taskShareApi";
import type { SharedTaskPreview } from "../supabase/taskShareApi";

const PRIORITY_LABELS: Record<string, string> = {
  none: "Žádná",
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
};

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; task: SharedTaskPreview };

export function SharedTaskView({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let isCancelled = false;

    fetchSharedTask(token)
      .then((task) => {
        if (isCancelled) {
          return;
        }

        setState(task ? { status: "ready", task } : { status: "not-found" });
      })
      .catch(() => {
        if (!isCancelled) {
          setState({ status: "error" });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [token]);

  if (state.status === "loading") {
    return (
      <div className="shared-task-view">
        <p>Načítám náhled úkolu…</p>
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className="shared-task-view">
        <h1>Odkaz není platný</h1>
        <p>Sdílení tohoto úkolu bylo zrušeno, nebo odkaz nikdy neexistoval.</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="shared-task-view">
        <h1>Něco se nepovedlo</h1>
        <p>Náhled úkolu se nepodařilo načíst. Zkuste to prosím znovu.</p>
      </div>
    );
  }

  const { task } = state;

  return (
    <div className="shared-task-view">
      <p className="shared-task-view__eyebrow">Náhled úkolu (jen ke čtení)</p>
      <h1 className="shared-task-view__title">{task.title}</h1>

      <div className="shared-task-view__meta">
        <span
          className={
            task.completed
              ? "shared-task-view__status shared-task-view__status--done"
              : "shared-task-view__status"
          }
        >
          {task.completed ? "Hotovo" : "Nehotovo"}
        </span>
        {task.priority !== "none" ? (
          <span className="shared-task-view__priority">
            Priorita: {PRIORITY_LABELS[task.priority] ?? task.priority}
          </span>
        ) : null}
        {task.dueDate ? (
          <span className="shared-task-view__due">
            Termín: {task.dueDate}
            {task.dueTime ? ` ${task.dueTime}` : ""}
          </span>
        ) : null}
      </div>

      {task.projectName || task.teamName ? (
        <p className="shared-task-view__context">
          {task.projectName ? `Projekt: ${task.projectName}` : null}
          {task.projectName && task.teamName ? " · " : null}
          {task.teamName ? `Tým: ${task.teamName}` : null}
        </p>
      ) : null}

      {task.assigneeName ? (
        <p className="shared-task-view__context">Přiřazeno: {task.assigneeName}</p>
      ) : null}

      {task.note ? <p className="shared-task-view__note">{task.note}</p> : null}

      {task.subtasks.length > 0 ? (
        <ul className="shared-task-view__subtasks">
          {task.subtasks.map((subtask) => (
            <li
              key={subtask.id}
              className={
                subtask.completed
                  ? "shared-task-view__subtask shared-task-view__subtask--done"
                  : "shared-task-view__subtask"
              }
            >
              {subtask.title}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
