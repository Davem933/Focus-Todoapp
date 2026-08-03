# QR sdílení úkolu — design spec

Datum: 2026-08-03

## Cíl

Umožnit uživateli sdílet náhled jednoho úkolu s kýmkoliv (i bez účtu v appce) přes QR kód. Uživatel klikne na ikonku QR kódu v detailu úkolu, appka vygeneruje QR kód, který lze naskenovat/sdílet a vede na veřejnou, read-only stránku s náhledem daného úkolu.

## Rozsah

- Sdílení jednoho konkrétního úkolu (ne celého seznamu/projektu).
- Veřejný náhled je **pouze pro čtení** — žádné akce (zaškrtnutí, editace) bez přihlášení.
- Funguje pro úkoly v `DetailPanel` (běžné, neprojektové úkoly) i pro úkoly editované přes `ProjectCardComposerModal` (karty na nástěnce projektu) — všude, kde je úkol editovatelný.
- Sdílení vyžaduje, aby byl úkol synchronizovaný do Supabase (cloud sync). Pokud uživatel cloud sync nemá zapnutý/přihlášený, QR sdílení není k dispozici (viz Edge cases).

Mimo rozsah (YAGNI, nepřidávat):
- Sdílení celého seznamu/projektu/nástěnky.
- Časové omezení platnosti odkazu (expirace).
- Jakákoliv veřejná akce (zaškrtávání subtasků atd.) bez přihlášení.
- Sledování/analytika zobrazení (kdo/kolikrát odkaz otevřel).

## Bezpečnostní model

- Nová sloupec `tasks.share_token uuid` (nullable, `UNIQUE`). `NULL` = úkol není sdílený.
- Token je náhodný (`crypto.randomUUID()`), generuje se klientsky při prvním otevření QR popoveru a rovnou se uloží do řádku úkolu v Supabase (přímý `update`, nečeká se na běžný sync cyklus).
- Přístup pro nepřihlášené (`anon`) uživatele jde výhradně přes jednu RPC funkci `get_shared_task(p_token uuid)`:
  - `SECURITY DEFINER`, `GRANT EXECUTE ... TO anon`.
  - Vrátí task (title, note, dueDate, dueTime, priority, completed, subtasks) + jméno assignee + název projektu/týmu **pouze pokud** existuje řádek s `share_token = p_token`.
  - Když token neexistuje / byl zrušen, vrátí prázdný výsledek (žádná chyba, která by prozrazovala existenci/neexistenci úkolu jinak než "nic tu není").
  - Žádné jiné anon SELECT politiky na `tasks`/`subtasks`/`teams`/`projects` se nepřidávají — RPC je jediné řízené dveře k veřejným datům, což je snazší auditovat než plošné RLS výjimky pro `anon` napříč tabulkami.
- Zrušení sdílení (`share_token = NULL`) jde přes existující autentizovanou update cestu (owner nebo team member dle současných RLS pravidel na `tasks` — žádná nová politika není potřeba, protože jde o standardní autentizovaný update vlastního/týmového úkolu).
- Opětovné otevření QR popoveru pro úkol se stále platným tokenem zobrazí **stejný** QR/odkaz (žádná rotace při každém otevření). Nový token vznikne jen po explicitním "Zrušit sdílení" + opětovném otevření.

## Datový tok

1. Uživatel otevře detail úkolu (`DetailPanel` nebo `ProjectCardComposerModal`) a klikne na ikonu QR kódu.
2. Otevře se `ShareTaskPopover`:
   - Pokud `task.shareToken` existuje → rovnou zobrazí QR + link.
   - Pokud ne → zavolá `supabase.from('tasks').update({ share_token: crypto.randomUUID() }).eq('id', task.id)`, uloží token do lokálního task state (aby se projevil i v UI/localStorage), pak zobrazí QR + link.
3. QR kód se generuje klientsky (`qrcode` npm balíček) z URL `${window.location.origin}/share/${shareToken}`.
4. Popover nabízí: náhled QR obrázku, tlačítko "Kopírovat odkaz", tlačítko "Zrušit sdílení".
5. "Zrušit sdílení" → `update({ share_token: null })`, vymaže token z lokálního state, popover se vrátí do stavu "negenerováno".
6. Kdokoliv otevře `/share/<token>` (i bez přihlášení) → `SharedTaskView` zavolá `supabase.rpc('get_shared_task', { p_token: token })` přes anon klienta.
   - Výsledek existuje → zobrazí read-only náhled.
   - Výsledek prázdný → zobrazí stav "Odkaz není platný nebo bylo sdílení zrušeno."

## Komponenty

### DB (Supabase migrace)
- `ALTER TABLE tasks ADD COLUMN share_token uuid UNIQUE;`
- `CREATE FUNCTION get_shared_task(p_token uuid) RETURNS ... SECURITY DEFINER ...`
- `GRANT EXECUTE ON FUNCTION get_shared_task(uuid) TO anon;`

### `src/tasks/taskTypes.ts`
- Přidat `shareToken: string | null` do `Task`.

### `src/supabase/taskShareApi.ts` (nový soubor)
- `generateShareToken(taskId: string): Promise<string>` — update + vrátí token.
- `revokeShareToken(taskId: string): Promise<void>` — update na null.
- `fetchSharedTask(token: string): Promise<SharedTaskPreview | null>` — volá RPC, používá anon klienta (stejný `supabaseClient.ts` export, žádný přihlášený session není potřeba, RLS/RPC to řeší samo).

### `src/layout/ShareTaskPopover.tsx` (nový soubor)
- Props: `task`, `onTokenChange(taskId, token | null)`.
- Renderuje QR (přes `qrcode` balíček, vygeneruje data URL/SVG na klientovi), odkaz s copy-to-clipboard, revoke tlačítko.
- Používá se z `DetailPanel.tsx` i z `ProjectCardComposerModal` (uvnitř `AppShell.tsx`) — ikonka QR kódu v headeru/toolbar detailu úkolu otevře tento popover.

### `src/layout/SharedTaskView.tsx` (nový soubor)
- Samostatná, na auth/team/localStorage nezávislá stránka. Načte token z URL, zavolá `fetchSharedTask`, zobrazí read-only kartu úkolu (title, note, due date, priority, stav, subtasky se stavem, assignee jméno, projekt/tým název) nebo chybový stav.
- Vlastní jednoduchý layout/styl, nepoužívá `AppShell`.

### `src/main.tsx` (routing hook)
- Před mountem hlavní `App` komponenty zkontrolovat `window.location.pathname`. Pokud začíná `/share/`, vyrenderovat `SharedTaskView` s tokenem z path místo celé appky (žádná potřeba auth bootstrap, cloud sync efektů apod.).

## Error handling

- Update tokenu selže (offline/network) → popover zobrazí chybovou hlášku, token se needitovaný neuloží do lokálního state, uživatel může zkusit znovu.
- `get_shared_task` vrátí prázdno (neplatný/zrušený token, nebo úkol byl mezitím smazán) → jasná zpráva na `/share/:token`, žádná stack trace / syrová DB chyba.
- Úkol bez cloud syncu (žádný `ownerId`/nikdy nenahráno do Supabase) → QR ikonka v popoveru rovnou informuje, že sdílení vyžaduje přihlášení a cloud synchronizaci, namísto tichého selhání při update.

## Testing

V repu není testovací framework (žádný `test`/`*.test.*`), takže ověření je manuální přes `npm run dev` + prohlížeč:
- Vygenerovat QR pro běžný úkol (DetailPanel) i pro úkol na nástěnce projektu (ProjectCardComposerModal), ověřit že token přetrvá po refresh (uložen v Supabase).
- Otevřít vygenerovaný `/share/<token>` v anonymním okně (bez přihlášení) → ověřit správný obsah a že žádná editace není možná.
- Zrušit sdílení → ověřit, že stejný odkaz už vrátí "neplatný" stav.
- Zkusit náhodný/neexistující token na `/share/` → ověřit korektní chybový stav bez úniku informací.
- Zkontrolovat, že `get_shared_task` negrantuje víc než zamýšlená pole (žádné emaily, žádná jiná soukromá pole týmu).

## Poznámka k nasazení

Migrace (`ALTER TABLE` + nová `SECURITY DEFINER` funkce + `GRANT` pro `anon`) jde přímo proti živému Supabase projektu — je potřeba explicitní schválení uživatele před spuštěním `apply_migration`, stejně jako review vygenerovaného SQL před aplikací (viz `CLAUDE.md` poznámka o `schema.sql` being stale a nutnosti kontrolovat live RLS/schema přes MCP nástroje).
