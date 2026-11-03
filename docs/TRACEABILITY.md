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
| P8-FIN / P7-FIN | `src/core/finance.ts`, `inventory.ts`, `sales.ts`, `purchases.ts`, `expenses.ts` | `tests/integration/sales.test.ts`, `returns.test.ts`, `reports.test.ts`, `docs/e2e-workflow.json` |
| P7-POS / P7-RET | `src/core/sales.ts`, `purchases.ts`, `dispatch.ts`, `src/renderer/pages/Pos.tsx` | `tests/integration/sales.test.ts`, `returns.test.ts`, `docs/e2e-workflow.json` |
| P9-RPT / P10-EXP | `src/core/reports.ts`, `exports.ts`, `printing.ts` | `tests/integration/reports.test.ts`, `docs/e2e-workflow.json` |
| P11-BAK | `src/core/backup.ts` | `tests/integration/backup.test.ts`, `docs/e2e-workflow.json` |
| P12-AUTH / P21-SEC | `src/core/auth.ts`, `sessions.ts`, `permissions.ts`, `audit.ts`, `validation.ts`, `logger.ts` | `tests/security/auth.test.ts` |
| P18-LIC | `src/core/licensing.ts`, `activation.ts`, `src/main/device.ts`, `apps/license-generator/src/index.ts` | `tests/unit/licensing.test.ts`, `tests/integration/activation.test.ts`, `docs/e2e-workflow.json` |
| P5-LOC / P14-UI / P15-ANIM / P16-GRT / P17-KEY | `src/renderer/i18n.ts`, `App.tsx`, `styles.css`, `components.tsx`, `pages/*` | `scripts/dev/visual-qa.mjs`, `docs/visual-qa/report.json`, `scripts/dev/smoke-preview.mjs` |
| P19-WIN / P20-CI / P28-DEL | `src/main/*`, `src/preload/index.ts`, `electron-builder.yml`, `.github/workflows/*` | Historical Windows CI `41646629301` / `f7d78d5` (installer `13235581789`, generator `13235615213`); Linux CI `41646629269`, Security `41646629348`; install/release QA `BLOCKED`; final commit runs recorded in delivery answer |
| P22-PERF | `src/core/util.ts`, `reports.ts`, migration indexes | `tests/performance/large-dataset.test.ts` |
| P25-TST | `tests/`, `scripts/dev/*.mjs` | `docs/test-results.json`, `docs/e2e-workflow.json`, `docs/visual-qa/report.json` |

## CI evidence (historical; final delivery commit runs in delivery answer)

* `3b11e3a`: CI `41642232635`, Security `41642232646`, Windows `41642232644` — SUCCESS.
* `efacbaf` docs-only re-verification: CI `41645278808`, Security `41645278586`,
  Windows `41645278572` — SUCCESS.
* `f7d78d5`: CI `41646629269` (46 s), Security `41646629348` (27 s), Windows
  `41646629301` (3 m 34 s) — SUCCESS. Windows produced an unsigned NSIS installer and
  protected owner-only generator EXE with checksums.
* Earlier failures and fixes: `docs/BUILD_HISTORY.md` B-005..B-011.
* Linux CI now also runs `format:check`, `db:verify`, `qa:e2e` and `qa:visual`; Windows CI
  runs `db:verify`. These extended workflows are re-run on the final delivery commit and
  their run IDs recorded in the final delivery answer.

## Conventions

* Code and test references are repository-relative paths.
* A requirement is `PASSED` only when all eleven verification steps are true and the
  referenced tests were actually executed.
* `BLOCKED` always names the missing environment/tooling; see `docs/KNOWN_ISSUES.md`.
* CI evidence records the GitHub Actions run ID. Unsigned CI artifacts are technical
  build outputs, not release assets. The owner declined OV/EV code signing.
