import { supabase } from "./supabaseClient";
import {
  DEFAULT_TASK_LIST_ID,
  MOCK_LISTS,
  SYSTEM_LISTS,
} from "../tasks/mockData";
import type { StoredTaskState } from "../tasks/taskStorage";
import type {
  Task,
  TaskLabel,
  TaskList,
  TaskPriority,
  TaskRecurrence,
} from "../tasks/taskTypes";

type UploadResult = {
  labels: number;
  lists: number;
  subtasks: number;
  taskLabels: number;
  tasks: number;
};

type RemoteId = {
  id: string;
};

type UploadLocalDataInput = {
  lists: TaskList[];
  tasks: Task[];
  userId: string;
};

type CloudTaskListRow = {
  color: string | null;
  id: string;
  is_archived: boolean;
  name: string;
  team_id: string | null;
};

type CloudTaskRow = {
  completed: boolean;
  due_date: string | null;
  due_time: string | null;
  id: string;
  is_archived: boolean;
  list_id: string;
  team_id: string | null;
  assignee_id: string | null;
  owner_id: string;
  project_id: string | null;
  board_column_key: string | null;
  note: string | null;
  priority: string;
  recurrence: string;
  title: string;
};

type CloudSubtaskRow = {
  completed: boolean;
  id: string;
  position: number;
  task_id: string;
  title: string;
};

type CloudLabelRow = {
  color: string;
  id: string;
  name: string;
};

type CloudTaskLabelRow = {
  label_id: string;
  task_id: string;
};

export async function uploadLocalDataToSupabase({
  lists,
  tasks,
  userId,
}: UploadLocalDataInput): Promise<UploadResult> {
  if (!supabase) {
    throw new Error("Supabase neni nakonfigurovany.");
  }

  const hasCloudData = await checkCloudDataExists(userId);

  if (hasCloudData) {
    throw new Error(
      "Cloud uz obsahuje data. Upload jsem zastavil, aby nevznikly duplicity.",
    );
  }

  const userLists = lists.filter((list) => !list.isSystem);

  if (userLists.length === 0) {
    throw new Error("Neni co nahrat. Nejdriv vytvor aspon jeden seznam.");
  }

  return insertLocalData({ lists: userLists, tasks, userId });
}

export async function replaceSupabaseData({
  lists,
  tasks,
  userId,
}: UploadLocalDataInput): Promise<UploadResult> {
  if (!supabase) {
    throw new Error("Supabase neni nakonfigurovany.");
  }

  const userLists = lists.filter((list) => !list.isSystem);

  if (userLists.length === 0) {
    throw new Error("Neni co ulozit. Nejdriv vytvor aspon jeden seznam.");
  }

  return insertLocalData({ lists: userLists, tasks, userId });
}

async function insertLocalData({
  lists,
  tasks,
  userId,
}: {
  lists: TaskList[];
  tasks: Task[];
  userId: string;
}) {
  const upsertedLists = await upsertLists(userId, lists);
  const fallbackListId = upsertedLists[0]?.id;

  if (!fallbackListId) {
    throw new Error("Nepodarilo se ulozit seznam do cloudu.");
  }

  const validListIds = new Set(upsertedLists.map((list) => list.id));
  const upsertedTasks = await upsertTasks(userId, tasks, validListIds, fallbackListId);
  const labels = collectLabels(tasks);
  const upsertedLabels = await insertLabels(userId, labels);
  const labelIdByKey = new Map(
    upsertedLabels.map((remoteLabel, index) => [
      getLabelKey(labels[index]),
      remoteLabel.id,
    ]),
  );
  const subtasksCount = await upsertSubtasks(userId, tasks);
  const taskLabelsCount = await upsertTaskLabels(userId, tasks, labelIdByKey);

  await deleteRemovedTasks(userId, tasks);
  await deleteRemovedLists(userId, lists);

  return {
    labels: upsertedLabels.length,
    lists: upsertedLists.length,
    subtasks: subtasksCount,
    taskLabels: taskLabelsCount,
    tasks: upsertedTasks.length,
  };
}

export async function downloadSupabaseData(userId: string): Promise<StoredTaskState> {
  if (!supabase) {
    throw new Error("Supabase neni nakonfigurovany.");
  }

  const membershipResult = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  const memberTeamIds = Array.from(
    new Set((membershipResult.data ?? []).map((row) => row.team_id as string)),
  );
  const ownedOrTeamFilter =
    memberTeamIds.length > 0
      ? `owner_id.eq.${userId},team_id.in.(${memberTeamIds.join(",")})`
      : `owner_id.eq.${userId}`;
  const ownedOrAssignedOrTeamFilter =
    memberTeamIds.length > 0
      ? `owner_id.eq.${userId},assignee_id.eq.${userId},team_id.in.(${memberTeamIds.join(",")})`
      : `owner_id.eq.${userId},assignee_id.eq.${userId}`;

  const [listsResult, tasksResult] = await Promise.all([
    supabase
      .from("task_lists")
      .select("id,name,color,is_archived,team_id")
      .or(ownedOrTeamFilter)
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "id,list_id,title,completed,due_date,due_time,is_archived,note,priority,recurrence,team_id,assignee_id,owner_id,project_id,board_column_key",
      )
      .or(ownedOrAssignedOrTeamFilter)
      .order("created_at", { ascending: true }),
  ]);

  if (listsResult.error) {
    throw listsResult.error;
  }

  if (tasksResult.error) {
    throw tasksResult.error;
  }

  const remoteLists = (listsResult.data ?? []) as CloudTaskListRow[];
  const remoteTasks = (tasksResult.data ?? []) as CloudTaskRow[];
  const taskIds = remoteTasks.map((task) => task.id);

  const [subtasksResult, taskLabelsResult] = await Promise.all([
    taskIds.length > 0
      ? supabase
          .from("subtasks")
          .select("id,task_id,title,completed,position")
          .in("task_id", taskIds)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    taskIds.length > 0
      ? supabase
          .from("task_labels")
          .select("task_id,label_id")
          .in("task_id", taskIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (subtasksResult.error) {
    throw subtasksResult.error;
  }

  if (taskLabelsResult.error) {
    throw taskLabelsResult.error;
  }

  const remoteSubtasks = (subtasksResult.data ?? []) as CloudSubtaskRow[];
  const remoteTaskLabels = (taskLabelsResult.data ?? []) as CloudTaskLabelRow[];
  const labelIds = Array.from(new Set(remoteTaskLabels.map((row) => row.label_id)));
  const labelFilter =
    labelIds.length > 0
      ? `owner_id.eq.${userId},id.in.(${labelIds.join(",")})`
      : `owner_id.eq.${userId}`;

  const labelsResult = await supabase
    .from("labels")
    .select("id,name,color")
    .or(labelFilter);

  if (labelsResult.error) {
    throw labelsResult.error;
  }

  const remoteLabels = (labelsResult.data ?? []) as CloudLabelRow[];
  const labelsById = new Map(
    remoteLabels.map((label): [string, TaskLabel] => [
      label.id,
      {
        id: label.id,
        color: label.color,
        name: label.name,
      },
    ]),
  );
  const taskLabelsByTaskId = groupBy(remoteTaskLabels, (row) => row.task_id);
  const subtasksByTaskId = groupBy(remoteSubtasks, (row) => row.task_id);
  const lists: TaskList[] = [
    ...SYSTEM_LISTS,
    ...remoteLists.map((list) => ({
      id: list.id,
      color: list.color,
      isArchived: list.is_archived,
      isSystem: false,
      teamId: list.team_id,
      name: list.name,
    })),
  ];
  const fallbackListId = remoteLists[0]?.id ?? DEFAULT_TASK_LIST_ID;
  const tasks: Task[] = remoteTasks.map((task) => ({
    ...mapCloudTaskRowCore(task, remoteLists.map((list) => list.id), fallbackListId),
    labels: (taskLabelsByTaskId.get(task.id) ?? [])
      .map((taskLabel) => labelsById.get(taskLabel.label_id))
      .filter((label): label is TaskLabel => Boolean(label)),
    subtasks: (subtasksByTaskId.get(task.id) ?? []).map((subtask) => ({
      id: subtask.id,
      completed: subtask.completed,
      title: subtask.title,
    })),
  }));

  return {
    activeListId: remoteLists[0]?.id ?? MOCK_LISTS[0]?.id ?? "",
    lists,
    selectedTaskId: null,
    tasks,
  };
}

async function checkCloudDataExists(userId: string) {
  if (!supabase) {
    return false;
  }

  const [listsResult, tasksResult] = await Promise.all([
    supabase
      .from("task_lists")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId),
  ]);

  if (listsResult.error) {
    throw listsResult.error;
  }

  if (tasksResult.error) {
    throw tasksResult.error;
  }

  return Boolean((listsResult.count ?? 0) > 0 || (tasksResult.count ?? 0) > 0);
}

async function deleteRemovedLists(userId: string, lists: TaskList[]) {
  if (!supabase) {
    return;
  }

  const keepIds = lists.map((list) => list.id);
  let query = supabase.from("task_lists").delete().eq("owner_id", userId);

  if (keepIds.length > 0) {
    query = query.not("id", "in", `(${keepIds.join(",")})`);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }
}

async function deleteRemovedTasks(userId: string, tasks: Task[]) {
  if (!supabase) {
    return;
  }

  const keepIds = tasks.map((task) => task.id);
  let query = supabase.from("tasks").delete().eq("owner_id", userId);

  if (keepIds.length > 0) {
    query = query.not("id", "in", `(${keepIds.join(",")})`);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }
}

async function upsertLists(userId: string, lists: TaskList[]) {
  if (!supabase || lists.length === 0) {
    return [];
  }

  // Team lists owned by a teammate can only be updated by that team's admins
  // (task_lists RLS), so skip re-writing lists we don't own to avoid failing
  // the whole sync for regular members. We still treat them as valid targets
  // for a task's list_id.
  const { data: existingLists, error: existingError } = await supabase
    .from("task_lists")
    .select("id,owner_id")
    .in(
      "id",
      lists.map((list) => list.id),
    );

  if (existingError) {
    throw existingError;
  }

  const ownerByRemoteId = new Map(
    (existingLists ?? []).map((row) => [row.id as string, row.owner_id as string]),
  );
  const writableLists = lists.filter((list) => {
    const remoteOwner = ownerByRemoteId.get(list.id);

    return remoteOwner === undefined || remoteOwner === userId;
  });
  const readOnlyIds = lists
    .filter((list) => !writableLists.includes(list))
    .map((list) => ({ id: list.id }));

  if (writableLists.length === 0) {
    return readOnlyIds;
  }

  const { data, error } = await supabase
    .from("task_lists")
    .upsert(
      writableLists.map((list) => ({
        id: list.id,
        color: list.color ?? null,
        is_archived: list.isArchived,
        name: list.name,
        owner_id: userId,
        team_id: list.teamId ?? null,
      })),
      { onConflict: "id" },
    )
    .select("id");

  if (error) {
    throw error;
  }

  return [...((data ?? []) as RemoteId[]), ...readOnlyIds];
}

async function upsertTasks(
  userId: string,
  tasks: Task[],
  validListIds: Set<string>,
  fallbackListId: string,
) {
  if (!supabase || tasks.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("tasks")
    .upsert(
      tasks.map((task) => ({
        id: task.id,
        completed: task.completed,
        due_date: task.dueDate,
        due_time: task.dueTime,
        is_archived: task.isArchived,
        list_id: validListIds.has(task.listId) ? task.listId : fallbackListId,
        note: task.note,
        owner_id: userId,
        priority: task.priority,
        recurrence: task.recurrence,
        assignee_id: task.assigneeId,
        project_id: task.projectId,
        board_column_key: task.boardColumnKey,
        team_id: task.teamId,
        title: task.title,
      })),
      { onConflict: "id" },
    )
    .select("id");

  if (error) {
    throw error;
  }

  return (data ?? []) as RemoteId[];
}

async function insertLabels(userId: string, labels: TaskLabel[]) {
  if (!supabase || labels.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("labels")
    .upsert(
      labels.map((label) => ({
        color: label.color,
        name: label.name,
        owner_id: userId,
      })),
      { onConflict: "owner_id,name" },
    )
    .select("id");

  if (error) {
    throw error;
  }

  return (data ?? []) as RemoteId[];
}

async function upsertSubtasks(userId: string, tasks: Task[]) {
  if (!supabase) {
    return 0;
  }

  const allRows = tasks.flatMap((task) =>
    task.subtasks.map((subtask, index) => ({
      id: subtask.id,
      completed: subtask.completed,
      owner_id: userId,
      position: index,
      task_id: task.id,
      title: subtask.title,
    })),
  );

  const keepIds = allRows.map((row) => row.id);
  let deleteQuery = supabase.from("subtasks").delete().eq("owner_id", userId);

  if (keepIds.length > 0) {
    deleteQuery = deleteQuery.not("id", "in", `(${keepIds.join(",")})`);
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    throw deleteError;
  }

  if (allRows.length === 0) {
    return 0;
  }

  // subtasks RLS only allows the owner (or a global admin) to update a row,
  // so skip re-writing subtasks owned by a teammate to avoid failing the
  // whole batch for the rest of this user's own subtasks.
  const { data: existingSubtasks, error: existingError } = await supabase
    .from("subtasks")
    .select("id,owner_id")
    .in("id", keepIds);

  if (existingError) {
    throw existingError;
  }

  const ownerById = new Map(
    (existingSubtasks ?? []).map((row) => [row.id as string, row.owner_id as string]),
  );
  const subtaskRows = allRows.filter((row) => {
    const remoteOwner = ownerById.get(row.id);

    return remoteOwner === undefined || remoteOwner === userId;
  });

  if (subtaskRows.length === 0) {
    return 0;
  }

  const { error } = await supabase.from("subtasks").upsert(subtaskRows, { onConflict: "id" });

  if (error) {
    throw error;
  }

  return subtaskRows.length;
}

async function upsertTaskLabels(
  userId: string,
  tasks: Task[],
  labelIdByKey: Map<string, string>,
) {
  if (!supabase) {
    return 0;
  }

  const allRows = tasks.flatMap((task) =>
    task.labels
      .map((label) => {
        const labelId = labelIdByKey.get(getLabelKey(label));

        return labelId
          ? {
              label_id: labelId,
              owner_id: userId,
              task_id: task.id,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
  );

  const taskIds = tasks.map((task) => task.id);

  if (taskIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("task_labels")
      .delete()
      .eq("owner_id", userId)
      .in("task_id", taskIds);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (allRows.length === 0) {
    return 0;
  }

  // task_labels RLS only allows the owner (or a global admin) to update a
  // row, so skip re-writing pairs owned by a teammate to avoid failing the
  // whole batch for the rest of this user's own task_labels.
  const { data: existingTaskLabels, error: existingError } = await supabase
    .from("task_labels")
    .select("task_id,label_id,owner_id")
    .in("task_id", taskIds);

  if (existingError) {
    throw existingError;
  }

  const ownerByPair = new Map(
    (existingTaskLabels ?? []).map((row) => [
      `${row.task_id}:${row.label_id}`,
      row.owner_id as string,
    ]),
  );
  const taskLabelRows = allRows.filter((row) => {
    const remoteOwner = ownerByPair.get(`${row.task_id}:${row.label_id}`);

    return remoteOwner === undefined || remoteOwner === userId;
  });

  if (taskLabelRows.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from("task_labels")
    .upsert(taskLabelRows, { onConflict: "task_id,label_id" });

  if (error) {
    throw error;
  }

  return taskLabelRows.length;
}

function collectLabels(tasks: Task[]) {
  const labelsByKey = new Map<string, TaskLabel>();

  for (const task of tasks) {
    for (const label of task.labels) {
      const key = getLabelKey(label);

      if (!labelsByKey.has(key)) {
        labelsByKey.set(key, label);
      }
    }
  }

  return [...labelsByKey.values()];
}

function getLabelKey(label: TaskLabel | undefined) {
  return label ? label.name.trim().toLocaleLowerCase("cs-CZ") : "";
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key) ?? [];

    group.push(item);
    groups.set(key, group);
  }

  return groups;
}

function normalizeBoardColumnKey(value: string | null): Task["boardColumnKey"] {
  return value && value.trim().length > 0 ? value : "todo";
}

function mapCloudTaskRowCore(
  task: CloudTaskRow,
  validListIds: string[],
  fallbackListId: string,
): Omit<Task, "labels" | "subtasks"> {
  return {
    id: task.id,
    completed: task.completed,
    dueDate: task.due_date,
    dueTime: task.due_date ? normalizeTimeValue(task.due_time) : null,
    isArchived: task.is_archived,
    teamId: task.team_id,
    assigneeId: task.assignee_id,
    ownerId: task.owner_id,
    projectId: task.project_id,
    boardColumnKey: normalizeBoardColumnKey(task.board_column_key),
    listId: validListIds.includes(task.list_id) ? task.list_id : fallbackListId,
    note: task.note ?? "",
    priority: normalizePriority(task.priority),
    recurrence: normalizeRecurrence(task.recurrence),
    title: task.title,
  };
}

export type TaskChangeEvent =
  | { type: "upserted"; task: Omit<Task, "labels" | "subtasks"> }
  | { type: "deleted"; taskId: string };

export function subscribeToTaskChanges(
  onChange: (event: TaskChangeEvent) => void,
): () => void {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel("tasks-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as Partial<CloudTaskRow>;

          if (oldRow.id) {
            onChange({ type: "deleted", taskId: oldRow.id });
          }

          return;
        }

        const row = payload.new as CloudTaskRow;

        onChange({
          type: "upserted",
          task: mapCloudTaskRowCore(row, [row.list_id], row.list_id),
        });
      },
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}

function normalizePriority(priority: string): TaskPriority {
  return priority === "low" || priority === "medium" || priority === "high"
    ? priority
    : "none";
}

function normalizeRecurrence(recurrence: string): TaskRecurrence {
  return recurrence === "daily" ||
    recurrence === "weekly" ||
    recurrence === "monthly"
    ? recurrence
    : "none";
}

function normalizeTimeValue(timeValue: string | null) {
  if (!timeValue) {
    return null;
  }

  return timeValue.slice(0, 5);
}
