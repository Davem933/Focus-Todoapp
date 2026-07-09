create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists nickname text;

create table if not exists public.task_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  list_id uuid not null references public.task_lists (id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  due_date date,
  due_time time,
  is_archived boolean not null default false,
  note text not null default '',
  priority text not null default 'none'
    check (priority in ('none', 'low', 'medium', 'high')),
  recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.task_labels (
  task_id uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  primary key (task_id, label_id)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

drop trigger if exists touch_task_lists_updated_at on public.task_lists;
create trigger touch_task_lists_updated_at
before update on public.task_lists
for each row execute function public.touch_updated_at();

drop trigger if exists touch_tasks_updated_at on public.tasks;
create trigger touch_tasks_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

drop trigger if exists touch_subtasks_updated_at on public.subtasks;
create trigger touch_subtasks_updated_at
before update on public.subtasks
for each row execute function public.touch_updated_at();

drop trigger if exists touch_labels_updated_at on public.labels;
create trigger touch_labels_updated_at
before update on public.labels
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.task_lists enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or private.is_global_admin()
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (
  id = (select auth.uid())
  or private.is_global_admin()
);

drop policy if exists "profiles_update_own" on public.profiles;
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
create policy "task_lists_owner_all"
on public.task_lists for all
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
)
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

drop policy if exists "tasks_owner_all" on public.tasks;
create policy "tasks_owner_all"
on public.tasks for all
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
)
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

drop policy if exists "subtasks_owner_all" on public.subtasks;
create policy "subtasks_owner_all"
on public.subtasks for all
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
)
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

drop policy if exists "labels_owner_all" on public.labels;
create policy "labels_owner_all"
on public.labels for all
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
)
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);

drop policy if exists "task_labels_owner_all" on public.task_labels;
create policy "task_labels_owner_all"
on public.task_labels for all
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_global_admin()
)
with check (
  owner_id = (select auth.uid())
  or private.is_global_admin()
);
