# Kompletní souhrn projektu DoNext

## 1. Co je tento projekt

`DoNext` je task management aplikace zaměřená na osobní produktivitu i týmovou spolupráci. Projekt spojuje:

- osobní seznamy úkolů,
- detailní správu tasků,
- focus režim pro práci na jednom úkolu,
- denní přehledy a doporučování další práce,
- týmové workspacy,
- projektové boardy ve stylu kanbanu,
- cloud synchronizaci přes Supabase,
- webové i Android nasazení přes Capacitor.

V repozitáři je frontend postavený jako SPA aplikace v Reactu a TypeScriptu, buildovaný přes Vite. Datová vrstva je rozdělená mezi lokální stav v prohlížeči a cloudový backend v Supabase.

## 2. Technologie a nástroje použité v projektu

### Frontend

- `React 19`
- `TypeScript 5`
- `Vite 7`
- `lucide-react` pro ikony

### Backend a data

- `Supabase`
- `@supabase/supabase-js`
- PostgreSQL schéma a RLS politiky v `supabase/*.sql`

### Mobilní a notifikační vrstva

- `Capacitor 8`
- `@capacitor/core`
- `@capacitor/app`
- `@capacitor/android`
- `@capacitor/local-notifications`

### PWA a nasazení

- service worker v `public/sw.js`
- web manifest v `public/manifest.webmanifest`
- produkční deployment na `Vercel`
- Android shell v adresáři `android/`

## 3. Spouštění, build a deployment

Definované skripty v `package.json`:

- `npm run dev`
  Spustí Vite dev server.
- `npm run build`
  Provede TypeScript kontrolu a produkční build.
- `npm run preview`
  Spustí preview build.
- `npm run deploy:vercel`
  Odešle produkční deploy na Vercel přes CLI.
- `npm run android:sync`
  Udělá build a synchronizuje web assets do Android projektu.
- `npm run android:open`
  Otevře Android projekt.

Nasazení pro web počítá s Vercel SPA rewrite pravidlem v `vercel.json`, které směruje všechny cesty na `index.html`.

## 4. Vstupní body aplikace

### `src/main.tsx`

Hlavní vstup aplikace:

- renderuje `App` do DOM,
- načítá globální stylesheet `src/styles.css`,
- v produkci registruje service worker přes `registerServiceWorker()`.

### `src/App.tsx`

Toto je hlavní orchestrátor celé aplikace. Je to nejdůležitější soubor projektu. Řídí:

- inicializaci stavu aplikace,
- načítání a ukládání tasků do local storage,
- route stav přes URL,
- focus mode,
- Supabase autentizaci,
- načtení cloudových dat,
- automatický autosync do Supabase,
- načítání týmů,
- notifikace,
- výběr aktivního workspace a seznamu,
- předávání callbacků do `AppShell` a `FocusView`.

## 5. Architektura frontendu

Frontend je rozdělený do několika vrstev.

### A. Root orchestrace

Soubor: `src/App.tsx`

Odpovědnosti:

- drží root state pro `tasks`, `lists`, `teams`, `selectedTaskId`, `activeListId`, `activeTeamId`,
- řeší route synchronizaci přes `window.history`,
- spravuje auth session a profil uživatele,
- stahuje a ukládá cloudová data,
- synchronizuje notifikace,
- rozhoduje, zda se zobrazí `AppShell` nebo `FocusView`.

Hlavní interní handlery v `App.tsx`:

- `handleUpdateTask`
- `handleArchiveTask`
- `handleUndoArchiveTask`
- `handleDeleteTask`
- `handleUndoDeleteTask`
- `handleCreateTask`
- `handleCreateList`
- `handleRenameList`
- `handleArchiveList`
- `handleRestoreList`
- `handleDeleteList`
- `handleSelectList`
- `handleSelectWorkspace`
- `handleSelectTask`
- `handleClearTaskSelection`
- `handleStartFocus`
- `handleCompleteFocusTask`
- `handleCompleteFocusTaskInSession`
- `handleToggleFocusSubtask`
- `handleExitFocusMode`
- `handleStartNextFocusTask`
- `handleOpenMissedNotificationTask`
- `handleSignIn`
- `handleSignUp`
- `handleSignOut`
- `handleCreateTeam`
- `handleDeleteTeam`
- `handleTeamUpdated`
- `handleUploadLocalDataToCloud`
- `handleDownloadCloudData`
- `handleSaveLocalChangesToCloud`

Podpůrné utility ve stejném souboru:

- `createCloudSyncSnapshot`
- `ensureUserProfile`
- `getInitialThemeMode`
- `getInitialActiveTeamId`
- `getTasksForWorkspace`
- `getListsForWorkspace`
- `getDefaultListIdForWorkspace`
- `getInitialActiveListId`
- `getInitialSelectedTaskId`
- `getRouteStateFromPath`
- `buildListPath`
- `buildTaskPath`
- `pushListRoute`
- `pushTaskRoute`
- `replaceListRoute`
- `pushRoute`
- `replaceRoute`
- `normalizeListName`
- `normalizeTaskUpdate`
- `shouldCreateRecurringTask`
- `createRecurringTask`
- `hasMatchingRecurringTask`
- `getNextRecurrenceDate`
- `addRecurrenceInterval`
- `formatDateValue`
- `createEntityId`
- `getNewTaskDueDate`
- `getNewTaskPriority`
- `isCompletedTaskInCurrentScope`

### B. Layout vrstva

#### `src/layout/useAppLayout.ts`

Tento hook je centrální místo pro rozhodování o layoutu podle šířky viewportu a podle toho, zda je vybraný task.

Rozlišuje režimy:

- `mobile-list-only`
- `mobile-detail-only`
- `tablet-sidebar-list`
- `tablet-list-detail`
- `desktop-sidebar-list`
- `desktop-sidebar-list-detail`

Vrací:

- `viewport`
- `mode`
- `visiblePanels`

#### `src/layout/AppShell.tsx`

`AppShell` je hlavní renderer aplikačního shellu. Bere data a callbacky z `App.tsx` a skládá z nich uživatelské rozhraní.

Řeší:

- zobrazení panelů sidebar / list / detail,
- dashboard overlay,
- check-in overlay,
- focus assistant,
- workspace home,
- teams overview,
- projects overview,
- práci s doporučenými tasky,
- práci s archivovanými tasky,
- výpočty denních statistik,
- napojení na týmové a projektové API,
- board flow a modal interakce.

### C. Panelová vrstva

#### `src/layout/panels/SidebarPanel.tsx`

Levá navigační část aplikace:

- výběr systémových seznamů,
- výběr uživatelských seznamů,
- výběr týmového workspace,
- orientace mezi osobní a týmovou částí.

#### `src/layout/panels/ListPanel.tsx`

Hlavní seznam tasků:

- zobrazení tasků pro aktuální view,
- vytváření nových tasků,
- denní přehledy,
- filtry a rychlé akce,
- otevření konkrétního tasku.

#### `src/layout/panels/DetailPanel.tsx`

Detail vybraného tasku:

- editace názvu,
- poznámky,
- termínu a času,
- priority,
- recurrence,
- štítků,
- subtasks,
- přiřazení,
- navázání na projekt / board.

#### `src/layout/panels/WorkspaceHomePanel.tsx`

Domovská obrazovka aktivního workspace:

- sumarizace týmového prostoru,
- návaznost na projekty, tasky a workflow v rámci týmu.

## 6. Funkční moduly aplikace

### `src/focus/FocusView.tsx`

Samostatný focus režim:

- pracuje vždy s jedním taskem,
- obsahuje timer,
- umí start, pause, reset, continue session,
- při vypršení může vyvolat notifikaci,
- umožňuje dokončení tasku nebo přechod na další doporučený task,
- zobrazuje progress dne a subtasky.

Používá stavy:

- `idle`
- `running`
- `paused`
- `completed`
- `expired`
- `cancelled`

### `src/notifications/taskNotifications.ts`

Vrstva notifikací:

- vypočítá timestamp notifikace z `dueDate` a `dueTime`,
- určí, které tasky jsou kandidáti pro notifikaci,
- vybere nejbližší naplánovanou notifikaci,
- registruje nativní listenery přes Capacitor,
- synchronizuje naplánované nativní notifikace,
- zobrazuje fallback notifikace,
- vyžádá oprávnění k notifikacím,
- umí zobrazit notifikaci po focus session.

Klíčové exporty:

- `getTaskNotificationTimestamp`
- `isTaskNotificationCandidate`
- `getNextTaskNotification`
- `registerNativeNotificationHandlers`
- `syncTaskNotifications`
- `notifyDueTasks`
- `requestTaskNotificationPermission`
- `showFocusSessionNotification`

### `src/pwa/registerServiceWorker.ts`

Jednoduchá registrační vrstva pro PWA. Registrace probíhá jen pokud browser podporuje service worker.

## 7. Task doména

Adresář `src/tasks/` obsahuje hlavní business logiku pro tasky.

### `taskTypes.ts`

Definuje datové typy:

- `TaskPriority`
- `TaskRecurrence`
- `BoardColumnKey`
- `TaskLabel`
- `TaskList`
- `Task`
- `TaskSubtask`
- `TaskUpdate`

Datový model `Task` obsahuje:

- `id`
- `listId`
- `title`
- `completed`
- `dueDate`
- `dueTime`
- `isArchived`
- `note`
- `priority`
- `recurrence`
- `teamId`
- `assigneeId`
- `projectId`
- `boardColumnKey`
- `labels`
- `subtasks`

Datový model `TaskList` obsahuje:

- `id`
- `name`
- `isArchived`
- `isSystem`
- `teamId`
- `color`

### `taskStorage.ts`

Řeší lokální persistenci do `localStorage`.

Funkce:

- `loadTaskState()`
  Načte uložený stav nebo vrátí fallback.
- `saveTaskState(state)`
  Uloží sanitizovaný stav.

Důležité vlastnosti implementace:

- stav je ukládán pod klíčem `focus-todo-state`,
- při načtení probíhá validace shape objektů,
- systémové seznamy jsou automaticky doplněny,
- neplatné nebo zastaralé hodnoty se normalizují,
- taskům bez validního seznamu se přiřadí výchozí list,
- chybné recurrence, labely nebo subtasks jsou očištěny.

### `mockData.ts`

Definuje systémové a výchozí seznamy:

- `Dnes`
- `Důležité`
- `Plánované`
- `Vše`
- `Doručené`

Zároveň zavádí identifikátory:

- `FALLBACK_LIST_ID`
- `DEFAULT_TASK_LIST_ID`
- `TODAY_LIST_ID`
- `IMPORTANT_LIST_ID`
- `PLANNED_LIST_ID`

### `taskRecommendation.ts`

Jádro doporučovací a fokus logiky.

Definuje:

- doporučovací kontext,
- focus scope,
- score algoritmus,
- prioritizaci tasků,
- bucket logiku podle urgency a priority,
- důvody doporučení,
- progress focus scope.

Klíčové exporty:

- `getRecommendationContext`
- `getFocusScope`
- `getTaskScore`
- `getRecommendedTasks`
- `getFocusScopeTasks`
- `getFocusProgress`
- `getVisibleTasksForCurrentView`
- `isTaskInRecommendationContext`
- `getTaskRecommendationReasons`
- `getTaskReasons`
- `getPrimaryTimeStatus`
- `getRecommendationRank`

Pracuje s kategoriemi pohledu:

- `today`
- `planned`
- `important`
- `all`
- `user-list`

Používá bodování priority:

- `high = 50`
- `medium = 30`
- `low = 10`
- `none = 0`

Používá bodování urgency:

- `overdue = 80`
- `today = 50`
- `tomorrow = 20`
- `future = 5`
- `no_due_date = 0`

### `taskDailyOverview.ts`

Počítá denní přehledy:

- kolik tasků je na dnešek,
- kolik je důležitých,
- kolik je overdue,
- kolik je aktivních,
- které tasky vyžadují pozornost.

Exporty:

- `getDailyTaskStats`
- `getDailyAttentionTasks`

### `taskViews.ts`

Vrací:

- viditelné tasky pro list,
- archivované tasky pro list.

### `taskCounts.ts`

Počítá počty tasků podle seznamů.

### `listUtils.ts`

Pomocné funkce pro výběr cílového listu.

### `dateUtils.ts`

Základní práce s dnešním datem.

### `naturalLanguageTaskParser.ts`

Parser přirozeného vstupu pro tasky.

Umí rozpoznat:

- relativní data jako dnes, zítra, pozítří,
- názvy dnů v týdnu,
- absolutní datum,
- čas,
- části dne jako ráno, poledne, večer.

Vrací strukturu:

- `title`
- `dueDate`
- `dueTime`
- `message`
- `hasConflict`

Pokud je termín nejednoznačný, parser metadata nepoužije a vrátí konflikt.

## 8. Týmy a projekty

### `src/teams/teamTypes.ts`

Definuje:

- `Team`
- `TeamMember`
- `TeamInvite`

`Team` obsahuje:

- `id`
- `name`
- `color`
- `description`
- `ownerId`

### `src/teams/teamCounts.ts`

Počítá počty tasků podle týmů.

### `src/projects/projectTypes.ts`

Definuje:

- `ProjectStatus`
- `Project`
- `ProjectColumn`

`ProjectStatus`:

- `active`
- `paused`
- `completed`
- `archived`

### `src/supabase/teamApi.ts`

Klientská vrstva pro týmové operace nad Supabase.

Exporty:

- `loadUserTeams`
- `createTeamInSupabase`
- `updateTeamInSupabase`
- `loadTeamMembers`
- `inviteTeamMemberByEmail`
- `loadTeamInvites`
- `acceptPendingTeamInvites`
- `updateTeamMemberRole`
- `removeTeamMember`
- `deleteTeamInSupabase`

Co reálně dělá:

- načítá týmy přístupné uživateli,
- zakládá tým a automaticky zapisuje ownera jako člena s rolí `admin`,
- mění metadata týmu,
- používá RPC pro členy a pozvánky,
- při mazání týmu ručně odstraňuje navázané projektové sloupce, tasky, listy, projekty, pozvánky i členství.

### `src/supabase/projectApi.ts`

Klientská vrstva pro projekty a board sloupce.

Exporty:

- `DEFAULT_PROJECT_COLUMNS`
- `loadProjectsForTeams`
- `createProjectInSupabase`
- `updateProjectInSupabase`
- `deleteProjectInSupabase`
- `loadProjectColumns`
- `createProjectColumn`
- `updateProjectColumn`
- `archiveProjectColumn`
- `deleteProjectColumn`

Výchozí board sloupce:

- `todo`
- `doing`
- `review`
- `done`

Soubor zajišťuje:

- CRUD projektů,
- CRUD sloupců,
- doplnění výchozích sloupců pro nový projekt,
- mapování DB řádků na frontend typy.

## 9. Supabase integrace

Adresář `src/supabase/` sdružuje integraci na backend.

### `supabaseClient.ts`

Inicializuje Supabase klienta z proměnných:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Pokud nejsou nastavené, `supabase` je `null` a aplikace přechází do režimu bez cloud backendu.

### `AuthWidget.tsx`

UI vrstva pro autentizaci.

Režimy:

- `widget`
- `screen`

Umožňuje:

- přihlášení,
- registraci,
- odhlášení,
- informování o sync stavu.

### `cloudBackup.ts`

Mapování mezi lokálním stavem aplikace a cloudovou databází.

Exporty:

- `uploadLocalDataToSupabase`
- `replaceSupabaseData`
- `downloadSupabaseData`

Chování:

- při prvním uploadu kontroluje, zda cloud už neobsahuje data,
- při replace nejprve smaže cloudová data a nahraje nová,
- mapuje tasky, listy, labely, task-label vztahy a subtasks,
- skládá frontend state z více tabulek v Supabase.

Cloud tabulky, se kterými modul přímo pracuje:

- `task_lists`
- `tasks`
- `subtasks`
- `labels`
- `task_labels`

Navíc počítá s rozšířenými sloupci na task entitách:

- `team_id`
- `assignee_id`
- `project_id`
- `board_column_key`

### `adminApi.ts`

Vrstva pro globální správu uživatelů.

Exporty:

- `loadAppUsers`
- `updateGlobalUserRole`

Používá RPC funkce:

- `list_app_users`
- `update_global_user_role`

## 10. Databáze a SQL vrstva

Databázová vrstva je v repozitáři rozdělená do několika SQL souborů.

### A. `supabase/schema.sql`

Toto je základní schema, které explicitně definuje:

- `public.profiles`
- `public.task_lists`
- `public.tasks`
- `public.subtasks`
- `public.labels`
- `public.task_labels`

#### `profiles`

Účel:

- profil aplikace navázaný na `auth.users`,
- drží globální roli uživatele.

Sloupce:

- `id`
- `role`
- `created_at`

Role:

- `user`
- `admin`

#### `task_lists`

Účel:

- seznamy úkolů patřící uživateli.

Sloupce:

- `id`
- `owner_id`
- `name`
- `color`
- `is_archived`
- `created_at`
- `updated_at`

#### `tasks`

Účel:

- hlavní tabulka úkolů.

Sloupce definované v `schema.sql`:

- `id`
- `owner_id`
- `list_id`
- `title`
- `completed`
- `due_date`
- `due_time`
- `is_archived`
- `note`
- `priority`
- `recurrence`
- `created_at`
- `updated_at`

#### `subtasks`

Účel:

- podúkoly navázané na task.

Sloupce:

- `id`
- `owner_id`
- `task_id`
- `title`
- `completed`
- `position`
- `created_at`
- `updated_at`

#### `labels`

Účel:

- štítky patřící uživateli.

Sloupce:

- `id`
- `owner_id`
- `name`
- `color`
- `created_at`
- `updated_at`

Unikátní omezení:

- `unique (owner_id, name)`

#### `task_labels`

Účel:

- M:N vazba mezi taskem a labelem.

Sloupce:

- `task_id`
- `label_id`
- `owner_id`

Primární klíč:

- `(task_id, label_id)`

### B. Trigger a helper funkce v `schema.sql`

Definované funkce:

- `public.touch_updated_at()`
  Obecný trigger helper pro automatické přepisování `updated_at`.
- `private.is_global_admin()`
  Vrací, zda aktuální uživatel má v `profiles.role` hodnotu `admin`.

Triggery jsou založené pro:

- `task_lists`
- `tasks`
- `subtasks`
- `labels`

### C. RLS v `schema.sql`

Základní RLS pravidla povolují přístup:

- vlastníkovi dat,
- nebo globálnímu adminovi.

Politiky jsou definované pro:

- `profiles`
- `task_lists`
- `tasks`
- `subtasks`
- `labels`
- `task_labels`

### D. `supabase/fix-rls-policies.sql`

Tento skript rozšiřuje bezpečnostní model směrem k týmové spolupráci.

Obsahuje:

- znovuvytvoření `private.is_global_admin()`,
- granty na veřejné tabulky pro `authenticated`,
- nové RLS politiky pro `task_lists` a `tasks`,
- reference na `private.is_team_member(team_id)`.

Zásadní rozdíl proti základnímu schématu:

- `task_lists` a `tasks` už nejsou čistě owner-only,
- nově mohou být přístupné i přes členství v týmu,
- skript počítá se sloupcem `team_id`.

### E. `supabase/global-admin-user-management.sql`

Tento skript přidává RPC pro globální administraci uživatelů.

Definuje:

- `public.list_app_users()`
- `public.update_global_user_role(target_user_id uuid, new_role text)`

Vlastnosti:

- obě funkce jsou `security definer`,
- přístup mají jen `authenticated`,
- samotná logika navíc uvnitř vynucuje, že akci může provést jen globální admin,
- při odebrání role admin kontroluje, aby v aplikaci zůstal alespoň jeden globální admin.

## 11. Důležitá databázová poznámka ke skutečnému stavu repozitáře

Aktuální frontend a Supabase klientské API pracují s širším datovým modelem, než jaký je explicitně definovaný v `supabase/schema.sql`.

Frontend kód přímo očekává:

- `task_lists.team_id`
- `tasks.team_id`
- `tasks.assignee_id`
- `tasks.project_id`
- `tasks.board_column_key`
- tabulky `teams`, `team_members`, `team_invites`, `projects`, `project_columns`
- RPC funkce `get_team_members`, `get_team_invites`, `invite_team_member_by_email`, `accept_pending_team_invites`, `update_team_member_role`, `remove_team_member_from_team`
- helper `private.is_team_member(team_id)`

Tyto entity a funkce jsou v aktuálně dostupných SQL souborech repozitáře:

- referované,
- nebo předpokládané,
- ale jejich plná definice není ve zkontrolovaných souborech explicitně obsažená.

Praktický závěr:

- základ task/list/label model je v repu popsaný přímo,
- globální admin model je v repu popsaný přímo,
- týmový a projektový datový model je ve frontendu aktivně používaný,
- ale kompletní migrační SQL pro tuto část není v tomto okamžiku v repu kompletně dohledatelné.

To je důležité hlavně pro:

- onboarding dalšího vývojáře,
- ruční rekonstrukci databáze,
- audit migrací,
- nasazení nového prostředí od nuly.

## 12. Jak funguje tok dat v aplikaci

### Lokální režim

1. `App.tsx` načte stav přes `loadTaskState()`.
2. Stav se drží v React state.
3. Každá změna tasků nebo listů se ukládá přes `saveTaskState()`.
4. Layout se přepočítává přes `useAppLayout()`.
5. UI vykresluje `AppShell` nebo `FocusView`.

### Cloud režim se Supabase

1. `supabase.auth.getSession()` zjistí session.
2. `ensureUserProfile()` vytvoří nebo načte profil v `profiles`.
3. `downloadSupabaseData()` stáhne cloudový stav.
4. Data se promítnou do root state.
5. Další změny vytváří snapshot.
6. Pokud se snapshot změní, `replaceSupabaseData()` po krátkém debounce uloží nový stav do cloudu.

### Týmový režim

1. Po přihlášení se zavolá `loadUserTeams()`.
2. Aktivní workspace filtruje tasky a listy podle `teamId`.
3. `AppShell` umožňuje spravovat členy, pozvánky a projekty.
4. Projektové boardy používají `projectApi.ts`.

## 13. Uživatelské funkce aplikace

Podle aktuálního kódu aplikace umí:

- vytvářet a spravovat task listy,
- vytvářet, upravovat, archivovat, mazat a obnovovat tasky,
- pracovat s due date a due time,
- používat priority,
- používat recurrence,
- používat poznámky,
- používat subtasks,
- používat štítky,
- doporučovat další tasky podle urgency a priority,
- spouštět focus session na vybraný task,
- zobrazovat dashboard a check-in přehled,
- filtrovat tasky přes systémové pohledy,
- pracovat v osobním nebo týmovém workspace,
- vytvářet týmy,
- zvát členy týmu,
- měnit role členů týmu,
- vytvářet projekty,
- používat projektové sloupce a board flow,
- používat cloud sync,
- přihlašovat a registrovat uživatele,
- používat globální administraci rolí,
- plánovat a přijímat notifikace,
- běžet jako web, PWA i Android wrapper.

## 14. Native a mobilní část

### `capacitor.config.ts`

Konfigurace:

- `appId = com.donext.app`
- `appName = DoNext`
- `webDir = dist`
- Android background color
- konfigurace ikon pro `LocalNotifications`

### `android/`

Obsahuje plný Android projekt vygenerovaný a synchronizovaný přes Capacitor, včetně:

- Gradle konfigurace,
- `MainActivity.java`,
- `AndroidManifest.xml`,
- resources pro ikony a splash screen,
- test skeletonů.

## 15. Struktura projektu na vysoké úrovni

### Konfigurace

- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `vercel.json`
- `capacitor.config.ts`

### Frontend

- `src/main.tsx`
- `src/App.tsx`
- `src/styles.css`
- `src/layout/*`
- `src/tasks/*`
- `src/focus/*`
- `src/notifications/*`
- `src/supabase/*`
- `src/teams/*`
- `src/projects/*`
- `src/pwa/*`

### Public assets

- `public/sw.js`
- `public/manifest.webmanifest`
- `public/icons/*`

### Backend a DB skripty

- `supabase/schema.sql`
- `supabase/fix-rls-policies.sql`
- `supabase/global-admin-user-management.sql`

### Mobilní část

- `android/*`

## 16. Architektonické silné stránky

- Jasné oddělení root orchestrace (`App.tsx`) a layout vrstvy (`AppShell.tsx`).
- Samostatná task business logika v `src/tasks/`.
- Jasně oddělené Supabase API moduly podle domén.
- Kombinace local-first chování a cloud syncu.
- Připravenost na web i Android runtime.
- RLS a role model pro citlivější přístup k datům.

## 17. Rizika a technický dluh viditelný z repozitáře

- Kompletní týmové a projektové SQL migrace nejsou v aktuálně zkontrolovaných SQL souborech plně dohledatelné.
- `AppShell.tsx` je velmi rozsáhlý a nese velkou část UI orchestrace.
- V několika souborech jsou vidět známky rozbitých českých znaků, tedy dřívější encoding mismatch.
- Datový model ve frontendu už je širší než základní `schema.sql`, což zvyšuje riziko driftu mezi kódem a databází.

## 18. Doporučení pro další údržbu

- Doplnit chybějící migrace pro týmové a projektové tabulky do repozitáře.
- Udržovat jednoznačný zdroj pravdy pro kompletní DB schema.
- Postupně rozdělovat velké UI bloky z `AppShell.tsx`.
- Opravit encoding problém u českých textů.
- Přidat technickou dokumentaci k workflow týmů, boardů a globální administrace.

## 19. Shrnutí

`DoNext` je pokročilá produktivní aplikace, která už není jen jednoduchý todo list. Aktuální kódová základna zahrnuje:

- osobní task manager,
- focus assistant,
- denní prioritizační logiku,
- týmové workspacy,
- projektové boardy,
- Supabase auth a sync,
- globální admin vrstvu,
- PWA i Android shell.

Repozitář dobře popisuje frontendovou architekturu a základní Supabase model. Zároveň je z aktuálního stavu patrné, že týmová a projektová databázová část už v aplikaci existuje a používá se, ale její kompletní SQL definice není v repu v této chvíli soustředěná na jednom plně dohledatelném místě.
