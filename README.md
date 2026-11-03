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
> Nothing in this README claims production readiness. Integrated milestone: `c0c620d`.

## What is implemented

The application is a modular Electron + React + TypeScript desktop app with a single
shared TypeScript domain core. The same core runs inside Electron's main process, inside
the browser-based development preview, and inside automated tests. SQLite (via
`better-sqlite3`) is the local, offline database. All money is stored as integer minor
units (paisa), every business operation is a single SQL transaction, and all queries are
parameterized.

Core capabilities now implemented in source: business profile and settings, users/roles/permissions,
products/categories/brands/units, barcode and QR, purchases and supplier ledger, POS sales
with split payments/holds/returns, customer ledger and due collection, expenses, cash and
financial accounts, inventory movements, returns and adjustments, dashboard analytics,
28 report families, CSV/XLSX/PDF export, thermal receipts, encrypted backups and restore,
offline Ed25519 licence verification, and the owner-only licence generator.

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
npm run licenses        # 722 packages allow-listed for commercial redistribution
npm run build:generator # owner-only generator SEA blob + CLI smoke test
node scripts/dev/smoke-preview.mjs   # 12/12 live activation → sale → backup checks (needs npm run dev)
```

Actual executed results: `npm test` 41/41, typecheck/lint/format/licences clean, renderer +
Electron bundles built, 30/30 database checks, 12/12 preview API smoke checks. Windows
installer, installation/activation testing, hardware QA, code signing and GitHub Release are
**BLOCKED** in the Linux sandbox — see `docs/TESTING_STATUS.md`, `docs/BUILD_HISTORY.md` and
`docs/FINAL_BUILD_REPORT.md`. Customer data used during development lives only in an ignored
local SQLite directory and is never committed.

## Licensing and distribution

The main application embeds an Ed25519 **public** verification key. The owner's private
signing key is generated outside the repository and must never be committed or published.
The licence generator executable is an owner-only artifact: CI uploads it as a protected
workflow artifact / private release, never as a public release asset. See
[`docs/licensing/`](docs/licensing/) for the full design and operator instructions.

## Legal

See [`LICENSE`](LICENSE), [`SECURITY.md`](SECURITY.md) and
[`docs/architecture/THIRD_PARTY_LICENSES.md`](docs/architecture/THIRD_PARTY_LICENSES.md).
Customer business data never leaves the local machine; there is no telemetry and no
mandatory network access.
