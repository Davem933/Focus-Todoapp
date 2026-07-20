import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Notification = {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
};

interface NotificationItemProps {
  notification: Notification;
  index: number;
  onMarkAsRead: (id: string) => void;
  textColor?: string;
  hoverBgColor?: string;
  dotColor?: string;
}

const NotificationItem = ({
  notification,
  index,
  onMarkAsRead,
  textColor = "text-nt-fg",
  dotColor = "bg-nt-brand",
  hoverBgColor = "hover:bg-nt-card-hover",
}: NotificationItemProps) => (
  <motion.div
    initial={{ opacity: 0, x: 20, filter: "blur(10px)" }}
    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
    transition={{ duration: 0.3, delay: index * 0.05 }}
    key={notification.id}
    className={cn(`p-3 ${hoverBgColor} cursor-pointer transition-colors`)}
    onClick={() => onMarkAsRead(notification.id)}
  >
    <div className="flex justify-between items-start gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {!notification.read && (
          <span className={`h-1.5 w-1.5 flex-none rounded-full ${dotColor}`} />
        )}
        <h4 className={`text-sm font-medium truncate ${textColor}`}>
          {notification.title}
        </h4>
      </div>

      <span className={`text-xs opacity-70 flex-none ${textColor}`}>
        {notification.timestamp.toLocaleDateString("cs-CZ", {
          day: "numeric",
          month: "numeric",
        })}
      </span>
    </div>
    <p className={`text-xs opacity-70 mt-1 ${textColor}`}>
      {notification.description}
    </p>
  </motion.div>
);

interface NotificationListProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  textColor?: string;
  hoverBgColor?: string;
  dividerColor?: string;
}

const NotificationList = ({
  notifications,
  onMarkAsRead,
  textColor,
  hoverBgColor,
  dividerColor = "divide-nt-border",
}: NotificationListProps) => (
  <div className={`divide-y ${dividerColor}`}>
    {notifications.map((notification, index) => (
      <NotificationItem
        key={notification.id}
        notification={notification}
        index={index}
        onMarkAsRead={onMarkAsRead}
        textColor={textColor}
        hoverBgColor={hoverBgColor}
      />
    ))}
  </div>
);

interface NotificationPopoverProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  /** Which side the panel opens toward vertically. */
  align?: "top" | "bottom";
  /** Which edge of the trigger the panel's edge anchors to. */
  side?: "left" | "right";
  /**
   * Render the panel into document.body with a computed fixed position
   * instead of a plain `absolute` child. Needed when the trigger sits
   * inside a narrow/`overflow: hidden` container (e.g. the sidebar) where
   * a normally-positioned 320px panel would get clipped.
   */
  usePortal?: boolean;
  buttonClassName?: string;
  popoverClassName?: string;
  textColor?: string;
  hoverBgColor?: string;
  dividerColor?: string;
  headerBorderColor?: string;
}

const PANEL_WIDTH = 320;
const PANEL_GAP = 8;

export const NotificationPopover = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  align = "bottom",
  side = "right",
  usePortal = false,
  buttonClassName = "w-9 h-9 rounded-lg bg-nt-card hover:bg-nt-card-hover border border-nt-border text-nt-muted hover:text-nt-fg",
  popoverClassName = "bg-nt-card-strong border border-nt-border backdrop-blur-sm",
  textColor = "text-nt-fg",
  hoverBgColor = "hover:bg-nt-card-hover",
  dividerColor = "divide-nt-border",
  headerBorderColor = "border-nt-border",
}: NotificationPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fixedPosition, setFixedPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleOpen = () => setIsOpen((current) => !current);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePosition() {
      if (!usePortal || !buttonRef.current) {
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const left =
        side === "right"
          ? Math.max(rect.right - PANEL_WIDTH, PANEL_GAP)
          : Math.min(rect.left, window.innerWidth - PANEL_WIDTH - PANEL_GAP);
      const top =
        align === "bottom"
          ? rect.bottom + PANEL_GAP
          : Math.max(rect.top - PANEL_GAP, PANEL_GAP);

      setFixedPosition({ top: align === "bottom" ? top : top, left });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !containerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    updatePosition();
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, usePortal, side, align]);

  const panel = (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: align === "bottom" ? 10 : -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: align === "bottom" ? 10 : -10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "w-80 max-h-[400px] overflow-y-auto rounded-xl shadow-lg z-50",
        usePortal
          ? "fixed"
          : cn("absolute", side === "right" ? "right-0" : "left-0", align === "bottom" ? "top-full mt-2" : "bottom-full mb-2"),
        textColor,
        popoverClassName,
      )}
      style={
        usePortal && fixedPosition
          ? {
              top: align === "bottom" ? fixedPosition.top : undefined,
              bottom:
                align === "top"
                  ? window.innerHeight - fixedPosition.top
                  : undefined,
              left: fixedPosition.left,
            }
          : undefined
      }
    >
      <div className={`p-3 border-b ${headerBorderColor} flex justify-between items-center`}>
        <h3 className="text-sm font-medium">Notifikace</h3>
        {unreadCount > 0 ? (
          <Button
            onClick={onMarkAllAsRead}
            variant="ghost"
            size="sm"
            className={`text-xs ${hoverBgColor} hover:text-nt-fg`}
          >
            Označit vše jako přečtené
          </Button>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <p className="p-3 text-xs opacity-70">Zatím žádné notifikace.</p>
      ) : (
        <NotificationList
          notifications={notifications}
          onMarkAsRead={onMarkAsRead}
          textColor={textColor}
          hoverBgColor={hoverBgColor}
          dividerColor={dividerColor}
        />
      )}
    </motion.div>
  );

  return (
    <div ref={containerRef} className={cn("relative", textColor)}>
      <Button
        ref={buttonRef}
        onClick={toggleOpen}
        size="icon"
        aria-label="Otevřít notifikace"
        className={cn("relative", buttonClassName)}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-nt-danger rounded-full flex items-center justify-center text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </Button>

      {isOpen ? (usePortal ? (fixedPosition ? createPortal(panel, document.body) : null) : panel) : null}
    </div>
  );
};
