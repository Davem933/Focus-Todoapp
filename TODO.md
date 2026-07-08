# TODO

## Priorita 1
- Opravit encoding/mojibake texty v `src/layout/AppShell.tsx` a dalsich souborech s ceskymi stringy.
- Rozdelit chovani `Archivovat` vs `Smazat` u board sloupcu tak, aby archivace mela vlastni perzistentni stav.
- Projit board sloupcove menu UX a doplnit zavirani i pri `Escape`, pokud uz neni.

## Priorita 2
- Zkontrolovat, zda se vsechny board/task zmeny korektne syncuji do Supabase i po reloadu.
- Dopsat migration/schema podporu pro `project_columns` archived stav, pokud zatim chybi.
- Opravit README / docs tak, aby odpovidaly realnemu deploy a release procesu.
- Doresit GitHub Release workflow po obnoveni `gh` auth nebo pres jiny nastroj.

## Priorita 3
- Zmensit hlavni frontend chunk a zvazit code-splitting pro velke overlaye nebo projektovou cast.
- Dopsat lehky smoke test checklist pro board flow:
  - create card
  - edit card
  - drag task
  - archive/delete column
  - close menu outside click
- Zkontrolovat, zda modal a overlaye maji konzistentni backdrop styly vs global `button:hover` styly.

## Male konkretni tasky vhodne pro Codex
- Najit a opravit vsechny rozbite znaky typu `Otev??t`, `Zav??t`, `Nem?` v `src/layout/AppShell.tsx`.
- Pridat archived flag do modelu `ProjectColumn` a Supabase API vrstvy.
- Upravit `archiveProjectColumn` tak, aby pouze archivovala sloupec misto delete.
- Pridat filtraci archivovanych sloupcu v `loadProjectColumns`.
- Dopsat klavesove zavreni sloupcoveho menu pres `Escape`.
- Dopsat / zkontrolovat README screenshot nebo release docs.
- Zkontrolovat, ze backdrop modalu board tasku je konzistentni i v light theme.

## Co zatim nedelat
- Nedelat velky refactor `AppShell.tsx` bez jasneho planu a mensich kroku.
- Nedotykat se nahodne existujicich nezdokumentovanych stringu / textu bez kontroly encodingu a diffu.
- Nezavadet automaticky GitHub Release workflow, dokud nebude vyresena autentizace nebo potvrzena preferovana cesta.
- Neprovadet destruktivni git operace (`reset --hard`, revert cizich zmen apod.).
