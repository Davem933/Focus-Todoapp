# Detail úkolu na týmové nástěnce + omezení mazání pro členy

Datum: 2026-07-11

## Cíl

Na týmové Kanban nástěnce (`ProjectDetailView` v `src/layout/AppShell.tsx`):

1. Kliknutí na kartu úkolu zobrazí detail úkolu, kde lze prohlížet a upravovat všechna pole (název, popis, priorita, termín, štítky, přiřazení, podúkoly).
2. Člen týmu (role `member`), který úkol nezaložil, nesmí úkol smazat. Smazat může pouze:
   - admin týmu (existující `canManageProject` kontrola), nebo
   - uživatel, který úkol vytvořil.
   - Úkoly bez záznamu tvůrce (legacy data, `createdBy === null`) zůstávají mazatelné pro kohokoliv v týmu.

## Aktuální stav

- Klik na řádek karty (`ProjectTaskMiniRow`, `AppShell.tsx:3253`) už volá `onOpenTask(task.id)` → `handleOpenProjectCard` → otevře `ProjectCardComposerModal` v editačním režimu se všemi poli. Tato část je funkčně hotová; ověří se manuálně v prohlížeči a případně opraví, pokud something nefunguje.
- Mazání karty (tlačítko "Smazat" v 3-tečkovém menu, `AppShell.tsx:3282-3292`) volá `onDeleteTask(task.id)` bez jakékoliv kontroly oprávnění.
- `Task` typ (`src/tasks/taskTypes.ts`) nemá pole pro tvůrce úkolu — pouze `assigneeId` (komu je přiřazen).
- Supabase tabulka `tasks` má sloupec `owner_id`, ale ten se při každé auto-synchronizaci (`replaceSupabaseData` v `src/supabase/cloudBackup.ts`) přepisuje na ID aktuálně synchronizujícího uživatele pro všechny úkoly v jeho lokálním stavu (včetně týmových úkolů, které nevytvořil). Nelze ho tedy použít jako spolehlivý "tvůrce" — je potřeba nové, samostatné pole, které se při synchronizaci nepřepisuje.

## Datový model

Přidat do tabulky `tasks` v Supabase nový sloupec:

- `created_by uuid null references auth.users(id)`.
- Zpětné vyplnění existujících řádků: `update tasks set created_by = owner_id where created_by is null`.

Rozšířit `Task` typ (`src/tasks/taskTypes.ts`):

```ts
export type Task = {
  ...
  createdBy: string | null;
};
```

`createdBy` **není** součástí `TaskUpdate` — nastavuje se pouze při vytvoření úkolu a dál se needituje.

## Změny v kódu

**`src/tasks/taskTypes.ts`** — přidat `createdBy: string | null` do `Task`.

**`src/App.tsx` (`handleCreateTask`)** — při vytváření nového `Task` nastavit `createdBy: authUser?.id ?? null`.

**`src/supabase/cloudBackup.ts`**:
- `CloudTaskRow`: přidat `created_by: string | null`.
- `downloadSupabaseData`: přidat `created_by` do `select(...)` sloupců a namapovat na `createdBy: task.created_by`.
- `insertTasks`: zapisovat `created_by: task.createdBy` (hodnota už je součástí lokálního `Task` objektu, žádný fallback na `userId` není potřeba — pole se stanovuje výhradně při vytvoření úkolu v `handleCreateTask`).

**`src/layout/AppShell.tsx`**:
- V komponentě, kde je definováno `canManageProject` (cca řádek 1784) a kde je dostupné `currentUserId`, přidat pomocnou funkci `canDeleteTask(task: Task, project: Project)`:
  ```ts
  function canDeleteTask(task: Task, project: Project) {
    if (canManageProject(project)) return true;
    if (task.createdBy === null) return true;
    return task.createdBy === currentUserId;
  }
  ```
- V `ProjectDetailView` (řádek ~2856) přidat prop `currentUserId: string | null` a `canDeleteTask: (task: Task) => boolean` (předá se z volajícího místa řádek ~2385 jako `(task) => canDeleteTask(task, selectedProject)`).
- V `ProjectTaskMiniRow` (řádek ~3190) přidat prop `canDelete: boolean`. Pokud `canDelete` je `false`, tlačítko "Smazat" v menu se vůbec nezobrazí (celá položka menu zmizí, ne jen disabled stav — jednodušší a jasnější UX).

## Mimo rozsah

- Neřeší se obecná nespolehlivost synchronizační vrstvy (`replaceSupabaseData` může za určitých okolností duplikovat týmové úkoly při resyncu jiným členem) — jde o předexistující chování nesouvisející s tímto úkolem.
- Needituje se sjednocení duplicitní `isTeamAdminRole` utility (existuje ve dvou souborech) — nesouvisí přímo se zadáním.
- Osobní (netýmové) úkoly a `DetailPanel` nejsou touto změnou dotčeny — zadání se týká výhradně týmové Kanban nástěnky.

## Testování

- Manuální ověření v prohlížeči (dev server): admin týmu vidí "Smazat" u všech karet; člen týmu vidí "Smazat" jen u karet, které sám vytvořil; klik na kartu otevře detail se všemi poli pro čtení i editaci.
