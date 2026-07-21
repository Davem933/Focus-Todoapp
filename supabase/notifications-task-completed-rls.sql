-- Allows a task's assignee to notify the task's owner that the task is done,
-- without needing admin/team-admin rights (unlike the task_assigned insert
-- policy in notifications-schema.sql). The DB itself verifies the claim via
-- the tasks table: the acting user must actually be assignee_id on the
-- referenced task, and the notification recipient must actually be its
-- owner_id — so a member cannot spoof this for a task that isn't theirs.

drop policy if exists "notifications_insert_by_task_completer" on public.notifications;
create policy "notifications_insert_by_task_completer"
on public.notifications for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and kind = 'task_completed'
  and task_id is not null
  and exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.assignee_id = (select auth.uid())
      and t.owner_id = recipient_id
  )
);
