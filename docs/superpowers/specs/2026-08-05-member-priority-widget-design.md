# Priority podle člena — Design

Status: approved, ready for implementation plan.

## Why

Uživatel chce vidět rozpad priorit úkolů konkrétního člověka v týmu (např. "vyber Dave, uvidíš kolik má high priority úkolů"), interaktivně přes výběr osoby v samotném widgetu.

## Scope decisions (from brainstorming)

- **Výběr člověka**: dropdown uvnitř widgetu (`CustomDropdown`, existující komponenta z `src/layout/CustomDropdown.tsx`), ne samostatný widget na osobu.
- **Typ grafu**: koláčový (odlišný od stávajícího sloupcového Priority Breakdown, aby byly vizuálně rozlišitelné).
- **Data**: úkoly filtrované na `task.assigneeId === vybraný člověk`, poté stejná logika jako existující `getPriorityBreakdown()` — žádná nová agregační funkce, jen předfiltrovaný vstup.
- **Barvy**: stejné jako stávající Priority Breakdown (`TASK_PRIORITY_COLORS`) — barva priority znamená totéž napříč celým dashboardem.
- **Výchozí výběr**: první člen týmu, jakmile se `members` načtou (stejný zdroj dat jako ostatní widgety, žádný nový fetch).
- **Vlastnictví stavu výběru**: leží v `DashboardPanel`, ne uvnitř widgetu — jinak by export (JSON/Excel) nemohl vědět, kterého člověka zrovna exportovat. Widget je čistě řízená komponenta (`selectedMemberId` + `onSelectMember` props), stejně jako ostatní widgety dostávají data shora.
- **Reset při přepnutí týmu**: výběr se resetuje na `null` při změně `activeTeamId`, poté se znovu nastaví na prvního člena nového týmu, jakmile dorazí.
- **Export**: ano, JSON i Excel stejně jako ostatních 6 grafů — exportuje data aktuálně vybraného člověka.
- **Bez persistence výběru** do localStorage — jen stav relace, nebylo požadováno.

## Architecture

- `src/dashboard/dashboardTypes.ts`: `DashboardWidgetKind` rozšířen o `"memberPriority"`.
- `src/dashboard/dashboardLayoutStorage.ts`: `VALID_KINDS` rozšířen o `"memberPriority"`.
- `src/dashboard/widgets/MemberPriorityWidget.tsx` (nový) — řízená komponenta. Props: `{ tasks: Task[]; members: TeamMember[]; selectedMemberId: string | null; onSelectMember: (memberId: string) => void }`.
  - Render: `CustomDropdown` (`value={selectedMemberId ?? ""}`, `options` = `members.map(m => ({value: m.userId, label: getMemberDisplayName(m)}))` — `getMemberDisplayName` z existujícího `src/teams/teamMemberDisplay.ts`), pod ním `recharts` `PieChart` (stejná struktura jako `AssigneePieWidget.tsx`: `Pie`/`Cell`/`Tooltip`/`Legend`).
  - Data pro graf: `tasks.filter(task => task.assigneeId === selectedMemberId)` → `getPriorityBreakdown(memberTasks)` → filtr na `count > 0` (koláčový graf nemá smysl s nulovými výsečemi) → `Cell fill` z `entry.color` (`TASK_PRIORITY_COLORS`, už součástí `PriorityBreakdownEntry`).
  - Prázdné stavy: `members.length === 0` → "V týmu nejsou žádní členové."; vybraný člověk má 0 aktivních úkolů → "Žádné aktivní úkoly.".
- `src/dashboard/DashboardPanel.tsx`:
  - Nový stav `memberPriorityWidgetMemberId: string | null`.
  - Nový `useEffect` reagující na `activeTeamId` změnu → reset `memberPriorityWidgetMemberId` na `null`.
  - Nový `useEffect` reagující na `members` změnu → pokud `memberPriorityWidgetMemberId === null && members.length > 0`, nastaví na `members[0].userId`.
  - `WIDGET_TITLES`/`ALL_WIDGET_KINDS` rozšířené o `memberPriority: "Priority podle člena"`.
  - `renderWidgetContent` switch rozšířen o `case "memberPriority"` → `<MemberPriorityWidget tasks={tasks} members={members} selectedMemberId={memberPriorityWidgetMemberId} onSelectMember={setMemberPriorityWidgetMemberId} />`.
  - `getExportRowsForWidget` rozšířen o parametr `memberPriorityWidgetMemberId` a `case "memberPriority"` → stejný filtr + `getPriorityBreakdown` jako ve widgetu, mapovaný na `{ Kategorie: entry.label, Počet: entry.count }`; vrací `null`, pokud `memberPriorityWidgetMemberId` je `null` (žádný člověk vybraný — např. tým bez členů).

## Data flow

```
DashboardPanel (tasks, members, activeTeamId, memberPriorityWidgetMemberId)
  → MemberPriorityWidget(tasks, members, selectedMemberId, onSelectMember)
      → CustomDropdown (výběr člověka, volá onSelectMember → setMemberPriorityWidgetMemberId v rodiči)
      → PieChart (getPriorityBreakdown(filtered tasks))
  → getExportRowsForWidget("memberPriority", ...) → DashboardWidget kebab menu export
```

Žádný nový Supabase přístup, žádné nové `Task` pole — `members` už `DashboardPanel` načítá pro assignee-based widgety.

## Styling

Nová CSS třída `.dashboard-member-priority` (flex column: dropdown nahoře s pevnou výškou, graf `flex: 1; min-height: 0` pod ním) — stejný vzor jako ostatní widgety, žádné nové CSS proměnné.

## Testing

Bez unit test frameworku — manuální ověření v prohlížeči (`npm run dev`):
- Přidat widget přes "+ Přidat widget" — zobrazí se s prvním členem týmu předvybraným a jeho koláčovým grafem priorit.
- Přepnutí dropdownu na jiného člena přepočítá graf na jeho úkoly.
- Člověk bez aktivních úkolů zobrazí "Žádné aktivní úkoly.".
- Přepnutí aktivního týmu resetuje výběr na prvního člena nového týmu.
- Export JSON/Excel z kebab menu odpovídá aktuálně vybranému člověku (přepnout osobu, exportovat, ověřit že soubor odpovídá nové osobě, ne staré).
- Barvy výsečí odpovídají barvám priority použitým jinde v appce (Kanban karty, Priority Breakdown widget).
- Layout persistence (drag/resize/refresh, skrytí/znovu-přidání) funguje stejně jako u ostatních widgetů.
