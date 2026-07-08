# HANDOFF_PROMPT

Pracuji v repozitari `C:\Users\David\Documents\focus to do list`.

Nejdriv si precti soubory:
- `PROJECT_CONTEXT.md`
- `TODO.md`
- pripadne aktualni `README.md`

Kontext:
- Jde o React + TypeScript + Vite task manager s focus modem, dashboardem, tymy a projektovymi kanban boardy.
- Nedavno se doplnilo drag and drop mezi board sloupci, animace presunu karet, menu sloupce (3 tecky), zavirani menu po kliknuti mimo a opravy modal backdropu.
- README uz byl aktualizovan a pushnut na GitHub.
- Produkcni deploy uz probehl na Vercel.

Dulezite:
- Neprepisuj nebo nerevertuj existujici zmeny bez explicitniho duvodu.
- Postupuj po malych bezpecnych krocich.
- Pokud budes upravovat `src/layout/AppShell.tsx`, davej velky pozor na encoding stringu, protoze soubor ma misty rozbite ceske znaky.
- Pokud budes resit sloupce boardu, pocitej s tim, ze `Archivovat` a `Smazat` se ted chovaji skoro stejne a je potreba zavest skutecny archived stav.

Doporuceny prvni krok:
1. Otevri `PROJECT_CONTEXT.md` a `TODO.md`.
2. Zkontroluj `git status --short --branch`.
3. Vyber nejvyssi prioritu z `TODO.md` a pokracuj implementaci.

Pokud budes potrebovat nasadit nebo pushnout zmeny:
- build: `npm run build`
- typecheck: `npx tsc --noEmit`
- deploy: `npm run deploy:vercel`

Pokud budes pracovat s GitHub Release, pocitej s tim, ze v minule konverzaci nebyl `gh` validne prihlaseny.
