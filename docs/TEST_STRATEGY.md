# Testing Strategy (Part 25)

## 1. Principles

* A test is `PASSED` only when executed and its assertion succeeded in this environment
  or in a verified CI run. Compilation is not a test.
* Environment-dependent cases are marked `BLOCKED` or `NOT TESTED` with the exact reason.
* Every requirement ID maps to at least one test ID in `docs/TEST_CASES.md`; every test
  maps to code in `src/core/` or `src/renderer/`.
* Actual results are written to `docs/test-results.json` and summarised in
  `docs/TESTING_STATUS.md`.

## 2. Suites

| Suite | Tool | Coverage |
| --- | --- | --- |
| Unit | Vitest | money parsing/rounding, validation, unit conversion, discount/VAT, licence canonicalization, fingerprint matching, report totals, CSV escaping |
| Integration | Vitest + temp SQLite | migrations, constraints, atomic sale/purchase, COGS, ledger, stock, returns, splits, holds, idempotency, backup/restore, reconciliation invariants |
| Security | Vitest | invalid login, lockout, permission enforcement, SQL-injection strings, unsafe paths, licence tamper/wrong device/business, log redaction, secret scan |
| Performance | Vitest + timers | 10k products/customers, indexed search, 1k sales, commit latency, startup query cost, memory trend |
| UI/E2E | Playwright (renderer) or manual Windows QA checklist | window sizes, Bangla rendering, keyboard navigation, dialogs, every button, toast states |
| Installation | Windows CI runner | install, shortcut, Start Menu, first launch, activation, DB init, uninstall |
| Hardware | physical devices | scanner wedge input, 58/80mm print, cut, failure handling |
| Export | Vitest + file parsers | CSV/XLSX/PDF with Bangla + English; numeric/date formatting; totals |
| Crash recovery | Vitest | abrupt close during transaction, WAL replay, integrity check |

## 3. Test case template

`ID | Requirement ref | Description | Preconditions | Steps | Expected | Actual | Status | Evidence`
— stored in `docs/TEST_CASES.md`. Actual results are copied from executed output, never
invented.

## 4. Quality gate

Release is blocked while any critical case is `FAILED`, or any mandatory case is
`BLOCKED`/`NOT TESTED` without an explicit owner-accepted disclosure. Regression suite
runs after every fix. The final report lists exact counts and links to CI logs.
