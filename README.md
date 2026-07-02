# Focus-Todoapp

Focus Todoapp je produktivni task manager zamereny na kazdodenni planovani, soustredeni a tymovou spolupraci. Kombinuje klasicke osobni ukoly se seznamy, detailnimi tasky, fokus rezimem, dashboardem a projektovymi boardy ve stylu kanbanu.

## Co aplikace umi

- Sprava ukolu, seznamu a detailu tasku vcetne poznamek, terminu, priorit, stitku a podukolu.
- Fokus rezim pro praci na jednom ukolu s navazujicimi doporucenymi kroky.
- Dashboard a check-in prehledy pro rychly denni stav, overdue ukoly a priority.
- Projektove nastenky s vlastnimi sloupci, drag and drop presunem karet a spravou sloupcu.
- Tymove prostory, prirazeni clenu a projektove ukoly navazane na tym.
- Archivaci tasku a seznamu, cloud sync a notifikace na naplanovane ukoly.
- PWA a mobilni smerovani pres Capacitor pro web i Android build.

## Technologie

- React 19 + TypeScript
- Vite 7
- Supabase pro autentizaci a cloudova data
- Capacitor pro mobilni shell a lokalni notifikace
- Lucide React pro ikonky
- Vercel pro produkcni deployment

## Development

Install dependencies and run the app locally:

```bash
npm install
npm run dev
```

Create a production build locally:

```bash
npm run build
```

## Vercel Deploy

This project should be deployed to Vercel with a direct CLI deploy from this linked workspace.

Use this flow:

```bash
npm run build
npm run deploy:vercel
```

Notes:

- Do not rely on the Git integration as the primary deploy path for this project.
- The workspace is linked to the Vercel project `jsemdavidminarik-3959s-projects/focus-todo-app`.
- `.vercel/` should stay local and remain ignored by git.
