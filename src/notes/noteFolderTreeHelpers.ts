import type { Note, NoteFolder, NoteFolderTreeNode } from "./noteTypes";

export function buildNoteFolderTree(folders: NoteFolder[], notes: Note[]): NoteFolderTreeNode[] {
  const sortedFolders = [...folders].sort((left, right) =>
    left.name.localeCompare(right.name, "cs-CZ"),
  );

  function buildLevel(parentFolderId: string | null): NoteFolderTreeNode[] {
    return sortedFolders
      .filter((folder) => folder.parentFolderId === parentFolderId)
      .map((folder) => ({
        folder,
        children: buildLevel(folder.id),
        notes: notes
          .filter((note) => note.folderId === folder.id)
          .sort((left, right) => left.title.localeCompare(right.title, "cs-CZ")),
      }));
  }

  return buildLevel(null);
}

export function flattenFolderTreeForOptions(
  tree: NoteFolderTreeNode[],
  depth = 0,
): { id: string; label: string }[] {
  const options: { id: string; label: string }[] = [];

  for (const node of tree) {
    options.push({ id: node.folder.id, label: `${"— ".repeat(depth)}${node.folder.name}` });
    options.push(...flattenFolderTreeForOptions(node.children, depth + 1));
  }

  return options;
}

export function collectDescendantFolderIds(folders: NoteFolder[], folderId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [folderId];

  while (queue.length > 0) {
    const currentId = queue.shift() as string;

    for (const folder of folders) {
      if (folder.parentFolderId === currentId && !descendants.has(folder.id)) {
        descendants.add(folder.id);
        queue.push(folder.id);
      }
    }
  }

  return descendants;
}

export function wouldCreateFolderCycle(
  folders: NoteFolder[],
  folderId: string,
  candidateParentId: string | null,
): boolean {
  if (candidateParentId === null) {
    return false;
  }

  if (candidateParentId === folderId) {
    return true;
  }

  let currentId: string | null = candidateParentId;

  while (currentId !== null) {
    if (currentId === folderId) {
      return true;
    }

    const currentFolder = folders.find((folder) => folder.id === currentId);
    currentId = currentFolder ? currentFolder.parentFolderId : null;
  }

  return false;
}
