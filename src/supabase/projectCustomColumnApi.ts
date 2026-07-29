import { supabase } from './supabaseClient';
import type {
  CustomFieldOption,
  CustomFieldType,
  ProjectCustomColumn,
  TaskCustomFieldValue,
} from '../tasks/customFieldTypes';

type ProjectCustomColumnRow = {
  id: string;
  project_id: string;
  key: string;
  title: string;
  field_type: CustomFieldType;
  options: CustomFieldOption[] | null;
  position: number;
};

type TaskCustomFieldValueRow = {
  task_id: string;
  column_id: string;
  value: string | null;
};

export const MAX_CUSTOM_COLUMNS_PER_PROJECT = 2;

export async function loadCustomColumns(projectId: string): Promise<ProjectCustomColumn[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('project_custom_columns')
    .select('id,project_id,key,title,field_type,options,position')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ProjectCustomColumnRow[]).map(mapCustomColumnRow);
}

export async function createCustomColumn(
  projectId: string,
  title: string,
  fieldType: CustomFieldType,
  options: CustomFieldOption[] = [],
): Promise<ProjectCustomColumn> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw new Error('Nazev sloupce nesmi byt prazdny.');
  }

  const existing = await loadCustomColumns(projectId);

  if (existing.length >= MAX_CUSTOM_COLUMNS_PER_PROJECT) {
    throw new Error('Nastenka uz ma maximalni pocet vlastnich sloupcu (2).');
  }

  const { data, error } = await supabase
    .from('project_custom_columns')
    .insert({
      key: createCustomColumnKey(),
      project_id: projectId,
      title: trimmedTitle,
      field_type: fieldType,
      options,
      position: existing.length,
    })
    .select('id,project_id,key,title,field_type,options,position')
    .single();

  if (error) {
    throw error;
  }

  return mapCustomColumnRow(data as ProjectCustomColumnRow);
}

export async function deleteCustomColumn(columnId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { error } = await supabase
    .from('project_custom_columns')
    .delete()
    .eq('id', columnId);

  if (error) {
    throw error;
  }
}

export async function loadCustomFieldValues(projectId: string): Promise<TaskCustomFieldValue[]> {
  const columns = await loadCustomColumns(projectId);

  if (!supabase || columns.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('task_custom_field_values')
    .select('task_id,column_id,value')
    .in('column_id', columns.map((column) => column.id));

  if (error) {
    throw error;
  }

  return ((data ?? []) as TaskCustomFieldValueRow[]).map(mapCustomFieldValueRow);
}

export async function setCustomFieldValue(
  taskId: string,
  columnId: string,
  value: string | null,
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { error } = await supabase
    .from('task_custom_field_values')
    .upsert({ task_id: taskId, column_id: columnId, value }, { onConflict: 'task_id,column_id' });

  if (error) {
    throw error;
  }
}

function createCustomColumnKey() {
  return 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function mapCustomColumnRow(row: ProjectCustomColumnRow): ProjectCustomColumn {
  return {
    id: row.id,
    projectId: row.project_id,
    key: row.key,
    title: row.title,
    fieldType: row.field_type,
    options: row.options ?? [],
    position: row.position,
  };
}

function mapCustomFieldValueRow(row: TaskCustomFieldValueRow): TaskCustomFieldValue {
  return {
    taskId: row.task_id,
    columnId: row.column_id,
    value: row.value,
  };
}
