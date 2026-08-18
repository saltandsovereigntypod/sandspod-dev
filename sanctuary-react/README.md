# React Sanctuary Rebuild

This directory is the parallel React rebuild of the authenticated/interactive Salt & Sovereignty Sanctuary. It intentionally does not replace the public HTML site or the existing vanilla Sanctuary routes yet.

## Goals

- Keep the public Salt & Sovereignty site static and framework-free.
- Rebuild Sanctuary application behavior as reusable React components and shared state.
- Continue using the development Supabase project and existing RLS-backed tables.
- Preserve guest/local persistence while supporting authenticated cloud persistence.
- Preserve normalized altar coordinates so saved layouts remain responsive.
- Treat Living Library entities as canonical references shared by altar, grimoire, rituals, and future native apps.
- Migrate route-by-route only after feature parity and data compatibility are verified.

## Current React surfaces

- Sanctuary dashboard
- Digital altar canvas
- Cabinet/catalog object placement
- Rotate, flip, lock, light/extinguish, remove and responsive drag placement
- Working altar local persistence
- Existing `saved_altars` cloud save integration
- Personal grimoire draft editor
- Living Library shell
- Ritual lifecycle editor (`draft`, `planned`, `active`, `paused`, `completed`, `abandoned`, `archived`)
- Supabase sign in/sign up/sign out
- Account & Data shell
- Responsive desktop/mobile navigation

## Run locally

```bash
cd sanctuary-react
npm install
npm run dev
```

## Build

```bash
npm run build
```

Vite outputs to `sanctuary-react/dist`. `base: './'` plus hash routing keeps the app compatible with static hosting and nested GitHub Pages paths without server-side route rewrites.

## Migration rule

Do not remove `/altar`, `/grimoire`, existing account pages, backup/restore code, reconciliation code, or deletion functions until the corresponding React implementation has verified feature and data parity. This branch is intentionally additive.

## Next parity work

1. Replace the starter cabinet catalog with the existing complete canonical object catalog and artwork paths.
2. Add full saved altar manager: update existing, save as new view, fresh duplicate, favorite, delete, guest-to-account migration.
3. Port candle duration, dressing, grouping, layering and Companion behavior.
4. Connect the React grimoire to `grimoire_books`, `grimoire_sections`, `grimoire_pages`, `grimoire_blocks`, and `grimoire_page_links` rather than local drafts.
5. Port ritual templates, ritual journal handoff and Living Connections.
6. Port Living Library reconciliation/admin surfaces after the current preview-only safety work is complete.
7. Port account backup/restore and secure deletion UI only after existing server verification remains intact.
8. Add accessibility settings and mundane mode as top-level React context rather than per-page DOM mutations.
9. Add tests around serialization compatibility with the vanilla Sanctuary before route cutover.
