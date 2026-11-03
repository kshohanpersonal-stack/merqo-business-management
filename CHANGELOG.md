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

### Fixed
- Return parents inserted before child rows (FK failures), percent discounts converted to
  basis points, safety backup history after restore, qualified report sort columns,
  non-transactional `auth.login` for lockout counting, exact single-string device match,
  product-level discount application, and null-safe product updates.
- Windows CI: CRLF schema diff, non-deterministic checklist timestamp, ignored build
  scripts, `EBUSY` on restored DB cleanup, VS 2026 detection, Electron 43 / V8 API
  incompatibility, and npm's automatic node-gyp rebuild during `npm ci`.

### Verified
- `npm test` 41/41 (local ≈22 s; Windows CI 23.84 s), `npm run db:verify` 30/30,
  `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run licenses`
  (708 packages), `npm run build`, `npm run build:generator`, `npm run secrets`
  (152 tracked files), `npm run smoke` 12/12.
- GitHub Actions: CI `41642232635`, Security `41642232646`, Windows build `41642232644`
  all SUCCESS on `3b11e3a`; re-verified after the docs-only push `efacbaf` with CI
  `41645278808`, Security `41645278586`, Windows build `41645278572` all SUCCESS
  (Windows job 4 m 39 s, 41/41 tests in 22.51 s, 152-file secret scan).
- Windows CI produced `MERQO-Setup-0.1.0-x64.exe` (131,626,408 bytes, artifact
  `13232244667`), `MERQO-License-Generator.exe` (protected artifact `13232224614`), and
  SHA-256 checksum files. The `efacbaf` re-build produced the same unsigned,
  development-key outputs as artifacts `13235565390` / `13235615213`; not released.

### Not included / blocked
- Real Windows installation/activation/shortcut/uninstall testing, trusted code-signed
  binaries, physical thermal printer/scanner tests, browser visual QA, production
  Ed25519 public key replacement, tag-triggered GitHub Release and final signed build
  report. See `docs/KNOWN_ISSUES.md` and `docs/FINAL_BUILD_REPORT.md`.
