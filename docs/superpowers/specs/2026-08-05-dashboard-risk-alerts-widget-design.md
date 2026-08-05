# Widget "Rizika a upozornění" — Design

Status: approved, ready for implementation plan.

## Why

Manažerský pohled na dashboard — jedno místo, kde vidíš problémy bez procházení víc grafů zvlášť: kdo je v týmu přetížený a co je po termínu.

## Scope decisions (from brainstorming)

- **Přetížení členové**: seznam jmen s počtem aktivních úkolů, jen ti nad prahem >8 (stejný práh jako `WorkloadWidget`). Práh se vytáhne ze sdíleného místa místo duplicitní konstanty v obou widgetech.
- **Úkoly po termínu**: 5 nejstarších podle `dueDate` (vzestupně — nejdéle po termínu první), s názvem úkolu a jménem assignee (nebo "Nepřiřazeno"), klikatelné — otevře úkol stejně jako `UpcomingTasksWidget`.
- **Prázdný stav**: pokud nikdo není přetížený a nic není po termínu, zobrazí se jedna pozitivní hláška "Vše v pořádku — žádná rizika." místo dvou prázdných sekcí.
- **Bez exportu**: na rozdíl od 7 stávajících grafových widgetů tenhle export JSON/Excel nedostane — data nemají jednotný tvar kategorie→počet (kombinace jmen+počtů a úkolů+termínů), stejné pravidlo jako u Stats/Upcoming Tasks.

## Architecture

- `src/dashboard/widgets/WorkloadWidget.tsx`: `OVERLOAD_THRESHOLD` (hodnota 8) se **exportuje** místo být lokální konstantou — jediná změna ve stávajícím souboru, zbytek beze změny.
- `src/dashboard/widgets/RiskAlertsWidget.tsx` (nový) — props: `{ tasks: Task[]; members: TeamMember[]; onOpenTask: (taskId: string) => void }`.
  - **Přetížení**: `getAssigneeBreakdown(tasks, members)` (existující, znovupoužito) → filtr na `assigneeId !== null && count > OVERLOAD_THRESHOLD` (importováno z `WorkloadWidget.tsx`).
  - **Po termínu**: `tasks.filter(task => !task.completed && !task.isArchived && task.dueDate !== null && task.dueDate < today)`, seřazeno vzestupně podle `dueDate`, `.slice(0, 5)`. Jméno assignee přes `members` mapu + `getMemberDisplayName` (existující), fallback "Nepřiřazeno".
  - Klik na položku po termínu volá `onOpenTask(taskId)`.
  - Prázdný stav: obě sekce prázdné → jedna hláška na celý widget; jinak se renderují jen neprázdné sekce (žádná zvlášť "sekce je prázdná" hláška na úrovni jedné sekce — buď je co ukázat, nebo se sekce vynechá).
- `src/dashboard/dashboardTypes.ts` / `dashboardLayoutStorage.ts`: `DashboardWidgetKind`/`VALID_KINDS` rozšířené o `"riskAlerts"`.
- `src/dashboard/DashboardPanel.tsx`: `WIDGET_TITLES`/`ALL_WIDGET_KINDS` rozšířené o `riskAlerts: "Rizika a upozornění"`; `renderWidgetContent` rozšířen o `case "riskAlerts"`; `getExportRowsForWidget` rozšířen o `case "riskAlerts": return null;` (žádný export, explicitně jako Stats/Upcoming).

## Data flow

```
DashboardPanel (tasks, members — už existují)
  → RiskAlertsWidget(tasks, members, onOpenTask)
      → getAssigneeBreakdown(tasks, members) → filtr > OVERLOAD_THRESHOLD
      → tasks.filter(overdue) → sort → slice(0, 5)
```

Žádný nový Supabase přístup, žádné nové `Task` pole.

## Styling

Nové CSS třídy: `.dashboard-risk`, `.dashboard-risk__section`, `.dashboard-risk__section-title`, `.dashboard-risk__list`, `.dashboard-risk__item` — stejný vzor jako existující `.dashboard-upcoming` třídy (seznam s klikatelnými řádky).

## Testing

Bez unit test frameworku — manuální ověření v prohlížeči (`npm run dev`):
- Tým s alespoň jedním přetíženým členem (>8 aktivních úkolů) a alespoň jedním úkolem po termínu — obě sekce se zobrazí správně.
- Tým bez přetížených členů a bez úkolů po termínu — zobrazí se "Vše v pořádku — žádná rizika."
- Tým jen s přetíženými členy (žádné úkoly po termínu) — zobrazí se jen sekce přetížení, žádná prázdná sekce po termínu.
- Klik na úkol po termínu otevře správný panel (DetailPanel vs. board card podle `projectId`, stejné jako u Upcoming Tasks).
- Widget nemá kebab export položky (na rozdíl od ostatních grafových widgetů) — kebab menu se zobrazí jen v edit módu, jen se "Skrýt widget".
- Práh >8 sedí s tím, co ukazuje `WorkloadWidget` (červená barva) pro stejného člověka.
