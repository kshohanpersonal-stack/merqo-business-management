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

### Fixed
- Return parents inserted before child rows (FK failures), percent discounts converted to
  basis points, safety backup history after restore, qualified report sort columns,
  non-transactional `auth.login` for lockout counting, exact single-string device match,
  product-level discount application, and null-safe product updates.

### Verified
- `npm test` 41/41, `npm run db:verify` 30/30, `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `npm run licenses` (722 packages), `npm run build`,
  `npm run build:generator`, and `npm run smoke` 12/12.

### Not included / blocked
- Windows NSIS installer, installation/activation testing, code-signed binaries, physical
  thermal printer/scanner tests, browser visual QA, tag-triggered GitHub Release and final
  build report. See `docs/KNOWN_ISSUES.md` and `docs/FINAL_BUILD_REPORT.md`.
