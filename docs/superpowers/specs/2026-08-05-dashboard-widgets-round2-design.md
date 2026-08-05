# Dashboard widgety — druhé kolo (štítky, projekty, vytížení) — Design

Status: approved, ready for implementation plan.

## Why

Rozšíření přizpůsobitelného dashboardu (viz `docs/superpowers/specs/2026-08-05-clickup-dashboard-design.md`) o tři další widgety, vybrané uživatelem z navrhovaného seznamu: rozdělení podle štítků, rozdělení podle nástěnky/projektu (s navigací), a vytížení týmu s barevným varováním při přetížení. Cílem je dát uživateli víc pohledů na aktivní práci týmu, aniž by bylo nutné rozšiřovat datový model — všechny tři čerpají výhradně z polí, která `Task` už má.

## Scope decisions (from brainstorming)

- **Rozdělení podle štítků**: sloupcový graf (konzistentní s Priority Breakdown). Počítá aktivní (nedokončené, nearchivované) úkoly podle `task.labels` — úkol s více štítky se počítá do každého sloupce zvlášť. Barva sloupce = `TaskLabel.color`. Úkoly bez štítků tvoří bucket "Bez štítku".
- **Rozdělení podle nástěnky/projektu**: sloupcový graf, klikatelný. Počítá aktivní úkoly podle `task.projectId`, název sloupce = `Project.name`. Klik na sloupec otevře daný board (`onOpenProject(projectId)` → `AppShell`'s `handleOpenProjectsOverview(projectId)`). Úkoly bez projektu tvoří neklikatelný bucket "Bez nástěnky".
- **Vytížení týmu**: sloupcový graf, znovupoužívá existující `getAssigneeBreakdown()` (žádná duplicitní agregační logika). Barva sloupce podle pevného prahu: **>8 aktivních úkolů = danger (červená)**, **5–8 = warning (oranžová)**, **<5 = accent (normální)**. Bucket "Nepřiřazeno" je vždy neutrální šedá bez ohledu na počet.
- Všechny tři se registrují do existujícího `DashboardWidgetKind` systému (stejný vzor jako `assigneePie`/`assigneeBar` z prvního rozšíření) — hidden by default, přidávají se přes "+ Přidat widget", ukládají se do stejného localStorage layoutu.

## Architecture

- `src/dashboard/dashboardTypes.ts`: `DashboardWidgetKind` rozšířen o `"labels" | "projectBreakdown" | "workload"`.
- `src/dashboard/dashboardLayoutStorage.ts`: `VALID_KINDS` rozšířen o stejné tři hodnoty.
- `src/dashboard/labelBreakdown.ts` (nový, pure function) — `getLabelBreakdown(tasks: Task[]): { labelId: string; name: string; color: string; count: number }[]`, filtruje aktivní úkoly, iteruje `task.labels`, agreguje podle `label.id`; úkoly s prázdným `labels` polem inkrementují speciální bucket `{ labelId: "unlabeled", name: "Bez štítku", color: "var(--color-text-secondary)", count }`.
- `src/dashboard/widgets/LabelBreakdownWidget.tsx` (nový) — `recharts` `BarChart`, stejná struktura jako `PriorityBreakdownWidget.tsx` (Cell per entry, barva z `entry.color`), prázdný stav "Žádné aktivní úkoly."
- `src/dashboard/projectBreakdown.ts` (nový, pure function) — `getProjectBreakdown(tasks: Task[], projects: Project[]): { projectId: string | null; name: string; count: number }[]`, filtruje aktivní úkoly, agreguje podle `task.projectId`; `projectId === null` mapuje na bucket `{ projectId: null, name: "Bez nástěnky", count }`. Řadí sestupně podle count.
- `src/dashboard/widgets/ProjectBreakdownWidget.tsx` (nový) — `recharts` `BarChart` s `onClick` na `Bar` (recharts podporuje `onClick` per-bar přes `activeIndex`/`onClick` handler na `<Bar>` nebo `<Cell>`), volá `onOpenProject(projectId)` jen pro sloupce s `projectId !== null` (kurzor `pointer` jen na klikatelných sloupcích). Props: `{ tasks: Task[]; projects: Project[]; onOpenProject: (projectId: string) => void }`.
- `src/dashboard/widgets/WorkloadWidget.tsx` (nový) — importuje `getAssigneeBreakdown` z existujícího `src/dashboard/assigneeBreakdown.ts` (beze změny), `recharts` `BarChart`, barva sloupce vypočtená lokální funkcí `getWorkloadTone(count: number, assigneeId: string | null)`: `assigneeId === null` → neutrální (`var(--color-text-secondary)`), jinak práh `>8` → `var(--color-...)` danger, `5–8` → warning/orange, `<5` → accent. Props: `{ tasks: Task[]; members: TeamMember[] }` (stejné jako `AssigneeBarWidget`).
- `src/dashboard/DashboardPanel.tsx`:
  - Nový prop `onOpenProject: (projectId: string) => void`, přeposílá se do `ProjectBreakdownWidget`.
  - Nový stav `projects: Project[]`, načítaný přes `useEffect` volající `loadProjectsForTeams([activeTeamId])` (stejný zdroj jako `WorkspaceHomePanel`), analogicky k existujícímu `members` efektu.
  - `WIDGET_TITLES` a `ALL_WIDGET_KINDS` rozšířené o `labels`, `projectBreakdown`, `workload`.
  - `renderWidgetContent` switch rozšířen o tři nové case větve.
- `AppShell.tsx`: `DashboardPanel` volání dostane nový prop `onOpenProject={(projectId) => handleOpenProjectsOverview(projectId)}` (funkce už existuje, `AppShell.tsx:754`).

## Data flow

```
AppShell (allTasks filtered by activeTeamId, activeTeamId, handleOpenProjectsOverview)
  → DashboardPanel (+ vlastní fetch: loadTeamMembers, loadProjectsForTeams)
      → LabelBreakdownWidget(tasks)
      → ProjectBreakdownWidget(tasks, projects, onOpenProject)
      → WorkloadWidget(tasks, members)
```

Žádný nový Supabase zápis, žádné nové `Task` pole. `loadProjectsForTeams` je čtecí volání, které `WorkspaceHomePanel` už používá se stejnou signaturou — žádné nové API.

## Styling

Žádné nové CSS třídy potřeba nad rámec existujících `.dashboard-widget__empty` a recharts inline styly (`var(--color-*)`) — stejný vzor jako `PriorityBreakdownWidget`/`AssigneeBarWidget`. Klikatelné sloupce v `ProjectBreakdownWidget` dostanou `cursor: pointer` přes recharts `<Cell style={{ cursor: ... }}>`.

## Testing

Bez unit test frameworku — manuální ověření v prohlížeči (`npm run dev`):
- Přidat všechny 3 nové widgety přes "+ Přidat widget", ověřit render s reálnými daty (více štítků, více boardů, různě vytížení členové).
- Úkol se 2 štítky se objeví v obou sloupcích štítkového grafu.
- Úkoly bez štítku/projektu se objeví v bucketu "Bez štítku"/"Bez nástěnky"; bucket "Bez nástěnky" není klikatelný.
- Klik na sloupec s projektem otevře daný board (přepne z dashboardu do Projects Overview).
- Člen s >8 aktivními úkoly má červený sloupec, 5–8 oranžový, <5 normální; "Nepřiřazeno" vždy šedé bez ohledu na počet.
- Prázdné stavy (0 aktivních úkolů) nerozbijí layout.
- Persistence layoutu a hide/show funguje stejně jako u ostatních widgetů (žádná nová logika v `dashboardLayoutStorage.ts` kromě rozšíření `VALID_KINDS`).
