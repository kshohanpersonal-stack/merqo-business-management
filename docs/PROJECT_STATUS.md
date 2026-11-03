# Project Status — Phase A checkpoint

Last updated: 2026-11-03 · Branch: `arena/e53fcc9d-merqo-business-management`

## Repository state at checkpoint

| Item | Value |
| --- | --- |
| HEAD before checkpoint | `f7d78d5` |
| Remote branch | same commit, clean working tree before generated evidence refresh |
| Tags / GitHub Releases | none |
| Repository visibility | public; default branch `main` |
| Latest green CI on `f7d78d5` | CI `41646629269`, Security `41646629348`, Windows `41646629301` |

## Reproducible verification executed at this checkpoint

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors / 0 warnings) |
| `npm run format:check` | PASS |
| `npm test` | 11 files / 41 tests PASS, 25.04 s (fresh `docs/test-results.json`) |
| `npm run db:verify` | 30/30 PASS |
| `npm run licenses` | 708 packages allow-listed, PASS |
| `npm run secrets` | 152 tracked files, PASS |
| `npm run build` | renderer + Electron main/preload PASS |
| `npm run build:generator` | PASS |
| `npm run smoke` | 12/12 PASS on a fresh preview database |

## Phase A audit findings

1. The existing 127-action dispatcher, 49-table SQLite schema, 28 report families,
   Ed25519 licensing, backup/restore, Electron shell and four CI workflows are real and
   reproducible; they must be preserved.
2. The owner has now explicitly decided **not** to purchase an OV/EV code-signing
   certificate. Several existing documents still instruct the owner to buy one; these must
   be corrected to an honest unsigned-distribution policy.
3. No production Ed25519 public key has been supplied; the installer continues to embed
   the clearly identified development key. No private key is committed.
4. No Windows installation, activation, shortcut/uninstall, printer, scanner or
   hardware-change QA has been performed. No browser visual QA had been executed because
   no system browser binary was installed.
5. A working headless Chromium is available from the npm-registry package
   `@sparticuz/chromium` (binary included in the tarball; no external browser download
   host needed). This makes real renderer visual QA possible on Linux CI.
6. The `language` setting exists and an English option is shown in Settings, but the
   renderer is almost entirely hardcoded Bangla. English UX is not yet functional.
7. The 12-check preview smoke test does not yet cover the full 18-step owner workflow
   (supplier, purchase, partial payment, due collection, return, expense, restore,
   restart persistence, receipt reprint).
8. Missing persistent progress/delivery documents: `PROJECT_STATUS.md`,
   `IMPLEMENTATION_CHECKLIST.md`, `KNOWN_LIMITATIONS.md`, `INSTALLATION_GUIDE.md`,
   `BUILD_RELEASE_GUIDE.md`, `BACKUP_RESTORE_GUIDE.md`, `DEVELOPMENT_GUIDE.md`.
9. No version tag or GitHub Release exists. Creating one now would be premature because
   hardware, Windows-install and production-key criteria are not met.

## Prioritized execution plan (Phases B–I)

1. **B/C/D/F evidence**: add a real headless-Chromium visual QA script and run it at
   1280×720, 1366×768, 1440×900 and 1920×1080; add DOM checks for Bangla text, focus,
   keyboard navigation, dead controls and overflow. Record screenshots as evidence.
2. **C/F**: add a comprehensive end-to-end workflow test that covers the owner's 18
   steps through the real dispatcher, including backup/restore and restart persistence.
3. **E**: implement a functional Bangla/English language layer for the shell and common
   UI strings; document exact coverage and any residual limitation.
4. **D/H**: correct all unsigned-distribution documentation, add the missing guides and
   progress files, and keep the checklist honest.
5. **H/I**: re-run every local check, push, verify all three workflows on the final
   commit, regenerate Windows artifacts/checksums, and refresh the final report.
6. Do **not** create a production tag or public Release until the documented mandatory
   gates are satisfied.

## Resume instruction

On interruption, read this file, `git log -1`, `git status`,
`docs/IMPLEMENTATION_CHECKLIST.md`, `docs/KNOWN_LIMITATIONS.md`,
`docs/FINAL_BUILD_REPORT.md` and `gh run list`, then resume at the first unfinished plan
item. Never reset or force-push existing work.
