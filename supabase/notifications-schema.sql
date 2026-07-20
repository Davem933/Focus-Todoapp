-- In-app notifications, initially used for "task assigned to you" alerts sent
-- by a global admin or team admin when they assign a task to a team member.
--
-- task_id is intentionally NOT a foreign key to public.tasks: cloud sync
-- (see src/supabase/cloudBackup.ts) fully deletes and re-inserts a user's
-- tasks on every sync, so remote task ids are not stable across syncs. A FK
-- would either cascade-delete notifications on the next sync or reject the
-- insert. task_title is stored denormalized so the notification stays
-- meaningful even after the source task row is gone.
--
-- Reuses private.is_global_admin() from schema.sql and
-- private.is_team_admin(team_id) from fix-team-visibility-rls.sql.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'task_assigned',
  task_id uuid,
  task_title text not null,
  team_id uuid references public.teams (id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_by_recipient" on public.notifications;
create policy "notifications_select_by_recipient"
on public.notifications for select
to authenticated
using (recipient_id = (select auth.uid()));

drop policy if exists "notifications_update_by_recipient" on public.notifications;
create policy "notifications_update_by_recipient"
on public.notifications for update
to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

drop policy if exists "notifications_insert_by_admin" on public.notifications;
create policy "notifications_insert_by_admin"
on public.notifications for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and (
    private.is_global_admin()
    or (team_id is not null and private.is_team_admin(team_id))
  )
);

drop policy if exists "notifications_delete_by_recipient" on public.notifications;
create policy "notifications_delete_by_recipient"
on public.notifications for delete
to authenticated
using (recipient_id = (select auth.uid()));

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
