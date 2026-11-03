# Project Status — active delivery checkpoint

Last updated: 2026-11-03 · Branch: `arena/e53fcc9d-merqo-business-management`

## Repository state

| Item | Value |
| --- | --- |
| Phase A checkpoint commit | `7cd19bb` (`checkpoint: Phase A audit, reproducible verification and progress docs`) |
| Remote branch at checkpoint | same commit; subsequent delivery work is committed in this series |
| Tags / GitHub Releases | none; no production release has been published |
| Repository visibility | public; default branch `main` |
| Latest historical green CI on `f7d78d5` | CI `41646629269`, Security `41646629348`, Windows `41646629301` |
| Final HEAD CI | re-run after the final push; conclusions and run IDs are verified in `gh run list` and recorded in the final delivery answer |

## Completed since the Phase A checkpoint

- Integrated a real Bangla/English renderer language layer in `src/renderer/i18n.ts`,
  wired it into `main.tsx`, `App.tsx`, `Auth.tsx`, `System.tsx` and `styles.css`, and
  added a top-bar bn/en toggle plus settings/setup language persistence. English uses a
  boundary-aware dictionary; untranslated phrases remain Bangla rather than producing
  mixed-script corruption. Coverage is intentionally partial and documented.
- Added `scripts/dev/ensure-dev-license.mjs` so clean CI checkouts can generate an
  ephemeral Ed25519 development keypair and licence without committing private material.
  Fixed `scripts/dev/make-dev-license.mjs` to parse the actual `public-key.ts` format.
- Added `scripts/dev/visual-qa.mjs` and `npm run qa:visual`: headless Chromium from the
  npm-bundled `@sparticuz/chromium` plus `playwright-core`. It activates/sets up through
  the real UI, visits 18 pages at four desktop viewports, checks overflow, Bangla font,
  keyboard focus, accessible control names, console errors and the bn/en switch, and
  writes `docs/visual-qa/report.json` plus six screenshots.
- Added `scripts/dev/e2e-workflow.mjs` and `npm run qa:e2e`: 18/18 real-dispatcher
  workflow checks from first launch through activation, setup, master data, purchase,
  POS, receipt, due collection, return, expense, reports, backup/restore, restart and
  reconciliation; evidence in `docs/e2e-workflow.json`.
- Added `format:check`, `db:verify`, `qa:e2e` and `qa:visual` to Linux CI,
  `db:verify` to Windows CI, and QA evidence upload. Corrected `release.yml` to describe
  unsigned distribution honestly. Updated the 247-item requirement register to
  `17 IMPLEMENTED / 154 TESTING / 51 PASSED / 0 FAILED / 25 BLOCKED` from executed evidence.
- Corrected stale certificate/SmartScreen wording across the delivery docs to the
  owner's explicit decision: unsigned distribution is accepted; no OV/EV purchase, no
  Defender/SmartScreen bypass, no trusted-publisher claim.

## Reproducible verification executed on the current worktree

| Check | Result |
| --- | --- |
| `npm run format:check` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors / 0 warnings) |
| `npm test` | 11 files / 41 tests PASS, 24.10 s (fresh `docs/test-results.json`) |
| `npm run db:verify` | 30/30 PASS |
| `npm run licenses` | 723 installed packages allow-listed, PASS |
| `npm run secrets` | 173 tracked files after staging all delivery files, PASS |
| `npm run build` | renderer + Electron main/preload PASS |
| `npm run build:generator` | PASS (SEA blob 17,756 bytes; CLI smoke test) |
| `npm run smoke` | 12/12 PASS on a fresh preview database |
| `npm run qa:e2e` | 18/18 PASS |
| `npm run qa:visual` | 18 pages / 4 viewports / 6 screenshots; 18/18 English nav probes; Bangla restored; no overflow, unnamed controls, focus, font or console errors |

## Remaining blockers / limitations

- Production Ed25519 public key has not been supplied; `src/core/public-key.ts` remains
  the clearly identified development key. No private key is committed.
- No real Windows installation, activation, shortcut/uninstall, startup/shutdown,
  upgrade, printer, scanner, hardware-change transfer, crash-recovery or cross-PC
  restore QA. The NSIS installer and owner-only generator are built in Windows CI only.
- No Electron-window-specific visual QA; renderer QA is headless Chromium on Linux.
- English UI coverage is dictionary-based and partial; Bangla remains primary.
- No version tag, public GitHub Release or release notes. A successful build is not a
  production release. The owner accepts an unsigned installer; this is not a blocker,
  but unverified-publisher and variable SmartScreen behaviour must be disclosed.
- Final CI/Security/Windows runs are executed on the exact delivery commit; their
  conclusions and run IDs are verified in `gh run list` and recorded in the final
  delivery answer.

## Exact next action

The delivery series is committed and pushed on the session branch. CI / Security /
Windows workflows are re-run, their conclusions matched to the final commit, and the
final run IDs and artifact IDs recorded in the final delivery answer. Do **not**
create a tag or public Release until the owner explicitly authorises it and the
remaining external/hardware gates are honestly disclosed.

## Resume instruction

On interruption, read this file, `git log -1`, `git status`,
`docs/IMPLEMENTATION_CHECKLIST.md`, `docs/KNOWN_LIMITATIONS.md`,
`docs/FINAL_BUILD_REPORT.md` and `gh run list`, then resume at the first unfinished
item. Never reset or force-push existing work.
