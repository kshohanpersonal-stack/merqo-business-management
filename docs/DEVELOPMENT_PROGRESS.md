# Development Progress

Last updated: 2026-11-03 · Branch: `arena/e53fcc9d-merqo-business-management`
Base commit: `3a42431 Initial commit` · Pushed commits: `c0c620d` (integrated source),
`e571a71` / `2e5747a` (evidence refresh), `4e5eb31`, `3234e8e`, `9ef4763`, `cda840e`,
`3b11e3a` (CI/Windows build fixes). Repository visibility: **public** (`gh api`).
Latest pushed source commit: `3b11e3a`; this evidence refresh is committed on top of it.

## Current phase

**Phase 8 (complete integration) — implemented and exercised on Linux and in GitHub CI.**
Phases 1–7 are implemented; a full Bangla React UI, Electron main/preload, Windows device
fingerprint and printing providers, a Vite `/api` bridge, the owner-only licence generator
CLI and an end-to-end preview smoke test are in place. Three push-triggered GitHub Actions
workflows are now green on `windows-latest` / `ubuntu-latest`, and the Windows build
`41642232644` produced an NSIS installer plus the owner-only generator EXE as protected
CI artifacts. Phases 9–11 (complete QA with UI and hardware, real Windows
installation/activation test, signed GitHub release) remain **BLOCKED**. This is not a
completion claim.

## Completed in this session

1. **Phase 1** — 38 requirement groups / 247 tracked requirements, architecture, database,
   security, licence, UI/UX, testing, risk and third-party-licence documents.
2. **Phase 2** — pinned dependency manifest, TypeScript/Vite/Vitest/ESLint/Prettier/esbuild
   config, `electron-builder.yml`, four GitHub Actions workflows, `.gitignore`, secret scan,
   custom product logo/splash/icons (16–256 px + `.ico`), bundled Noto Sans Bengali with OFL.
3. **Phase 3** — 661-line forward-only SQLite migration (49 tables, 26 indexes, WAL, FKs,
   ACID, idempotency), 30 permissions/4 roles, and ~30 `src/core/*` modules covering money,
   validation, auth/sessions/RBAC/audit, settings, notifications, catalogue, parties,
   purchases, sales/returns, expenses, finance, 28 reports, exports, printing, backup and a
   single permission/transaction/audit dispatcher.
4. **Phase 4** — light-theme Bangla design system (`styles.css`, `fonts.css`), React shell
   with sidebar/active state, topbar greeting, notification centre, user menu, toasts,
   modals, tables, loading/empty states, charts and configurable keyboard shortcuts.
5. **Phase 5** — Dashboard, Products, Catalogue, Inventory, POS, Purchases, Sales/Returns,
   Customers/Suppliers, Expenses, Finance, Reports, Backup/Restore, Users/RBAC,
   Notifications, Settings, About and Audit screens, all wired to the real dispatcher.
6. **Phase 6/7** — `src/server/api.ts` preview bridge, `src/main/index.ts`, `src/main/device.ts`,
   `src/main/printing.ts`, `src/preload/index.ts`, owner-only generator at
   `apps/license-generator/src/index.ts`, `scripts/database/verify.mjs`,
   `scripts/dev/smoke-preview.mjs`, `scripts/dev/make-dev-license.mjs`.
7. **Verification (local Linux)** — `npm test` 41/41 (≈22 s), `npm run typecheck`,
   `npm run lint`, `npm run format:check`, `npm run licenses` (708 packages),
   `npm run db:verify` 30/30, `npm run build`, `npm run build:generator`,
   `npm run secrets` (152 tracked files), and `npm run smoke` 12/12.
8. **CI and Windows build** — fixed CRLF schema comparisons, deterministic requirement
   generation, a `.gitignore` that excluded `scripts/build/`, Windows SQLite file locks,
   VS 2026 detection, Electron 43 / V8 incompatibility, and npm's automatic node-gyp
   rebuild. Upgraded `better-sqlite3` 12.4.1 → **13.0.3 (N-API)** and set
   `npmRebuild: false`. Final runs: CI `41642232635`, Security `41642232646`, Windows
   `41642232644` — all **success**. Windows `npm test` 41/41 in 23.84 s; NSIS
   `MERQO-Setup-0.1.0-x64.exe` (131,626,408 bytes) and `MERQO-License-Generator.exe`
   uploaded as protected artifacts with SHA-256 checksum files.

## Not done / blocked

* No real Windows installation, first-run activation, shortcut/uninstall or startup test —
  the installer exists only as an unsigned CI artifact.
* No owner code-signing certificate, no trusted Authenticode signature, no SmartScreen
  clearance, no version tag and no GitHub Release.
* `src/core/public-key.ts` still embeds the **development** public key; the CI installer
  therefore cannot activate production licences until the owner replaces it.
* No physical thermal printer or barcode scanner test.
* No real-browser visual/multi-window-size test (no browser binary in sandbox).
* No final signed build report with installation/activation results.

See `docs/KNOWN_ISSUES.md`, `docs/MASTER_REQUIREMENT_CHECKLIST.md` (**17 IMPLEMENTED,
153 TESTING, 49 PASSED, 0 FAILED, 28 BLOCKED**) and `docs/NEXT_ACTIONS.md`. The 49
`PASSED` entries have all eleven verification steps satisfied by executed tests and
committed source; 28 `BLOCKED` entries are Windows install/hardware/release items.
