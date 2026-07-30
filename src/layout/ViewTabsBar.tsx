import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { BarChart3, CalendarDays, ChartGantt, List, NotebookText, Plus, Table2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ViewTabKind = "list" | "calendar" | "table" | "dashboard" | "gantt" | "notes";

const VIEW_TAB_CONFIG: Record<ViewTabKind, { label: string; Icon: LucideIcon }> = {
  list: { label: "Seznam", Icon: List },
  calendar: { label: "Kalendář", Icon: CalendarDays },
  table: { label: "Tabulka", Icon: Table2 },
  dashboard: { label: "Dashboard", Icon: BarChart3 },
  gantt: { label: "Gantt diagram", Icon: ChartGantt },
  notes: { label: "Poznámky", Icon: NotebookText },
};

const VIEW_TAB_ORDER: ViewTabKind[] = ["list", "calendar", "table", "dashboard", "gantt", "notes"];

type ViewTabsBarProps = {
  tabs: ViewTabKind[];
  activeTab: ViewTabKind | null;
  onSelectTab: (kind: ViewTabKind) => void;
  onCloseTab: (kind: ViewTabKind) => void;
  onReorderTabs: (tabs: ViewTabKind[]) => void;
  onAddTab: (kind: ViewTabKind) => void;
};

export function ViewTabsBar({
  tabs,
  activeTab,
  onSelectTab,
  onCloseTab,
  onReorderTabs,
  onAddTab,
}: ViewTabsBarProps) {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAddMenuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAddMenuOpen]);

  const availableKinds = VIEW_TAB_ORDER.filter((kind) => !tabs.includes(kind));

  function handleDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();

    if (dragIndex === null || dragIndex === index) {
      return;
    }

    const next = [...tabs];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(index);
    onReorderTabs(next);
  }

  return (
    <div className="app-shell__view-tabs" role="tablist" aria-label="Zobrazení">
      <div className="app-shell__view-tabs-list">
        {tabs.map((kind, index) => {
          const { label, Icon } = VIEW_TAB_CONFIG[kind];

          return (
            <div
              key={kind}
              className="view-tab"
              data-selected={activeTab === kind}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => handleDragOver(event, index)}
              onDragEnd={() => setDragIndex(null)}
            >
              <button
                className="view-tab__select"
                type="button"
                role="tab"
                aria-selected={activeTab === kind}
                onClick={() => onSelectTab(kind)}
              >
                <Icon aria-hidden="true" size={15} />
                <span>{label}</span>
              </button>
              <button
                className="view-tab__close"
                type="button"
                aria-label={`Zavřít ${label}`}
                onClick={() => onCloseTab(kind)}
              >
                <X aria-hidden="true" size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="app-shell__view-tabs-add" ref={menuRef}>
        <button
          className="app-shell__view-tabs-add-button"
          type="button"
          onClick={() => setIsAddMenuOpen((open) => !open)}
        >
          <Plus aria-hidden="true" size={14} />
          Zobrazení
        </button>
        {isAddMenuOpen && availableKinds.length > 0 ? (
          <div className="app-shell__view-tabs-menu" role="menu">
            {availableKinds.map((kind) => {
              const { label, Icon } = VIEW_TAB_CONFIG[kind];

              return (
                <button
                  key={kind}
                  className="app-shell__view-tabs-menu-item"
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    onAddTab(kind);
                    setIsAddMenuOpen(false);
                  }}
                >
                  <Icon aria-hidden="true" size={15} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
