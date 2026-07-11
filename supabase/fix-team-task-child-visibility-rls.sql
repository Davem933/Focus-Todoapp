-- Fix: a task assigned to a team member (tasks.assignee_id) or visible via
-- team membership (tasks.team_id) was created and owned by someone else
-- (tasks.owner_id = creator). tasks_select_own_or_team already grants SELECT
-- on such rows via private.is_team_member(team_id), but subtasks/labels/
-- task_labels policies were strictly owner_id-only, so any subtasks or
-- labels attached to a team-visible task were invisible to teammates who
-- didn't create them. This extends SELECT on those child tables to follow
-- the same visibility as their parent task.
--
-- The client-side query in src/supabase/cloudBackup.ts (downloadSupabaseData)
-- was also fixed separately: it previously filtered every table by
-- `.eq("owner_id", userId)`, which excluded team-owned lists/tasks and
-- assigned-but-not-owned tasks even though RLS already permitted reading them.

drop policy if exists "subtasks_select_own" on public.subtasks;
create policy "subtasks_select_own_or_team"
on public.subtasks for select
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
  or exists (
    select 1
    from public.tasks as t
    where t.id = subtasks.task_id
      and (
        t.owner_id = (select auth.uid())
        or t.assignee_id = (select auth.uid())
        or (t.team_id is not null and private.is_team_member(t.team_id))
      )
  )
);

drop policy if exists "task_labels_select_own" on public.task_labels;
create policy "task_labels_select_own_or_team"
on public.task_labels for select
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
  or exists (
    select 1
    from public.tasks as t
    where t.id = task_labels.task_id
      and (
        t.owner_id = (select auth.uid())
        or t.assignee_id = (select auth.uid())
        or (t.team_id is not null and private.is_team_member(t.team_id))
      )
  )
);

drop policy if exists "labels_select_own" on public.labels;
create policy "labels_select_own_or_team"
on public.labels for select
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
  or exists (
    select 1
    from public.task_labels as tl
    join public.tasks as t on t.id = tl.task_id
    where tl.label_id = labels.id
      and (
        t.owner_id = (select auth.uid())
        or t.assignee_id = (select auth.uid())
        or (t.team_id is not null and private.is_team_member(t.team_id))
      )
  )
);
