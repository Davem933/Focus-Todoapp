# Přizpůsobitelný dashboard (ClickUp styl) — Design

Status: approved, ready for implementation plan.

## Why

Nahradit statický placeholder dashboardu novým, plně přizpůsobitelným ClickUp-stylu dashboardem: drag-and-drop mřížka widgetů, měnitelná velikost, edit/read mód, perzistentní rozvržení, znovupoužitelný `DashboardWidget` obal a 3 výchozí widgety nad reálnými daty úkolů.

## Scope decisions (from brainstorming)

- **Umístění**: nahrazuje placeholder na `AppShell.tsx:1369-1373`, otevírá se přes existující "+ Zobrazení" tab (`ViewTabsBar`, kind `"dashboard"`) — stejný vstupní bod jako Kalendář/Tabulka/Gantt, ne nový samostatný overlay (ten stávající `DashboardOverlay`/"Ranní shrnutí" zůstává beze změny, je to jiná funkce).
- **Datový rozsah**: widgety čerpají z `allTasks` filtrovaných na `activeTeamId`, stejně jako List/Table/Kalendář — žádné nové API volání, žádné cross-team agregace.
- **Styling**: vlastní CSS v `styles.css` (konzistentní s projektovou konvencí, žádný Tailwind), vizuálně cílené na přiblížení se ClickUp dashboardu (zaoblené karty, jemné stíny, čisté hlavičky widgetů).
- **Chart knihovna**: `recharts` — nová závislost, použita v prvním widgetu (Priority) a připravena pro budoucí grafy.
- **Perzistence**: pouze localStorage v v1 (`donext.dashboardLayout.v1`), globální (ne per-tým) — je to preference uživatelova rozvržení karet, ne týmová data. Ukládací vrstva je čistě oddělená funkce, aby šla později přepnout na Supabase bez zásahu do komponent.

## Architecture

Nový adresář `src/dashboard/`:

- `dashboardTypes.ts` — `DashboardWidgetKind = "stats" | "priority" | "upcoming"`; `DashboardWidgetLayoutItem = { i: string; x: number; y: number; w: number; h: number }` (react-grid-layout formát, `i` = widget kind jako string id, protože v1 má každý widget kind max 1 instanci).
- `dashboardLayoutStorage.ts` — `loadDashboardLayout(): DashboardWidgetLayoutItem[]`, `saveDashboardLayout(layout)`, `getDefaultDashboardLayout(): DashboardWidgetLayoutItem[]` (3 widgety, viz níže). Čisté funkce nad localStorage, žádná závislost na React.
- `DashboardPanel.tsx` — nahrazuje placeholder v `AppShell.tsx`. Props: `tasks: Task[]`, `onUpdateTask`, `onOpenTask: (taskId: string) => void`. Vnitřní stav: `layout` (načtený z `dashboardLayoutStorage`), `hiddenWidgets: DashboardWidgetKind[]`, `isEditMode: boolean`. Renderuje `react-grid-layout`s `<GridLayout>` s widgety podle `layout`, hlavičku panelu s přepínačem "Upravit dashboard"/"Hotovo", tlačítkem "Obnovit výchozí rozvržení" a "+ Přidat widget" menu (viditelné jen v edit módu, nabízí `hiddenWidgets`).
- `DashboardWidget.tsx` — obalový komponent: `{ title, kind, isEditMode, onHide, children }`. Hlavička s názvem, drag rukojetí (`.dashboard-widget__drag-handle`, viditelná jen `isEditMode`, react-grid-layout `dragHandleClassName`) a kebab menu (`⋮`) s jedinou položkou "Skrýt widget" → `onHide(kind)`. Content kontejner s `overflow: auto` pro případ, že obsah přesáhne dostupnou výšku karty.
- `widgets/StatsOverviewWidget.tsx`, `widgets/PriorityBreakdownWidget.tsx`, `widgets/UpcomingTasksWidget.tsx` — každý přijímá `tasks: Task[]` (a `UpcomingTasksWidget` navíc `onToggleTaskCompleted`, `onOpenTask`), žádný vlastní data-fetching.

Integrace do `AppShell.tsx`: `isDashboardViewOpen` blok (aktuálně placeholder na řádcích 1369–1373) se nahradí `<DashboardPanel tasks={allTasks filtered by activeTeamId} onUpdateTask={onUpdateTask} onOpenTask={handleSelectCommandPaletteTask} />` — `handleSelectCommandPaletteTask` už řeší routing do board-flow vs. `DetailPanel` podle `task.projectId` (řádky 627–636), takže se znovupoužije beze změny.

## Widgety (v1, výchozí layout)

Výchozí rozvržení (3 sloupce mřížky, `cols: 12`, `rowHeight` ladit v implementaci):

1. **Stats Overview** (`x:0,y:0,w:12,h:2`) — 4 počítadla vedle sebe: Dnes (due today, nedokončené), Po termínu (`dueDate < today`, nedokončené), Dokončeno (`completed && !isArchived`), V řešení (`!completed && !isArchived` celkem). Stejný vizuální jazyk jako `MetricCard` v `WorkspaceHomePanel.tsx` (barevné tóny, framer-motion vstupní animace) — sdílet vzor, ne nutně stejnou komponentu.
2. **Priority Breakdown** (`x:0,y:2,w:6,h:4`) — `recharts` `BarChart`, 4 sloupce (Žádná/Nízká/Střední/Vysoká), počty aktivních (`!completed && !isArchived`) úkolů dle `TaskPriority`. Barvy sloupců navázané na existující prioritní barevnou paletu v projektu (dohledat/sjednotit při implementaci, viz `AppShell.tsx` prioritní barvy).
3. **Upcoming Tasks** (`x:6,y:2,w:6,h:4`) — nejbližších 6 nedokončených úkolů seřazených podle `dueDate` (null poslední), každý řádek: checkbox (`onUpdateTask(id, {completed: true})`), název, due date. Klik na řádek (mimo checkbox) volá `onOpenTask(taskId)`. Prázdný stav: "Žádné nadcházející úkoly."

## Edit mód

- Přepínací tlačítko v hlavičce `DashboardPanel` ("Upravit dashboard" / "Hotovo").
- Edit mód zapnutý: `GridLayout` props `isDraggable`, `isResizable` = `true`; viditelná drag rukojeť v hlavičce každého widgetu; resize úchyt v pravém dolním rohu karty (react-grid-layout výchozí `react-resizable-handle`, přestylovaný pod app vzhled); jemný grid overlay na pozadí panelu (CSS `background-image` s tečkami/čárami, zobrazený jen v edit módu); widget při tažení dostává zvýrazněný stín.
- Edit mód vypnutý (výchozí): `isDraggable`/`isResizable` = `false`, žádné rukojeti/overlay, layout uzamčen proti nechtěné změně.
- `onLayoutChange` z `react-grid-layout` volá `saveDashboardLayout` (jen v edit módu, aby čtecí re-render negeneroval zbytečné zápisy).
- "Obnovit výchozí rozvržení": nastaví `layout = getDefaultDashboardLayout()`, `hiddenWidgets = []`, uloží do localStorage.
- Skrytí widgetu (kebab menu → "Skrýt widget"): odebere položku z `layout` a přidá `kind` do `hiddenWidgets`; uloží se do localStorage. Znovu-přidání přes "+ Přidat widget" menu v hlavičce panelu (analogické k existujícímu vzoru přidávání view tabů v `ViewTabsBar.tsx`) vloží widget zpět na první volnou pozici v mřížce (spočítanou jako `maxY + 1` z aktuálního layoutu) a odebere ho z `hiddenWidgets`.

## Data flow

```
AppShell (allTasks, activeTeamId, onUpdateTask)
  → DashboardPanel (filtruje na activeTeamId, spravuje layout/hiddenWidgets/isEditMode)
      → GridLayout (react-grid-layout)
          → DashboardWidget × 3 (title, kind, isEditMode, onHide)
              → StatsOverviewWidget(tasks)
              → PriorityBreakdownWidget(tasks)
              → UpcomingTasksWidget(tasks, onToggleTaskCompleted, onOpenTask)
```

Žádný nový Supabase přístup, žádné nové Task pole. Mutace úkolů (checkbox dokončení) jde přes existující `onUpdateTask` prop, stejně jako ve všech ostatních panelech.

## Dependencies

- `react-grid-layout` + `@types/react-grid-layout` (devDependency) — grid/drag/resize.
- `recharts` — Priority Breakdown graf, připraveno pro budoucí grafy.

## Styling

Nové třídy v `styles.css`: `.dashboard-panel`, `.dashboard-panel__toolbar`, `.dashboard-panel__grid` (edit-mód grid overlay pomocí `data-edit-mode` atributu), `.dashboard-widget`, `.dashboard-widget__header`, `.dashboard-widget__drag-handle`, `.dashboard-widget__menu`, `.dashboard-widget__content`. React-grid-layout defaultní CSS (`react-grid-layout/css/styles.css`, `react-resizable/css/styles.css`) se importuje jednou v `DashboardPanel.tsx` a přestylovává se přes vlastní třídy — barvy/radius/stíny/typografie navázané na existující CSS proměnné projektu (světlý i tmavý režim).

## Testing

Bez unit test frameworku (viz CLAUDE.md) — ověření ručně přes browser preview:
- Otevření dashboardu přes "+ Zobrazení".
- Přepnutí edit módu: zobrazení/skrytí rukojetí a mřížky.
- Drag widgetu, resize widgetu, ověření persistence po refreshi stránky.
- "Obnovit výchozí rozvržení" vrátí layout i skryté widgety do výchozího stavu.
- Skrytí widgetu → zmizí z mřížky → "+ Přidat widget" ho vrátí zpět.
- Zaškrtnutí úkolu v "Nadcházející úkoly" widgetu odškrtne úkol a zmizí ze seznamu.
- Klik na řádek úkolu otevře správný panel (DetailPanel vs. board card podle `projectId`).
- Prázdné stavy (0 úkolů, 0 nadcházejících) nerozbijí layout.
- Světlý i tmavý režim, responzivita při zúžení okna.
