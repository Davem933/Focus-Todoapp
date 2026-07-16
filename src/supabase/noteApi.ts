import { supabase } from './supabaseClient';
import { parseNoteLinks, resolveNoteTitleSlug } from '../notes/noteLinkParsing';
import type { Note, NoteFolder, NoteReferenceTargetType } from '../notes/noteTypes';

type NoteRow = {
  id: string;
  team_id: string;
  created_by: string;
  title: string;
  content: string;
  folder_id: string | null;
  tags: string[];
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type NoteFolderRow = {
  id: string;
  team_id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
};

type NoteReferenceRow = {
  id: string;
  source_note_id: string;
};

const NOTE_COLUMNS =
  'id,team_id,created_by,title,content,folder_id,tags,is_pinned,is_archived,created_at,updated_at';
const NOTE_FOLDER_COLUMNS = 'id,team_id,name,parent_folder_id,created_at';

export type CreateNoteInput = {
  teamId: string;
  createdBy: string;
  title: string;
  content?: string;
  folderId?: string | null;
  tags?: string[];
};

export type UpdateNoteInput = {
  noteId: string;
  teamId: string;
  title: string;
  content: string;
  folderId: string | null;
  tags: string[];
  isArchived?: boolean;
};

export async function loadNotesForTeams(teamIds: string[]): Promise<Note[]> {
  if (!supabase || teamIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('notes')
    .select(NOTE_COLUMNS)
    .in('team_id', teamIds)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as NoteRow[]).map(mapNoteRow);
}

export async function loadNoteFolders(teamId: string): Promise<NoteFolder[]> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { data, error } = await supabase
    .from('note_folders')
    .select(NOTE_FOLDER_COLUMNS)
    .eq('team_id', teamId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as NoteFolderRow[]).map(mapNoteFolderRow);
}

export async function createNoteFolder(
  teamId: string,
  name: string,
  parentFolderId: string | null = null,
): Promise<NoteFolder> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Nazev slozky nesmi byt prazdny.');
  }

  const { data, error } = await supabase
    .from('note_folders')
    .insert({ team_id: teamId, name: trimmedName, parent_folder_id: parentFolderId })
    .select(NOTE_FOLDER_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return mapNoteFolderRow(data as NoteFolderRow);
}

export async function deleteNoteFolder(folderId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { error } = await supabase.from('note_folders').delete().eq('id', folderId);

  if (error) {
    throw error;
  }
}

export async function moveNoteFolder(
  folderId: string,
  nextParentFolderId: string | null,
): Promise<NoteFolder> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { data, error } = await supabase
    .from('note_folders')
    .update({ parent_folder_id: nextParentFolderId })
    .eq('id', folderId)
    .select(NOTE_FOLDER_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return mapNoteFolderRow(data as NoteFolderRow);
}

export async function renameNoteFolder(folderId: string, name: string): Promise<NoteFolder> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Nazev slozky nesmi byt prazdny.');
  }

  const { data, error } = await supabase
    .from('note_folders')
    .update({ name: trimmedName })
    .eq('id', folderId)
    .select(NOTE_FOLDER_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return mapNoteFolderRow(data as NoteFolderRow);
}

export async function createNoteInSupabase(input: CreateNoteInput): Promise<Note> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedTitle = input.title.trim();

  if (!trimmedTitle) {
    throw new Error('Nazev poznamky nesmi byt prazdny.');
  }

  const content = input.content ?? '';

  const { data, error } = await supabase
    .from('notes')
    .insert({
      content,
      created_by: input.createdBy,
      folder_id: input.folderId ?? null,
      tags: input.tags ?? [],
      team_id: input.teamId,
      title: trimmedTitle,
    })
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const note = mapNoteRow(data as NoteRow);
  await syncNoteReferences(note.id, note.teamId, content);

  return note;
}

export async function updateNoteInSupabase(input: UpdateNoteInput): Promise<Note> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedTitle = input.title.trim();

  if (!trimmedTitle) {
    throw new Error('Nazev poznamky nesmi byt prazdny.');
  }

  const update: Record<string, unknown> = {
    content: input.content,
    folder_id: input.folderId,
    tags: input.tags,
    title: trimmedTitle,
  };

  if (input.isArchived !== undefined) {
    update.is_archived = input.isArchived;
  }

  const { data, error } = await supabase
    .from('notes')
    .update(update)
    .eq('id', input.noteId)
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const note = mapNoteRow(data as NoteRow);
  await syncNoteReferences(note.id, note.teamId, note.content);

  return note;
}

export async function deleteNoteInSupabase(noteId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { error } = await supabase.from('notes').delete().eq('id', noteId);

  if (error) {
    throw error;
  }
}

export async function setNotePinned(noteId: string, isPinned: boolean): Promise<Note> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { data, error } = await supabase
    .from('notes')
    .update({ is_pinned: isPinned })
    .eq('id', noteId)
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return mapNoteRow(data as NoteRow);
}

export async function moveNoteToFolder(noteId: string, folderId: string | null): Promise<Note> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { data, error } = await supabase
    .from('notes')
    .update({ folder_id: folderId })
    .eq('id', noteId)
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return mapNoteRow(data as NoteRow);
}

export async function loadBacklinksForNote(teamId: string, noteTitle: string): Promise<Note[]> {
  return loadNoteMentionsForTarget(teamId, 'note', resolveNoteTitleSlug(noteTitle));
}

export async function loadNoteMentionsForTarget(
  teamId: string,
  targetType: NoteReferenceTargetType,
  targetKey: string,
): Promise<Note[]> {
  if (!supabase || !targetKey) {
    return [];
  }

  const { data: referenceRows, error: referenceError } = await supabase
    .from('note_references')
    .select('id,source_note_id')
    .eq('team_id', teamId)
    .eq('target_type', targetType)
    .eq('target_key', targetKey);

  if (referenceError) {
    throw referenceError;
  }

  const sourceNoteIds = Array.from(
    new Set(((referenceRows ?? []) as NoteReferenceRow[]).map((row) => row.source_note_id)),
  );

  if (sourceNoteIds.length === 0) {
    return [];
  }

  const { data: noteRows, error: notesError } = await supabase
    .from('notes')
    .select(NOTE_COLUMNS)
    .in('id', sourceNoteIds)
    .eq('is_archived', false);

  if (notesError) {
    throw notesError;
  }

  return ((noteRows ?? []) as NoteRow[]).map(mapNoteRow);
}

async function syncNoteReferences(noteId: string, teamId: string, content: string): Promise<void> {
  if (!supabase) {
    return;
  }

  const references = parseNoteLinks(content);

  const { error: deleteError } = await supabase
    .from('note_references')
    .delete()
    .eq('source_note_id', noteId);

  if (deleteError) {
    throw deleteError;
  }

  if (references.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from('note_references').insert(
    references.map((reference) => ({
      source_note_id: noteId,
      target_key: reference.targetKey,
      target_label: reference.targetLabel,
      target_type: reference.targetType,
      team_id: teamId,
    })),
  );

  if (insertError) {
    throw insertError;
  }
}

function mapNoteRow(row: NoteRow): Note {
  return {
    id: row.id,
    teamId: row.team_id,
    createdBy: row.created_by,
    title: row.title,
    content: row.content,
    folderId: row.folder_id,
    tags: row.tags ?? [],
    isPinned: row.is_pinned,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNoteFolderRow(row: NoteFolderRow): NoteFolder {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    parentFolderId: row.parent_folder_id,
    createdAt: row.created_at,
  };
}
