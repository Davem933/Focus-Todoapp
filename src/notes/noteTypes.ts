export type Note = {
  id: string;
  teamId: string;
  createdBy: string;
  title: string;
  content: string;
  folderId: string | null;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NoteFolder = {
  id: string;
  teamId: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
};

export type NoteFolderTreeNode = {
  folder: NoteFolder;
  children: NoteFolderTreeNode[];
  notes: Note[];
};

export type NoteReferenceTargetType = "note" | "task" | "project";

export type NoteReference = {
  id: string;
  teamId: string;
  sourceNoteId: string;
  targetType: NoteReferenceTargetType;
  targetKey: string;
  targetLabel: string;
  createdAt: string;
};

export type ParsedNoteReference = {
  targetType: NoteReferenceTargetType;
  targetKey: string;
  targetLabel: string;
};

export type MentionItem = {
  id: string;
  type: "task" | "project";
  label: string;
};
