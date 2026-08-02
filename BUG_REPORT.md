# Bug Report — DoNext (focus-todo-app-sigma.vercel.app)

Found during an automated Playwright exploratory crawl + CRUD test build-out on
2026-07-26, logged in as `david.minarik@seznam.cz` against the production
deployment. Sections covered: login, personal task lists (CRUD, filters,
priority), profile/theme/logout, and a navigation smoke pass over
Teams/Boards/Calendar/Table/Notes.

---

## 1. [CRITICAL] Deleted tasks (and lists) silently reappear after a sync

**Where:** `src/supabase/cloudBackup.ts`, `insertLocalData()` (~L123–162)

**What happens:** Deleting a task shows the "Úkol smazán" toast and removes it
from the UI immediately, but the deletion is not durably persisted. On a
later reload/sync, the task comes back.

**Root cause:** `insertLocalData()` runs upload steps in this order:

```
upsertLists → upsertTasks → insertLabels → upsertSubtasks → upsertTaskLabels
  → deleteRemovedTasks → deleteRemovedLists
```

`upsertTaskLabels()` (line 630-636) currently throws on every call because of
bug #2 below. Since none of the calls are individually try/caught,
that thrown error aborts `insertLocalData()` before it ever reaches
`deleteRemovedTasks()` / `deleteRemovedLists()` (lines 152-153). The delete is
applied to local state/localStorage, but never reaches Supabase — so the next
`downloadSupabaseData()` pull restores the "deleted" row.

**Repro (reproduced twice manually):**
1. Open any personal list, add a task, delete it (toast confirms "Úkol smazán", list shows empty state).
2. Navigate away and back (or reload) — the deleted task is present again.

**Impact:** Any task or list deletion is unreliable as long as bug #2 is live — this affects real user data, not just test fixtures.

**Fix direction:** Make `upsertTaskLabels` resilient to a partial failure (catch-and-log, or run the delete steps in a `finally`/independent of the labels step), and/or fix bug #2 so the throw stops happening.

---

## 2. [HIGH] Every task/list mutation triggers a `task_labels` upsert 500

**Where:** `src/supabase/cloudBackup.ts`, `upsertTaskLabels()` (L559-639)

**What happens:** Creating, editing, or completing any task fires a background sync that POSTs to `task_labels` and gets back:

```
POST /rest/v1/task_labels?on_conflict=task_id,label_id&columns=... → 500
{"code":"21000","message":"ON CONFLICT DO UPDATE command cannot affect row a second time",
 "hint":"Ensure that no rows proposed for insertion within the same command have duplicate constrained values."}
```

**Root cause:** `allRows` is built at L568-582 via `tasks.flatMap(task => task.labels.map(...))` with no de-duplication of `(task_id, label_id)` pairs. This account's stored task data already contains duplicate label assignments (independent of this test — first reproduced on the very first task created during this session), so the batch passed to `.upsert(taskLabelRows, { onConflict: "task_id,label_id" })` (L630-632) contains the same conflict key twice, which Postgres rejects outright (error 21000 is not "some rows failed," it's "the whole statement failed").

**Impact:** Silent 500 on essentially every write action; and per bug #1, it also blocks all deletions from persisting.

**Fix direction:** De-dupe `allRows` by `` `${task_id}:${label_id}` `` before upserting (e.g. `Map` keyed by that pair, keep last).

---

## 3. [MEDIUM] Deep link to a personal-mode list silently loads the wrong list

**Where:** `src/App.tsx`, `getInitialActiveTeamId()` (L1732) / `getInitialActiveListId()` (L1766)

**What happens:** A full page load (not an in-app click) to a personal list's URL, e.g. `/list/da3dc4e9-7f1c-4ffb-a5f5-050886ff6dbb`, does not land on that list. It silently redirects to a different list — the default list of whatever team was last active.

**Root cause:** `getInitialActiveTeamId()` reads the active team purely from `localStorage` (`ACTIVE_TEAM_STORAGE_KEY`), independent of the URL. If that stored team differs from "personal", the list array `getInitialActiveListId()` searches is pre-filtered to that team's lists (via `getListsForWorkspace`), so `routeListId` never matches and the code falls through to `lists.find(...)?.id` — the team's own default list — instead of erroring or switching to the "Osobní" tab implied by the URL.

**Repro:**
1. In one browser session, view any team/workspace list (so `localStorage.donext-active-team` — or whatever the actual key is — points at a team).
2. Directly navigate (full reload, not a click) to a personal list's URL.
3. Observe: the app loads a workspace/team list instead, with no error or redirect notice.

**Impact:** Breaks bookmarking/sharing personal-list links, and browser refresh while viewing a personal list can silently switch the visible list. Worked around in the generated Playwright suite by navigating via UI clicks (`TaskListPage.openPersonalList`) instead of direct URLs — see `pages/TaskListPage.ts`.

**Fix direction:** On initial load, check which workspace (`teamId` vs `null`) the `routeListId` actually belongs to and set `activeTeamId` to match *before* resolving the initial list, rather than trusting `localStorage` unconditionally.

---

## 4. [LOW] Toast messages render mojibake in production

**What happens:** The "task deleted" toast reads `?kol smaz?n` instead of `Úkol smazán` (also saw `Hlavn? rozvr?en? aplikace` as the `<main>` accessible name on every page).

**Note:** This matches the encoding issue already documented in this repo's `CLAUDE.md` ("pre-existing mojibake... `Otev??t`, `Nem?`") — logged here only to confirm it's still present in the current production deployment and affects at least one more string (the delete-task toast) than previously catalogued. Not a new defect; no action needed beyond what's already tracked.

---

## Not a bug (test-authoring note)

`TaskListPage.completeTask`/`uncompleteTask` in `pages/TaskListPage.ts` use `.click()` instead of Playwright's `.check()`/`.uncheck()`. Those helpers hung against this app's custom animated checkbox component — the click itself works and the app state updates correctly (verified manually), it's specifically Playwright's post-click checked-state polling that doesn't resolve. Documented in code comments; not an app defect.

---

## Coverage summary

| Area | Depth |
|---|---|
| Login (positive/negative/edge cases) | Full — 10 tests |
| Personal task list CRUD | Full — create/edit priority/complete/uncomplete/delete — 4 tests |
| Task filtering (status tabs, "Důležité" view) | Full — 2 tests |
| Profile / theme toggle / logout | Full — 4 tests |
| Teams, Boards (Nástěnky + Tabulka), Calendar, Notes | Smoke only — navigated to each, confirmed it renders and produces no console errors; no CRUD test coverage written for these sections given scope. Recommended as follow-up work. |

All 21 automated tests pass (`npx playwright test`). Page objects live in `pages/`, specs in `tests/`.
