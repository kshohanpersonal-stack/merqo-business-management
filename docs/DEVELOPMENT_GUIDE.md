# Development Guide

## Architecture

See `docs/architecture/ARCHITECTURE.md`. Layers: renderer → dispatcher → core services →
SQLite. The Vite preview plugin (`src/server/api.ts`) and Electron main process call the
same `dispatch()` with the same `createContext()`. Never put SQL in the renderer.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite preview on `0.0.0.0:5173` with `/api` core bridge |
| `npm test` | Vitest unit/integration/security/performance suites |
| `npm run typecheck` / `lint` / `format:check` | static quality gates |
| `npm run db:verify` | 30 schema/transaction/index checks |
| `npm run licenses` | commercial redistribution allow-list |
| `npm run secrets` | tracked-file secret scan |
| `npm run build` | renderer + Electron bundles |
| `npm run build:generator` | owner-only generator SEA blob/CLI check |
| `npm run smoke` | 12/12 preview API smoke checks |
| `npm run qa:visual` | headless-Chromium renderer visual QA (18 pages, four viewports) |
| `npm run qa:e2e` | 18-step real-dispatcher owner workflow |
| `npm run checklist` | regenerate 247-item requirement evidence |

## Windows notes

Use `npm ci --ignore-scripts` then `node node_modules/electron/install.js`. Plain
`npm ci` triggers `node-gyp` on `better-sqlite3/binding.gyp` and fails on VS 2026.
`npmRebuild: false` is intentional.

## Adding a feature

1. Map it to a stable requirement ID.
2. Add/extend a Zod validator and dispatcher action with permission + audit.
3. Implement the business logic in `src/core/` inside a transaction when money moves.
4. Add real tests; never mark PASSED without executed evidence.
5. Wire the UI through `window.merqo.call` / the preview bridge.
6. Update `docs/requirement-overrides.json` from real evidence, regenerate the checklist,
   and refresh state docs.
7. Commit logically; push only to the session branch; verify CI.

## Visual and E2E QA

`scripts/dev/visual-qa.mjs` uses `playwright-core` and the npm-bundled headless Chromium
from `@sparticuz/chromium` (no external browser download). It starts an isolated preview,
activates and sets up through the real UI, then checks four desktop viewports, Bangla
glyphs, focus visibility, accessible control names, overflow, console errors and the
Bangla/English switch. `scripts/dev/ensure-dev-license.mjs` supplies an ignored
development licence (or an ephemeral keypair in clean CI). Evidence is written to
`docs/visual-qa/report.json`, `english-body.txt`, `english-nav.txt` and six screenshots.

`scripts/dev/e2e-workflow.mjs` drives the same `/api` dispatcher against a temporary
SQLite database through 18 owner workflow steps and writes `docs/e2e-workflow.json`.
Both scripts are wired into `npm run qa:visual` / `qa:e2e` and Linux CI.

## Localization

`src/renderer/i18n.ts` is a boundary-aware Bangla→English dictionary layer with a
`MutationObserver`, localStorage persistence and settings synchronization. It is
initialized in `src/renderer/main.tsx`. English coverage is partial by design; unknown
phrases remain Bangla rather than being partially translated into mixed-script text.
Add full phrase entries to the dictionary rather than single-word substrings when
extending coverage.

## Secrets

`private/`, `*.pem`, `*.merqolic`, `.merqo-data/`, databases and backups are ignored.
Never commit a private key, licence file or customer database. The customer app contains
only the public verification key.
