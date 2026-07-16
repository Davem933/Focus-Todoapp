-- Nested folder tree + pinned notes for the Obsidian-parity Notes redesign.
-- Additive/idempotent. Applied directly to the live project (Supabase MCP
-- apply_migration) on 2026-07-15; notes-schema.sql has been updated to
-- reflect this as the merged end-state reference doc.

alter table public.note_folders
  add column if not exists parent_folder_id uuid
    references public.note_folders (id) on delete cascade;

do $$ begin
  alter table public.note_folders
    add constraint note_folders_no_self_parent
      check (parent_folder_id is distinct from id);
exception when duplicate_object then null;
end $$;

create index if not exists note_folders_parent_id_idx
  on public.note_folders (parent_folder_id);

alter table public.notes
  add column if not exists is_pinned boolean not null default false;

create index if not exists notes_team_pinned_idx
  on public.notes (team_id, is_pinned);
