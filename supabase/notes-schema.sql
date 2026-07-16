-- Obsidian-style shared team notes: folders, notes, and a generic
-- reference table used for both note-to-note wiki-links ([[Title]]) and
-- note-to-task/project mentions (@-autocomplete).
--
-- Reuses private.is_team_member(team_id) / private.is_team_admin(team_id)
-- from fix-team-visibility-rls.sql, and public.touch_updated_at() from
-- schema.sql, so behavior matches the rest of the app's team-scoped tables.

create table if not exists public.note_folders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  parent_folder_id uuid references public.note_folders (id) on delete cascade
);

do $$ begin
  alter table public.note_folders
    add constraint note_folders_no_self_parent
      check (parent_folder_id is distinct from id);
exception when duplicate_object then null;
end $$;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content text not null default '',
  folder_id uuid references public.note_folders (id) on delete set null,
  tags text[] not null default '{}',
  is_archived boolean not null default false,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.note_references (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  source_note_id uuid not null references public.notes (id) on delete cascade,
  target_type text not null check (target_type in ('note', 'task', 'project')),
  target_key text not null,
  target_label text not null,
  created_at timestamptz not null default now()
);

create index if not exists notes_team_id_idx on public.notes (team_id);
create index if not exists notes_folder_id_idx on public.notes (folder_id);
create index if not exists notes_team_pinned_idx on public.notes (team_id, is_pinned);
create index if not exists note_folders_team_id_idx on public.note_folders (team_id);
create index if not exists note_folders_parent_id_idx on public.note_folders (parent_folder_id);
create index if not exists note_references_source_idx on public.note_references (source_note_id);
create index if not exists note_references_target_idx on public.note_references (team_id, target_type, target_key);

drop trigger if exists touch_notes_updated_at on public.notes;
create trigger touch_notes_updated_at
before update on public.notes
for each row execute function public.touch_updated_at();

alter table public.note_folders enable row level security;
alter table public.notes enable row level security;
alter table public.note_references enable row level security;

drop policy if exists "note_folders_select_by_member" on public.note_folders;
create policy "note_folders_select_by_member"
on public.note_folders for select
to authenticated
using (private.is_team_member(team_id));

drop policy if exists "note_folders_insert_by_member" on public.note_folders;
create policy "note_folders_insert_by_member"
on public.note_folders for insert
to authenticated
with check (private.is_team_member(team_id));

drop policy if exists "note_folders_update_by_member" on public.note_folders;
create policy "note_folders_update_by_member"
on public.note_folders for update
to authenticated
using (private.is_team_member(team_id))
with check (private.is_team_member(team_id));

drop policy if exists "note_folders_delete_by_admin" on public.note_folders;
create policy "note_folders_delete_by_admin"
on public.note_folders for delete
to authenticated
using (private.is_team_admin(team_id));

drop policy if exists "notes_select_by_member" on public.notes;
create policy "notes_select_by_member"
on public.notes for select
to authenticated
using (private.is_team_member(team_id));

drop policy if exists "notes_insert_by_member" on public.notes;
create policy "notes_insert_by_member"
on public.notes for insert
to authenticated
with check (private.is_team_member(team_id));

drop policy if exists "notes_update_by_member" on public.notes;
create policy "notes_update_by_member"
on public.notes for update
to authenticated
using (private.is_team_member(team_id))
with check (private.is_team_member(team_id));

drop policy if exists "notes_delete_by_admin" on public.notes;
create policy "notes_delete_by_admin"
on public.notes for delete
to authenticated
using (private.is_team_admin(team_id));

drop policy if exists "note_references_select_by_member" on public.note_references;
create policy "note_references_select_by_member"
on public.note_references for select
to authenticated
using (private.is_team_member(team_id));

drop policy if exists "note_references_insert_by_member" on public.note_references;
create policy "note_references_insert_by_member"
on public.note_references for insert
to authenticated
with check (private.is_team_member(team_id));

drop policy if exists "note_references_delete_by_member" on public.note_references;
create policy "note_references_delete_by_member"
on public.note_references for delete
to authenticated
using (private.is_team_member(team_id));
