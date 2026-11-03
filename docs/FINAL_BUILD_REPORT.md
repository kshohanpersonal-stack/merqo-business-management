# Final Build Report — NOT COMPLETE

Last updated: 2026-11-03. **This is not a release report.** No Windows installer, no
installation/activation test, no code-signed binary, no tag, no GitHub Release and no
Windows artefact checksums exist yet. The strict completion gate is **BLOCKED**.

## What has been built and verified on Linux

| Item | Result | Evidence |
| --- | --- | --- |
| Renderer bundle | PASS | `docs/BUILD_HISTORY.md` B-001 |
| Electron main + preload bundles | PASS | B-002 |
| Owner-only generator SEA blob + CLI | PASS | B-004 |
| Full Vitest suite | 41/41 PASS | `docs/TESTING_STATUS.md` |
| Database verification | 30/30 PASS | `scripts/database/verify.mjs` |
| Live preview API end-to-end | 12/12 PASS | `scripts/dev/smoke-preview.mjs` |
| Typecheck / lint / format / licences | PASS | `docs/TESTING_STATUS.md` |
| Windows installer / EXE / signed build / release | **BLOCKED** | KI-001, KI-002, KI-013, KI-015 |

## Required before this file can become a real final build report

1. Owner supplies a production Ed25519 keypair (replace `src/core/public-key.ts`) and a
   Windows code-signing certificate in CI secrets.
2. `windows-latest` CI builds the NSIS installer and owner-only generator EXE, verifies
   outputs, and produces SHA-256 checksums.
3. Installation, shortcuts, icon, uninstaller, first-run activation, business setup, POS,
   returns, backup/restore, Bangla exports and thermal printing are tested on real Windows
   hardware; results recorded in `docs/TEST_CASES.md`.
4. A version tag creates the GitHub Release with **authorised public assets only** — main
   installer, activation component (in-app, no separate EXE), checksums and notes. The
   generator EXE and private key must remain private.
5. `docs/MASTER_REQUIREMENT_CHECKLIST.md` has no mandatory `BLOCKED`/`FAILED`/`NOT TESTED`
   item, and `docs/TESTING_STATUS.md`, `docs/KNOWN_ISSUES.md`, `docs/BUILD_HISTORY.md` and
   this file are refreshed with real artefact sizes, hashes and results.

Until then, MERQO must not be described as a released or production-ready Windows product.
