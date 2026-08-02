import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Command } from "cmdk";
import {
  BarChart3,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  List,
  Moon,
  Plus,
  Settings,
  Sun,
  Table2,
} from "lucide-react";
import type { Task, TaskPriority } from "../tasks/taskTypes";

export type CommandPaletteViewKind = "dashboard" | "list" | "table" | "calendar" | "settings";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "Bez priority",
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
};

const IS_MAC =
  typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(navigator.platform ?? navigator.userAgent);
const MOD_KEY = IS_MAC ? "⌘" : "Ctrl+";
const MOD_SHIFT_PREFIX = IS_MAC ? "⇧⌘" : "Ctrl+Shift+";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onNavigate: (view: CommandPaletteViewKind) => void;
  onCreateTask: () => void;
  onToggleTheme: () => void;
  themeMode: "dark" | "light";
  onMarkAllNotificationsAsRead: () => void;
  onFilterByPriority: (priority: TaskPriority) => void;
};

type CommandEntry = {
  id: string;
  label: string;
  keywords: string;
  icon: ReactNode;
  shortcut?: string;
  onSelect: () => void;
};

export function CommandPalette({
  open,
  onClose,
  tasks,
  onSelectTask,
  onNavigate,
  onCreateTask,
  onToggleTheme,
  themeMode,
  onMarkAllNotificationsAsRead,
  onFilterByPriority,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [prioritySubmenu, setPrioritySubmenu] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch("");
      setPrioritySubmenu(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();

        if (prioritySubmenu) {
          setPrioritySubmenu(false);
          setSearch("");
          return;
        }

        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, prioritySubmenu, onClose]);

  function runAndClose(action: () => void) {
    action();
    onClose();
  }

  const navigationEntries: CommandEntry[] = useMemo(
    () => [
      {
        id: "nav-dashboard",
        label: "Dashboard",
        keywords: "dashboard prehled",
        icon: <BarChart3 aria-hidden="true" size={15} />,
        onSelect: () => runAndClose(() => onNavigate("dashboard")),
      },
      {
        id: "nav-list",
        label: "List View",
        keywords: "list view seznam ukoly",
        icon: <List aria-hidden="true" size={15} />,
        onSelect: () => runAndClose(() => onNavigate("list")),
      },
      {
        id: "nav-table",
        label: "Table View",
        keywords: "table view tabulka",
        icon: <Table2 aria-hidden="true" size={15} />,
        onSelect: () => runAndClose(() => onNavigate("table")),
      },
      {
        id: "nav-calendar",
        label: "Kalendář",
        keywords: "kalendar calendar",
        icon: <CalendarDays aria-hidden="true" size={15} />,
        onSelect: () => runAndClose(() => onNavigate("calendar")),
      },
      {
        id: "nav-settings",
        label: "Nastavení",
        keywords: "nastaveni settings profil",
        icon: <Settings aria-hidden="true" size={15} />,
        shortcut: `${MOD_KEY},`,
        onSelect: () => runAndClose(() => onNavigate("settings")),
      },
    ],
    [onNavigate],
  );

  const actionEntries: CommandEntry[] = useMemo(
    () => [
      {
        id: "action-create-task",
        label: "Vytvořit nový úkol",
        keywords: "vytvorit novy ukol pridat create task",
        icon: <Plus aria-hidden="true" size={15} />,
        shortcut: `${MOD_SHIFT_PREFIX}N`,
        onSelect: () => runAndClose(onCreateTask),
      },
      {
        id: "action-toggle-theme",
        label: `Přepnout na ${themeMode === "dark" ? "světlý" : "tmavý"} režim`,
        keywords: "tmavy svetly rezim dark light mode",
        icon: themeMode === "dark" ? <Sun aria-hidden="true" size={15} /> : <Moon aria-hidden="true" size={15} />,
        shortcut: `${MOD_SHIFT_PREFIX}D`,
        onSelect: () => runAndClose(onToggleTheme),
      },
      {
        id: "action-mark-all-read",
        label: "Označit vše jako přečtené",
        keywords: "oznacit vse prectene notifikace",
        icon: <CheckCheck aria-hidden="true" size={15} />,
        onSelect: () => runAndClose(onMarkAllNotificationsAsRead),
      },
      {
        id: "action-filter-priority",
        label: "Filtrovat podle priority",
        keywords: "filtrovat priorita priority",
        icon: <ClipboardList aria-hidden="true" size={15} />,
        shortcut: "↵",
        onSelect: () => {
          setPrioritySubmenu(true);
          setSearch("");
        },
      },
    ],
    [themeMode, onCreateTask, onToggleTheme, onMarkAllNotificationsAsRead],
  );

  const query = search.trim().toLowerCase();

  const matchingTasks = useMemo(() => {
    if (!query) {
      return tasks.filter((task) => !task.completed).slice(0, 8);
    }

    return tasks.filter((task) => task.title.toLowerCase().includes(query)).slice(0, 8);
  }, [tasks, query]);

  const matchingNavigation = useMemo(
    () => navigationEntries.filter((entry) => !query || entry.keywords.includes(query)),
    [navigationEntries, query],
  );

  const matchingActions = useMemo(
    () => actionEntries.filter((entry) => !query || entry.keywords.includes(query)),
    [actionEntries, query],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="command-palette-overlay">
      <button
        type="button"
        className="command-palette-overlay__backdrop"
        aria-label="Zavřít"
        onClick={onClose}
      />
      <Command
        className="command-palette"
        label="Command palette"
        shouldFilter={false}
        loop
      >
        <div className="command-palette__input-row">
          <Command.Input
            autoFocus
            value={search}
            onValueChange={setSearch}
            placeholder={prioritySubmenu ? "Vyberte prioritu…" : "Hledat úkoly nebo napsat příkaz…"}
            className="command-palette__input"
          />
          <kbd className="command-palette__esc-hint">Esc</kbd>
        </div>
        <Command.List className="command-palette__list">
          <Command.Empty className="command-palette__empty">Nic nenalezeno</Command.Empty>

          {prioritySubmenu ? (
            <Command.Group heading="Filtrovat podle priority" className="command-palette__group">
              {(["high", "medium", "low", "none"] as TaskPriority[]).map((priority) => (
                <Command.Item
                  key={priority}
                  value={priority}
                  className="command-palette__item"
                  onSelect={() => runAndClose(() => onFilterByPriority(priority))}
                >
                  <span className="command-palette__item-label">{PRIORITY_LABELS[priority]}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : (
            <>
              {matchingTasks.length > 0 ? (
                <Command.Group heading="🔍 Úkoly" className="command-palette__group">
                  {matchingTasks.map((task) => (
                    <Command.Item
                      key={task.id}
                      value={`task-${task.id}`}
                      className="command-palette__item"
                      onSelect={() => runAndClose(() => onSelectTask(task.id))}
                    >
                      <ClipboardList aria-hidden="true" size={15} />
                      <span className="command-palette__item-label">{task.title}</span>
                      {task.completed ? <span className="command-palette__item-tag">Hotovo</span> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {matchingNavigation.length > 0 ? (
                <Command.Group heading="📍 Navigace" className="command-palette__group">
                  {matchingNavigation.map((entry) => (
                    <Command.Item
                      key={entry.id}
                      value={entry.id}
                      className="command-palette__item"
                      onSelect={entry.onSelect}
                    >
                      {entry.icon}
                      <span className="command-palette__item-label">{entry.label}</span>
                      {entry.shortcut ? <kbd className="command-palette__item-shortcut">{entry.shortcut}</kbd> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {matchingActions.length > 0 ? (
                <Command.Group heading="⚡ Rychlé akce" className="command-palette__group">
                  {matchingActions.map((entry) => (
                    <Command.Item
                      key={entry.id}
                      value={entry.id}
                      className="command-palette__item"
                      onSelect={entry.onSelect}
                    >
                      {entry.icon}
                      <span className="command-palette__item-label">{entry.label}</span>
                      {entry.shortcut ? <kbd className="command-palette__item-shortcut">{entry.shortcut}</kbd> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </>
          )}
        </Command.List>
      </Command>
    </div>
  );
}
