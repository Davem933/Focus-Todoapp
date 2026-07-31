# Smart Quick Capture (hlasové & textové zadávání úkolů) — Design

Datum: 2026-07-31

> **Dodatek (implementace):** Během implementace se ukázalo, že testovací Gemini
> klíče měly free-tier kvótu 0 (účtové/regionální omezení, ne chyba klíče) a
> Grok (x.ai) vyžaduje kredit předem koupený. Provider byl proto přepnut na
> **Groq** (`console.groq.com`, model `llama-3.1-8b-instant`) — skutečně
> bezplatný bez nutnosti platby. Veškerá zmínka "Gemini"/`geminiService.ts`
> níže odpovídá původnímu návrhu; ve výsledném kódu je modul
> `src/tasks/groqService.ts` s ekvivalentním rozhraním (`isGroqConfigured`,
> `parseVoiceInputWithGroq`), env proměnná `VITE_GROQ_API_KEY`.

## Cíl

Uživatel klikne na plovoucí tlačítko mikrofonu, namluví (nebo napíše) požadavek v češtině
("Připomeň mi zítra v 10 ráno poslat fakturu Petrovi a dej tomu vysokou prioritu") a aplikace
z toho vytvoří strukturovaný úkol — s možností úpravy před uložením. Řešení je 0 Kč: běží čistě
na straně klienta (Web Speech API + Gemini free tier), bez vlastního backendu.

## Rozsah

- Nový, samostatný vstupní bod (FAB), nenahrazuje stávající rychlý composer v `ListPanel`/`TableToolbar`.
- Cílí na běžné (ne-projektové) úkoly vytvářené přes `handleCreateTask` v `src/App.tsx:827`.
- Nerozšiřuje datový model (`Task`) — mapuje se na existující pole.

## Architektura / moduly

- **`src/tasks/geminiService.ts`** — izolovaný modul pro volání Gemini REST API
  (`gemini-1.5-flash`, `generateContent`). Sestaví system prompt s aktuálním datem/časem,
  vynutí striktní JSON výstup (`responseMimeType: application/json`), provede vlastní
  runtime validaci výstupu (bez nové závislosti na zod) s bezpečnými výchozími hodnotami.
  Vrací `{ title, dueDate, dueTime, priority, assigneeName }`. Priority hodnoty jsou přímo
  `"none"|"low"|"medium"|"high"` (žádné mapování Urgent/Normal — Gemini je instruován vracet
  rovnou tyto hodnoty). Bez pole `status` (appka ho pro běžné úkoly nemá kam uložit).
- **`src/layout/quickCapture/useSpeechRecognition.ts`** — hook nad
  `window.SpeechRecognition`/`webkitSpeechRecognition`, `lang="cs-CZ"`, `interimResults=true`.
  Stavy: `unsupported | idle | listening | denied | error`. Vrací živý přepis a `start()/stop()`.
- **`src/layout/quickCapture/QuickCaptureFab.tsx`** — plovoucí tlačítko (ikona mikrofonu,
  lucide-react), fixní pozice, vykreslené globálně v `AppShell.tsx`. Otevírá modal.
- **`src/layout/quickCapture/QuickCaptureModal.tsx`** — Radix Dialog se dvěma fázemi:
  1. **capture** — jedno editovatelné textové pole (plní ho jak diktát, tak ruční psaní),
     tlačítko Nahrávat/Zastavit s pulzující ikonou při poslechu, tlačítko "Zpracovat".
  2. **preview** — editovatelný náhled úkolu (název, datum, čas, select priority, select
     assignee) s tlačítky "Přidat úkol" / "Zpět" / "Zrušit". Loading spinner mezi fázemi
     během volání Gemini.

## Data flow

1. FAB → modal, fáze *capture*.
2. Nahrávání vyplňuje textové pole živě; uživatel může i jen napsat text ručně.
3. "Zpracovat" → spinner → `geminiService.parseVoiceInput(text, new Date())`.
4. **Úspěch:** JSON zvalidován. Pokud `assigneeName` vyplněné a existuje `activeTeamId`,
   načtou se `loadTeamMembers(activeTeamId)` a provede se fuzzy match (case-insensitive,
   bez diakritiky, proti `nickname` i lokální části emailu) → předvyplní se `assigneeId`
   v náhledu (uživatel ho může změnit/zrušit, nikdy se needituje bez potvrzení).
5. **Selhání** (chybí `VITE_GEMINI_API_KEY`, síť, kvóta, neplatný JSON): tichý fallback —
   text se zpracuje přes existující offline `parseTaskInput` (`src/tasks/naturalLanguageTaskParser.ts`),
   zobrazí se informační (ne chybová) hláška "AI zpracování nedostupné, použit základní
   rozpoznávač data/času", přejde se rovnou do fáze *preview* s tím, co offline parser
   vytáhl (priorita `none`, assignee prázdné).
6. V *preview* klik na "Přidat úkol" → `onCreateTask(title, { dueDate, dueTime, priority,
   assigneeId, teamId: activeTeamId })` → modal se zavře, krátká potvrzovací zpráva.

## Chybové stavy

- Web Speech API nepodporováno → tlačítko Nahrávat skryté/disabled s tooltipem, zůstává jen
  textové pole + Zpracovat.
- Zamítnutý přístup k mikrofonu (`onerror === "not-allowed"`) → inline hláška, fallback na
  textové pole.
- Chybějící API klíč → detekováno předem v `geminiService`, rovnou padá do offline fallbacku
  bez zbytečného síťového volání.
- Gemini vrátí neplatný/neúplný JSON → považováno za selhání → offline fallback (bod 5).

## Konfigurace

- `VITE_GEMINI_API_KEY` v `.env.local` (negitovaný), placeholder přidán do `.env.example`.
- Klíč je čitelný v built JS bundlu (čistě frontend app, žádný proxy backend) — vědomě
  přijaté riziko pro 0 Kč / bez-backendové řešení (odsouhlaseno uživatelem).

## Testování

V repu není test framework (žádný `*.test.*`, žádný test script) — ověření proběhne ručně
přes dev server v prohlížeči: fallback textové pole (lze i bez mikrofonu/HTTPS), happy-path
s Gemini (po doplnění klíče), a offline fallback (dočasně neplatný klíč).
