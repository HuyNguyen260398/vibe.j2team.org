# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**vibe.j2team.org** is a Vue 3 SPA where J2TEAM Community members each contribute a standalone sub-page ("vibe"). There is no database — all page metadata is declared in static `meta.ts` files that are scanned at build time.

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Type-check + build + generate OG images + sitemap
pnpm preview          # Preview production build
pnpm test:unit        # Run unit tests (Vitest)
pnpm test:unit --run  # Run tests once (no watch mode)
pnpm lint             # Run oxlint + eslint (with auto-fix)
pnpm format           # Format src/ with oxfmt
pnpm type-check       # Vue TSC type check only
pnpm analyze          # Build with bundle visualizer (opens dist/stats.html)

# Scaffold a new page interactively
pnpm create:page <slug>
# Or non-interactively:
pnpm create:page my-app --name "My App" --description "..." --author "Name" --category tool
```

Valid categories: `game`, `tool`, `creative`, `fun`, `learn`, `health`, `finance`, `spiritual`, `connect`, `other`

## Architecture

### Page Discovery (Build-Time)

The Vite plugin in `vite.config.ts` runs `scripts/generate-pages-json.mjs` on every build start and whenever any `src/views/*/meta.ts` changes during dev. It outputs:
- `src/data/pages.json` — array of `PageInfo` objects (metadata + derived path)
- `src/data/pages-loader.ts` — dynamic import map keyed by component path string

### Adding a New Page

Each page lives in `src/views/<slug>/` and requires exactly two files:

**`meta.ts`** — exports a `PageMeta` object (see `src/types/page.ts`):
```ts
import type { PageMeta } from '@/types/page'
const meta: PageMeta = {
  name: 'Display Name',
  description: 'Short description',
  author: 'Author Name',
  facebook: 'https://facebook.com/...',  // optional
  category: 'tool',
  showToolbar: false,  // optional, default true
  hidden: true,        // optional, hides from homepage listing but route still works
}
export default meta
```

**`index.vue`** — the page component. Must be self-contained (no per-page dependencies; all global libs are pre-installed).

### Routing

Routes are registered dynamically in `src/router/index.ts`. On first navigation, `usePagesStore().init()` fetches `pages.json`, then `buildPageRoutes()` maps each entry to a lazy-loaded route using the `pages-loader.ts` import map. The 404 catch-all is added last to avoid swallowing page routes.

### Pre-installed Libraries (use these, don't add new deps)

- `@vueuse/core` — composables (useStorage, useClipboard, useEventListener, etc.)
- `@iconify/vue` — `<Icon icon="..." />` with 200k+ icons
- `shiki` + `@shikijs/langs` + `@shikijs/themes` — syntax highlighting
- `html-to-image` — screenshot/export utilities
- `@unhead/vue` — `useHead()` for per-page meta tags

### State Management (Pinia stores in `src/stores/`)

- `usePagesStore` — loads and holds all `PageInfo[]` from `pages.json`
- `useFavoritesStore` — user's bookmarked pages (localStorage)
- `useRecentlyViewedStore` — recently visited pages (localStorage)

### Aliases

`@/` maps to `src/`.

## Commit Convention

Commits must follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, etc.). Enforced by commitlint via `commit-msg` git hook.

## Key Constraints (from project rules)

- No database or backend — all data is static/localStorage
- Every page must link back to `/` (home)
- Pages must be responsive
- No duplicate app concepts
- Each page is fully independent — no shared state between sub-pages
- Images committed to the repo are auto-optimized via the `pre-commit` hook using `scripts/optimize-image.mjs`
