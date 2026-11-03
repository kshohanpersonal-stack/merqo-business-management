# MERQO Project Master Plan

Version: 0.1.0 · Date: 2026-11-03 · Phase: 1 → 2 in progress

## 1. Objective

Deliver an actual offline-first, lifetime-licensed Windows business management and super
shop POS product, with real local SQLite data, correct Bangla, accurate financial logic,
secure offline licensing, reports/exports, backup/restore, a Windows installer and a
versioned GitHub release. A prototype is not acceptable.

## 2. Requirement baseline

`docs/requirements.json` is the canonical requirement register (generated from
`scripts/dev/requirements_data.py`). `docs/MASTER_REQUIREMENT_CHECKLIST.md` is its
human-readable view. IDs are stable and referenced from code comments, tests and
documentation. No requirement is silently dropped; anything not implementable in the
current environment is recorded as `BLOCKED` with the exact reason in
`docs/KNOWN_ISSUES.md`.

## 3. Phase plan and dependencies

| # | Phase | Depends on | Exit criterion |
| --- | --- | --- | --- |
| 1 | Research & requirement analysis | — | This plan, research report, architecture, schema, risk register, checklist committed |
| 2 | Project setup | 1 | Dependencies, lint/typecheck/test/build scripts, CI workflows, VERSION, state docs, pushed commit |
| 3 | Database & core engine | 2 | Schema/migrations, transactions, auth, permissions, audit, money helpers, reliability tests passing |
| 4 | UI/UX implementation | 3 | Design system, shell, navigation, dashboard, forms, tables, notifications, settings UI |
| 5 | Business modules | 3,4 | Every module functional against the real database, not a stub |
| 6 | Hardware & documents | 5 | Scanner input, receipt rendering/printing, CSV/XLSX/PDF exports, font bundling |
| 7 | Licensing | 2,3 | Generator, Ed25519 verification, device binding, offline activation, tamper tests |
| 8 | Integration | 3–7 | Cross-module reconciliation tests |
| 9 | QA | 8 | Functional, DB, integration, security, performance, UI, backup, export, crash tests executed; failures fixed |
| 10 | Final Windows build | 9 | Real Windows installer + artifacts from Windows runner; install/first-launch test |
| 11 | Release | 10 | Verified tag, authorized public assets, private generator artifact, notes, checksums, reports |

## 4. Work breakdown and module dependency order

```
config/money/errors/validation
        ↓
database (schema, migrations, transaction runner)
        ↓
auth + permissions + audit + settings + notifications
        ↓
catalog → units/conversions → inventory (weighted-average cost)
        ↓
parties (customers/suppliers) → accounts → ledger
        ↓
purchases → sales/POS → payments → returns/adjustments → expenses
        ↓
reports → analytics/dashboard → exports → backup/restore
        ↓
licensing → activation → first-run wizard
        ↓
Electron shell / IPC / installer / CI / release
```

## 5. Definition of done (per module)

1. Requirement IDs mapped to code and tests. 2. Real schema columns and constraints.
3. Parameterized queries only. 4. Atomic transaction with idempotency key. 5. Permission
check and audit record for sensitive actions. 6. Validation and useful Bangla error text.
7. Functional UI wired to the dispatcher. 8. Unit + integration tests executed.
9. Documentation updated. 10. Checklist evidence updated. 11. Committed and pushed.

## 6. Environment reality (must be respected)

* Sandbox: Linux x64, Node 22, npm, gcc/g++/make, Python 3.11. No Wine, no Xvfb, no
  Windows host, no physical thermal printer or barcode scanner. The owner declined an
  OV/EV certificate; unsigned distribution is accepted. Headless Chromium is available
  from the npm registry for renderer visual QA.
* GitHub access verified: authenticated as `kshohanpersonal-stack`; remote
  `https://github.com/kshohanpersonal-stack/merqo-business-management.git`; working
  branch `arena/e53fcc9d-merqo-business-management`.
* Therefore: Windows NSIS builds and installer/first-launch tests must run on the
  `windows-latest` GitHub Actions runner. Physical hardware tests remain `NOT TESTED`
  until hardware is available. These are documented blockers, never hidden.

## 7. Communication and continuity

At the end of every session: update `DEVELOPMENT_PROGRESS.md`,
`MASTER_REQUIREMENT_CHECKLIST.md`, `KNOWN_ISSUES.md`, `BUILD_HISTORY.md`,
`TESTING_STATUS.md` and `NEXT_ACTIONS.md`; commit and push. On `CONTINUE`, read those
files plus the latest commit and test/build logs, then resume the exact next task.
