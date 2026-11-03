# Requirement → Code → Test Traceability

Generated views: `docs/MASTER_REQUIREMENT_CHECKLIST.md` (all 247 requirements with status,
code, tests and 11 verification steps) and `docs/TESTING_STATUS.md` (suite → result).
`docs/requirements.json` is the machine-readable source;
`docs/requirement-overrides.json` and `scripts/dev/update-checklist.py` carry the evidence
used to regenerate it. `docs/TEST_CASES.md` maps TC IDs to executable tests and results.

## Layer map

| Requirement group | Primary code | Primary tests / evidence |
| --- | --- | --- |
| P6-DB | `database/migrations/001_initial.sql`, `src/core/db.ts`, `src/core/schema.generated.ts` | `tests/unit/schema.test.ts`, `scripts/database/verify.mjs` |
| P8-FIN / P7-FIN | `src/core/finance.ts`, `inventory.ts`, `sales.ts`, `purchases.ts`, `expenses.ts` | `tests/integration/sales.test.ts`, `returns.test.ts`, `reports.test.ts` |
| P7-POS / P7-RET | `src/core/sales.ts`, `purchases.ts`, `dispatch.ts`, `src/renderer/pages/Pos.tsx` | `tests/integration/sales.test.ts`, `returns.test.ts` |
| P9-RPT / P10-EXP | `src/core/reports.ts`, `exports.ts`, `printing.ts` | `tests/integration/reports.test.ts` |
| P11-BAK | `src/core/backup.ts` | `tests/integration/backup.test.ts` |
| P12-AUTH / P21-SEC | `src/core/auth.ts`, `sessions.ts`, `permissions.ts`, `audit.ts`, `validation.ts`, `logger.ts` | `tests/security/auth.test.ts` |
| P18-LIC | `src/core/licensing.ts`, `activation.ts`, `src/main/device.ts`, `apps/license-generator/src/index.ts` | `tests/unit/licensing.test.ts`, `tests/integration/activation.test.ts`, Windows artifact 13232224614 |
| P14-UI / P15-ANIM / P16-GRT / P17-KEY | `src/renderer/App.tsx`, `styles.css`, `components.tsx`, `pages/*` | `scripts/dev/smoke-preview.mjs` (data path only); visual QA `BLOCKED` |
| P19-WIN / P20-CI / P28-DEL | `src/main/*`, `src/preload/index.ts`, `electron-builder.yml`, `.github/workflows/*` | Windows CI `41642232644` (installer 13232244667, generator 13232224614) re-verified as `41645278572` (installer 13235565390, generator 13235615213); Linux CI `41642232635` / `41645278808`, Security `41642232646` / `41645278586`; install/release QA `BLOCKED` |
| P22-PERF | `src/core/util.ts`, `reports.ts`, migration indexes | `tests/performance/large-dataset.test.ts` |

## CI evidence (commit `3b11e3a`)

* CI — quality, tests and Linux build: run `41642232635`, **SUCCESS**.
* Security checks: run `41642232646`, **SUCCESS**.
* Windows build — installer and owner-only generator: run `41642232644`, **SUCCESS**
  (job `125938377073`), produced `MERQO-Setup-0.1.0-x64.exe` and
  `MERQO-License-Generator.exe` plus SHA-256 checksum files.
* Re-verification on docs-only commit `efacbaf`: CI `41645278808`, Security
  `41645278586`, Windows build `41645278572` (job `125948863993`) all **SUCCESS**;
  the Windows job re-built the unsigned dev-key installer and owner-only generator EXE.
* Earlier failures and their fixes are recorded in `docs/BUILD_HISTORY.md` B-005..B-011.

## Conventions

* Code and test references are repository-relative paths.
* A requirement is `PASSED` only when all eleven verification steps are true and the
  referenced tests were actually executed.
* `BLOCKED` always names the missing environment/tooling; see `docs/KNOWN_ISSUES.md`.
* CI evidence records the GitHub Actions run ID and job name. Unsigned CI artifacts are
  technical build outputs, not release assets.
