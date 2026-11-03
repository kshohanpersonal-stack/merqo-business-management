# Requirement → Code → Test Traceability

Generated views: `docs/MASTER_REQUIREMENT_CHECKLIST.md` (all 247 requirements with status,
code, tests and 11 verification steps) and `docs/TESTING_STATUS.md` (suite → result).
`docs/requirements.json` is the machine-readable source;
`docs/requirement-overrides.json` and `scripts/dev/update-checklist.py` carry the evidence
used to regenerate it. `docs/TEST_CASES.md` maps TC IDs to executable tests and results.

## Layer map

| Requirement group | Primary code | Primary tests |
| --- | --- | --- |
| P6-DB | `database/migrations/001_initial.sql`, `src/core/db.ts`, `src/core/schema.generated.ts` | `tests/unit/schema.test.ts`, `scripts/database/verify.mjs` |
| P8-FIN / P7-FIN | `src/core/finance.ts`, `inventory.ts`, `sales.ts`, `purchases.ts`, `expenses.ts` | `tests/integration/sales.test.ts`, `returns.test.ts`, `reports.test.ts` |
| P7-POS / P7-RET | `src/core/sales.ts`, `purchases.ts`, `dispatch.ts`, `src/renderer/pages/Pos.tsx` | `tests/integration/sales.test.ts`, `returns.test.ts` |
| P9-RPT / P10-EXP | `src/core/reports.ts`, `exports.ts`, `printing.ts` | `tests/integration/reports.test.ts` |
| P11-BAK | `src/core/backup.ts` | `tests/integration/backup.test.ts` |
| P12-AUTH / P21-SEC | `src/core/auth.ts`, `sessions.ts`, `permissions.ts`, `audit.ts`, `validation.ts`, `logger.ts` | `tests/security/auth.test.ts` |
| P18-LIC | `src/core/licensing.ts`, `activation.ts`, `src/main/device.ts`, `apps/license-generator/src/index.ts` | `tests/unit/licensing.test.ts`, `tests/integration/activation.test.ts` |
| P14-UI / P15-ANIM / P16-GRT / P17-KEY | `src/renderer/App.tsx`, `styles.css`, `components.tsx`, `pages/*` | `scripts/dev/smoke-preview.mjs` (data path only); visual QA `BLOCKED` |
| P19-WIN / P20-CI / P28-DEL | `src/main/*`, `src/preload/index.ts`, `electron-builder.yml`, `.github/workflows/*` | no Windows run yet — `BLOCKED` |
| P22-PERF | `src/core/util.ts`, `reports.ts`, migration indexes | `tests/performance/large-dataset.test.ts` |

## Conventions

* Code and test references are repository-relative paths.
* A requirement is `PASSED` only when all eleven verification steps are true and the
  referenced tests were actually executed.
* `BLOCKED` always names the missing environment/tooling; see `docs/KNOWN_ISSUES.md`.
* CI evidence, when available, must record the GitHub Actions run URL and job name.
