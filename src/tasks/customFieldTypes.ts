export type CustomFieldType = "text" | "select";

export type CustomFieldOption = {
  value: string;
  label: string;
  color?: string | null;
};

export type ProjectCustomColumn = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  fieldType: CustomFieldType;
  options: CustomFieldOption[];
  position: number;
};

export type TaskCustomFieldValue = {
  taskId: string;
  columnId: string;
  value: string | null;
};
