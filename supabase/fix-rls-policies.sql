create schema if not exists private;

create or replace function private.is_global_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

grant usage on schema public to anon, authenticated;
grant all on public.profiles to authenticated;
grant all on public.task_lists to authenticated;
grant all on public.tasks to authenticated;
grant all on public.subtasks to authenticated;
grant all on public.labels to authenticated;
grant all on public.task_labels to authenticated;

alter table public.profiles enable row level security;
alter table public.task_lists enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or private.is_global_admin()
);

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (
  id = (select auth.uid())
  or private.is_global_admin()
);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (
  id = (select auth.uid())
  or private.is_global_admin()
)
with check (
  id = (select auth.uid())
  or private.is_global_admin()
);

drop policy if exists "task_lists_owner_all" on public.task_lists;
drop policy if exists "task_lists_select_own" on public.task_lists;
drop policy if exists "task_lists_insert_own" on public.task_lists;
drop policy if exists "task_lists_update_own" on public.task_lists;
drop policy if exists "task_lists_delete_own" on public.task_lists;
drop policy if exists "task_lists_select_own_or_team" on public.task_lists;
drop policy if exists "task_lists_insert_own_or_team" on public.task_lists;
drop policy if exists "task_lists_update_own_or_team" on public.task_lists;
drop policy if exists "task_lists_delete_own_or_team" on public.task_lists;

create policy "task_lists_select_own_or_team"
on public.task_lists for select
to authenticated
using (
  private.is_global_admin()
  or owner_id = (select auth.uid())
  or (team_id is not null and private.is_team_member(team_id))
);

create policy "task_lists_insert_own_or_team"
on public.task_lists for insert
to authenticated
with check (
  private.is_global_admin()
  or (
    owner_id = (select auth.uid())
    and (team_id is null or private.is_team_member(team_id))
  )
);

create policy "task_lists_update_own_or_team"
on public.task_lists for update
to authenticated
using (
  private.is_global_admin()
  or owner_id = (select auth.uid())
  or (team_id is not null and private.is_team_member(team_id))
)
with check (
  private.is_global_admin()
  or (
    owner_id = (select auth.uid())
    and (team_id is null or private.is_team_member(team_id))
  )
);

create policy "task_lists_delete_own_or_team"
on public.task_lists for delete
to authenticated
using (
  private.is_global_admin()
  or owner_id = (select auth.uid())
  or (team_id is not null and private.is_team_member(team_id))
);

drop policy if exists "tasks_owner_all" on public.tasks;
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
drop policy if exists "tasks_select_own_or_team" on public.tasks;
drop policy if exists "tasks_insert_own_or_team" on public.tasks;
drop policy if exists "tasks_update_own_or_team" on public.tasks;
drop policy if exists "tasks_delete_own_or_team" on public.tasks;

create policy "tasks_select_own_or_team"
on public.tasks for select
to authenticated
using (
  private.is_global_admin()
  or owner_id = (select auth.uid())
  or (team_id is not null and private.is_team_member(team_id))
);

create policy "tasks_insert_own_or_team"
on public.tasks for insert
to authenticated
with check (
  private.is_global_admin()
  or (
    owner_id = (select auth.uid())
    and (team_id is null or private.is_team_member(team_id))
  )
);

create policy "tasks_update_own_or_team"
on public.tasks for update
to authenticated
using (
  private.is_global_admin()
  or owner_id = (select auth.uid())
  or (team_id is not null and private.is_team_member(team_id))
)
with check (
  private.is_global_admin()
  or (
    owner_id = (select auth.uid())
    and (team_id is null or private.is_team_member(team_id))
  )
);

create policy "tasks_delete_own_or_team"
on public.tasks for delete
to authenticated
using (
  private.is_global_admin()
  or owner_id = (select auth.uid())
  or (team_id is not null and private.is_team_member(team_id))
);

drop policy if exists "subtasks_owner_all" on public.subtasks;
drop policy if exists "subtasks_select_own" on public.subtasks;
drop policy if exists "subtasks_insert_own" on public.subtasks;
drop policy if exists "subtasks_update_own" on public.subtasks;
drop policy if exists "subtasks_delete_own" on public.subtasks;

create policy "subtasks_select_own"
on public.subtasks for select
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

create policy "subtasks_insert_own"
on public.subtasks for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

create policy "subtasks_update_own"
on public.subtasks for update
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
)
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

create policy "subtasks_delete_own"
on public.subtasks for delete
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

drop policy if exists "labels_owner_all" on public.labels;
drop policy if exists "labels_select_own" on public.labels;
drop policy if exists "labels_insert_own" on public.labels;
drop policy if exists "labels_update_own" on public.labels;
drop policy if exists "labels_delete_own" on public.labels;

create policy "labels_select_own"
on public.labels for select
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

create policy "labels_insert_own"
on public.labels for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

create policy "labels_update_own"
on public.labels for update
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
)
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

create policy "labels_delete_own"
on public.labels for delete
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

drop policy if exists "task_labels_owner_all" on public.task_labels;
drop policy if exists "task_labels_select_own" on public.task_labels;
drop policy if exists "task_labels_insert_own" on public.task_labels;
drop policy if exists "task_labels_update_own" on public.task_labels;
drop policy if exists "task_labels_delete_own" on public.task_labels;

create policy "task_labels_select_own"
on public.task_labels for select
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

create policy "task_labels_insert_own"
on public.task_labels for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

create policy "task_labels_update_own"
on public.task_labels for update
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
)
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

create policy "task_labels_delete_own"
on public.task_labels for delete
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);
