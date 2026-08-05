# Export dat dashboard grafů — Design

Status: approved, ready for implementation plan.

## Why

Uživatel chce exportovat data zobrazená v grafových widgetech dashboardu (viz `docs/superpowers/specs/2026-08-05-clickup-dashboard-design.md` a `docs/superpowers/specs/2026-08-05-dashboard-widgets-round2-design.md`) do JSON nebo Excelu, pro další zpracování mimo appku.

## Scope decisions (from brainstorming)

- **Které widgety**: všech 6 grafových widgetů — Priority, Assignee Pie, Assignee Bar, Štítky, Nástěnka, Vytížení. Stats (počítadla) a Nadcházející úkoly (seznam úkolů) export nedostanou — nemají tvar rozpadu kategorie→počet.
- **Ovládání**: tlačítka v kebab menu widgetu ("Exportovat jako JSON", "Exportovat jako Excel"), vedle existujícího "Skrýt widget".
- **Kebab menu viditelnost mimo edit mód**: kebab menu se dosud zobrazovalo jen v edit módu. Rozšiřuje se: zobrazí se, pokud je `isEditMode` **nebo** widget má co exportovat. "Skrýt widget" zůstává jen v edit módu (mění rozvržení, které by se v read módu nemělo měnit); export je dostupný vždy, protože je to čtecí akce nezávislá na režimu úprav.
- **Formát Excelu**: skutečný `.xlsx` soubor přes novou závislost `xlsx` (SheetJS), ne CSV.
- **Normalizovaný tvar dat**: všech 6 widgetů exportuje stejný tvar řádků `{ Kategorie: string; Počet: number }[]` — sjednocuje odlišná vnitřní pojmenování (`label`/`name`/`priority` apod.) do jednoho čitelného formátu pro export.

## Architecture

- `src/dashboard/dashboardExport.ts` (nový) — dvě čisté funkce bez závislosti na Reactu:
  - `exportRowsAsJson(rows: ExportRow[], filename: string)`: `JSON.stringify(rows, null, 2)` → `Blob` → dočasný `<a download>` element → `URL.revokeObjectURL` po kliknutí.
  - `exportRowsAsXlsx(rows: ExportRow[], filename: string)`: `XLSX.utils.json_to_sheet(rows)` → `XLSX.utils.book_new()` + `book_append_sheet(wb, ws, "Data")` → `XLSX.writeFile(wb, filename + ".xlsx")` (SheetJS `writeFile` v prohlížeči sám spustí download, žádný ruční Blob).
  - `ExportRow = { Kategorie: string; Počet: number }`.
- `src/dashboard/priorityBreakdown.ts` (nový, extrakce z `PriorityBreakdownWidget.tsx`) — `getPriorityBreakdown(tasks: Task[]): PriorityBreakdownEntry[]` stejným vzorem jako `getLabelBreakdown`/`getProjectBreakdown`/`getAssigneeBreakdown`. `PriorityBreakdownWidget.tsx` upraven, aby tuto funkci importoval místo inline výpočtu (žádná změna chování/vzhledu grafu).
- `src/dashboard/DashboardWidget.tsx`:
  - Nový volitelný prop `exportRows?: ExportRow[]`.
  - Kebab trigger tlačítko se zobrazí, pokud `isEditMode === true` **nebo** `exportRows` není `undefined`.
  - Menu obsah: `"Skrýt widget"` renderuje se jen když `isEditMode`. `"Exportovat jako JSON"` a `"Exportovat jako Excel"` renderují se vždy, když `exportRows` je zadané (nezávisle na `isEditMode`), volají `exportRowsAsJson`/`exportRowsAsXlsx` s `exportRows` a filename odvozeným z `kind` (např. `dashboard-priority`).
- `src/dashboard/DashboardPanel.tsx`:
  - Nová pure funkce (lokální, v tomto souboru) `getExportRowsForWidget(kind, tasks, members, projects): ExportRow[] | null` — přepínač podle `kind`, volá odpovídající existující `get*Breakdown` funkci a mapuje na `{ Kategorie, Počet }`; vrací `null` pro `"stats"` a `"upcoming"`.
  - Při renderu každého widgetu (ve stejné smyčce, kde se dnes volá `renderWidgetContent`) se spočítá `exportRows = getExportRowsForWidget(item.i, tasks, members, projects)` a předá do `<DashboardWidget exportRows={exportRows}>`.

## Data flow

```
DashboardPanel (tasks, members, projects — už existují)
  → pro každý viditelný widget:
      renderWidgetContent(kind)          // graf, jak dnes
      getExportRowsForWidget(kind, ...)  // stejná pure fn podruhé, pro export řádky
  → DashboardWidget(exportRows)
      → kebab menu → exportRowsAsJson / exportRowsAsXlsx (dashboardExport.ts)
```

Žádný nový Supabase přístup, žádný nový stav navíc kromě toho, co `DashboardPanel` už má.

## Dependencies

- `xlsx` (SheetJS) — nová závislost pro generování `.xlsx` souborů v prohlížeči.

## Testing

Bez unit test frameworku — manuální ověření v prohlížeči (`npm run dev`):
- V read módu (mimo edit) se u grafového widgetu objeví kebab menu jen s export položkami (bez "Skrýt widget").
- V edit módu se u grafového widgetu objeví kebab menu se všemi třemi položkami.
- U Stats a Nadcházejících úkolů se kebab menu v read módu neobjeví vůbec (žádný `exportRows`), v edit módu se objeví jen se "Skrýt widget".
- Export JSON stáhne soubor s daty odpovídajícími aktuálně zobrazenému grafu (ověřit obsah).
- Export Excel stáhne `.xlsx`, otevře se v Excelu/Sheets se sloupci "Kategorie"/"Počet" a správnými daty.
- `PriorityBreakdownWidget` graf vypadá po refaktoru identicky jako předtím (žádná vizuální regrese).
