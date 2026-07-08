# PROJECT_CONTEXT

## Strucny popis aplikace
Focus Todoapp je produktivni task manager pro osobni planovani i tymovou spolupraci. Kombinuje task listy, detail tasku, focus mode, dashboard/check-in prehledy a projektove kanban boardy s tymy a cloud syncem.

## Technologie a frameworky
- React 19
- TypeScript
- Vite 7
- Supabase (`@supabase/supabase-js`) pro auth, cloud sync a data API
- Capacitor (`@capacitor/core`, `@capacitor/app`, `@capacitor/local-notifications`, `@capacitor/android`) pro mobilni shell a notifikace
- Lucide React pro ikonky
- Vercel pro produkcni deploy
- PWA prvky: `public/sw.js`, `public/manifest.webmanifest`, `src/pwa/registerServiceWorker.ts`

## Aktualni architektura
- `src/App.tsx`
  Hlavni state orchestrator aplikace. Drzi tasky, listy, tymy, auth/session stav, local storage, route state a cloud sync logiku. Predava data a callbacky do `AppShell` nebo `FocusView`.
- `src/layout/AppShell.tsx`
  Nejvetsi UI orchestrace. Resi shell layout, prepinani panelu, dashboard/check-in overlaye, tymy, projekty, board detail, modal pro board kartu a velkou cast interakci kolem projektu/boardu.
- `src/layout/panels/*`
  Rozdeleni hlavni task UX:
  - `SidebarPanel.tsx`: navigace seznamu / workspace kontext
  - `ListPanel.tsx`: seznam tasku, filtry, daily centrum, task context menu
  - `DetailPanel.tsx`: detail tasku, subtasks, labels, due date, assignee, recurrence
- `src/tasks/*`
  Domenova vrstva tasku:
  - `taskTypes.ts`: hlavni typy
  - `taskStorage.ts`: load/save/sanitize local state
  - `taskRecommendation.ts`: focus scope, doporuceni, scoring
  - `taskDailyOverview.ts`: dashboard/check-in agregace
  - `taskViews.ts`: filtrovani tasku pro ruzne pohledy
  - `mockData.ts`, `dateUtils.ts`, `listUtils.ts`, `taskCounts.ts`
- `src/supabase/*`
  Integrace se Supabase:
  - `supabaseClient.ts`: klient
  - `cloudBackup.ts`: download/upload/replace lokalniho stavu
  - `teamApi.ts`: tymy, clenove, invite flow
  - `projectApi.ts`: projekty a board sloupce
  - `AuthWidget.tsx`: auth UI
- `src/focus/FocusView.tsx`
  Focus mode na jeden task.
- `src/notifications/taskNotifications.ts`
  Lokalni notifikace a synchronizace reminderu.
- `src/styles.css`
  Prakticky cely styling aplikace.

## Dulezite soubory a jejich role
- `src/App.tsx`: root state, route syncing, notification syncing, task update normalization
- `src/layout/AppShell.tsx`: projekty, boardy, modal pro karty, overlaye, column menu, drag and drop UI
- `src/layout/panels/DetailPanel.tsx`: detail tasku a editace task vlastnosti
- `src/layout/panels/ListPanel.tsx`: hlavni task list experience
- `src/supabase/projectApi.ts`: CRUD pro projekty a sloupce
- `src/supabase/cloudBackup.ts`: mapovani task/list dat mezi lokalnim stavem a Supabase
- `src/tasks/taskRecommendation.ts`: doporuceni tasku a focus logika
- `src/tasks/taskStorage.ts`: normalizace local persistence
- `supabase/schema.sql`: DB schema pro task/list/subtask/labels vrstvu
- `package.json`: skripty pro build/deploy/android
- `.vercel/project.json`: link na Vercel projekt

## Hotove funkce
- Task listy a task detail s:
  - title, note, due date/time
  - priority
  - recurrence
  - labels
  - subtasks
  - archive/delete/undo
- Focus mode s doporucenym dalsim taskem
- Dashboard overlay a check-in overlay
- Theme toggle (dark/light)
- Tymove prostory a project boardy
- Projektove boardy s vlastnimi sloupci
- Drag and drop mezi board sloupci
- Logika sync mezi `boardColumnKey` a `completed`
- Animace pri presunu karty mezi sloupci
- Menu sloupce (3 tecky) s akcemi `Archivovat` a `Smazat`
- Zavirani sloupcoveho menu pri kliknuti mimo
- Modal pro create/edit board tasku
- Supabase cloud sync
- Capacitor/local notifications
- Vercel produkcni deploy script

## Rozpracovane funkce
- Skutecne oddeleni `Archivovat` vs `Smazat` pro board sloupce
  - aktualne obe akce vedou prakticky k odstraneni sloupce z boardu
- Lepsi release workflow na GitHubu
  - README je aktualizovane na GitHubu
  - GitHub Release sekce zatim nebyla vytvorena automaticky
- Mozne dalsi zlepseni README / changelog / release procesu

## Zname bugy a problemy
- `Archivovat` a `Smazat` u board sloupce se aktualne chovaji skoro stejne, protoze model sloupce nema samostatny archived stav.
- V `src/layout/AppShell.tsx` jsou na nekolika mistech videt rozbite ceske znaky (mojibake) z drivejsich editaci / encoding mismatch. To je potreba opravit opatrne, protoze soubor je velky a cast textu uz je poskozena.
- Build projde, ale Vite hlasi velky chunk nad 500 kB.
- GitHub CLI `gh` nebylo v predchozi konverzaci validne prihlasene (`gh auth status` hlasil invalid token), proto nesel agenticky dodelat GitHub Release.

## Zmeny z aktualni konverzace (2026-07-08)
- Oprava stejne sirky boxu tymu na strance Tymy (`.teams-overview__team-list`):
  - Sjednocena sirka karty tymu bez ohledu na delku nazvu i na to, jestli tym vlastnis (drive tlacitko smazat zabiralo flex misto jen u vlastnenych tymu a delalo je uzsi).
  - Tlacitko smazat tymu je nyni `position: absolute` presunute pres kartu, karta ma vzdy `width: 100%` radku.
  - Zmensen padding/min-height karty tymu (kompaktnejsi vzhled).
  - Pridan `text-overflow: ellipsis` na nazev tymu, aby se dlouhy nazev orizl "..." misto zalamovani/preteceni.
  - Ikona smazani tymu zmenena z kosiku (`Trash2`) na krizek (`X`), cervena barva pri hoveru na tlacitko.
  - Zmeny v `src/layout/AppShell.tsx` (kolem radku 1298-1329) a `src/styles.css` (kolem radku 8742-8800).
- `npx tsc --noEmit` prochazi bez chyb po vsech zmenach.
- Zmeny jsou zatim nekomitnute (working tree), nejsou nasazene na Vercel.

## Dulezita rozhodnuti z teto konverzace
- Board tasky maji nativni drag and drop mezi sloupci.
- Presun do `done` ma task dokoncit; presun z `done` ma task znovu otevrit.
- Rucni `completed=true` ma task presunout do `done`; znovuotevreni ma vratit task do `todo`, pokud byl v `done`.
- Karta na boardu uz nema zobrazovat nazev dalsiho sloupce.
- Menu sloupce je vpravo nahore jako ikona 3 tecek a ma se zavirat kliknutim mimo.
- U modal okna board tasku ma backdrop zustavat tmavy i pri hoveru.
- README byl rozsireny o sekce popisujici aplikaci a stack a byl pushnut na GitHub.
- Projekt byl nasazen na GitHub i Vercel.

## Jak aplikaci spustit
- Instalace:
  - `npm install`
- Lokalni web dev server:
  - `npm run dev`
- Android sync:
  - `npm run android:sync`
- Otevreni Android projektu:
  - `npm run android:open`

## Jak aplikaci testovat / buildovat
- TypeScript check:
  - `npx tsc --noEmit`
- Produkcni build:
  - `npm run build`
- Vercel deploy:
  - `npm run deploy:vercel`

## Posledni dulezite deployment info
- GitHub repo: `Davem933/Focus-Todoapp`
- Posledni pushnuty README commit z konverzace: `415b863`
- Predchozi feature commit s board zmenami: `36afc61`
- Produkcni URL z predchozi konverzace: `https://focus-todo-app-sigma.vercel.app`
