# Task Detail & Delete Permission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the team Kanban board, members can already open a task's detail by clicking its card; add creator-tracking so only a team admin or the task's creator can delete a card, while everyone can still view/edit it.

**Architecture:** Add a `created_by` column to the Supabase `tasks` table (mirrors the existing `projects.created_by` pattern), thread a `createdBy: string | null` field through the `Task` type end-to-end (creation, local storage normalization, cloud upload/download), and gate the existing "Smazat" (delete) menu item in the team board's card row component behind a `canDeleteTask` check that already reuses the existing `canManageProject` admin check.

**Tech Stack:** React 19 + TypeScript, Vite, Supabase (Postgres + `@supabase/supabase-js`). No test runner is configured in this project (no `vitest`/`jest`, no `test` script) — verification is done via `npx tsc --noEmit` (type checking) after each task plus a final manual browser pass.

## Global Constraints

- Project id for the Supabase MCP tools: `ykldkglnrjcimpazkhto` (Donext project, region eu-central-1).
- `createdBy` is set **only** at task creation and is never part of `TaskUpdate` — it must not become editable.
- Legacy tasks with `createdBy === null` (rows created before this migration) must remain deletable by any team member — do not lock users out of existing data.
- Keep files under 500 lines (existing project rule in `CLAUDE.md`) — `AppShell.tsx` is already large; only add the minimal functions needed, don't restructure it in this plan.
- No `Co-Authored-By` trailer on commits (per `CLAUDE.md`), and always create new commits — never amend.

---

### Task 1: Add `created_by` column to the Supabase `tasks` table

**Files:**
- None (database-only change via Supabase MCP tools).

**Interfaces:**
- Produces: a `tasks.created_by uuid null references auth.users(id)` column, backfilled from `tasks.owner_id` for all existing rows. Later tasks read/write this column by name.

- [ ] **Step 1: Apply the migration**

Call the `apply_migration` MCP tool (server `51ce6f44-a90b-4903-a1b2-a260bff0ca03`) with:
- `project_id`: `ykldkglnrjcimpazkhto`
- `name`: `add_tasks_created_by`
- `query`:
```sql
alter table public.tasks
  add column created_by uuid references auth.users(id);

update public.tasks
  set created_by = owner_id
  where created_by is null;
```

- [ ] **Step 2: Verify the column exists**

Call the `list_tables` MCP tool with `project_id: "ykldkglnrjcimpazkhto"`, `schemas: ["public"]`, `verbose: true`. Confirm `public.tasks` now has a `created_by` column of type `uuid`, nullable, with a foreign key to `auth.users.id`, and that `execute_sql` with `select count(*) from public.tasks where created_by is null;` returns `0` (all existing rows backfilled).

- [ ] **Step 3: Check advisors**

Call the `get_advisors` MCP tool with `project_id: "ykldkglnrjcimpazkhto"` and `type: "security"`. Confirm no new advisory was introduced by this migration (existing RLS policies on `tasks` are row-level and don't reference specific columns, so none are expected).

- [ ] **Step 4: Commit**

This task has no local file changes to commit (schema-only). Skip the commit step and proceed to Task 2.

---

### Task 2: Extend the `Task` type with `createdBy`

**Files:**
- Modify: `src/tasks/taskTypes.ts:22-39`
- Modify: `src/tasks/taskStorage.ts:93-116`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Task.createdBy: string | null`, and `normalizeTask` guarantees it's always `string | null` (never `undefined`) even for data persisted before this change. `TaskUpdate` (taskTypes.ts:47-66) is unchanged — `createdBy` is intentionally excluded from it.

- [ ] **Step 1: Add the field to the `Task` type**

In `src/tasks/taskTypes.ts`, change the `Task` type (currently lines 22-39):

```ts
export type Task = {
  id: string;
  listId: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
  dueTime: string | null;
  isArchived: boolean;
  note: string;
  priority: TaskPriority;
  recurrence: TaskRecurrence;
  teamId: string | null;
  assigneeId: string | null;
  projectId: string | null;
  boardColumnKey: BoardColumnKey;
  labels: TaskLabel[];
  subtasks: TaskSubtask[];
  createdBy: string | null;
};
```

Do **not** add `createdBy` to `TaskUpdate` (the `Pick<...>` type below it) — leave that type's field list exactly as-is.

- [ ] **Step 2: Normalize `createdBy` when loading from local storage**

In `src/tasks/taskStorage.ts`, in `normalizeTask` (currently lines 93-116), add a line inside the returned object so old locally-stored tasks (saved before this field existed) don't end up with `createdBy: undefined` at runtime:

```ts
function normalizeTask(task: Task): Task {
  const dueDate = task.dueDate ?? null;

  return {
    ...task,
    dueDate,
    dueTime: dueDate ? task.dueTime ?? null : null,
    isArchived: task.isArchived ?? false,
    recurrence: isTaskRecurrence(task.recurrence) ? task.recurrence : "none",
    projectId:
      typeof task.projectId === "string" || task.projectId === null
        ? task.projectId
        : null,
    assigneeId:
      typeof task.assigneeId === "string" || task.assigneeId === null
        ? task.assigneeId
        : null,
    createdBy:
      typeof task.createdBy === "string" || task.createdBy === null
        ? task.createdBy
        : null,
    boardColumnKey: isBoardColumnKey(task.boardColumnKey) ? task.boardColumnKey : "todo",
    labels: Array.isArray(task.labels) ? task.labels.filter(isTaskLabel) : [],
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.filter(isTaskSubtask)
      : [],
  };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: fails, listing every place that constructs a `Task` object literal without `createdBy` (this is expected — those are fixed in Tasks 3-4). Confirm the errors are only about missing `createdBy` on `Task` literals in `src/App.tsx` and `src/supabase/cloudBackup.ts`, not unrelated files.

- [ ] **Step 4: Commit**

```bash
git add src/tasks/taskTypes.ts src/tasks/taskStorage.ts
git commit -m "Add createdBy field to Task type"
```

---

### Task 3: Stamp `createdBy` when a task is created

**Files:**
- Modify: `src/App.tsx:688-719` (`handleCreateTask`)
- Modify: `src/App.tsx:1436-1474` (`createCloudSyncSnapshot`)

**Interfaces:**
- Consumes: `Task.createdBy` from Task 2; `authUser: User | null` (already in scope in `App.tsx`, Supabase auth user, `authUser.id` is the current user's uuid).
- Produces: every newly created `Task` has `createdBy` set to the current user's id (or `null` if signed out, which shouldn't happen in practice since task creation requires auth, but keeps the type honest).

- [ ] **Step 1: Set `createdBy` in `handleCreateTask`**

In `src/App.tsx`, inside `handleCreateTask` (currently lines 688-719), the `newTask` object construction currently ends with:

```ts
      boardColumnKey: options.boardColumnKey ?? "todo",
      labels: options.labels ?? [],
      subtasks: options.subtasks ?? [],
    };
```

Change it to:

```ts
      boardColumnKey: options.boardColumnKey ?? "todo",
      labels: options.labels ?? [],
      subtasks: options.subtasks ?? [],
      createdBy: authUser?.id ?? null,
    };
```

- [ ] **Step 2: Include `createdBy` in the cloud sync snapshot**

In `src/App.tsx`, inside `createCloudSyncSnapshot` (currently lines 1436-1474), the per-task mapping currently starts with:

```ts
    tasks: tasks.map((task) => ({
      assigneeId: task.assigneeId,
      boardColumnKey: task.boardColumnKey,
      id: task.id,
      completed: task.completed,
```

Add `createdBy` to that object:

```ts
    tasks: tasks.map((task) => ({
      assigneeId: task.assigneeId,
      boardColumnKey: task.boardColumnKey,
      createdBy: task.createdBy,
      id: task.id,
      completed: task.completed,
```

This ensures a change to `createdBy` (e.g. after a fresh cloud download populates it for older tasks) is detected by the auto-sync change check instead of being silently ignored.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: the `Task` literal error in `src/App.tsx` from Task 2 Step 3 is gone. Remaining errors (if any) should only be in `src/supabase/cloudBackup.ts`, fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "Stamp createdBy on new tasks and include it in cloud sync snapshot"
```

---

### Task 4: Read/write `created_by` in the Supabase sync layer

**Files:**
- Modify: `src/supabase/cloudBackup.ts:42-57` (`CloudTaskRow` type)
- Modify: `src/supabase/cloudBackup.ts:209-215` (download `select` column list)
- Modify: `src/supabase/cloudBackup.ts:296-320` (remote-row → `Task` mapping)
- Modify: `src/supabase/cloudBackup.ts:405-442` (`insertTasks`)

**Interfaces:**
- Consumes: `Task.createdBy` from Task 2/3.
- Produces: `downloadSupabaseData` returns tasks with `createdBy` populated from the DB; `uploadLocalDataToSupabase`/`replaceSupabaseData` (both go through `insertTasks`) persist `createdBy` back to the DB, preserving whatever value is already in the local `Task` object instead of overwriting it with the syncing user's id.

- [ ] **Step 1: Add `created_by` to `CloudTaskRow`**

In `src/supabase/cloudBackup.ts`, `CloudTaskRow` (currently lines 42-57) currently ends with:

```ts
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
```

Add the new field:

```ts
type CloudTaskRow = {
  completed: boolean;
  created_by: string | null;
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
```

- [ ] **Step 2: Select `created_by` in `downloadSupabaseData`**

In `src/supabase/cloudBackup.ts`, the tasks query (currently around line 209-215) currently selects:

```ts
    supabase
      .from("tasks")
      .select(
        "id,list_id,title,completed,due_date,due_time,is_archived,note,priority,recurrence,team_id,assignee_id,project_id,board_column_key",
      )
      .or(ownedOrAssignedOrTeamFilter)
      .order("created_at", { ascending: true }),
```

Add `created_by` to the column list:

```ts
    supabase
      .from("tasks")
      .select(
        "id,list_id,title,completed,due_date,due_time,is_archived,note,priority,recurrence,team_id,assignee_id,project_id,board_column_key,created_by",
      )
      .or(ownedOrAssignedOrTeamFilter)
      .order("created_at", { ascending: true }),
```

- [ ] **Step 3: Map `created_by` onto the local `Task`**

In `src/supabase/cloudBackup.ts`, the remote-row mapping (currently lines 296-320) currently starts:

```ts
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
```

Add the mapped field:

```ts
  const tasks: Task[] = remoteTasks.map((task) => ({
    id: task.id,
    completed: task.completed,
    createdBy: task.created_by,
    dueDate: task.due_date,
    dueTime: task.due_date ? normalizeTimeValue(task.due_time) : null,
    isArchived: task.is_archived,
    teamId: task.team_id,
    assigneeId: task.assignee_id,
    projectId: task.project_id,
    boardColumnKey: normalizeBoardColumnKey(task.board_column_key),
```

- [ ] **Step 4: Write `created_by` in `insertTasks`, preserving the task's own value**

In `src/supabase/cloudBackup.ts`, `insertTasks` (currently lines 405-442) currently builds each row as:

```ts
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
```

Change it to include `created_by`, falling back to the syncing user's id only when the task has none (e.g. a task created locally before this feature shipped):

```ts
    tasks.map((task) => ({
        completed: task.completed,
        created_by: task.createdBy ?? userId,
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
```

This is safe because `task.createdBy` on a task synced from another user was already read from the DB in Step 3 above and stored locally — it is never blank for a task that came from someone else's account, only for genuinely new/legacy local-only tasks.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors remaining from the `Task`/`createdBy` change (any other pre-existing errors unrelated to this change are out of scope).

- [ ] **Step 6: Commit**

```bash
git add src/supabase/cloudBackup.ts
git commit -m "Sync tasks.created_by through the Supabase backup layer"
```

---

### Task 5: Restrict the "Smazat" (delete) action to admins and the task's creator

**Files:**
- Modify: `src/layout/AppShell.tsx:1784-1786` (add `canDeleteTask` next to `canManageProject`)
- Modify: `src/layout/AppShell.tsx:2385-2412` (`ProjectDetailView` invocation — pass the new prop)
- Modify: `src/layout/AppShell.tsx:2856-2910` (`ProjectDetailView` props)
- Modify: `src/layout/AppShell.tsx:3145-3157` (`ProjectTaskMiniRow` invocation inside `ProjectDetailView`)
- Modify: `src/layout/AppShell.tsx:3190-3298` (`ProjectTaskMiniRow` component)

**Interfaces:**
- Consumes: `Task.createdBy` (Task 2), `currentUserId: string | null` (already in scope at line ~790 of the enclosing component), `canManageProject(project: Project): boolean` (existing, line 1784).
- Produces: `canDeleteTask(task: Task, project: Project): boolean`, threaded down as a per-row `canDelete: boolean` prop on `ProjectTaskMiniRow`. When `false`, the "Smazat" menu item is not rendered at all (the "Upravit" item and the click-to-open behavior are unaffected).

- [ ] **Step 1: Add the `canDeleteTask` helper**

In `src/layout/AppShell.tsx`, immediately after the existing `canManageProject` function (currently lines 1784-1786):

```ts
  function canManageProject(project: Project) {
    return isGlobalAdmin || manageableTeamIds.has(project.teamId);
  }

  function canDeleteTask(task: Task, project: Project) {
    if (canManageProject(project)) {
      return true;
    }

    if (task.createdBy === null) {
      return true;
    }

    return task.createdBy === currentUserId;
  }
```

- [ ] **Step 2: Pass `currentUserId` and a per-task delete check into `ProjectDetailView`**

In `src/layout/AppShell.tsx`, the `ProjectDetailView` invocation (currently around lines 2385-2412) currently includes:

```tsx
        <ProjectDetailView
          canManage={canManageProject(selectedProject)}
          columns={projectColumns}
```

Add a `canDeleteTask` prop right after `canManage`:

```tsx
        <ProjectDetailView
          canManage={canManageProject(selectedProject)}
          canDeleteTask={(task) => canDeleteTask(task, selectedProject)}
          columns={projectColumns}
```

- [ ] **Step 3: Accept and forward the prop in `ProjectDetailView`**

In `src/layout/AppShell.tsx`, `ProjectDetailView`'s destructured props and type (currently lines 2856-2910) currently start:

```ts
function ProjectDetailView({
  canManage,
  columns,
  ...
}: {
  canManage: boolean;
  columns: ProjectColumn[];
  ...
```

Add `canDeleteTask` to both the destructuring and the type:

```ts
function ProjectDetailView({
  canManage,
  canDeleteTask,
  columns,
  ...
}: {
  canManage: boolean;
  canDeleteTask: (task: Task) => boolean;
  columns: ProjectColumn[];
  ...
```

(Insert `canDeleteTask,` right after `canManage,` in the destructuring list, and `canDeleteTask: (task: Task) => boolean;` right after `canManage: boolean;` in the type — keep every other existing prop unchanged.)

- [ ] **Step 4: Pass `canDelete` down to each `ProjectTaskMiniRow`**

In `src/layout/AppShell.tsx`, inside `ProjectDetailView`'s render of the column task list (currently lines 3145-3157):

```tsx
                    columnTasks.map((task) => (
                      <ProjectTaskMiniRow
                        assignee={task.assigneeId ? memberById.get(task.assigneeId) ?? null : null}
                        isDragging={draggedTaskId === task.id}
                        isSettling={droppedTaskId === task.id}
                        key={task.id}
                        task={task}
                        onDragEnd={handleTaskDragEnd}
                        onDeleteTask={onDeleteTask}
                        onDragStart={handleTaskDragStart}
                        onOpenTask={onOpenTask}
                      />
                    ))
```

Add `canDelete`:

```tsx
                    columnTasks.map((task) => (
                      <ProjectTaskMiniRow
                        assignee={task.assigneeId ? memberById.get(task.assigneeId) ?? null : null}
                        canDelete={canDeleteTask(task)}
                        isDragging={draggedTaskId === task.id}
                        isSettling={droppedTaskId === task.id}
                        key={task.id}
                        task={task}
                        onDragEnd={handleTaskDragEnd}
                        onDeleteTask={onDeleteTask}
                        onDragStart={handleTaskDragStart}
                        onOpenTask={onOpenTask}
                      />
                    ))
```

- [ ] **Step 5: Accept `canDelete` in `ProjectTaskMiniRow` and hide "Smazat" when false**

In `src/layout/AppShell.tsx`, `ProjectTaskMiniRow`'s signature (currently lines 3190-3208) currently reads:

```ts
function ProjectTaskMiniRow({
  assignee,
  isDragging,
  isSettling,
  task,
  onDragEnd,
  onDeleteTask,
  onDragStart,
  onOpenTask,
}: {
  assignee: TeamMember | null;
  isDragging: boolean;
  isSettling: boolean;
  task: Task;
  onDragEnd: () => void;
  onDeleteTask: (taskId: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, task: Task) => void;
  onOpenTask: (taskId: string) => void;
}) {
```

Change it to:

```ts
function ProjectTaskMiniRow({
  assignee,
  canDelete,
  isDragging,
  isSettling,
  task,
  onDragEnd,
  onDeleteTask,
  onDragStart,
  onOpenTask,
}: {
  assignee: TeamMember | null;
  canDelete: boolean;
  isDragging: boolean;
  isSettling: boolean;
  task: Task;
  onDragEnd: () => void;
  onDeleteTask: (taskId: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, task: Task) => void;
  onOpenTask: (taskId: string) => void;
}) {
```

Then, further down in the same component, the menu content (currently lines 3270-3294) currently reads:

```tsx
        {isMenuOpen ? (
          <div className="project-detail__task-menu-content" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                handleMenuAction(() => onOpenTask(task.id));
              }}
            >
              Upravit
            </button>
            <button
              className="project-detail__task-menu-danger"
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                handleMenuAction(() => onDeleteTask(task.id));
              }}
            >
              Smazat
            </button>
          </div>
        ) : null}
```

Change it to only render the "Smazat" button when `canDelete` is true:

```tsx
        {isMenuOpen ? (
          <div className="project-detail__task-menu-content" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                handleMenuAction(() => onOpenTask(task.id));
              }}
            >
              Upravit
            </button>
            {canDelete ? (
              <button
                className="project-detail__task-menu-danger"
                type="button"
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation();
                  handleMenuAction(() => onDeleteTask(task.id));
                }}
              >
                Smazat
              </button>
            ) : null}
          </div>
        ) : null}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/layout/AppShell.tsx
git commit -m "Restrict team board card deletion to admins and the task creator"
```

---

### Task 6: Manual verification in the browser

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: the running app via the Vite dev server (`npm run dev`).

- [ ] **Step 1: Start the dev server and open the app**

Use the project's dev server preview tooling to start `npm run dev` and open the app in the browser pane.

- [ ] **Step 2: Verify click-to-open still works**

Sign in, navigate to a team's project board, and click a task card's title (not the 3-dot menu). Confirm the card composer modal opens in edit mode (title reads "Uložit kartu"/similar edit label, not "Add Card") and shows the task's existing title, note, priority, due date, labels, assignee, and subtasks. Edit a field (e.g. the note) and save; confirm the change persists after closing and reopening the card.

- [ ] **Step 3: Verify delete is visible for the team admin**

While signed in as the team's admin (or its owner), open the 3-dot menu on a task card created by a different member. Confirm both "Upravit" and "Smazat" are present.

- [ ] **Step 4: Verify delete is hidden for a non-creator member**

Sign in as a `member`-role user (not admin, not the task's creator) on the same team. Open the 3-dot menu on a card created by someone else. Confirm only "Upravit" is present — "Smazat" is not rendered. Open the 3-dot menu on a card that this member created themselves; confirm "Smazat" is present there.

- [ ] **Step 5: Verify legacy tasks (no creator recorded) remain deletable**

Using `execute_sql` against project `ykldkglnrjcimpazkhto` (read-only check), confirm whether any tasks still have `created_by is null` after the Task 1 backfill. If the backfill in Task 1 fully populated every row (expected, since it derives from `owner_id`), this scenario won't exist in production data — treat this step as a no-op confirmation rather than a live UI test, and note that a task manually inserted in the future without `created_by` would remain deletable by any member per the `canDeleteTask` logic in Task 5.

No commit for this task — it's a verification pass only.
