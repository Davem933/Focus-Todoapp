import { Mic } from "lucide-react";

type QuickCaptureFabProps = {
  onOpen: () => void;
};

export function QuickCaptureFab({ onOpen }: QuickCaptureFabProps) {
  return (
    <button
      type="button"
      className="quick-capture-fab"
      aria-label="Rychlé zadání úkolu hlasem nebo textem"
      title="Smart Quick Capture"
      onClick={onOpen}
    >
      <Mic size={22} aria-hidden="true" />
    </button>
  );
}
