import { supabase } from './supabaseClient';
import type { Project, ProjectColumn, ProjectStatus } from '../projects/projectTypes';

type ProjectRow = {
  id: string;
  team_id: string;
  created_by: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

type ProjectColumnRow = {
  id: string;
  project_id: string;
  key: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_PROJECT_COLUMNS = [
  { key: 'todo', title: 'To do', position: 0 },
  { key: 'doing', title: 'Probiha', position: 1 },
  { key: 'review', title: 'Kontrola', position: 2 },
  { key: 'done', title: 'Hotovo', position: 3 },
] as const;

export type CreateProjectInput = {
  createdBy: string;
  description?: string | null;
  endDate?: string | null;
  name: string;
  startDate?: string | null;
  teamId: string;
};

export type UpdateProjectInput = {
  description?: string | null;
  endDate?: string | null;
  name: string;
  projectId: string;
  startDate?: string | null;
  status: ProjectStatus;
  teamId: string;
};

export async function loadProjectsForTeams(teamIds: string[]): Promise<Project[]> {
  if (!supabase || teamIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id,team_id,created_by,name,description,start_date,end_date,status,created_at,updated_at')
    .in('team_id', teamIds)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ProjectRow[]).map(mapProjectRow);
}

export async function createProjectInSupabase(input: CreateProjectInput): Promise<Project> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error('Nazev projektu nesmi byt prazdny.');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      created_by: input.createdBy,
      description: input.description?.trim() || null,
      end_date: input.endDate || null,
      name: trimmedName,
      start_date: input.startDate || null,
      team_id: input.teamId,
    })
    .select('id,team_id,created_by,name,description,start_date,end_date,status,created_at,updated_at')
    .single();

  if (error) {
    throw error;
  }

  const project = mapProjectRow(data as ProjectRow);
  await ensureDefaultProjectColumns(project.id);

  return project;
}

export async function updateProjectInSupabase(input: UpdateProjectInput): Promise<Project> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error('Nazev projektu nesmi byt prazdny.');
  }

  const { data, error } = await supabase
    .from('projects')
    .update({
      description: input.description?.trim() || null,
      end_date: input.endDate || null,
      name: trimmedName,
      start_date: input.startDate || null,
      status: input.status,
      team_id: input.teamId,
    })
    .eq('id', input.projectId)
    .select('id,team_id,created_by,name,description,start_date,end_date,status,created_at,updated_at')
    .single();

  if (error) {
    throw error;
  }

  return mapProjectRow(data as ProjectRow);
}

export async function deleteProjectInSupabase(projectId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) {
    throw error;
  }
}

export async function loadProjectColumns(projectId: string): Promise<ProjectColumn[]> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { data, error } = await supabase
    .from('project_columns')
    .select('id,project_id,key,title,position,created_at,updated_at')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (error) {
    throw error;
  }

  const columns = ((data ?? []) as ProjectColumnRow[]).map(mapProjectColumnRow);

  if (columns.length > 0) {
    return columns;
  }

  return ensureDefaultProjectColumns(projectId);
}

export async function createProjectColumn(projectId: string, title: string, position: number): Promise<ProjectColumn> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw new Error('Nazev sloupce nesmi byt prazdny.');
  }

  const { data, error } = await supabase
    .from('project_columns')
    .insert({
      key: createProjectColumnKey(),
      position,
      project_id: projectId,
      title: trimmedTitle,
    })
    .select('id,project_id,key,title,position,created_at,updated_at')
    .single();

  if (error) {
    throw error;
  }

  return mapProjectColumnRow(data as ProjectColumnRow);
}

export async function updateProjectColumn(columnId: string, title: string): Promise<ProjectColumn> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw new Error('Nazev sloupce nesmi byt prazdny.');
  }

  const { data, error } = await supabase
    .from('project_columns')
    .update({ title: trimmedTitle })
    .eq('id', columnId)
    .select('id,project_id,key,title,position,created_at,updated_at')
    .single();

  if (error) {
    throw error;
  }

  return mapProjectColumnRow(data as ProjectColumnRow);
}

export async function archiveProjectColumn(columnId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { error } = await supabase
    .from('project_columns')
    .delete()
    .eq('id', columnId);

  if (error) {
    throw error;
  }
}

export async function deleteProjectColumn(columnId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { error } = await supabase
    .from('project_columns')
    .delete()
    .eq('id', columnId);

  if (error) {
    throw error;
  }
}

async function ensureDefaultProjectColumns(projectId: string): Promise<ProjectColumn[]> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { data, error } = await supabase
    .from('project_columns')
    .upsert(
      DEFAULT_PROJECT_COLUMNS.map((column) => ({
        key: column.key,
        position: column.position,
        project_id: projectId,
        title: column.title,
      })),
      { onConflict: 'project_id,key', ignoreDuplicates: true },
    )
    .select('id,project_id,key,title,position,created_at,updated_at')
    .order('position', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ProjectColumnRow[]).map(mapProjectColumnRow);
}

function createProjectColumnKey() {
  return 'column-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    teamId: row.team_id,
    createdBy: row.created_by,
    name: row.name,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectColumnRow(row: ProjectColumnRow): ProjectColumn {
  return {
    id: row.id,
    projectId: row.project_id,
    key: row.key,
    title: row.title,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}