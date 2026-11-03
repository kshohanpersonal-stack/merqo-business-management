# MERQO — Offline Business Management & Super Shop POS

**MERQO** is an offline-first, lifetime-licensed Windows desktop business management and
point-of-sale product for retail businesses in Bangladesh. Product owner: MERQO.
Founder: Shohan Khan · merqoonline@gmail.com.

> **Status (read this first):** this repository is under active development on branch
> `arena/e53fcc9d-merqo-business-management`. It is **not** yet a released commercial
> product. See [`docs/DEVELOPMENT_PROGRESS.md`](docs/DEVELOPMENT_PROGRESS.md),
> [`docs/MASTER_REQUIREMENT_CHECKLIST.md`](docs/MASTER_REQUIREMENT_CHECKLIST.md),
> [`docs/TESTING_STATUS.md`](docs/TESTING_STATUS.md) and
> [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) for the exact, evidence-based state.
> Phase A checkpoint: `7cd19bb`; delivery work since then adds a bilingual renderer,
> headless-Chromium visual QA and an 18-step E2E workflow. Historical CI, Security and
> CI, Security and Windows workflows are green on `8201bc7`; the final security-upgrade
> delivery commit is re-verified and its run IDs recorded in the delivery answer. The
> unsigned installer and owner-only generator exist as protected CI artifacts with
> development-key activation. Security-driven dependency upgrades removed all high/critical
> `npm audit` findings; 28 moderate build/test-tool advisories remain disclosed. No version
> tag or GitHub Release exists. Nothing in this README claims production readiness.

## What is implemented

The application is a modular Electron + React + TypeScript desktop app with a single
shared TypeScript domain core. The same core runs inside Electron's main process, inside
the browser-based development preview, and inside automated tests. SQLite (via
`better-sqlite3@13.0.3`, N-API prebuilds) is the local, offline database. All money is
stored as integer minor units (paisa), every business operation is a single SQL
transaction, and all queries are parameterized.

Core capabilities now implemented in source: business profile and settings, users/roles/permissions,
products/categories/brands/units, barcode and QR, purchases and supplier ledger, POS sales
with split payments/holds/returns, customer ledger and due collection, expenses, cash and
financial accounts, inventory movements, returns and adjustments, dashboard analytics,
28 report families, CSV/XLSX/PDF export, thermal receipts, encrypted backups and restore,
offline Ed25519 licence verification, the owner-only licence generator, a partial
Bangla/English renderer language layer, headless-Chromium visual QA and an 18-step
real-dispatcher E2E workflow.

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/core/` | Domain core: database, business logic, auth, licensing, reporting, printing, exports, backup |
| `src/main/`, `src/preload/` | Electron main process and hardened IPC bridge |
| `src/renderer/` | React light-theme Bangla UI (pages, components, design system) |
| `src/server/` | Vite plugin exposing the **same** core over `/api` for the live browser preview |
| `apps/license-generator/` | Owner-only CLI (source only; private key never committed) |
| `database/` | Canonical schema and forward-only migrations |
| `assets/` | Product logo/icon, OFL Bengali font, templates |
| `tests/` | Unit, integration, security, performance and e2e tests |
| `docs/` | Persistent project state, architecture, user and technical documentation |
| `.github/workflows/` | CI, Windows build, release and security checks |
| `scripts/` | Development, build, release, database and maintenance scripts |

## Quick start (developer / live preview)

```bash
npm ci
npm run dev            # Vite preview + /api core on http://localhost:5173
npm test               # Vitest unit/integration/security/performance suites
npm run typecheck      # TypeScript checks
npm run build          # renderer + Electron main/preload bundles
npm run build:win      # Windows installer (requires Windows runner or Wine)
```

On Windows, use `npm ci --ignore-scripts` followed by
`node node_modules/electron/install.js`; `better-sqlite3@13.0.3` ships N-API prebuilds, so
no `electron-builder install-app-deps` / node-gyp rebuild is needed (`npmRebuild: false` in
`electron-builder.yml`). The Windows CI workflow follows exactly this sequence.

The live preview runs the same domain core as the desktop app; it is a development tool,
not the customer deliverable. On a fresh preview the first screen is **MERQO অ্যাক্টিভেশন**;
click **ডেভেলপমেন্ট লাইসেন্স** to load the ignored local development licence, then
**অ্যাক্টিভেট করুন**, complete the three-step business/admin setup and log in. That licence
and its private key are development-only, ignored by Git, and must never be distributed.

Additional verified commands:

```bash
npm run db:verify       # 30/30 schema, FK, ACID and index checks
npm run lint            # 0 errors / 0 warnings
npm run format:check    # Prettier clean
npm run licenses        # 682 packages allow-listed for commercial redistribution
npm run build:generator # owner-only generator SEA blob + CLI smoke test
npm run smoke           # 12/12 live activation → sale → backup checks (needs npm run dev)
npm run qa:visual       # 18 pages / 4 viewports / 6 screenshots in headless Chromium
npm run qa:e2e          # 18/18 real-dispatcher owner workflow checks
npm run checklist       # regenerate the 247-requirement master checklist
```

## CI status (green runs; final delivery commit verification in delivery answer)

| Workflow | `3b11e3a` | `efacbaf` | `f7d78d5` | `8201bc7` |
| --- | --- | --- | --- | --- |
| CI — quality, tests and Linux build | `41642232635` SUCCESS | `41645278808` SUCCESS | `41646629269` SUCCESS | `41660526854` SUCCESS |
| Security checks | `41642232646` SUCCESS | `41645278586` SUCCESS | `41646629348` SUCCESS | `41660526869` SUCCESS |
| Windows build | `41642232644` SUCCESS | `41645278572` SUCCESS | `41646629301` SUCCESS | `41660526709` SUCCESS |

The `8201bc7` Windows run produced an unsigned NSIS installer (artifact `13242046945`,
ZIP SHA-256 `5f953eceb37e8743e29c0f2084e98bf603deab0a2e29ed43ab507ab340206e8b`,
ZIP 131,641,727 bytes) and the owner-only generator (protected artifact `13241417765`,
ZIP SHA-256 `3d4943c09c333df9fb87c567263a94b4a48fed01763419ecf1c48141347d18b5`,
ZIP 34,334,219 bytes, 7-day retention). Earlier `f7d78d5`, `efacbaf` and `3b11e3a`
artifacts are recorded in `docs/BUILD_HISTORY.md`. All are technical build outputs:
**unsigned**, embedding the development public key, and **not released**. The owner
explicitly declined an OV/EV certificate; no Defender or SmartScreen bypass is included
and no trusted-publisher claim is made.

Actual executed local results on the current worktree: `npm test` 41/41 (26.45 s),
typecheck/lint/format/licences clean, renderer + Electron bundles built, 30/30 database
checks, 12/12 preview API smoke checks, 18/18 E2E workflow checks and headless-Chromium
visual QA at four viewports. Security-driven upgrades moved Vite to 7.3.7, Vitest to
4.1.12, Zod to 4.6.7, electron-builder to 26.18.0 and added `react-is@19.2.0`;
`npm audit --audit-level=high` passes with 0 high/critical and 28 moderate advisories.
Final CI/Security/Windows runs are re-run on the exact delivery commit and their
conclusions verified before the delivery answer. Windows installation/activation testing,
hardware QA, production key, version tag and GitHub Release remain **BLOCKED** — see
`docs/TESTING_STATUS.md`, `docs/BUILD_HISTORY.md` and `docs/FINAL_BUILD_REPORT.md`.

## Licensing and distribution

The main application embeds an Ed25519 **public** verification key. The owner's private
signing key is generated outside the repository and must never be committed or published.
The licence generator executable is an owner-only artifact: CI uploads it as a protected
workflow artifact / private release, never as a public release asset. The current CI
installer still embeds the **development** public key (`src/core/public-key.ts`) and must be
rebuilt with the production key before any customer distribution. See
[`docs/licensing/`](docs/licensing/) for the full design and operator instructions.

## Legal

See [`LICENSE`](LICENSE), [`SECURITY.md`](SECURITY.md) and
[`docs/architecture/THIRD_PARTY_LICENSES.md`](docs/architecture/THIRD_PARTY_LICENSES.md).
Customer business data never leaves the local machine; there is no telemetry and no
mandatory network access.
