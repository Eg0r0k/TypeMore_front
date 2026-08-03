# Repository Guidelines

## Project Overview

**TypeMore** (`typemore`) is a Vue 3 + TypeScript + Vite single-page app for practicing touch-typing: timed/word-count/free/custom modes, WPM & accuracy stats, themes, sound, and multiplayer lobbies. Backend is a separate Go service (not in this repo). License: MIT.

## Architecture & Data Flow

Feature-Sliced Design (FSD). Layers under `src/`, strict downward dependency — higher imports lower, never upward:

```
app → pages → widgets → features → entities → shared
```

Each slice is segmented and exposes a public API via a barrel `index.ts`:
- `ui.vue` — the component (view)
- `model/store.ts` — Pinia setup-store (state + logic)
- `api/` — data access (only `src/shared/api` has one; see below)
- `types/*.ts` — types
- `lib/` — hooks/helpers (mostly in `shared`)

Data flow: component (`<script setup>`) → `useQuery(xQueryOptions())` / `useXMutation()` from `@shared/api` → endpoint fn (ofetch) → valibot-parsed payload, or a normalized `ApiError` on failure. Code outside a component (pinia actions, router guards, match bootstrap) calls the `loadX()` helpers, which hit the very same query cache. Router guards in `src/app/router/middleware/` read stores (auth, lobby) to gate navigation.

Bootstrap: `index.html` → `src/main.ts` → `installPlugins(app)` (`src/plugins.ts`) → `app.use(router)` → `mount('#app')`. `main.ts` also registers the global async component `Popper` (vue3-popper).

## Key Directories

- `src/app/` — init layer: `App.vue`, `router/index.ts` (the single router), global SCSS (`main.scss` + `_normalize/_reset/_scroll/_mixin/_animation.scss`), fonts.
- `src/entities/` — domain slices (auth, config, game, match, screen, lobby, chat, alert, ...). Each has `model/store.ts`, sometimes `types/`. There is **no** `modal` entity: modals are plain dialog components (see below).
- `src/features/` — feature slices (layouts, test, room, servers, profile, modal, home, header, footer, run-submit).
- `src/pages/` — route targets (home, auth/{login,register,verify,reset,reset-confirm,callback}, servers, room, match, profile, error). Settings is a dialog, **not** a route.
- `src/widgets/` — composition layer assembling features/entities into page regions.
- `src/shared/` — design system `ui/` (button, input, select, checkbox, radio, typography, chart, alert, ...), `lib/hooks/` (composables), `lib/helpers/` (plain fns), `constants/`, `directives/`, `middleware/`, `api/`.
- `public/static/` — runtime assets: `themes/themes.json`, `quotes/`, `sounds/`. **Dictionaries are NOT here**: the Go server is their only source (`GET /api/v1/dictionaries` → `/static/dictionaries/<dictHash>.json`, both wrapped by `src/shared/api/dictionaries`).

## Development Commands

Package manager: **pnpm** (`pnpm-lock.yaml` is authoritative). Scripts internally call `npm run …` in pre/post hooks; pnpm honors these.

```bash
pnpm install
pnpm dev            # vite dev server (host 0.0.0.0)
pnpm build          # vite build
pnpm preview        # preview production build
pnpm type-check     # vue-tsc --build --force
pnpm lint           # eslint over src
pnpm format         # prettier --write src/
pnpm lint:style     # stylelint 'src/**/*.{vue,scss}'
pnpm test           # vitest --dom --run (happy-dom)
pnpm test:dev       # vitest --dom (watch)
```

Git hooks (husky): `pre-commit` runs lint + lint:style + format; `pre-push` runs tests.

## Code Conventions & Common Patterns

- **Components**: always `<script setup lang="ts">` with scoped `<style lang="scss">`. Component files are always named `ui.vue`, re-exported PascalCase from the slice barrel: `export { default as Button } from './ui.vue'`.
- **Stores**: Pinia setup-style — `defineStore('name', () => { const x = ref(); ... return {...} })`, hook named `useXStore`, file `model/store.ts`. Only the `config` store is persisted (pinia-plugin-persistedstate, `localStorage` key `config`).
- **Composables**: `useXxx` in `src/shared/lib/hooks/`. Plain helpers in `src/shared/lib/helpers/`.
- **Forms**: vee-validate + valibot via `@vee-validate/valibot` — `const schema = toTypedSchema(v.object({...}))`, `useForm({ validationSchema: schema })`.
- **Class composition**: `clsx`. **Prop variants**: exported inline TS unions from the SFC (e.g. `ButtonColor`, `ButtonSize`).
- **Path aliases** (`vite.config.ts` + tsconfig): `@` → `src`, plus `@app`, `@entities`, `@pages`, `@shared`, `@widgets`. Same target may appear as `@/pages/...` or `@pages/...` — both valid.
- **SCSS**: `@/app/_mixin.scss` auto-injected via `css.preprocessorOptions.scss.additionalData` (modern API). Stylelint enforces BEM class pattern, recess-order, and `$var-`-prefixed SCSS variables.
- **Import order** (informal): external libs → aliased internal → relative `../`.

## Important Files

- `src/main.ts`, `src/plugins.ts` — bootstrap & plugin registration.
- `src/app/router/index.ts` — all routes (home eager, rest lazy `() => import('@pages/.../ui.vue')`) + 5 `beforeEach` guards.
- `src/shared/api/` — the only data-access layer. Core: `transport.ts` (one `ofetch` instance + `request()` that valibot-parses at the boundary, `ApiError`, `apiBase()`), `query-client.ts` (the single app-wide `QueryClient`), `keys.ts` (`API_SCOPE`). One folder per domain — `auth/`, `runs/`, `dictionaries/`, `themes/` — each with `schemas.ts` / `types.ts` / `endpoints.ts` / `keys.ts` / `queries.ts` / `mutations.ts` / `index.ts`. A new domain is a new folder plus one `export *` in `index.ts`; components import ONLY from `@shared/api`.
- `vite.config.ts` — plugins (vue, vueJsx, fontaine, visualizer), aliases, manualChunks, SCSS config.
- `eslint.config.js` (flat), `.prettierrc.json`, `.stylelintrc.json` — lint/format.
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` — TS config split.
- `src/features/modal/*` — every modal in the app. Each is a self-contained component taking `v-model:open` and built on `@/shared/ui/dialog` (which already renders portal + overlay + close button and traps focus), and by default the opener owns the `ref`. THREE exceptions are app-level and mounted once in `App.vue` — settings, themes, cookies — because several unrelated places open them (header, profile, the settings dialog itself, the first-visit check); their flags and the settings ⇄ theme/cookie drill-down live in `entities/dialogs` (`useDialogsStore`). Openers call `openSettings()` / `openThemes()` / `openCookies()`; nobody mounts a second instance.
- `src/features/modal/settings/` — the settings dialog (category column + search on `md+`, horizontal label strip below). `model/registry.ts` lists the categories and the searchable rows; `parts/SettingRow.vue` renders one row and hides itself via the injected `SETTINGS_FILTER`. Theme/cookie dialogs are NOT nested: `SETTINGS_NAV` hides the settings dialog, shows the other one, and comes back on close — stacked reka dialogs share one dismiss chain.

## Runtime/Tooling Preferences

- Node ≥ 20.19 (tooling tsconfig extends `@tsconfig/node22`).
- Package manager: **pnpm** (`packageManager` field pinned; single `pnpm-lock.yaml`).
- Build: Vite 8 (rolldown), TypeScript 6, `vue-tsc` for type-checking, sass.

## Testing & QA

- **Framework**: Vitest + `@vue/test-utils`, DOM via happy-dom (enabled by the `--dom` flag; there is **no** `test` block in `vite.config.ts` and no `vitest.config.*`/setup file).
- **Location & naming**: `src/__tests__/**` as `<name>.test.ts` (no `.spec.*`). Subdirs `stores/`, `hooks/`, `helpers/`.
- **Style**: explicit imports (no globals): `import { mount } from '@vue/test-utils'; import { expect, it, describe } from 'vitest'`. Pattern: `describe` → `it`, mount component with props/slots, assert classes/attributes/text; import via `@` aliases.
- **Run**: `pnpm test` (once) / `pnpm test:dev` (watch).

## Known Gotchas (for assistants)

- Server state is TanStack Query end to end: `queryOptions` factories + mutation hooks in `src/shared/api/<domain>/`, with `loadX()` (`queryClient.ensureQueryData`) for callers outside setup. There is no hand-rolled fetch memoization left — do not add one. `@tanstack/vue-virtual` is installed but not yet wired.
- One `QueryClient` app-wide: `plugins.ts` passes the instance exported from `shared/api/query-client.ts`, so router guards and pinia actions share the component cache. Never construct a second client.
- API base comes from `VITE_API_URL` (`VITE_API_BASE_URL` is a legacy fallback) via `apiBase()`; nothing hardcodes a host.
- Themes are a frontend asset (`public/static/themes/themes.json`) but are still fetched through `shared/api/themes` so they share the cache and the schema check. Storybook, `jest`/`gh-pages` scripts, and the stray lockfile were removed; animations use `@vueuse/motion` (`v-motion`), not gsap.
- Adding a `Config` field means FOUR files: `shared/constants/type.ts`, `default-config.ts`, `lib/helpers/validation.ts` (a `Record<keyof Config, ValidatorFn>`, so TS fails the build if you forget) and, when the value paints CSS, a setter in `lib/helpers/setConfigSettings.ts` that must also run once at boot from `useAppSetup`. Core-bound fields additionally go through `toCoreSetup` AND the rebuild watcher in `pages/home/ui.vue`.
- `CoreConfig` (`shared/core/game-core.ts`) is serialized verbatim into the run-submit payload and replayed server-side, so every new field there is OPTIONAL with a legacy default equal to the old behaviour (`startPolicy?`, `freedomMode?`, `stopOnError?`, `quickEnd?`). Opposite-shift mode is deliberately NOT implemented: it needs new data on `InsertEvent`, an `EVENT_LOG_VERSION` bump and a backend that understands it.
- z-index is token-driven (`src/app/main.scss`): `--fps-z: 1000` > `--alert-z`/`--popup-z: 999` > `--modal-z: 998`. Portaled popups (select, popover, dropdown, tooltip) MUST use `--popup-z`: with the shadcn default `z-50` they render under a dialog's overlay and silently stop receiving clicks.
- The typing field is a pure view: it reads NO config store. Caret style/smoothness, blind, fading and flashlight arrive as props from the page; the words are drawn in a shadow root styled by `widgets/test/game-styles.ts`, which reads `--tm-font-size` and `--tm-caret-*` from the root element.
- UI locales live in `src/app/i18n/locales/{en,ru}.ts` (identical key trees; English is the `fallbackLocale`, so a missing key renders English rather than the key path). Resolution lives one layer down in `shared/lib/i18n/locale.ts` because the config layer needs it: `config.uiLanguage` is `'system' | 'en' | 'ru'`, `system` means `navigator.language` and is re-evaluated live by `useUiLanguage` (wired once in `useAppSetup`). Boot order is saved → browser → `en`, and the winner is stamped on `<html lang>`. NOTE: `config.language` is the DICTIONARY language of the test text — a different thing entirely.
