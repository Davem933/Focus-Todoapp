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

  await deleteCloudData(userId);

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
  const insertedLists = await insertLists(userId, lists);
  const listIdByLocalId = new Map(
    insertedLists.map((remoteList, index) => [lists[index]?.id, remoteList.id]),
  );
  const fallbackRemoteListId = insertedLists[0]?.id;

  if (!fallbackRemoteListId) {
    throw new Error("Nepodarilo se vytvorit seznam v cloudu.");
  }

  const insertedTasks = await insertTasks(
    userId,
    tasks,
    listIdByLocalId,
    fallbackRemoteListId,
  );
  const taskIdByLocalId = new Map(
    insertedTasks.map((remoteTask, index) => [tasks[index]?.id, remoteTask.id]),
  );
  const labels = collectLabels(tasks);
  const insertedLabels = await insertLabels(userId, labels);
  const labelIdByKey = new Map(
    insertedLabels.map((remoteLabel, index) => [
      getLabelKey(labels[index]),
      remoteLabel.id,
    ]),
  );
  const subtasksCount = await insertSubtasks(userId, tasks, taskIdByLocalId);
  const taskLabelsCount = await insertTaskLabels(
    userId,
    tasks,
    taskIdByLocalId,
    labelIdByKey,
  );

  return {
    labels: insertedLabels.length,
    lists: insertedLists.length,
    subtasks: subtasksCount,
    taskLabels: taskLabelsCount,
    tasks: insertedTasks.length,
  };
}

export async function downloadSupabaseData(userId: string): Promise<StoredTaskState> {
  if (!supabase) {
    throw new Error("Supabase neni nakonfigurovany.");
  }

  const [listsResult, tasksResult, subtasksResult, labelsResult, taskLabelsResult] =
    await Promise.all([
      supabase
        .from("task_lists")
        .select("id,name,color,is_archived,team_id")
        .eq("owner_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("tasks")
        .select(
          "id,list_id,title,completed,due_date,due_time,is_archived,note,priority,recurrence,team_id,assignee_id,project_id,board_column_key",
        )
        .eq("owner_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("subtasks")
        .select("id,task_id,title,completed,position")
        .eq("owner_id", userId)
        .order("position", { ascending: true }),
      supabase
        .from("labels")
        .select("id,name,color")
        .eq("owner_id", userId),
      supabase
        .from("task_labels")
        .select("task_id,label_id")
        .eq("owner_id", userId),
    ]);

  if (listsResult.error) {
    throw listsResult.error;
  }

  if (tasksResult.error) {
    throw tasksResult.error;
  }

  if (subtasksResult.error) {
    throw subtasksResult.error;
  }

  if (labelsResult.error) {
    throw labelsResult.error;
  }

  if (taskLabelsResult.error) {
    throw taskLabelsResult.error;
  }

  const remoteLists = (listsResult.data ?? []) as CloudTaskListRow[];
  const remoteTasks = (tasksResult.data ?? []) as CloudTaskRow[];
  const remoteSubtasks = (subtasksResult.data ?? []) as CloudSubtaskRow[];
  const remoteLabels = (labelsResult.data ?? []) as CloudLabelRow[];
  const remoteTaskLabels = (taskLabelsResult.data ?? []) as CloudTaskLabelRow[];
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
    id: task.id,
    completed: task.completed,
    dueDate: task.due_date,
    dueTime: task.due_date ? normalizeTimeValue(task.due_time) : null,
    isArchived: task.is_archived,
    teamId: task.team_id,
    assigneeId: task.assignee_id,
    projectId: task.project_id,
    boardColumnKey: normalizeBoardColumnKey(task.board_column_key),
    labels: (taskLabelsByTaskId.get(task.id) ?? [])
      .map((taskLabel) => labelsById.get(taskLabel.label_id))
      .filter((label): label is TaskLabel => Boolean(label)),
    listId: remoteLists.some((list) => list.id === task.list_id)
      ? task.list_id
      : fallbackListId,
    note: task.note ?? "",
    priority: normalizePriority(task.priority),
    recurrence: normalizeRecurrence(task.recurrence),
    subtasks: (subtasksByTaskId.get(task.id) ?? []).map((subtask) => ({
      id: subtask.id,
      completed: subtask.completed,
      title: subtask.title,
    })),
    title: task.title,
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

async function deleteCloudData(userId: string) {
  if (!supabase) {
    return;
  }

  const deleteRequests = [
    supabase.from("task_labels").delete().eq("owner_id", userId),
    supabase.from("subtasks").delete().eq("owner_id", userId),
    supabase.from("tasks").delete().eq("owner_id", userId),
    supabase.from("labels").delete().eq("owner_id", userId),
    supabase.from("task_lists").delete().eq("owner_id", userId),
  ];

  for (const request of deleteRequests) {
    const { error } = await request;

    if (error) {
      throw error;
    }
  }
}

async function insertLists(userId: string, lists: TaskList[]) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("task_lists")
    .insert(
      lists.map((list) => ({
        color: list.color ?? null,
        is_archived: list.isArchived,
        name: list.name,
        owner_id: userId,
        team_id: list.teamId ?? null,
      })),
    )
    .select("id");

  if (error) {
    throw error;
  }

  return (data ?? []) as RemoteId[];
}

async function insertTasks(
  userId: string,
  tasks: Task[],
  listIdByLocalId: Map<string | undefined, string>,
  fallbackRemoteListId: string,
) {
  if (!supabase || tasks.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert(
      tasks.map((task) => ({
        completed: task.completed,
        due_date: task.dueDate,
        due_time: task.dueTime,
        is_archived: task.isArchived,
        list_id: listIdByLocalId.get(task.listId) ?? fallbackRemoteListId,
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

async function insertSubtasks(
  userId: string,
  tasks: Task[],
  taskIdByLocalId: Map<string | undefined, string>,
) {
  if (!supabase) {
    return 0;
  }

  const subtaskRows = tasks.flatMap((task) => {
    const taskId = taskIdByLocalId.get(task.id);

    if (!taskId) {
      return [];
    }

    return task.subtasks.map((subtask, index) => ({
      completed: subtask.completed,
      owner_id: userId,
      position: index,
      task_id: taskId,
      title: subtask.title,
    }));
  });

  if (subtaskRows.length === 0) {
    return 0;
  }

  const { error } = await supabase.from("subtasks").insert(subtaskRows);

  if (error) {
    throw error;
  }

  return subtaskRows.length;
}

async function insertTaskLabels(
  userId: string,
  tasks: Task[],
  taskIdByLocalId: Map<string | undefined, string>,
  labelIdByKey: Map<string, string>,
) {
  if (!supabase) {
    return 0;
  }

  const taskLabelRows = tasks.flatMap((task) => {
    const taskId = taskIdByLocalId.get(task.id);

    if (!taskId) {
      return [];
    }

    return task.labels
      .map((label) => {
        const labelId = labelIdByKey.get(getLabelKey(label));

        return labelId
          ? {
              label_id: labelId,
              owner_id: userId,
              task_id: taskId,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  });

  if (taskLabelRows.length === 0) {
    return 0;
  }

  const { error } = await supabase.from("task_labels").insert(taskLabelRows);

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
