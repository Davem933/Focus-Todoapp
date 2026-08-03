# QR sdílení úkolu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a QR-code share feature so a user can generate a link/QR code for a single task that anyone (no account needed) can open in a read-only preview.

**Architecture:** A nullable `share_token` column on `tasks`, set/cleared via a direct targeted Supabase update (bypassing the normal upsert-by-id sync). A single `SECURITY DEFINER` Postgres RPC (`get_shared_task`) is the only door anonymous visitors get into the data. `main.tsx` branches on `/share/:token` before mounting the authenticated app, rendering an independent `SharedTaskView` that calls the RPC with the anon Supabase client. A shared `ShareTaskPopover` component (QR generation via the `qrcode` package) is wired into both `DetailPanel` and `ProjectCardComposerModal`.

**Tech Stack:** React 19 + TypeScript, Vite, Supabase (Postgres + supabase-js), `qrcode` npm package (new dependency), `lucide-react` icons (already present).

## Global Constraints

- No test framework exists in this repo (no `test` script, no `*.test.*` files) — every task's "test" step is a manual `npm run dev` + browser verification, not an automated test. Do not add Jest/Vitest.
- Read-only public preview — never add a public UPDATE/INSERT path for the `anon` role.
- Sharing requires cloud sync (Supabase); there is no local-only/offline sharing path.
- `share_token` must NOT be added to `upsertTasks`'s upsert payload in `src/supabase/cloudBackup.ts` — it is managed only through the dedicated share API so the general sync cycle can never clobber it.
- Follow existing Czech UI copy conventions; do not touch unrelated mojibake strings in `AppShell.tsx` (per `CLAUDE.md`).
- `npx tsc --noEmit` must pass after every task that touches `.ts`/`.tsx` files.

---

### Task 1: Database migration — `share_token` column + `get_shared_task` RPC

**Files:**
- No local files — applied directly to the live Supabase project (`ykldkglnrjcimpazkhto`, "Donext") via the Supabase MCP `apply_migration` tool.

**Interfaces:**
- Produces: `tasks.share_token` (nullable `uuid`, unique). `public.get_shared_task(p_token uuid) returns jsonb`, granted to `anon`, returns `null` when no task matches.

This is a live-database change and needs explicit user confirmation before running (per project convention: schema changes go directly against the live project). Stop and get a "yes, apply it" from the user before Step 2.

- [ ] **Step 1: Get user confirmation**

Ask: "This adds a `share_token` column to `tasks` and a new `get_shared_task` RPC function (granted to `anon`) on the live Donext Supabase project. OK to apply?" Wait for explicit yes.

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool with `project_id: "ykldkglnrjcimpazkhto"`, `name: "add_task_share_token"`, and this SQL:

```sql
alter table public.tasks
  add column share_token uuid unique;

create or replace function public.get_shared_task(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'note', t.note,
    'dueDate', t.due_date,
    'dueTime', t.due_time,
    'priority', t.priority,
    'completed', t.completed,
    'projectName', p.name,
    'teamName', tm.name,
    'assigneeName', prof.nickname,
    'subtasks', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', s.id, 'title', s.title, 'completed', s.completed)
          order by s.position
        )
        from public.subtasks s
        where s.task_id = t.id
      ),
      '[]'::jsonb
    )
  )
  from public.tasks t
  left join public.projects p on p.id = t.project_id
  left join public.teams tm on tm.id = t.team_id
  left join public.profiles prof on prof.id = t.assignee_id
  where t.share_token = p_token
  limit 1;
$$;

grant execute on function public.get_shared_task(uuid) to anon;
```

- [ ] **Step 3: Verify**

Run the Supabase MCP `execute_sql` tool with:
```sql
select proname, prosecdef from pg_proc where proname = 'get_shared_task';
```
Expected: one row, `prosecdef = true`.

Run `get_advisors` (type `security`) for project `ykldkglnrjcimpazkhto` and confirm no new advisory flags the `get_shared_task` function or the `share_token` column.

No commit for this task (no local file changes).

---

### Task 2: Add `qrcode` dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `qrcode` importable as `import QRCode from "qrcode"` with `QRCode.toDataURL(text: string): Promise<string>`.

- [ ] **Step 1: Install**

```bash
npm install qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: passes (no new errors).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add qrcode dependency for task sharing"
```

---

### Task 3: `Task` type + local storage support for `shareToken`

**Files:**
- Modify: `src/tasks/taskTypes.ts`
- Modify: `src/tasks/taskStorage.ts:93-120` (`normalizeTask`), `src/tasks/taskStorage.ts:242-282` (`isTask`)

**Interfaces:**
- Produces: `Task.shareToken: string | null`. `isTask` accepts tasks with or without the field (backward-compatible with existing localStorage data). `normalizeTask` defaults missing/invalid values to `null`.

- [ ] **Step 1: Add the field to `Task`**

In `src/tasks/taskTypes.ts`, add `shareToken: string | null;` to the `Task` type (after `subtasks: TaskSubtask[];` on line 39):

```typescript
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
  ownerId: string | null;
  projectId: string | null;
  boardColumnKey: BoardColumnKey;
  labels: TaskLabel[];
  subtasks: TaskSubtask[];
  shareToken: string | null;
};
```

Do NOT add `shareToken` to `TaskUpdate` — it is never set through the generic update path.

- [ ] **Step 2: Default it in `normalizeTask`**

In `src/tasks/taskStorage.ts`, inside `normalizeTask` (starts at line 93), add a `shareToken` line to the returned object:

```typescript
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
    ownerId:
      typeof task.ownerId === "string" || task.ownerId === null
        ? task.ownerId
        : null,
    boardColumnKey: isBoardColumnKey(task.boardColumnKey) ? task.boardColumnKey : "todo",
    labels: Array.isArray(task.labels) ? task.labels.filter(isTaskLabel) : [],
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.filter(isTaskSubtask)
      : [],
    shareToken: typeof task.shareToken === "string" ? task.shareToken : null,
  };
}
```

- [ ] **Step 3: Accept the field in `isTask`**

In `src/tasks/taskStorage.ts`, inside `isTask` (starts at line 242), add a clause to the returned boolean expression, right after the `subtasks` clause (before the closing `);`):

```typescript
    (typeof value.subtasks === "undefined" ||
      (Array.isArray(value.subtasks) && value.subtasks.every(isTaskSubtask))) &&
    (typeof value.shareToken === "string" ||
      value.shareToken === null ||
      typeof value.shareToken === "undefined")
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: fails — every object literal typed as `Task` elsewhere in the codebase is now missing `shareToken`. This is expected; the next steps fix each site. Note the list of errors reported (should point to `src/App.tsx` and any mock/test fixtures).

- [ ] **Step 5: Commit** (after Task 4 fixes the call sites — see that task's commit step; do not commit here in isolation since the build is red)

---

### Task 4: Wire `shareToken` through task creation and cloud sync

**Files:**
- Modify: `src/App.tsx:839-857` (`handleCreateTask`'s `newTask` literal)
- Modify: `src/supabase/cloudBackup.ts:42-58` (`CloudTaskRow` type), `src/supabase/cloudBackup.ts:196-202` (download `select`), `src/supabase/cloudBackup.ts:679-700` (`mapCloudTaskRowCore`)

**Interfaces:**
- Consumes: `Task.shareToken` from Task 3.
- Produces: newly created local tasks have `shareToken: null`; tasks downloaded from Supabase carry their real `share_token` value into `Task.shareToken`.

- [ ] **Step 1: Default `shareToken` on new tasks**

In `src/App.tsx`, in `handleCreateTask` (around line 839), add `shareToken: null,` to the `newTask` object literal:

```typescript
    const newTask: Task = {
      id: createEntityId(),
      title: trimmedTitle,
      completed: false,
      listId: targetListId,
      dueDate,
      dueTime: dueDate ? options.dueTime ?? null : null,
      note: options.note ?? "",
      priority: options.priority ?? getNewTaskPriority(activeListId),
      recurrence: "none",
      isArchived: false,
      teamId: targetTeamId,
      assigneeId: options.assigneeId ?? null,
      ownerId: authUser?.id ?? null,
      projectId: options.projectId ?? null,
      boardColumnKey: options.boardColumnKey ?? "todo",
      labels: options.labels ?? [],
      subtasks: options.subtasks ?? [],
      shareToken: null,
    };
```

- [ ] **Step 2: Search for any other `Task` object literals**

Run: `npx tsc --noEmit` and read the remaining errors. If any other file constructs a full `Task` object literal (not a partial `TaskUpdate` and not a spread of an existing task), add `shareToken: null,` there too, following the same pattern.

- [ ] **Step 3: Add `share_token` to the cloud row type and download path**

In `src/supabase/cloudBackup.ts`, add to `CloudTaskRow` (around line 42-58):

```typescript
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
  share_token: string | null;
};
```

Update the download `select` string (around line 199) to include `share_token`:

```typescript
    supabase
      .from("tasks")
      .select(
        "id,list_id,title,completed,due_date,due_time,is_archived,note,priority,recurrence,team_id,assignee_id,owner_id,project_id,board_column_key,share_token",
      )
      .or(ownedOrAssignedOrTeamFilter)
      .order("created_at", { ascending: true }),
```

- [ ] **Step 4: Map it in `mapCloudTaskRowCore`**

Read `src/supabase/cloudBackup.ts` around line 679-700 to see the exact current return shape, then add `shareToken: task.share_token,` to the returned object (mirroring how `ownerId: task.owner_id` is mapped).

- [ ] **Step 5: Confirm `upsertTasks` is untouched**

Open `src/supabase/cloudBackup.ts:427-466` (`upsertTasks`) and confirm `share_token` is NOT in the `.upsert(...)` row mapping. It must stay absent — this is what keeps the normal sync cycle from ever overwriting a share token.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: passes with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/tasks/taskTypes.ts src/tasks/taskStorage.ts src/App.tsx src/supabase/cloudBackup.ts
git commit -m "Add shareToken field to Task and thread it through cloud sync download"
```

---

### Task 5: `taskShareApi.ts` — generate/revoke/fetch shared task

**Files:**
- Create: `src/supabase/taskShareApi.ts`

**Interfaces:**
- Consumes: `supabase` client from `./supabaseClient`.
- Produces:
  - `type SharedTaskSubtask = { id: string; title: string; completed: boolean }`
  - `type SharedTaskPreview = { id: string; title: string; note: string; dueDate: string | null; dueTime: string | null; priority: string; completed: boolean; projectName: string | null; teamName: string | null; assigneeName: string | null; subtasks: SharedTaskSubtask[] }`
  - `generateShareToken(taskId: string): Promise<string>`
  - `revokeShareToken(taskId: string): Promise<void>`
  - `fetchSharedTask(token: string): Promise<SharedTaskPreview | null>`

- [ ] **Step 1: Write the file**

```typescript
import { supabase } from "./supabaseClient";

export type SharedTaskSubtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type SharedTaskPreview = {
  id: string;
  title: string;
  note: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  completed: boolean;
  projectName: string | null;
  teamName: string | null;
  assigneeName: string | null;
  subtasks: SharedTaskSubtask[];
};

export async function generateShareToken(taskId: string): Promise<string> {
  if (!supabase) {
    throw new Error("Cloud sync není nakonfigurovaný.");
  }

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("tasks")
    .update({ share_token: token })
    .eq("id", taskId);

  if (error) {
    throw error;
  }

  return token;
}

export async function revokeShareToken(taskId: string): Promise<void> {
  if (!supabase) {
    throw new Error("Cloud sync není nakonfigurovaný.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({ share_token: null })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}

function isSharedTaskSubtask(value: unknown): value is SharedTaskSubtask {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.completed === "boolean"
  );
}

export async function fetchSharedTask(token: string): Promise<SharedTaskPreview | null> {
  if (!supabase) {
    throw new Error("Cloud sync není nakonfigurovaný.");
  }

  const { data, error } = await supabase.rpc("get_shared_task", { p_token: token });

  if (error) {
    throw error;
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as Record<string, unknown>;

  if (typeof row.id !== "string" || typeof row.title !== "string") {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    note: typeof row.note === "string" ? row.note : "",
    dueDate: typeof row.dueDate === "string" ? row.dueDate : null,
    dueTime: typeof row.dueTime === "string" ? row.dueTime : null,
    priority: typeof row.priority === "string" ? row.priority : "none",
    completed: row.completed === true,
    projectName: typeof row.projectName === "string" ? row.projectName : null,
    teamName: typeof row.teamName === "string" ? row.teamName : null,
    assigneeName: typeof row.assigneeName === "string" ? row.assigneeName : null,
    subtasks: Array.isArray(row.subtasks) ? row.subtasks.filter(isSharedTaskSubtask) : [],
  };
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Manual smoke test against the live RPC**

With `npm run dev` running and logged in, open the browser console and run (replace with a real task id you own):
```javascript
const { fetchSharedTask, generateShareToken } = await import("/src/supabase/taskShareApi.ts");
const token = await generateShareToken("<a real task id>");
console.log(token);
console.log(await fetchSharedTask(token));
```
Expected: `fetchSharedTask` returns an object with the task's title and fields; a bogus random UUID passed to `fetchSharedTask` returns `null`.

- [ ] **Step 4: Commit**

```bash
git add src/supabase/taskShareApi.ts
git commit -m "Add taskShareApi for generating, revoking and fetching shared tasks"
```

---

### Task 6: `ShareTaskPopover` component

**Files:**
- Create: `src/layout/ShareTaskPopover.tsx`
- Modify: `src/styles.css` (append new rules; do not touch existing ones)

**Interfaces:**
- Consumes: `generateShareToken`, `revokeShareToken` from `../supabase/taskShareApi`, `QRCode` from `qrcode`.
- Produces: `ShareTaskPopover` component with props `{ taskId: string; shareToken: string | null; onTokenChange: (taskId: string, token: string | null) => void; onClose: () => void }`.

- [ ] **Step 1: Write the component**

```typescript
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Loader2, X } from "lucide-react";
import { generateShareToken, revokeShareToken } from "../supabase/taskShareApi";

type ShareTaskPopoverProps = {
  taskId: string;
  shareToken: string | null;
  onTokenChange: (taskId: string, token: string | null) => void;
  onClose: () => void;
};

export function ShareTaskPopover({
  taskId,
  shareToken,
  onTokenChange,
  onClose,
}: ShareTaskPopoverProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : null;

  useEffect(() => {
    let isCancelled = false;

    async function ensureToken() {
      setError(null);

      if (shareToken) {
        return;
      }

      setIsLoading(true);

      try {
        const token = await generateShareToken(taskId);

        if (!isCancelled) {
          onTokenChange(taskId, token);
        }
      } catch {
        if (!isCancelled) {
          setError("Nepodařilo se vytvořit sdílený odkaz. Zkontrolujte připojení a zkuste to znovu.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    ensureToken();

    return () => {
      isCancelled = true;
    };
  }, [taskId, shareToken, onTokenChange]);

  useEffect(() => {
    if (!shareUrl) {
      setQrDataUrl(null);
      return;
    }

    let isCancelled = false;

    QRCode.toDataURL(shareUrl, { width: 220, margin: 1 })
      .then((dataUrl) => {
        if (!isCancelled) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setError("Nepodařilo se vygenerovat QR kód.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [shareUrl]);

  async function handleCopyLink() {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  async function handleRevoke() {
    setIsRevoking(true);
    setError(null);

    try {
      await revokeShareToken(taskId);
      onTokenChange(taskId, null);
    } catch {
      setError("Nepodařilo se zrušit sdílení. Zkuste to znovu.");
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <div className="share-task-popover" role="dialog" aria-label="Sdílet úkol pomocí QR kódu">
      <div className="share-task-popover__header">
        <h3>Sdílet úkol</h3>
        <button
          type="button"
          className="share-task-popover__close"
          aria-label="Zavřít"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      {isLoading ? (
        <div className="share-task-popover__loading">
          <Loader2 size={20} className="share-task-popover__spinner" />
          <span>Vytvářím odkaz…</span>
        </div>
      ) : null}

      {error ? <p className="share-task-popover__error">{error}</p> : null}

      {!isLoading && qrDataUrl ? (
        <>
          <img
            className="share-task-popover__qr"
            src={qrDataUrl}
            alt="QR kód pro náhled úkolu"
            width={220}
            height={220}
          />
          <p className="share-task-popover__hint">
            Kdokoliv s tímto odkazem uvidí náhled úkolu ke čtení, i bez přihlášení.
          </p>
          <div className="share-task-popover__actions">
            <button type="button" onClick={handleCopyLink}>
              {isCopied ? <Check size={16} /> : <Copy size={16} />}
              {isCopied ? "Zkopírováno" : "Kopírovat odkaz"}
            </button>
            <button
              type="button"
              className="share-task-popover__revoke"
              disabled={isRevoking}
              onClick={handleRevoke}
            >
              {isRevoking ? "Ruším…" : "Zrušit sdílení"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

Append to `src/styles.css`:

```css
.share-task-popover {
  position: absolute;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 280px;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-color, #2a2a2a);
  background: var(--panel-bg, #1a1a1a);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}

.share-task-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.share-task-popover__header h3 {
  margin: 0;
  font-size: 0.95rem;
}

.share-task-popover__close {
  border: none;
  background: transparent;
  cursor: pointer;
}

.share-task-popover__loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.share-task-popover__spinner {
  animation: share-task-popover-spin 1s linear infinite;
}

@keyframes share-task-popover-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.share-task-popover__error {
  margin: 0;
  font-size: 0.8rem;
  color: #ef4444;
}

.share-task-popover__qr {
  align-self: center;
  border-radius: 0.5rem;
}

.share-task-popover__hint {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.75;
}

.share-task-popover__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.share-task-popover__revoke {
  color: #ef4444;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/layout/ShareTaskPopover.tsx src/styles.css
git commit -m "Add ShareTaskPopover component for generating task QR share links"
```

---

### Task 7: Wire the share popover into `DetailPanel`

**Files:**
- Modify: `src/layout/panels/DetailPanel.tsx`

**Interfaces:**
- Consumes: `ShareTaskPopover` from Task 6, `Task.shareToken` from Task 3.
- Produces: new required prop `onShareTokenChange: (taskId: string, token: string | null) => void` on `DetailPanelProps`, used in `AppShell.tsx` (Task 9).

- [ ] **Step 1: Import and add prop**

In `src/layout/panels/DetailPanel.tsx`, add to the imports (near the `lucide-react` import block, line 2-12):

```typescript
import {
  CalendarDays,
  Clock3,
  FolderOpen,
  Loader2,
  Plus,
  QrCode,
  Repeat,
  Star,
  UserRound,
  Wand2,
} from "lucide-react";
```

Add `import { ShareTaskPopover } from "../ShareTaskPopover";` after the other local imports (after line 19's `createEntityId` import).

Add `onShareTokenChange: (taskId: string, token: string | null) => void;` to `DetailPanelProps` (after `onOpenNoteFromTask` on line 45).

Add `onShareTokenChange,` to the destructured props (after `onOpenNoteFromTask,` on line 101).

- [ ] **Step 2: Add local state**

Near the other `useState` calls at the top of the component body (after line 106's `isActionMenuOpen` state), add:

```typescript
  const [isSharePopoverOpen, setIsSharePopoverOpen] = useState(false);
```

- [ ] **Step 3: Add the menu item to the mobile action menu**

In the mobile menu content block (lines 609-638), add a "Sdílet QR kódem" item before "Duplikovat":

```typescript
            {isActionMenuOpen ? (
              <div className="detail-panel__mobile-menu-content" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleMenuAction(() => setIsSharePopoverOpen(true))}
                >
                  <QrCode size={16} /> Sdílet QR kódem
                </button>
                <button disabled type="button" role="menuitem">
                  Duplikovat
                </button>
```
(leave the rest of that block — `Archivovat`/`Smazat` — unchanged)

- [ ] **Step 4: Add the menu item to the desktop action menu**

In the desktop menu content block (lines 710-735), add the same item before "Duplikovat":

```typescript
            {isActionMenuOpen ? (
              <div className="detail-panel__menu-content" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleMenuAction(() => setIsSharePopoverOpen(true))}
                >
                  <QrCode size={16} /> Sdílet QR kódem
                </button>
                <button disabled type="button" role="menuitem">
                  Duplikovat
                </button>
```
(leave `Archivovat`/`Smazat` unchanged)

- [ ] **Step 5: Render the popover**

Immediately after the closing `</div>` of `detail-panel__actions` (line 737, right before line 738's closing `</div>` of `detail-panel__header`), add:

```typescript
        {isSharePopoverOpen ? (
          <ShareTaskPopover
            taskId={task.id}
            shareToken={task.shareToken}
            onTokenChange={onShareTokenChange}
            onClose={() => setIsSharePopoverOpen(false)}
          />
        ) : null}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: fails, because `DetailPanel` is instantiated in `AppShell.tsx` without the new `onShareTokenChange` prop yet. Confirm the error is exactly that (missing prop), then proceed — Task 9 fixes it.

- [ ] **Step 7: Commit** (deferred — commit together with Task 9 once the build is green again; see Task 9's commit step)

---

### Task 8: Wire the share popover into `ProjectCardComposerModal`

**Files:**
- Modify: `src/layout/ProjectCardComposerModal.tsx`

**Interfaces:**
- Consumes: `ShareTaskPopover` from Task 6.
- Produces: new props `taskId: string | null`, `shareToken: string | null`, `onShareTokenChange: (taskId: string, token: string | null) => void` on the component, used in `AppShell.tsx` (Task 9). The share button only renders when `taskId` is non-null (i.e. editing an existing card, not creating a new unsaved one).

- [ ] **Step 1: Add imports and props**

In `src/layout/ProjectCardComposerModal.tsx`, change the icon import (line 3):

```typescript
import { Loader2, QrCode, Wand2, X } from "lucide-react";
```

Add `import { useState } from "react";` to the top import (merge with the existing `import type { CSSProperties, FormEvent } from "react";` on line 1 — change it to):

```typescript
import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
```

Add `import { ShareTaskPopover } from "./ShareTaskPopover";` after the other local imports (after line 13's `teamTypes` import).

Add three new props to the destructured prop list (after `subtasks,` around line 29) and the type block (after `subtasks: TaskSubtask[];` around line 59):

```typescript
  taskId,
  shareToken,
```
(add both, alphabetically placed near `subtasks`/`title`)

and in the type block:
```typescript
  taskId: string | null;
  shareToken: string | null;
```

Add `onShareTokenChange: (taskId: string, token: string | null) => void;` next to the other `on*` prop types (near `onSubmit`), and destructure it (near `onSubmit,`).

- [ ] **Step 2: Add local state**

Inside the component body, after `const previewLabels = createCardLabels(labels);` (line 76), add:

```typescript
  const [isSharePopoverOpen, setIsSharePopoverOpen] = useState(false);
```

- [ ] **Step 3: Add the share button to the header**

In the `<header className="board-card-modal__header">` block (lines 130-146), add a share button between the title block and the close button, only when `taskId` is set:

```typescript
        <header className="board-card-modal__header">
          <div>
            <h2 id="board-card-modal-title">{isEditing ? "Upravit kartu" : "Vytvořit kartu"}</h2>
            <p>{isEditing ? "Uprav kartu na nástěnce " + projectName + "." : "Přidej novou kartu do nástěnky " + projectName + "."}</p>
          </div>
          <div className="board-card-modal__header-actions">
            {taskId ? (
              <button
                type="button"
                className="board-card-modal__share"
                aria-label="Sdílet QR kódem"
                onClick={() => setIsSharePopoverOpen((isOpen) => !isOpen)}
              >
                <QrCode size={18} />
              </button>
            ) : null}
            <motion.button
              className="board-card-modal__close"
              type="button"
              aria-label="Zavřít"
              onClick={onClose}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.06, rotate: 90 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
              transition={{ duration: 0.18 }}
            >
              <X size={18} />
            </motion.button>
          </div>
        </header>
        {isSharePopoverOpen && taskId ? (
          <ShareTaskPopover
            taskId={taskId}
            shareToken={shareToken}
            onTokenChange={onShareTokenChange}
            onClose={() => setIsSharePopoverOpen(false)}
          />
        ) : null}
```

- [ ] **Step 4: Add a style for the header actions wrapper**

Append to `src/styles.css`:

```css
.board-card-modal__header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.board-card-modal__share {
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: fails, because `AppShell.tsx` instantiates `ProjectCardComposerModal` without the three new props yet. Confirm the error matches, proceed to Task 9.

- [ ] **Step 6: Commit** (deferred — see Task 9)

---

### Task 9: Thread `onShareTokenChange` through `AppShell.tsx` and `App.tsx`

**Files:**
- Modify: `src/App.tsx` (add `handleUpdateTaskShareToken`, pass to `AppShell`)
- Modify: `src/layout/AppShell.tsx` (accept prop, pass to `DetailPanel` and `ProjectCardComposerModal`)

**Interfaces:**
- Consumes: `DetailPanel`'s and `ProjectCardComposerModal`'s new props from Tasks 7-8.
- Produces: `App.tsx`'s `handleUpdateTaskShareToken(taskId: string, token: string | null): void`, which updates local `tasks` state so the popover shows the persisted token without waiting for a full cloud re-download.

- [ ] **Step 1: Add the handler in `App.tsx`**

Near `handleArchiveTask` (around line 760), add:

```typescript
  function handleUpdateTaskShareToken(taskId: string, token: string | null) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, shareToken: token } : task,
      ),
    );
  }
```

- [ ] **Step 2: Pass it to `AppShell`**

Find the `<AppShell` instantiation (around line 1548-1568, near `onArchiveTask={handleArchiveTask}`) and add:

```typescript
        onUpdateTaskShareToken={handleUpdateTaskShareToken}
```

- [ ] **Step 3: Accept the prop in `AppShell.tsx`**

In `AppShellProps` (around line 143, next to `onUpdateTask`), add:

```typescript
  onUpdateTaskShareToken: (taskId: string, token: string | null) => void;
```

In the destructuring block (around line 196, next to `onUpdateTask,`), add:

```typescript
    onUpdateTaskShareToken,
```

- [ ] **Step 4: Pass it to `DetailPanel`**

At the `<DetailPanel` instantiation (around line 1429-1440), add:

```typescript
            onShareTokenChange={onUpdateTaskShareToken}
```

- [ ] **Step 5: Pass task id/token and the handler to `ProjectCardComposerModal`**

At the `<ProjectCardComposerModal` instantiation (around line 3498-3528), add three props. Look up the current task being edited from the `tasks` array using `cardComposerTaskId`:

```typescript
            taskId={cardComposerTaskId}
            shareToken={
              cardComposerTaskId
                ? tasks.find((task) => task.id === cardComposerTaskId)?.shareToken ?? null
                : null
            }
            onShareTokenChange={onUpdateTaskShareToken}
```

(add these alongside the other props already listed there, e.g. right after `subtasks={cardComposerSubtasks}`)

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: passes with no errors.

- [ ] **Step 7: Manual verification**

```bash
npm run dev
```
Open the app in a browser, log in, open any task's detail panel, open the "⋯" menu, click "Sdílet QR kódem". Expected: a QR code and link appear within ~1-2 seconds, no console errors. Close and reopen the popover — expected: same QR/link (no regeneration). Click "Zrušit sdílení" — expected: popover returns to loading state, a fresh token/QR appears if reopened.

Repeat on a project board card (open a card, click the QR icon in its header).

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/layout/AppShell.tsx src/layout/panels/DetailPanel.tsx src/layout/ProjectCardComposerModal.tsx src/styles.css
git commit -m "Wire QR share popover into DetailPanel and ProjectCardComposerModal"
```

---

### Task 10: `SharedTaskView` public read-only page

**Files:**
- Create: `src/layout/SharedTaskView.tsx`

**Interfaces:**
- Consumes: `fetchSharedTask`, `SharedTaskPreview` from `../supabase/taskShareApi`.
- Produces: `SharedTaskView` component with props `{ token: string }`, self-contained (no dependency on any app/auth state).

- [ ] **Step 1: Write the component**

```typescript
import { useEffect, useState } from "react";
import { fetchSharedTask } from "../supabase/taskShareApi";
import type { SharedTaskPreview } from "../supabase/taskShareApi";

const PRIORITY_LABELS: Record<string, string> = {
  none: "Žádná",
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
};

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; task: SharedTaskPreview };

export function SharedTaskView({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let isCancelled = false;

    fetchSharedTask(token)
      .then((task) => {
        if (isCancelled) {
          return;
        }

        setState(task ? { status: "ready", task } : { status: "not-found" });
      })
      .catch(() => {
        if (!isCancelled) {
          setState({ status: "error" });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [token]);

  if (state.status === "loading") {
    return (
      <div className="shared-task-view">
        <p>Načítám náhled úkolu…</p>
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className="shared-task-view">
        <h1>Odkaz není platný</h1>
        <p>Sdílení tohoto úkolu bylo zrušeno, nebo odkaz nikdy neexistoval.</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="shared-task-view">
        <h1>Něco se nepovedlo</h1>
        <p>Náhled úkolu se nepodařilo načíst. Zkuste to prosím znovu.</p>
      </div>
    );
  }

  const { task } = state;

  return (
    <div className="shared-task-view">
      <p className="shared-task-view__eyebrow">Náhled úkolu (jen ke čtení)</p>
      <h1 className="shared-task-view__title">{task.title}</h1>

      <div className="shared-task-view__meta">
        <span className={task.completed ? "shared-task-view__status shared-task-view__status--done" : "shared-task-view__status"}>
          {task.completed ? "Hotovo" : "Nehotovo"}
        </span>
        {task.priority !== "none" ? (
          <span className="shared-task-view__priority">
            Priorita: {PRIORITY_LABELS[task.priority] ?? task.priority}
          </span>
        ) : null}
        {task.dueDate ? (
          <span className="shared-task-view__due">
            Termín: {task.dueDate}
            {task.dueTime ? ` ${task.dueTime}` : ""}
          </span>
        ) : null}
      </div>

      {task.projectName || task.teamName ? (
        <p className="shared-task-view__context">
          {task.projectName ? `Projekt: ${task.projectName}` : null}
          {task.projectName && task.teamName ? " · " : null}
          {task.teamName ? `Tým: ${task.teamName}` : null}
        </p>
      ) : null}

      {task.assigneeName ? (
        <p className="shared-task-view__context">Přiřazeno: {task.assigneeName}</p>
      ) : null}

      {task.note ? <p className="shared-task-view__note">{task.note}</p> : null}

      {task.subtasks.length > 0 ? (
        <ul className="shared-task-view__subtasks">
          {task.subtasks.map((subtask) => (
            <li
              key={subtask.id}
              className={
                subtask.completed
                  ? "shared-task-view__subtask shared-task-view__subtask--done"
                  : "shared-task-view__subtask"
              }
            >
              {subtask.title}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

Append to `src/styles.css`:

```css
.shared-task-view {
  max-width: 560px;
  margin: 3rem auto;
  padding: 2rem;
  border-radius: 1rem;
  border: 1px solid var(--border-color, #2a2a2a);
  background: var(--panel-bg, #1a1a1a);
}

.shared-task-view__eyebrow {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
}

.shared-task-view__title {
  margin: 0 0 1rem;
  font-size: 1.5rem;
}

.shared-task-view__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.shared-task-view__status--done {
  color: #10b981;
}

.shared-task-view__context {
  font-size: 0.85rem;
  opacity: 0.8;
  margin: 0.25rem 0;
}

.shared-task-view__note {
  white-space: pre-wrap;
  margin: 1rem 0;
}

.shared-task-view__subtasks {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.shared-task-view__subtask--done {
  text-decoration: line-through;
  opacity: 0.6;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/layout/SharedTaskView.tsx src/styles.css
git commit -m "Add SharedTaskView read-only public task preview page"
```

---

### Task 11: Route `/share/:token` in `main.tsx`

**Files:**
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `SharedTaskView` from Task 10.

- [ ] **Step 1: Add the route check**

Replace the contents of `src/main.tsx` with:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";
import { App } from "./App";
import { SharedTaskView } from "./layout/SharedTaskView";
import { registerServiceWorker } from "./pwa/registerServiceWorker";
import "./tailwind.css";

function getShareToken(): string | null {
  const match = window.location.pathname.match(/^\/share\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

const shareToken = getShareToken();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    {shareToken ? (
      <SharedTaskView token={shareToken} />
    ) : (
      <>
        <App />
        {import.meta.env.DEV && <Agentation />}
      </>
    )}
  </StrictMode>,
);

if (import.meta.env.PROD && !shareToken) {
  registerServiceWorker();
}
```

- [ ] **Step 2: Check Vercel SPA rewrite covers `/share/*`**

Read `vercel.json` (or equivalent rewrite config) in the project root. Confirm it has a catch-all rewrite to `/index.html` for all paths (needed so a direct browser load of `/share/<token>` — not just client-side navigation — serves the app instead of a 404). If it's missing a catch-all, add one; if a project-specific config already handles this generically, no change is needed. Report which case applies.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Manual verification**

```bash
npm run dev
```
Navigate to a share link generated in Task 9's manual test (e.g. `http://localhost:5173/share/<token>`). Expected: `SharedTaskView` renders with the task's data, no app shell, no auth prompt. Navigate to `http://localhost:5173/share/00000000-0000-0000-0000-000000000000` (a syntactically valid but non-existent token). Expected: "Odkaz není platný" message, no console errors, no raw Supabase error surfaced.

Then navigate to `http://localhost:5173/` (no token). Expected: normal app loads as before.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx
git commit -m "Route /share/:token to the public SharedTaskView"
```

---

### Task 12: End-to-end verification and production build check

**Files:**
- None (verification only).

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: passes with zero errors.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds (the existing >500kB main-chunk warning is expected and pre-existing; no new errors).

- [ ] **Step 3: Full manual walkthrough**

With `npm run dev` running:
1. Generate a QR for a personal (non-project) task via `DetailPanel` → scan or copy the link → open it in a private/incognito window → confirm read-only preview matches the task.
2. Generate a QR for a project board card via `ProjectCardComposerModal` → same check, including that `projectName`/`teamName` show up.
3. Revoke sharing on one of them → reload the same `/share/<token>` URL → confirm it now shows "Odkaz není platný".
4. Confirm no task can be edited, checked off, or deleted from the `/share/:token` page (no interactive controls other than plain text).

- [ ] **Step 4: Report results**

Summarize pass/fail for each of the 4 manual checks above to the user. If anything fails, stop and fix before considering the feature done — do not report success without every check passing.
