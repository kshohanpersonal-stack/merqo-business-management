# Changelog

All notable changes are documented here. Semantic versioning; owner controls release tags.

## [0.1.0] — 2026-11-03 (unreleased development milestone)

### Added
- Phase 1 research, 247-requirement register, architecture/database/security/licence/UI
  and third-party-licence documentation.
- Pinned Electron/React/TypeScript/Vite/Vitest toolchain, four GitHub Actions workflows,
  `electron-builder.yml`, custom MERQO product logo/splash/icons and bundled OFL
  Noto Sans Bengali font.
- Forward-only SQLite migration (49 tables, 26 indexes, WAL, FK, ACID) and ~30 domain core
  modules with integer paisa money and weighted-average COGS.
- Full light-theme Bangla React UI: dashboard, catalogue, inventory, POS, purchases,
  sales/returns, parties, expenses, finance, 28 reports, backup/restore, RBAC,
  notifications, settings, About and audit log.
- Electron main/preload, Windows device fingerprint and printing providers, relative
  `/api` preview bridge, owner-only Ed25519 licence generator CLI, and database verify,
  dev licence and end-to-end preview smoke scripts.
- `.gitattributes` forcing LF line endings, deterministic requirement generator, tracked
  `scripts/build/*`, Windows-safe SQLite cleanup, portable `postject` invocation,
  `npm ci --ignore-scripts` + explicit Electron install on Windows, and
  `better-sqlite3@13.0.3` N-API prebuilds with `npmRebuild: false`.
- Boundary-aware Bangla/English renderer layer (`src/renderer/i18n.ts`), top-bar language
  toggle, settings/setup language persistence and `:focus-visible` styles.
- `npm run qa:visual` headless-Chromium visual QA (18 pages, four viewports, six
  screenshots) and `npm run qa:e2e` (18/18 real-dispatcher owner workflow checks), plus
  `scripts/dev/ensure-dev-license.mjs` for clean CI checkouts.
- Linux CI now runs `format:check`, `db:verify`, `qa:e2e` and `qa:visual`; Windows CI
  runs `db:verify`; QA evidence is uploaded. `release.yml` notes describe unsigned
  distribution honestly.

### Fixed
- Return parents inserted before child rows (FK failures), percent discounts converted to
  basis points, safety backup history after restore, qualified report sort columns,
  non-transactional `auth.login` for lockout counting, exact single-string device match,
  product-level discount application, and null-safe product updates.
- Windows CI: CRLF schema diff, non-deterministic checklist timestamp, ignored build
  scripts, `EBUSY` on restored DB cleanup, VS 2026 detection, Electron 43 / V8 API
  incompatibility, and npm's automatic node-gyp rebuild during `npm ci`.
- Security-driven dependency upgrades: Vite `7.2.2` → `7.3.7`, Vitest `3.2.4` → `4.1.12`,
  Zod `4.1.11` → `4.6.7`, electron-builder `26.0.12` → `26.18.0`, plus explicit
  `react-is@19.2.0` for Recharts. `npm audit --audit-level=high` now passes with 0
  high/critical and 31 moderate advisories; the Security workflow now fails on
  high/critical advisories instead of suppressing them.

### Verified
- `npm test` 41/41 (current local 26.45 s; historical Windows CI 23.84 s),
  `npm run db:verify` 30/30, `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `npm run licenses` (682 packages), `npm run build`,
  `npm run build:generator`, `npm run secrets`, `npm run smoke` 12/12,
  `npm run qa:e2e` 18/18 and `npm run qa:visual` at four viewports.
- GitHub Actions: CI `41642232635`, Security `41642232646`, Windows build `41642232644`
  all SUCCESS on `3b11e3a`; re-verified after the docs-only push `efacbaf` with CI
  `41645278808`, Security `41645278586`, Windows build `41645278572` all SUCCESS
  (Windows job 4 m 39 s, 41/41 tests in 22.51 s, 152-file secret scan). Re-verified on
  `f7d78d5`: CI `41646629269`, Security `41646629348`, Windows `41646629301` all SUCCESS;
  `8201bc7`: CI `41660526854`, Security `41660526869`, Windows `41660526709` all SUCCESS.
  Final delivery commit workflows will be re-run and verified before the delivery answer.
- Windows CI produced `MERQO-Setup-0.1.0-x64.exe` (131,626,408 bytes, artifact
  `13232244667`), `MERQO-License-Generator.exe` (protected artifact `13232224614`), and
  SHA-256 checksum files. The `efacbaf` re-build produced the same unsigned,
  development-key outputs as artifacts `13235565390` / `13235615213`; not released.
  The `8201bc7` Windows build produced installer artifact `13242046945` (ZIP SHA-256
  `5f953eceb37e8743e29c0f2084e98bf603deab0a2e29ed43ab507ab340206e8b`) and owner-only
  generator artifact `13241417765` (ZIP SHA-256
  `3d4943c09c333df9fb87c567263a94b4a48fed01763419ecf1c48141347d18b5`).

### Not included / blocked
- Real Windows installation/activation/shortcut/uninstall/upgrade testing, physical
  thermal printer/scanner tests, Electron-window-specific visual QA, production Ed25519
  public key replacement, tag-triggered GitHub Release and production release QA.
  The final unsigned build report is present. Headless-Chromium renderer visual QA and the
  18-step E2E workflow are now executed.
  Unsigned distribution is an explicit owner decision, not a blocker. See
  `docs/KNOWN_ISSUES.md` and `docs/FINAL_BUILD_REPORT.md`.
