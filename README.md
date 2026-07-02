# Focus-Todoapp

Focus Todo app built with Vite, React, Capacitor, and Supabase.

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
