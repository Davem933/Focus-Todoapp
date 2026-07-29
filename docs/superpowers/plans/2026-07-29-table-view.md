# Table View (Tabulka) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a ClickUp-style Table view for a board's tasks, with a board selector, functional toolbar (group/shown-columns/filter/closed/assignee/search/add-task), inline-editable rows, and up to 2 custom columns per board persisted to Supabase.

**Architecture:** A new `TableViewPanel` replaces the existing placeholder in `AppShell.tsx` for the "table" view tab. It loads the selected board's `ProjectColumn`s, team members, custom-column definitions/values, and renders a `TableToolbar` + `TaskTable` built from small reusable cell components (`StatusBadge`, `PriorityFlag`, `AssigneeAvatar`). Built-in field edits reuse the existing `onUpdateTask` callback; custom-field edits go through a new `projectCustomColumnApi.ts` module and two new Supabase tables.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres + RLS), plain CSS in `src/styles.css` (no CSS-in-JS in this codebase), `lucide-react` icons, existing `CustomDropdown` component for single-select fields.

## Global Constraints

- This repo has **no test framework** (no Jest/Vitest, no `*.test.*` files) — per project `CLAUDE.md`, do not assume one exists. Verification steps use `npx tsc --noEmit` (the project's only static check) and manual browser verification via the dev server, not automated unit tests.
- Keep files under 500 lines (project `CLAUDE.md` rule) — this is why cell components are split into their own files under `src/layout/panels/table/`.
- Custom columns are capped at **2 per project**, enforced app-side in `createCustomColumn`.
- Follow existing snake_case-DB / camelCase-client mapping convention (see `src/supabase/projectApi.ts`).
- Follow existing BEM-ish CSS naming (`.block__element`, `data-*` attributes for state) as used throughout `src/styles.css`.
- Don't touch the Gantt/Dashboard placeholders — out of scope.
- Spec: `docs/superpowers/specs/2026-07-29-table-view-design.md`.

---

### Task 1: Supabase schema — custom column tables + RLS

**Files:**
- Supabase migration (via `apply_migration` MCP tool), name: `add_table_view_custom_columns`

**Interfaces:**
- Produces: tables `public.project_custom_columns` (`id, project_id, key, title, field_type, options, position, created_at, updated_at`) and `public.task_custom_field_values` (`task_id, column_id, value, updated_at`), consumed by Task 2's `projectCustomColumnApi.ts`.

- [ ] **Step 1: Apply the migration**

Call `apply_migration` with `project_id: "ykldkglnrjcimpazkhto"`, `name: "add_table_view_custom_columns"`, and this SQL:

```sql
create table public.project_custom_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  key text not null,
  title text not null,
  field_type text not null check (field_type in ('text', 'select')),
  options jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);

create table public.task_custom_field_values (
  task_id uuid not null references public.tasks(id) on delete cascade,
  column_id uuid not null references public.project_custom_columns(id) on delete cascade,
  value text,
  updated_at timestamptz not null default now(),
  primary key (task_id, column_id)
);

alter table public.project_custom_columns enable row level security;
alter table public.task_custom_field_values enable row level security;

create policy project_custom_columns_select_team_members on public.project_custom_columns
  for select using (
    exists (select 1 from public.projects p where p.id = project_custom_columns.project_id and private.is_team_member(p.team_id))
  );

create policy project_custom_columns_insert_team_admins on public.project_custom_columns
  for insert with check (
    exists (select 1 from public.projects p where p.id = project_custom_columns.project_id and private.is_team_admin(p.team_id))
  );

create policy project_custom_columns_update_team_admins on public.project_custom_columns
  for update using (
    exists (select 1 from public.projects p where p.id = project_custom_columns.project_id and private.is_team_admin(p.team_id))
  ) with check (
    exists (select 1 from public.projects p where p.id = project_custom_columns.project_id and private.is_team_admin(p.team_id))
  );

create policy project_custom_columns_delete_team_admins on public.project_custom_columns
  for delete using (
    exists (select 1 from public.projects p where p.id = project_custom_columns.project_id and private.is_team_admin(p.team_id))
  );

create policy task_custom_field_values_select_team_members on public.task_custom_field_values
  for select using (
    exists (
      select 1 from public.project_custom_columns c
      join public.projects p on p.id = c.project_id
      where c.id = task_custom_field_values.column_id and private.is_team_member(p.team_id)
    )
  );

create policy task_custom_field_values_insert_team_members on public.task_custom_field_values
  for insert with check (
    exists (
      select 1 from public.project_custom_columns c
      join public.projects p on p.id = c.project_id
      where c.id = task_custom_field_values.column_id and private.is_team_member(p.team_id)
    )
  );

create policy task_custom_field_values_update_team_members on public.task_custom_field_values
  for update using (
    exists (
      select 1 from public.project_custom_columns c
      join public.projects p on p.id = c.project_id
      where c.id = task_custom_field_values.column_id and private.is_team_member(p.team_id)
    )
  ) with check (
    exists (
      select 1 from public.project_custom_columns c
      join public.projects p on p.id = c.project_id
      where c.id = task_custom_field_values.column_id and private.is_team_member(p.team_id)
    )
  );

create policy task_custom_field_values_delete_team_members on public.task_custom_field_values
  for delete using (
    exists (
      select 1 from public.project_custom_columns c
      join public.projects p on p.id = c.project_id
      where c.id = task_custom_field_values.column_id and private.is_team_member(p.team_id)
    )
  );
```

- [ ] **Step 2: Verify the tables and policies exist**

Call `list_tables` with `project_id: "ykldkglnrjcimpazkhto"`, `schemas: ["public"]`, `verbose: true`.
Expected: `project_custom_columns` and `task_custom_field_values` appear with the columns above and `rls_enabled: true`.

- [ ] **Step 3: Check for security advisories**

Call `get_advisors` with `project_id: "ykldkglnrjcimpazkhto"`, `type: "security"`.
Expected: no new warnings referencing `project_custom_columns` or `task_custom_field_values`.

---

### Task 2: Custom-field types and Supabase client module

**Files:**
- Create: `src/tasks/customFieldTypes.ts`
- Create: `src/supabase/projectCustomColumnApi.ts`

**Interfaces:**
- Consumes: `supabase` client from `src/supabase/supabaseClient.ts` (same import used by `src/supabase/projectApi.ts:1`).
- Produces: `CustomFieldType`, `CustomFieldOption`, `ProjectCustomColumn`, `TaskCustomFieldValue` types; `MAX_CUSTOM_COLUMNS_PER_PROJECT`, `loadCustomColumns(projectId)`, `createCustomColumn(projectId, title, fieldType, options?)`, `deleteCustomColumn(columnId)`, `loadCustomFieldValues(projectId)`, `setCustomFieldValue(taskId, columnId, value)` — consumed by Task 7 (`TableViewPanel.tsx`) and Task 4 (`CustomColumnModal.tsx`).

- [ ] **Step 1: Create the types file**

```ts
// src/tasks/customFieldTypes.ts
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
```

- [ ] **Step 2: Create the Supabase client module**

```ts
// src/supabase/projectCustomColumnApi.ts
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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `src/tasks/customFieldTypes.ts` or `src/supabase/projectCustomColumnApi.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/tasks/customFieldTypes.ts src/supabase/projectCustomColumnApi.ts
git commit -m "feat(table-view): add custom column types and Supabase client module"
```

---

### Task 3: Status classification + presentational cell components

**Files:**
- Create: `src/layout/panels/table/tableStatus.ts`
- Create: `src/layout/panels/table/PriorityFlag.tsx`
- Create: `src/layout/panels/table/AssigneeAvatar.tsx`
- Create: `src/layout/panels/table/StatusBadge.tsx`

**Interfaces:**
- Consumes: `ProjectColumn` from `src/projects/projectTypes.ts`; `TaskPriority` from `src/tasks/taskTypes.ts`; `TASK_PRIORITY_COLORS`, `BOARD_CARD_PRIORITY_LABELS` from `src/tasks/taskPriorityColors.ts`; `TeamMember` from `src/teams/teamTypes.ts`; `getMemberDisplayName`, `getMemberInitials` from `src/teams/teamMemberDisplay.ts`; `CustomDropdown`, `DropdownOption` from `src/layout/CustomDropdown.tsx`.
- Produces: `classifyColumnState(columnKey, columns): "todo" | "in-progress" | "done"`, `<PriorityFlag priority>`, `<AssigneeAvatar member>`, `<StatusBadge columns columnKey onChange>` — consumed by Task 6 (`TaskTable.tsx`).

- [ ] **Step 1: Create the status classification helper**

```ts
// src/layout/panels/table/tableStatus.ts
import type { ProjectColumn } from "../../../projects/projectTypes";

export type TableRowStatus = "todo" | "in-progress" | "done";

export function classifyColumnState(columnKey: string, columns: ProjectColumn[]): TableRowStatus {
  if (columnKey === "done") {
    return "done";
  }

  const index = columns.findIndex((column) => column.key === columnKey);

  if (index <= 0) {
    return "todo";
  }

  return "in-progress";
}
```

- [ ] **Step 2: Create PriorityFlag**

```tsx
// src/layout/panels/table/PriorityFlag.tsx
import type { CSSProperties } from "react";
import { Flag } from "lucide-react";
import type { TaskPriority } from "../../../tasks/taskTypes";
import { TASK_PRIORITY_COLORS, BOARD_CARD_PRIORITY_LABELS } from "../../../tasks/taskPriorityColors";

export function PriorityFlag({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className="table-priority-flag"
      style={{ "--priority-color": TASK_PRIORITY_COLORS[priority] } as CSSProperties}
    >
      <Flag size={14} aria-hidden="true" />
      {BOARD_CARD_PRIORITY_LABELS[priority]}
    </span>
  );
}
```

- [ ] **Step 3: Create AssigneeAvatar**

```tsx
// src/layout/panels/table/AssigneeAvatar.tsx
import type { TeamMember } from "../../../teams/teamTypes";
import { getMemberDisplayName, getMemberInitials } from "../../../teams/teamMemberDisplay";

export function AssigneeAvatar({ member }: { member: TeamMember | null }) {
  if (!member) {
    return <span className="table-assignee-avatar table-assignee-avatar--empty">Nepriřazeno</span>;
  }

  return (
    <span className="table-assignee-avatar">
      <span className="table-assignee-avatar__initials" aria-hidden="true">
        {getMemberInitials(member)}
      </span>
      <span className="table-assignee-avatar__name">{getMemberDisplayName(member)}</span>
    </span>
  );
}
```

- [ ] **Step 4: Create StatusBadge**

```tsx
// src/layout/panels/table/StatusBadge.tsx
import { CustomDropdown } from "../../CustomDropdown";
import type { ProjectColumn } from "../../../projects/projectTypes";
import { classifyColumnState } from "./tableStatus";

type StatusBadgeProps = {
  columns: ProjectColumn[];
  columnKey: string;
  onChange: (columnKey: string) => void;
};

export function StatusBadge({ columns, columnKey, onChange }: StatusBadgeProps) {
  const activeColumn = columns.find((column) => column.key === columnKey) ?? null;
  const state = classifyColumnState(columnKey, columns);
  const label = (activeColumn?.title ?? columnKey).toUpperCase();

  return (
    <CustomDropdown
      className="table-status-badge"
      value={columnKey}
      options={columns.map((column) => ({ value: column.key, label: column.title }))}
      onChange={onChange}
      ariaLabel={"Stav ukolu: " + label}
      renderTriggerContent={() => (
        <span className="table-status-badge__pill" data-state={state}>
          {label}
        </span>
      )}
    />
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from the four new files.

- [ ] **Step 6: Commit**

```bash
git add src/layout/panels/table/tableStatus.ts src/layout/panels/table/PriorityFlag.tsx src/layout/panels/table/AssigneeAvatar.tsx src/layout/panels/table/StatusBadge.tsx
git commit -m "feat(table-view): add status/priority/assignee cell components"
```

---

### Task 4: Custom column "+" add modal

**Files:**
- Create: `src/layout/panels/table/CustomColumnModal.tsx`

**Interfaces:**
- Consumes: `CustomFieldType`, `CustomFieldOption` from `src/tasks/customFieldTypes.ts`.
- Produces: `<CustomColumnModal onClose onSubmit(title, fieldType, options)>` — consumed by Task 7 (`TableViewPanel.tsx`).

- [ ] **Step 1: Create the modal component**

```tsx
// src/layout/panels/table/CustomColumnModal.tsx
import { useState } from "react";
import type { CustomFieldOption, CustomFieldType } from "../../../tasks/customFieldTypes";

type CustomColumnModalProps = {
  onClose: () => void;
  onSubmit: (title: string, fieldType: CustomFieldType, options: CustomFieldOption[]) => void;
};

export function CustomColumnModal({ onClose, onSubmit }: CustomColumnModalProps) {
  const [title, setTitle] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [optionsInput, setOptionsInput] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    const options: CustomFieldOption[] =
      fieldType === "select"
        ? optionsInput
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((label) => ({ value: label.toLowerCase().replace(/\s+/g, "-"), label }))
        : [];

    onSubmit(trimmedTitle, fieldType, options);
  }

  return (
    <div className="custom-column-modal__backdrop" onClick={onClose}>
      <form
        className="custom-column-modal__panel"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2>Novy sloupec</h2>
        <label className="custom-column-modal__field">
          <span>Nazev</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            autoFocus
            required
          />
        </label>
        <label className="custom-column-modal__field">
          <span>Typ</span>
          <select
            value={fieldType}
            onChange={(event) => setFieldType(event.currentTarget.value as CustomFieldType)}
          >
            <option value="text">Text</option>
            <option value="select">Vyber z moznosti</option>
          </select>
        </label>
        {fieldType === "select" ? (
          <label className="custom-column-modal__field">
            <span>Moznosti (oddelene carkou)</span>
            <input
              type="text"
              value={optionsInput}
              onChange={(event) => setOptionsInput(event.currentTarget.value)}
              placeholder="napr. Nizka, Stredni, Vysoka"
            />
          </label>
        ) : null}
        <div className="custom-column-modal__actions">
          <button type="button" onClick={onClose}>
            Zrusit
          </button>
          <button type="submit" disabled={!title.trim()}>
            Pridat sloupec
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `CustomColumnModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/layout/panels/table/CustomColumnModal.tsx
git commit -m "feat(table-view): add custom column creation modal"
```

---

### Task 5: TableToolbar

**Files:**
- Create: `src/layout/panels/table/useOutsideClick.ts`
- Create: `src/layout/panels/table/TableToolbar.tsx`

**Interfaces:**
- Consumes: `TeamMember` from `src/teams/teamTypes.ts`; `getMemberDisplayName` from `src/teams/teamMemberDisplay.ts`; `TaskPriority` from `src/tasks/taskTypes.ts`; `BOARD_CARD_PRIORITY_OPTIONS`, `BOARD_CARD_PRIORITY_LABELS` from `src/tasks/taskPriorityColors.ts`; `ProjectCustomColumn` from `src/tasks/customFieldTypes.ts`.
- Produces: `TableGroupBy` type (`"none" | "status" | "assignee" | "priority"`), `TableDueFilter` type (`"all" | "overdue" | "no_date"`), `TableColumnVisibility` type (`{ assignee: boolean; status: boolean; dueDate: boolean; priority: boolean; custom: Record<string, boolean> }`), `<TableToolbar>` component with props `members`, `customColumns`, `visibility`, `onToggleColumnVisible(key)`, `groupBy`, `onGroupByChange`, `showClosed`, `onToggleShowClosed`, `assigneeFilter: Set<string>`, `onToggleAssigneeFilter(userId)`, `priorityFilter: Set<TaskPriority>`, `onTogglePriorityFilter(priority)`, `dueFilter`, `onDueFilterChange`, `searchQuery`, `onSearchQueryChange`, `onAddTask`, `canAddCustomColumn`, `onOpenAddColumn` — consumed by Task 7 (`TableViewPanel.tsx`) and Task 6 (`TaskTable.tsx`, which imports the `TableGroupBy`/`TableColumnVisibility` types).

- [ ] **Step 1: Create the outside-click hook**

```ts
// src/layout/panels/table/useOutsideClick.ts
import { useEffect, type RefObject } from "react";

export function useOutsideClick(ref: RefObject<HTMLElement | null>, isActive: boolean, onOutsideClick: () => void) {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        onOutsideClick();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOutsideClick();
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, onOutsideClick, ref]);
}
```

- [ ] **Step 2: Create the toolbar component**

```tsx
// src/layout/panels/table/TableToolbar.tsx
import { useRef, useState } from "react";
import { Filter, Plus, Search } from "lucide-react";
import type { TeamMember } from "../../../teams/teamTypes";
import { getMemberDisplayName } from "../../../teams/teamMemberDisplay";
import type { TaskPriority } from "../../../tasks/taskTypes";
import { BOARD_CARD_PRIORITY_OPTIONS, BOARD_CARD_PRIORITY_LABELS } from "../../../tasks/taskPriorityColors";
import type { ProjectCustomColumn } from "../../../tasks/customFieldTypes";
import { useOutsideClick } from "./useOutsideClick";

export type TableGroupBy = "none" | "status" | "assignee" | "priority";
export type TableDueFilter = "all" | "overdue" | "no_date";

export type TableColumnVisibility = {
  assignee: boolean;
  status: boolean;
  dueDate: boolean;
  priority: boolean;
  custom: Record<string, boolean>;
};

const GROUP_BY_LABELS: Record<TableGroupBy, string> = {
  none: "Group: None",
  status: "Group: Status",
  assignee: "Group: Assignee",
  priority: "Group: Priority",
};

type TableToolbarProps = {
  members: TeamMember[];
  customColumns: ProjectCustomColumn[];
  visibility: TableColumnVisibility;
  onToggleColumnVisible: (key: string) => void;
  groupBy: TableGroupBy;
  onGroupByChange: (groupBy: TableGroupBy) => void;
  showClosed: boolean;
  onToggleShowClosed: () => void;
  assigneeFilter: Set<string>;
  onToggleAssigneeFilter: (userId: string) => void;
  priorityFilter: Set<TaskPriority>;
  onTogglePriorityFilter: (priority: TaskPriority) => void;
  dueFilter: TableDueFilter;
  onDueFilterChange: (value: TableDueFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onAddTask: () => void;
  canAddCustomColumn: boolean;
  onOpenAddColumn: () => void;
};

type OpenPopover = "group" | "shown" | "filter" | "assignee" | null;

export function TableToolbar({
  members,
  customColumns,
  visibility,
  onToggleColumnVisible,
  groupBy,
  onGroupByChange,
  showClosed,
  onToggleShowClosed,
  assigneeFilter,
  onToggleAssigneeFilter,
  priorityFilter,
  onTogglePriorityFilter,
  dueFilter,
  onDueFilterChange,
  searchQuery,
  onSearchQueryChange,
  onAddTask,
  canAddCustomColumn,
  onOpenAddColumn,
}: TableToolbarProps) {
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useOutsideClick(containerRef, openPopover !== null, () => setOpenPopover(null));

  return (
    <div className="table-toolbar" ref={containerRef}>
      <div className="table-toolbar__group">
        <button
          type="button"
          className="table-toolbar__button"
          onClick={() => setOpenPopover((current) => (current === "group" ? null : "group"))}
        >
          {GROUP_BY_LABELS[groupBy]}
        </button>
        {openPopover === "group" ? (
          <div className="table-toolbar__popover">
            {(Object.keys(GROUP_BY_LABELS) as TableGroupBy[]).map((option) => (
              <button
                key={option}
                type="button"
                className="table-toolbar__popover-option"
                data-selected={option === groupBy}
                onClick={() => {
                  onGroupByChange(option);
                  setOpenPopover(null);
                }}
              >
                {GROUP_BY_LABELS[option]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="table-toolbar__group">
        <button
          type="button"
          className="table-toolbar__button"
          onClick={() => setOpenPopover((current) => (current === "shown" ? null : "shown"))}
        >
          Shown
        </button>
        {openPopover === "shown" ? (
          <div className="table-toolbar__popover">
            <label className="table-toolbar__checkbox-row">
              <input
                type="checkbox"
                checked={visibility.assignee}
                onChange={() => onToggleColumnVisible("assignee")}
              />
              Reesitel
            </label>
            <label className="table-toolbar__checkbox-row">
              <input type="checkbox" checked={visibility.status} onChange={() => onToggleColumnVisible("status")} />
              Stav
            </label>
            <label className="table-toolbar__checkbox-row">
              <input
                type="checkbox"
                checked={visibility.dueDate}
                onChange={() => onToggleColumnVisible("dueDate")}
              />
              Terrmin
            </label>
            <label className="table-toolbar__checkbox-row">
              <input
                type="checkbox"
                checked={visibility.priority}
                onChange={() => onToggleColumnVisible("priority")}
              />
              Priorita
            </label>
            {customColumns.map((column) => (
              <label key={column.id} className="table-toolbar__checkbox-row">
                <input
                  type="checkbox"
                  checked={visibility.custom[column.id] ?? true}
                  onChange={() => onToggleColumnVisible(column.id)}
                />
                {column.title}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="table-toolbar__group">
        <button
          type="button"
          className="table-toolbar__button"
          onClick={() => setOpenPopover((current) => (current === "filter" ? null : "filter"))}
        >
          <Filter size={14} aria-hidden="true" />
          Filter
        </button>
        {openPopover === "filter" ? (
          <div className="table-toolbar__popover">
            <p className="table-toolbar__popover-heading">Priorita</p>
            {BOARD_CARD_PRIORITY_OPTIONS.map((priority) => (
              <label key={priority} className="table-toolbar__checkbox-row">
                <input
                  type="checkbox"
                  checked={priorityFilter.has(priority)}
                  onChange={() => onTogglePriorityFilter(priority)}
                />
                {BOARD_CARD_PRIORITY_LABELS[priority]}
              </label>
            ))}
            <p className="table-toolbar__popover-heading">Terrmin</p>
            <select value={dueFilter} onChange={(event) => onDueFilterChange(event.currentTarget.value as TableDueFilter)}>
              <option value="all">Vsechny</option>
              <option value="overdue">Po terminu</option>
              <option value="no_date">Bez terminu</option>
            </select>
          </div>
        ) : null}
      </div>

      <button type="button" className="table-toolbar__button" data-active={showClosed} onClick={onToggleShowClosed}>
        Closed
      </button>

      <div className="table-toolbar__group">
        <button
          type="button"
          className="table-toolbar__button"
          onClick={() => setOpenPopover((current) => (current === "assignee" ? null : "assignee"))}
        >
          Assignee
        </button>
        {openPopover === "assignee" ? (
          <div className="table-toolbar__popover">
            {members.map((member) => (
              <label key={member.userId} className="table-toolbar__checkbox-row">
                <input
                  type="checkbox"
                  checked={assigneeFilter.has(member.userId)}
                  onChange={() => onToggleAssigneeFilter(member.userId)}
                />
                {getMemberDisplayName(member)}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <label className="table-toolbar__search">
        <Search size={14} aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
          placeholder="Hledat ukoly"
        />
      </label>

      {canAddCustomColumn ? (
        <button type="button" className="table-toolbar__button" onClick={onOpenAddColumn}>
          <Plus size={14} aria-hidden="true" />
          Sloupec
        </button>
      ) : null}

      <button type="button" className="table-toolbar__add-task" onClick={onAddTask}>
        <Plus size={16} aria-hidden="true" />
        Add Task
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `useOutsideClick.ts` or `TableToolbar.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/layout/panels/table/useOutsideClick.ts src/layout/panels/table/TableToolbar.tsx
git commit -m "feat(table-view): add functional table toolbar"
```

---

### Task 6: TaskTable (rows, grouping, inline editing)

**Files:**
- Create: `src/layout/panels/table/TaskTable.tsx`

**Interfaces:**
- Consumes: `Task`, `TaskUpdate`, `TaskPriority` from `src/tasks/taskTypes.ts`; `ProjectColumn` from `src/projects/projectTypes.ts`; `TeamMember` from `src/teams/teamTypes.ts`; `getMemberDisplayName` from `src/teams/teamMemberDisplay.ts`; `ProjectCustomColumn`, `TaskCustomFieldValue` from `src/tasks/customFieldTypes.ts`; `TableColumnVisibility`, `TableGroupBy` from `./TableToolbar`; `classifyColumnState` from `./tableStatus`; `StatusBadge`, `PriorityFlag`, `AssigneeAvatar` from Task 3; `CustomDropdown` from `src/layout/CustomDropdown.tsx`.
- Produces: `<TaskTable>` with props `tasks` (pre-filtered/sorted `Task[]`), `columns`, `members`, `customColumns`, `customFieldValues`, `visibility`, `groupBy`, `onUpdateTask`, `onSetCustomFieldValue`, `onOpenTask`, `onDeleteTask`, `canDeleteTask` — consumed by Task 7 (`TableViewPanel.tsx`).

- [ ] **Step 1: Create the component**

```tsx
// src/layout/panels/table/TaskTable.tsx
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Task, TaskUpdate } from "../../../tasks/taskTypes";
import type { ProjectColumn } from "../../../projects/projectTypes";
import type { TeamMember } from "../../../teams/teamTypes";
import { getMemberDisplayName } from "../../../teams/teamMemberDisplay";
import type { ProjectCustomColumn, TaskCustomFieldValue } from "../../../tasks/customFieldTypes";
import { CustomDropdown } from "../../CustomDropdown";
import type { TableColumnVisibility, TableGroupBy } from "./TableToolbar";
import { classifyColumnState } from "./tableStatus";
import { StatusBadge } from "./StatusBadge";
import { PriorityFlag } from "./PriorityFlag";
import { AssigneeAvatar } from "./AssigneeAvatar";

type TaskTableProps = {
  tasks: Task[];
  columns: ProjectColumn[];
  members: TeamMember[];
  customColumns: ProjectCustomColumn[];
  customFieldValues: TaskCustomFieldValue[];
  visibility: TableColumnVisibility;
  groupBy: TableGroupBy;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onSetCustomFieldValue: (taskId: string, columnId: string, value: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
};

function formatDueDate(dueDate: string | null): { label: string; isOverdue: boolean } {
  if (!dueDate) {
    return { label: "-", isOverdue: false };
  }

  const [year, month, day] = dueDate.split("-");
  const label = day && month && year ? day + "/" + month + "/" + year.slice(2) : dueDate;
  const isOverdue = new Date(dueDate + "T23:59:59") < new Date();

  return { label, isOverdue };
}

function groupTasks(tasks: Task[], groupBy: TableGroupBy, columns: ProjectColumn[], members: TeamMember[]) {
  if (groupBy === "none") {
    return [{ key: "all", title: null as string | null, tasks }];
  }

  const groups = new Map<string, { title: string; tasks: Task[] }>();

  for (const task of tasks) {
    let key: string;
    let title: string;

    if (groupBy === "status") {
      key = task.boardColumnKey;
      title = columns.find((column) => column.key === task.boardColumnKey)?.title ?? task.boardColumnKey;
    } else if (groupBy === "assignee") {
      key = task.assigneeId ?? "none";
      title = task.assigneeId
        ? getMemberDisplayName(members.find((member) => member.userId === task.assigneeId) ?? { email: task.assigneeId })
        : "Nepriřazeno";
    } else {
      key = task.priority;
      title = task.priority;
    }

    if (!groups.has(key)) {
      groups.set(key, { title, tasks: [] });
    }

    groups.get(key)!.tasks.push(task);
  }

  return Array.from(groups.entries()).map(([key, group]) => ({ key, title: group.title, tasks: group.tasks }));
}

export function TaskTable({
  tasks,
  columns,
  members,
  customColumns,
  customFieldValues,
  visibility,
  groupBy,
  onUpdateTask,
  onSetCustomFieldValue,
  onOpenTask,
  onDeleteTask,
  canDeleteTask,
}: TaskTableProps) {
  const groups = groupTasks(tasks, groupBy, columns, members);
  let rowNumber = 0;

  return (
    <div className="task-table__scroll">
      <table className="task-table">
        <thead>
          <tr>
            <th className="task-table__col-index">#</th>
            <th className="task-table__col-name">Nazev</th>
            {visibility.assignee ? <th>Řešitel</th> : null}
            {visibility.status ? <th>Stav</th> : null}
            {visibility.dueDate ? <th>Termin</th> : null}
            {visibility.priority ? <th>Priorita</th> : null}
            {customColumns
              .filter((column) => visibility.custom[column.id] ?? true)
              .map((column) => (
                <th key={column.id}>{column.title}</th>
              ))}
            <th className="task-table__col-add">+</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <TaskTableGroup
              key={group.key}
              title={group.title}
              tasks={group.tasks}
              columns={columns}
              members={members}
              customColumns={customColumns}
              customFieldValues={customFieldValues}
              visibility={visibility}
              startIndex={(rowNumber += group.tasks.length) - group.tasks.length}
              onUpdateTask={onUpdateTask}
              onSetCustomFieldValue={onSetCustomFieldValue}
              onOpenTask={onOpenTask}
              onDeleteTask={onDeleteTask}
              canDeleteTask={canDeleteTask}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskTableGroup({
  title,
  tasks,
  columns,
  members,
  customColumns,
  customFieldValues,
  visibility,
  startIndex,
  onUpdateTask,
  onSetCustomFieldValue,
  onOpenTask,
  onDeleteTask,
  canDeleteTask,
}: {
  title: string | null;
  tasks: Task[];
  columns: ProjectColumn[];
  members: TeamMember[];
  customColumns: ProjectCustomColumn[];
  customFieldValues: TaskCustomFieldValue[];
  visibility: TableColumnVisibility;
  startIndex: number;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onSetCustomFieldValue: (taskId: string, columnId: string, value: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
}) {
  const visibleCustomColumns = customColumns.filter((column) => visibility.custom[column.id] ?? true);
  const columnCount =
    2 +
    (visibility.assignee ? 1 : 0) +
    (visibility.status ? 1 : 0) +
    (visibility.dueDate ? 1 : 0) +
    (visibility.priority ? 1 : 0) +
    visibleCustomColumns.length +
    1;

  return (
    <>
      {title !== null ? (
        <tr className="task-table__group-header">
          <td colSpan={columnCount}>
            {title} <span className="task-table__group-count">({tasks.length})</span>
          </td>
        </tr>
      ) : null}
      {tasks.map((task, index) => (
        <TaskTableRow
          key={task.id}
          task={task}
          rowNumber={startIndex + index + 1}
          columns={columns}
          members={members}
          customColumns={visibleCustomColumns}
          customFieldValues={customFieldValues}
          visibility={visibility}
          onUpdateTask={onUpdateTask}
          onSetCustomFieldValue={onSetCustomFieldValue}
          onOpenTask={onOpenTask}
          onDeleteTask={onDeleteTask}
          canDeleteTask={canDeleteTask}
        />
      ))}
    </>
  );
}

function TaskTableRow({
  task,
  rowNumber,
  columns,
  members,
  customColumns,
  customFieldValues,
  visibility,
  onUpdateTask,
  onSetCustomFieldValue,
  onOpenTask,
  onDeleteTask,
  canDeleteTask,
}: {
  task: Task;
  rowNumber: number;
  columns: ProjectColumn[];
  members: TeamMember[];
  customColumns: ProjectCustomColumn[];
  customFieldValues: TaskCustomFieldValue[];
  visibility: TableColumnVisibility;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onSetCustomFieldValue: (taskId: string, columnId: string, value: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(task.title);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const status = classifyColumnState(task.boardColumnKey, columns);
  const assignee = members.find((member) => member.userId === task.assigneeId) ?? null;
  const due = formatDueDate(task.dueDate);

  function commitName() {
    setIsEditingName(false);
    const trimmed = nameDraft.trim();

    if (trimmed && trimmed !== task.title) {
      onUpdateTask(task.id, { title: trimmed });
    } else {
      setNameDraft(task.title);
    }
  }

  return (
    <tr className="task-table__row">
      <td className="task-table__col-index">
        <span className="task-table__row-number">{rowNumber}</span>
        <span className="task-table__status-dot" data-state={status} aria-hidden="true" />
      </td>
      <td className="task-table__col-name">
        {isEditingName ? (
          <input
            className="task-table__name-input"
            autoFocus
            value={nameDraft}
            onChange={(event) => setNameDraft(event.currentTarget.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitName();
              } else if (event.key === "Escape") {
                setNameDraft(task.title);
                setIsEditingName(false);
              }
            }}
          />
        ) : (
          <button type="button" className="task-table__name-button" onClick={() => setIsEditingName(true)}>
            {task.title}
          </button>
        )}
        <span className="task-table__row-actions">
          <button type="button" onClick={() => onOpenTask(task.id)}>
            Otevřit
          </button>
          {canDeleteTask(task) ? (
            <button type="button" onClick={() => onDeleteTask(task.id)} aria-label="Smazat ukol">
              <Trash2 size={14} aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </td>
      {visibility.assignee ? (
        <td>
          <CustomDropdown
            className="table-assignee-dropdown"
            value={task.assigneeId ?? ""}
            options={[
              { value: "", label: "Nepriřazeno" },
              ...members.map((member) => ({ value: member.userId, label: getMemberDisplayName(member) })),
            ]}
            onChange={(value) => onUpdateTask(task.id, { assigneeId: value || null })}
            ariaLabel="Reesitel ukolu"
            renderTriggerContent={() => <AssigneeAvatar member={assignee} />}
          />
        </td>
      ) : null}
      {visibility.status ? (
        <td>
          <StatusBadge
            columns={columns}
            columnKey={task.boardColumnKey}
            onChange={(columnKey) => onUpdateTask(task.id, { boardColumnKey: columnKey })}
          />
        </td>
      ) : null}
      {visibility.dueDate ? (
        <td>
          {isEditingDate ? (
            <input
              type="date"
              autoFocus
              value={task.dueDate ?? ""}
              onChange={(event) => {
                onUpdateTask(task.id, { dueDate: event.currentTarget.value || null });
              }}
              onBlur={() => setIsEditingDate(false)}
            />
          ) : (
            <button
              type="button"
              className="task-table__due-date"
              data-overdue={due.isOverdue && !task.completed}
              onClick={() => setIsEditingDate(true)}
            >
              {due.label}
            </button>
          )}
        </td>
      ) : null}
      {visibility.priority ? (
        <td>
          <CustomDropdown
            className="table-priority-dropdown"
            value={task.priority}
            options={["none", "low", "medium", "high"].map((priority) => ({ value: priority, label: priority }))}
            onChange={(value) => onUpdateTask(task.id, { priority: value as Task["priority"] })}
            ariaLabel="Priorita ukolu"
            renderTriggerContent={() => <PriorityFlag priority={task.priority} />}
          />
        </td>
      ) : null}
      {customColumns.map((column) => {
        const currentValue =
          customFieldValues.find((value) => value.taskId === task.id && value.columnId === column.id)?.value ?? "";

        return (
          <td key={column.id}>
            {column.fieldType === "select" ? (
              <CustomDropdown
                value={currentValue}
                options={[{ value: "", label: "-" }, ...column.options]}
                onChange={(value) => onSetCustomFieldValue(task.id, column.id, value || null)}
                ariaLabel={column.title}
              />
            ) : (
              <input
                type="text"
                defaultValue={currentValue}
                onBlur={(event) => onSetCustomFieldValue(task.id, column.id, event.currentTarget.value || null)}
              />
            )}
          </td>
        );
      })}
      <td className="task-table__col-add" />
    </tr>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `TaskTable.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/layout/panels/table/TaskTable.tsx
git commit -m "feat(table-view): add TaskTable with grouping and inline editing"
```

---

### Task 7: TableViewPanel (board selector + data loading + wiring)

**Files:**
- Create: `src/layout/panels/TableViewPanel.tsx`

**Interfaces:**
- Consumes: `loadProjectsForTeams`, `loadProjectColumns` from `src/supabase/projectApi.ts`; `loadTeamMembers` from `src/supabase/teamApi.ts`; `loadCustomColumns`, `createCustomColumn`, `loadCustomFieldValues`, `setCustomFieldValue` from `src/supabase/projectCustomColumnApi.ts`; `Task`, `TaskUpdate` from `src/tasks/taskTypes.ts`; `Project`, `ProjectColumn` from `src/projects/projectTypes.ts`; `Team`, `TeamMember` from `src/teams/teamTypes.ts`; `TableToolbar`, `TableColumnVisibility`, `TableGroupBy`, `TableDueFilter` from `./table/TableToolbar`; `TaskTable` from `./table/TaskTable`; `CustomColumnModal` from `./table/CustomColumnModal`; `CustomDropdown` from `../CustomDropdown`.
- Produces: `<TableViewPanel teams activeTeamId tasks currentUserId isGlobalAdmin onUpdateTask onCreateTask onDeleteTask canDeleteTask onOpenTask>` — consumed by `AppShell.tsx` (Task 8).

- [ ] **Step 1: Create the panel**

```tsx
// src/layout/panels/TableViewPanel.tsx
import { useEffect, useMemo, useState } from "react";
import type { Task, TaskPriority, TaskUpdate } from "../../tasks/taskTypes";
import type { Project, ProjectColumn } from "../../projects/projectTypes";
import type { Team, TeamMember } from "../../teams/teamTypes";
import type { ProjectCustomColumn, TaskCustomFieldValue } from "../../tasks/customFieldTypes";
import { loadProjectsForTeams, loadProjectColumns } from "../../supabase/projectApi";
import { loadTeamMembers } from "../../supabase/teamApi";
import {
  createCustomColumn,
  loadCustomColumns,
  loadCustomFieldValues,
  setCustomFieldValue,
  MAX_CUSTOM_COLUMNS_PER_PROJECT,
} from "../../supabase/projectCustomColumnApi";
import { CustomDropdown } from "../CustomDropdown";
import { TableToolbar } from "./table/TableToolbar";
import type { TableColumnVisibility, TableDueFilter, TableGroupBy } from "./table/TableToolbar";
import { TaskTable } from "./table/TaskTable";
import { CustomColumnModal } from "./table/CustomColumnModal";

type TableViewPanelProps = {
  teams: Team[];
  activeTeamId: string | null;
  tasks: Task[];
  currentUserId: string | null;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onCreateTask: (title: string, options?: Record<string, unknown>) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
};

const DEFAULT_VISIBILITY: TableColumnVisibility = {
  assignee: true,
  status: true,
  dueDate: true,
  priority: true,
  custom: {},
};

export function TableViewPanel({
  teams,
  activeTeamId,
  tasks,
  onUpdateTask,
  onOpenTask,
  onDeleteTask,
  canDeleteTask,
}: TableViewPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [customColumns, setCustomColumns] = useState<ProjectCustomColumn[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<TaskCustomFieldValue[]>([]);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);

  const [visibility, setVisibility] = useState<TableColumnVisibility>(DEFAULT_VISIBILITY);
  const [groupBy, setGroupBy] = useState<TableGroupBy>("none");
  const [showClosed, setShowClosed] = useState(true);
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<Set<TaskPriority>>(new Set());
  const [dueFilter, setDueFilter] = useState<TableDueFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!activeTeamId) {
      setProjects([]);
      return;
    }

    loadProjectsForTeams([activeTeamId]).then(setProjects).catch(() => setProjects([]));
  }, [activeTeamId]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setColumns([]);
      setCustomColumns([]);
      setCustomFieldValues([]);
      return;
    }

    loadProjectColumns(selectedProjectId).then(setColumns).catch(() => setColumns([]));
    loadCustomColumns(selectedProjectId).then(setCustomColumns).catch(() => setCustomColumns([]));
    loadCustomFieldValues(selectedProjectId).then(setCustomFieldValues).catch(() => setCustomFieldValues([]));
  }, [selectedProjectId]);

  useEffect(() => {
    const project = projects.find((entry) => entry.id === selectedProjectId);

    if (!project) {
      setMembers([]);
      return;
    }

    loadTeamMembers(project.teamId).then(setMembers).catch(() => setMembers([]));
  }, [projects, selectedProjectId]);

  const boardTasks = useMemo(
    () => tasks.filter((task) => task.projectId === selectedProjectId),
    [tasks, selectedProjectId],
  );

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return boardTasks.filter((task) => {
      if (!showClosed && task.boardColumnKey === "done") {
        return false;
      }

      if (assigneeFilter.size > 0 && (!task.assigneeId || !assigneeFilter.has(task.assigneeId))) {
        return false;
      }

      if (priorityFilter.size > 0 && !priorityFilter.has(task.priority)) {
        return false;
      }

      if (dueFilter === "overdue" && !(task.dueDate && new Date(task.dueDate + "T23:59:59") < new Date() && !task.completed)) {
        return false;
      }

      if (dueFilter === "no_date" && task.dueDate) {
        return false;
      }

      if (query && !task.title.toLowerCase().includes(query)) {
        return false;
      }

      return true;
    });
  }, [boardTasks, showClosed, assigneeFilter, priorityFilter, dueFilter, searchQuery]);

  function toggleAssigneeFilter(userId: string) {
    setAssigneeFilter((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function togglePriorityFilter(priority: TaskPriority) {
    setPriorityFilter((current) => {
      const next = new Set(current);
      if (next.has(priority)) {
        next.delete(priority);
      } else {
        next.add(priority);
      }
      return next;
    });
  }

  function toggleColumnVisible(key: string) {
    setVisibility((current) => {
      if (key === "assignee" || key === "status" || key === "dueDate" || key === "priority") {
        return { ...current, [key]: !current[key] };
      }

      return { ...current, custom: { ...current.custom, [key]: !(current.custom[key] ?? true) } };
    });
  }

  async function handleAddCustomColumn(title: string, fieldType: "text" | "select", options: { value: string; label: string }[]) {
    if (!selectedProjectId) {
      return;
    }

    const created = await createCustomColumn(selectedProjectId, title, fieldType, options);
    setCustomColumns((current) => [...current, created]);
    setIsAddColumnOpen(false);
  }

  async function handleSetCustomFieldValue(taskId: string, columnId: string, value: string | null) {
    await setCustomFieldValue(taskId, columnId, value);
    setCustomFieldValues((current) => {
      const withoutExisting = current.filter((entry) => !(entry.taskId === taskId && entry.columnId === columnId));
      return [...withoutExisting, { taskId, columnId, value }];
    });
  }

  if (projects.length === 0) {
    return (
      <div className="app-panel view-placeholder">
        <h2>Tabulka</h2>
        <p>Tento tym zatim nema zadnou nastenku. Vytvorte ji v prehledu projektu.</p>
      </div>
    );
  }

  return (
    <div className="app-panel table-view-panel">
      <div className="table-view-panel__header">
        <CustomDropdown
          className="table-view-panel__board-select"
          value={selectedProjectId ?? ""}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
          onChange={setSelectedProjectId}
          ariaLabel="Vyber nastenky"
        />
      </div>
      <TableToolbar
        members={members}
        customColumns={customColumns}
        visibility={visibility}
        onToggleColumnVisible={toggleColumnVisible}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        showClosed={showClosed}
        onToggleShowClosed={() => setShowClosed((current) => !current)}
        assigneeFilter={assigneeFilter}
        onToggleAssigneeFilter={toggleAssigneeFilter}
        priorityFilter={priorityFilter}
        onTogglePriorityFilter={togglePriorityFilter}
        dueFilter={dueFilter}
        onDueFilterChange={setDueFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onAddTask={() => selectedProjectId && onOpenTask("")}
        canAddCustomColumn={customColumns.length < MAX_CUSTOM_COLUMNS_PER_PROJECT}
        onOpenAddColumn={() => setIsAddColumnOpen(true)}
      />
      <TaskTable
        tasks={filteredTasks}
        columns={columns}
        members={members}
        customColumns={customColumns}
        customFieldValues={customFieldValues}
        visibility={visibility}
        groupBy={groupBy}
        onUpdateTask={onUpdateTask}
        onSetCustomFieldValue={handleSetCustomFieldValue}
        onOpenTask={onOpenTask}
        onDeleteTask={onDeleteTask}
        canDeleteTask={canDeleteTask}
      />
      {isAddColumnOpen ? (
        <CustomColumnModal onClose={() => setIsAddColumnOpen(false)} onSubmit={handleAddCustomColumn} />
      ) : null}
    </div>
  );
}
```

Note on "+ Add Task": wiring it to the existing `ProjectCardComposerModal` flow requires the same composer state that lives inside `ProjectsOverviewPanel` (`AppShell.tsx:2402-2411`) — that state is local to `ProjectsOverviewPanel`, not shared. For this task, `onAddTask` calls `onOpenTask("")` as a placeholder that the wiring step (Task 8) replaces with a real handler that opens the board's card composer for `selectedProjectId` (see Task 8, Step 1) — do not leave the `onOpenTask("")` call in the final code.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `TableViewPanel.tsx` (the `onOpenTask("")` placeholder is replaced in Task 8, so this step may show it as temporarily unused — that's fine, it's fixed next task).

- [ ] **Step 3: Commit**

```bash
git add src/layout/panels/TableViewPanel.tsx
git commit -m "feat(table-view): add TableViewPanel with board selector and data loading"
```

---

### Task 8: Wire TableViewPanel into AppShell + add Add-Task handoff

**Files:**
- Modify: `src/layout/AppShell.tsx:1137-1141` (replace placeholder), imports section
- Modify: `src/layout/panels/TableViewPanel.tsx` (replace the `onAddTask` placeholder from Task 7)

**Interfaces:**
- Consumes: `TableViewPanel` from `./panels/TableViewPanel`; existing `teams`, `activeTeamId`, `allTasks`, `currentUserId`, `onUpdateTask`, `handleCreateTask`, `handleSelectTask`, `handleDeleteTaskAction`, `canDeleteTask` already in scope in `AppShell.tsx` (per `AppShell.tsx:109-183` prop destructuring, `AppShell.tsx:350-365` helper definitions, and `AppShell.tsx:543-546` for `handleCreateTask`).

- [ ] **Step 1: Add the import**

In `src/layout/AppShell.tsx`, near the other panel imports (alongside the `ProjectCardComposerModal` import at line 92):

```tsx
import { TableViewPanel } from "./panels/TableViewPanel";
```

- [ ] **Step 2: Replace the placeholder**

Replace `AppShell.tsx:1137-1141`:

```tsx
          ) : isTableOpen ? (
            <div className="app-panel view-placeholder">
              <h2>Tabulka</h2>
              <p>Tabulkove zobrazeni se pripravuje.</p>
            </div>
```

with:

```tsx
          ) : isTableOpen ? (
            <TableViewPanel
              teams={teams}
              activeTeamId={activeTeamId}
              tasks={allTasks}
              currentUserId={currentUserId}
              onUpdateTask={onUpdateTask}
              onCreateTaskForBoard={(projectId) => {
                const newTaskId = handleCreateTask("Novy ukol", { projectId, boardColumnKey: "todo" });

                if (newTaskId) {
                  handleSelectTask(newTaskId);
                }
              }}
              onOpenTask={(taskId) => handleSelectTask(taskId)}
              onDeleteTask={handleDeleteTaskAction}
              canDeleteTask={canDeleteTask}
            />
```

This drops `onCreateTask` and `isGlobalAdmin` from the props list defined in Task 7 (they end up unused since "+ Add Task" is wired through the new `onCreateTaskForBoard` prop instead) — remove those two from `TableViewPanelProps` and the destructured props in `TableViewPanel.tsx` in this step, and add `onCreateTaskForBoard: (projectId: string) => void` in their place (this is the same change described in Step 3 below — apply both edits to `TableViewPanel.tsx` together).

- [ ] **Step 3: Replace the Add-Task placeholder in TableViewPanel**

In `src/layout/panels/TableViewPanel.tsx`, since project-board tasks must open via the project/board flow (not `DetailPanel`, per this repo's convention that project-owned tasks route through the Kanban card flow), the "+ Add Task" button opens the task directly in the existing per-task detail flow used elsewhere for project tasks: change

```tsx
onAddTask={() => selectedProjectId && onOpenTask("")}
```

to call `onOpenTask` with a freshly created task id. Since `TableViewPanel` doesn't own task creation, add an `onCreateTaskForBoard: (projectId: string) => void` prop instead of reusing `onOpenTask("")`:

```tsx
type TableViewPanelProps = {
  teams: Team[];
  activeTeamId: string | null;
  tasks: Task[];
  currentUserId: string | null;
  onUpdateTask: (taskId: string, patch: TaskUpdate) => void;
  onCreateTaskForBoard: (projectId: string) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  canDeleteTask: (task: Task) => boolean;
};
```

and in the component body:

```tsx
onAddTask={() => selectedProjectId && onCreateTaskForBoard(selectedProjectId)}
```

removing the earlier `onCreateTask` prop entirely (it's superseded by `onCreateTaskForBoard`).

- [ ] **Step 4: Wire `onCreateTaskForBoard` in AppShell**

`AppShell.tsx:543-546` already defines `handleCreateTask(title: string, options?: CreateTaskOptions): string | null`, where `CreateTaskOptions` (`AppShell.tsx:94-105`) includes `projectId` and `boardColumnKey`, and the function returns the new task's id (or `null` on failure). Pass `onCreateTaskForBoard` to `TableViewPanel` as:

```tsx
onCreateTaskForBoard={(projectId) => {
  const newTaskId = handleCreateTask("Novy ukol", { projectId, boardColumnKey: "todo" });

  if (newTaskId) {
    handleSelectTask(newTaskId);
  }
}}
```

This creates the task on the selected board's "todo" column and immediately opens it via the existing `handleSelectTask` flow (same one wired to `onOpenTask` in Step 2), so the user can fill in details right after adding it.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/layout/AppShell.tsx src/layout/panels/TableViewPanel.tsx
git commit -m "feat(table-view): wire TableViewPanel into AppShell view tabs"
```

---

### Task 9: Styling

**Files:**
- Modify: `src/styles.css` (append new rules; do not touch unrelated existing rules)

**Interfaces:**
- Consumes: CSS custom properties already defined at the top of `src/styles.css` (check existing `:root` variables for background/border/text colors before hardcoding new ones — reuse them for consistency with the rest of the dark theme).

- [ ] **Step 1: Add table view styles**

Append to `src/styles.css` (adjust exact color values to match the existing `:root` custom properties found by inspecting the top of the file — do not introduce a second color system):

```css
.table-view-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-view-panel__header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  position: relative;
}

.table-toolbar__group {
  position: relative;
}

.table-toolbar__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle, #333);
  background: var(--surface-raised, #1c1f26);
  color: inherit;
  font-size: 13px;
}

.table-toolbar__button[data-active="true"] {
  border-color: #38bdf8;
}

.table-toolbar__popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 180px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle, #333);
  background: var(--surface-raised, #1c1f26);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-toolbar__popover-option[data-selected="true"] {
  color: #38bdf8;
}

.table-toolbar__checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.table-toolbar__search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle, #333);
  background: var(--surface-raised, #1c1f26);
}

.table-toolbar__search input {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 13px;
}

.table-toolbar__add-task {
  margin-left: auto;
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  background: #38bdf8;
  color: #0b1220;
  font-weight: 600;
  font-size: 13px;
}

.task-table__scroll {
  overflow: auto;
  max-height: 70vh;
  border-radius: 8px;
  border: 1px solid var(--border-subtle, #333);
}

.task-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.task-table thead th {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--surface-raised, #1c1f26);
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-subtle, #333);
}

.task-table__row td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-subtle, #2a2d34);
}

.task-table__col-index {
  display: flex;
  align-items: center;
  gap: 6px;
}

.task-table__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px dashed #7c8aa8;
}

.task-table__status-dot[data-state="in-progress"] {
  border-style: solid;
  background: #38bdf8;
  border-color: #38bdf8;
}

.task-table__status-dot[data-state="done"] {
  border-style: solid;
  background: #22c55e;
  border-color: #22c55e;
}

.task-table__name-button {
  background: transparent;
  border: none;
  color: inherit;
  text-align: left;
  font-size: 13px;
}

.task-table__name-input {
  background: transparent;
  border: 1px solid #38bdf8;
  border-radius: 4px;
  color: inherit;
  font-size: 13px;
  padding: 2px 6px;
}

.task-table__row-actions {
  display: inline-flex;
  gap: 8px;
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.task-table__row:hover .task-table__row-actions {
  opacity: 1;
}

.task-table__due-date[data-overdue="true"] {
  color: #f43f5e;
  font-weight: 600;
}

.task-table__group-header td {
  background: var(--surface-sunken, #15171c);
  font-weight: 600;
  padding: 8px 10px;
}

.table-status-badge__pill {
  display: inline-flex;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  border: 1px dashed #7c8aa8;
  color: #cbd5e1;
}

.table-status-badge__pill[data-state="in-progress"] {
  border-style: solid;
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.table-status-badge__pill[data-state="done"] {
  border-style: solid;
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
}

.table-assignee-avatar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.table-assignee-avatar__initials {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #334155;
  font-size: 11px;
  font-weight: 700;
}

.table-assignee-avatar--empty {
  color: #7c8aa8;
  font-size: 12px;
}

.table-priority-flag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--priority-color);
  font-size: 12px;
  font-weight: 600;
}

.custom-column-modal__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.custom-column-modal__panel {
  width: 320px;
  padding: 20px;
  border-radius: 10px;
  background: var(--surface-raised, #1c1f26);
  border: 1px solid var(--border-subtle, #333);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.custom-column-modal__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}

.custom-column-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat(table-view): add table view styles"
```

---

### Task 10: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Start the dev server and open it**

Use `preview_start` with `{name: "dev"}` (or whatever config name exists in `.claude/launch.json` for `npm run dev` — create the config first if missing, per the `preview_start` tool's instructions).

- [ ] **Step 3: Navigate to a team, open the Table tab**

Use `navigate`/`computer` to log in (existing session) and click the "Tabulka" entry in the view tabs. Confirm via `read_page` or `computer{action:"screenshot"}` that:
- The board selector dropdown appears and lists the team's boards.
- Selecting a board renders rows with index/status dot, Name, Assignee, Status, Due Date, Priority columns.
- Clicking a task name switches it to an editable input; typing and pressing Enter updates the row without a page reload.
- Clicking the Status badge opens a dropdown of the board's columns; selecting one updates the badge.
- The "Group" button switches to grouped sections when set to Status/Assignee/Priority.
- The Search field filters rows live.
- The "Closed" toggle hides/shows done tasks.

- [ ] **Step 4: Check console for errors**

Use `read_console_messages` with `onlyErrors: true`.
Expected: no new errors caused by the Table view.

- [ ] **Step 5: Report results to the user**

Summarize what was verified and share a screenshot.
