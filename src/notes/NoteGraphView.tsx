import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildNoteGraphModel,
  filterToLocalGraph,
  stepGraphSimulation,
} from "./noteGraphLayout";
import type { Note } from "./noteTypes";

const backdropMotion = {
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  initial: { opacity: 0 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

const cardMotion = {
  animate: { opacity: 1, scale: 1, x: "-50%", y: "-50%" },
  exit: { opacity: 0, scale: 0.97, x: "-50%", y: "-50%" },
  initial: { opacity: 0, scale: 0.97, x: "-50%", y: "-50%" },
  transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const },
};

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

type NoteGraphViewProps = {
  isOpen: boolean;
  notes: Note[];
  mode: "global" | "local";
  focusNoteId: string | null;
  onModeChange: (mode: "global" | "local") => void;
  onOpenNote: (noteId: string) => void;
  onClose: () => void;
};

export function NoteGraphView({
  isOpen,
  notes,
  mode,
  focusNoteId,
  onModeChange,
  onOpenNote,
  onClose,
}: NoteGraphViewProps) {
  const [, setTick] = useState(0);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const panRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);

  const fullModel = useMemo(() => buildNoteGraphModel(notes), [notes]);
  const model = useMemo(() => {
    if (mode === "local" && focusNoteId) {
      return filterToLocalGraph(fullModel, focusNoteId);
    }

    return fullModel;
  }, [focusNoteId, fullModel, mode]);

  const nodesRef = useRef(model.nodes);

  useEffect(() => {
    nodesRef.current = model.nodes;
    setView({ scale: 1, x: 0, y: 0 });
  }, [model]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let frameId: number;

    function tick() {
      stepGraphSimulation(nodesRef.current, model.edges);
      setTick((current) => current + 1);
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [isOpen, model.edges]);

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    setView((current) => ({
      ...current,
      scale: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * delta)),
    }));
  }

  function handleBackgroundPointerDown(event: PointerEvent<SVGRectElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, startX: event.clientX - view.x, startY: event.clientY - view.y };
  }

  function handleBackgroundPointerMove(event: PointerEvent<SVGRectElement>) {
    const pan = panRef.current;

    if (!pan || pan.pointerId !== event.pointerId) {
      return;
    }

    const nextX = event.clientX - pan.startX;
    const nextY = event.clientY - pan.startY;

    setView((current) => ({ ...current, x: nextX, y: nextY }));
  }

  function handleBackgroundPointerUp(event: PointerEvent<SVGRectElement>) {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
    }
  }

  function zoomBy(factor: number) {
    setView((current) => ({
      ...current,
      scale: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * factor)),
    }));
  }

  function resetView() {
    setView({ scale: 1, x: 0, y: 0 });
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.button
            {...backdropMotion}
            aria-label="Zavřít graf poznámek"
            className="fixed inset-0 bg-black/60"
            type="button"
            onClick={onClose}
          />
          <motion.div
            {...cardMotion}
            aria-label="Graf poznámek"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 flex h-[36rem] w-[52rem] max-w-[92vw] flex-col overflow-hidden rounded-lg border border-nt-border bg-nt-card-strong shadow-2xl"
            role="dialog"
          >
            <div className="flex items-center gap-2 border-b border-nt-border px-3 py-2">
              <div
                className="inline-flex gap-1 rounded-full border border-nt-border bg-nt-card p-1"
                role="tablist"
                aria-label="Režim grafu"
              >
                <button
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold text-nt-muted",
                    mode === "global" && "bg-nt-brand text-nt-brand-foreground",
                  )}
                  data-selected={mode === "global"}
                  type="button"
                  onClick={() => onModeChange("global")}
                >
                  Celý graf
                </button>
                <button
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold text-nt-muted disabled:opacity-40",
                    mode === "local" && "bg-nt-brand text-nt-brand-foreground",
                  )}
                  data-selected={mode === "local"}
                  disabled={!focusNoteId}
                  type="button"
                  onClick={() => onModeChange("local")}
                >
                  Lokální graf
                </button>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  aria-label="Oddálit"
                  className="rounded-md p-1.5 text-nt-muted hover:bg-nt-card-hover hover:text-nt-fg"
                  title="Oddálit"
                  type="button"
                  onClick={() => zoomBy(0.85)}
                >
                  <Minus aria-hidden="true" size={14} />
                </button>
                <button
                  aria-label="Přiblížit"
                  className="rounded-md p-1.5 text-nt-muted hover:bg-nt-card-hover hover:text-nt-fg"
                  title="Přiblížit"
                  type="button"
                  onClick={() => zoomBy(1.15)}
                >
                  <Plus aria-hidden="true" size={14} />
                </button>
                <button
                  aria-label="Reset pohledu"
                  className="rounded-md p-1.5 text-nt-muted hover:bg-nt-card-hover hover:text-nt-fg"
                  title="Reset pohledu"
                  type="button"
                  onClick={resetView}
                >
                  <RotateCcw aria-hidden="true" size={14} />
                </button>
                <button
                  aria-label="Zavřít graf"
                  className="rounded-md p-1.5 text-nt-muted hover:bg-nt-card-hover hover:text-nt-fg"
                  title="Zavřít"
                  type="button"
                  onClick={onClose}
                >
                  <X aria-hidden="true" size={14} />
                </button>
              </div>
            </div>

            <svg className="min-h-0 flex-1 cursor-grab bg-nt-bg active:cursor-grabbing" onWheel={handleWheel}>
              <rect
                fill="transparent"
                height="100%"
                width="100%"
                onPointerDown={handleBackgroundPointerDown}
                onPointerMove={handleBackgroundPointerMove}
                onPointerUp={handleBackgroundPointerUp}
              />
              <g transform={`translate(${view.x + 400} ${view.y + 220}) scale(${view.scale})`}>
                {model.edges.map((edge) => {
                  const source = nodesRef.current.find((node) => node.id === edge.sourceId);
                  const target = nodesRef.current.find((node) => node.id === edge.targetId);

                  if (!source || !target) {
                    return null;
                  }

                  return (
                    <line
                      className="stroke-nt-border"
                      key={`${edge.sourceId}-${edge.targetId}`}
                      strokeWidth={1}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                    />
                  );
                })}
                {nodesRef.current.map((node) => {
                  const radius = Math.min(6 + node.degree * 1.4, 16);
                  const isCurrent = node.id === focusNoteId;

                  return (
                    <g
                      className="cursor-pointer"
                      key={node.id}
                      transform={`translate(${node.x} ${node.y})`}
                      onClick={() => onOpenNote(node.id)}
                    >
                      <circle className="fill-transparent" r={radius + 10} />
                      <circle
                        className={cn("fill-nt-card", isCurrent ? "stroke-nt-brand" : "stroke-nt-border")}
                        r={radius}
                        strokeWidth={isCurrent ? 2.5 : 1.5}
                      />
                      <text className="fill-nt-muted text-[11px]" dy={radius + 12} textAnchor="middle">
                        {node.title}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {model.nodes.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-nt-muted">
                Žádné propojené poznámky k zobrazení.
              </p>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
