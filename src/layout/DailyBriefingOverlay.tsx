import { useEffect, useState } from "react";
import { Loader2, Sparkle, Sunrise, X } from "lucide-react";
import { summarizeDailyBriefingTasks } from "../tasks/dailyBriefing";
import { generateDailyBriefingWithGroq, type DailyBriefing } from "../tasks/groqService";
import type { Task } from "../tasks/taskTypes";

type DailyBriefingOverlayProps = {
  boardName: string;
  tasks: Task[];
  onClose: () => void;
};

type BriefingPhase = "loading" | "ready" | "error";

export function DailyBriefingOverlay({ boardName, tasks, onClose }: DailyBriefingOverlayProps) {
  const [phase, setPhase] = useState<BriefingPhase>("loading");
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);

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
    let isCancelled = false;

    async function generate() {
      const taskSummaries = summarizeDailyBriefingTasks(tasks);

      if (taskSummaries.length === 0) {
        if (!isCancelled) {
          setBriefing({
            pozdravAUvod: `Dobré ráno! Na nástěnce „${boardName}“ dnes nemáš žádné naléhavé ani zpožděné úkoly.`,
            hlavniBodDne: "Můžeš se v klidu věnovat tomu, co tě dnes čeká.",
            doporucenePoradi: [],
            povzbuzeni: "Užij si klidný den!",
          });
          setPhase("ready");
        }

        return;
      }

      try {
        const generatedBriefing = await generateDailyBriefingWithGroq(taskSummaries);

        if (!isCancelled) {
          setBriefing(generatedBriefing);
          setPhase("ready");
        }
      } catch {
        if (!isCancelled) {
          setPhase("error");
        }
      }
    }

    void generate();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="daily-briefing-overlay" role="presentation">
      <button
        className="daily-briefing-overlay__backdrop"
        aria-label="Zavřít"
        type="button"
        onClick={onClose}
      />
      <section
        className="daily-briefing-overlay__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-briefing-title"
      >
        <div className="daily-briefing-overlay__header">
          <span className="daily-briefing-overlay__header-title">
            <Sunrise size={20} aria-hidden="true" />
            <strong id="daily-briefing-title">Ranní shrnutí — {boardName}</strong>
          </span>
          <button
            className="daily-briefing-overlay__close"
            aria-label="Zavřít"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {phase === "loading" ? (
          <div className="daily-briefing-overlay__skeleton" aria-live="polite" aria-busy="true">
            <Loader2 className="icon-spin" data-spinning="true" size={18} aria-hidden="true" />
            <span>Připravuji tvé ranní shrnutí…</span>
          </div>
        ) : null}

        {phase === "error" ? (
          <p className="daily-briefing-overlay__error">
            Shrnutí se nepodařilo načíst, ale tvé úkoly jsou připraveny níže na nástěnce.
          </p>
        ) : null}

        {phase === "ready" && briefing ? (
          <div className="daily-briefing-overlay__content">
            <p className="daily-briefing-overlay__intro">{briefing.pozdravAUvod}</p>
            {briefing.hlavniBodDne ? (
              <p className="daily-briefing-overlay__highlight">
                <Sparkle size={14} aria-hidden="true" />
                <strong>{briefing.hlavniBodDne}</strong>
              </p>
            ) : null}
            {briefing.doporucenePoradi.length > 0 ? (
              <ul className="daily-briefing-overlay__steps">
                {briefing.doporucenePoradi.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            ) : null}
            {briefing.povzbuzeni ? (
              <p className="daily-briefing-overlay__cheer">{briefing.povzbuzeni}</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
