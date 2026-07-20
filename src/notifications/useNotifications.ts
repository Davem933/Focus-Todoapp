import { useCallback, useEffect, useState } from "react";
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type AppNotification,
} from "../supabase/notificationsApi";

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    let isCancelled = false;

    loadNotifications(userId)
      .then((loaded) => {
        if (!isCancelled) {
          setNotifications(loaded);
        }
      })
      .catch((error) => {
        console.error("Nepodařilo se načíst notifikace", error);
      });

    const unsubscribe = subscribeToNotifications(userId, (notification) => {
      setNotifications((current) => {
        if (current.some((item) => item.id === notification.id)) {
          return current;
        }
        return [notification, ...current];
      });
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [userId]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
    markNotificationRead(id).catch((error) => {
      console.error("Nepodařilo se označit notifikaci jako přečtenou", error);
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    if (!userId) {
      return;
    }
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    markAllNotificationsRead(userId).catch((error) => {
      console.error("Nepodařilo se označit notifikace jako přečtené", error);
    });
  }, [userId]);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
