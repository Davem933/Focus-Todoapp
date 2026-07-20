import { supabase } from "./supabaseClient";

export type AppNotification = {
  id: string;
  recipientId: string;
  actorId: string;
  kind: string;
  taskId: string | null;
  taskTitle: string;
  teamId: string | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string;
  kind: string;
  task_id: string | null;
  task_title: string;
  team_id: string | null;
  is_read: boolean;
  created_at: string;
};

const NOTIFICATION_COLUMNS =
  "id,recipient_id,actor_id,kind,task_id,task_title,team_id,is_read,created_at";

function mapNotificationRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    actorId: row.actor_id,
    kind: row.kind,
    taskId: row.task_id,
    taskTitle: row.task_title,
    teamId: row.team_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export async function loadNotifications(
  userId: string,
  limit = 50,
): Promise<AppNotification[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as NotificationRow[]).map(mapNotificationRow);
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_id", userId)
    .eq("is_read", false);

  if (error) {
    throw error;
  }
}

export async function createTaskAssignedNotification({
  recipientId,
  actorId,
  taskId,
  taskTitle,
  teamId,
}: {
  recipientId: string;
  actorId: string;
  taskId: string | null;
  taskTitle: string;
  teamId: string;
}): Promise<void> {
  if (!supabase || recipientId === actorId) {
    return;
  }

  const { error } = await supabase.from("notifications").insert({
    recipient_id: recipientId,
    actor_id: actorId,
    kind: "task_assigned",
    task_id: taskId,
    task_title: taskTitle,
    team_id: teamId,
  });

  if (error) {
    throw error;
  }
}

export function subscribeToNotifications(
  userId: string,
  onInsert: (notification: AppNotification) => void,
): () => void {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        onInsert(mapNotificationRow(payload.new as NotificationRow));
      },
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}
