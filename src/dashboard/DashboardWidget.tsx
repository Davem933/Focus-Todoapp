import { useEffect, useRef, useState, type ReactNode } from "react";
import { GripVertical, MoreVertical, EyeOff } from "lucide-react";
import type { DashboardWidgetKind } from "./dashboardTypes";

type DashboardWidgetProps = {
  kind: DashboardWidgetKind;
  title: string;
  isEditMode: boolean;
  onHide: (kind: DashboardWidgetKind) => void;
  children: ReactNode;
};

export function DashboardWidget({ kind, title, isEditMode, onHide, children }: DashboardWidgetProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget__header">
        {isEditMode ? (
          <span className="dashboard-widget__drag-handle" aria-hidden="true">
            <GripVertical size={15} />
          </span>
        ) : null}
        <strong>{title}</strong>
        {isEditMode ? (
          <div className="dashboard-widget__menu" ref={menuRef}>
            <button
              type="button"
              className="dashboard-widget__menu-trigger"
              aria-label={`Možnosti widgetu ${title}`}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <MoreVertical aria-hidden="true" size={16} />
            </button>
            {isMenuOpen ? (
              <div className="dashboard-widget__menu-list" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onHide(kind);
                  }}
                >
                  <EyeOff aria-hidden="true" size={14} />
                  Skrýt widget
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="dashboard-widget__content">{children}</div>
    </div>
  );
}
