# Testing Status — actual executed results

Last updated: 2026-11-03. Every number below comes from an executed command; compilation
is never counted as an application test. Machine-readable Vitest output:
`docs/test-results.json`.

## Executed suites

| Suite | Command | Result | Evidence |
| --- | --- | --- | --- |
| Unit (money, schema, licensing, barcode) | `npm test` | **17/17 PASSED** | `tests/unit/*.test.ts` |
| Sales integration | `npm test` | **5/5 PASSED** | `tests/integration/sales.test.ts` |
| Returns / refunds / exchange / adjustments | `npm test` | **6/6 PASSED** | `tests/integration/returns.test.ts` |
| Reports / 28 report families / exports | `npm test` | **3/3 PASSED** | `tests/integration/reports.test.ts` |
| Activation / first-run setup | `npm test` | **2/2 PASSED** | `tests/integration/activation.test.ts` |
| Backup / tamper / encryption / safe restore | `npm test` | **2/2 PASSED** | `tests/integration/backup.test.ts` |
| Security / auth / RBAC / injection / paths / logs | `npm test` | **5/5 PASSED** | `tests/security/auth.test.ts` |
| Performance (10,000 products) | `npm test` | **1/1 PASSED** — search p95 **9.0 ms**, dashboard **5.1 ms** | `tests/performance/large-dataset.test.ts` |
| **Full Vitest suite** | `npm test` | **11 files / 41 tests PASSED, 0 failed** | `docs/test-results.json` |
| Database verification | `npm run db:verify` | **30/30 checks PASSED** | `scripts/database/verify.mjs` |
| TypeScript | `npm run typecheck` | **PASSED** (0 errors) | — |
| ESLint | `npm run lint --max-warnings 0` | **PASSED** (0 errors, 0 warnings) | — |
| Prettier | `npm run format:check` | **PASSED** | — |
| Third-party licences | `npm run licenses` | **PASSED** — 722 installed packages allow-listed | `docs/architecture/THIRD_PARTY_LICENSES.md` |
| Secret scan (tracked files) | `npm run secrets` | **PASSED** — re-run after staging | `scripts/dev/secret_scan.py` |
| Renderer + Electron bundles | `npm run build` | **PASSED** | `dist/`, `dist-electron/` |
| Owner-only generator | `npm run build:generator` | **PASSED** — SEA blob 17,538 bytes; CLI `help` smoke test | `dist-electron/license-generator.blob` |
| Generator issue/verify/list | `node dist-electron/license-generator.cjs …` | **PASSED** — Ed25519 signature verified | ignored `private/` artefacts |
| Live preview API end-to-end | `node scripts/dev/smoke-preview.mjs` | **12/12 PASSED** | fresh DB → activation → setup → product → sale → dashboard → report → backup → reconcile |

## NOT TESTED / BLOCKED

| Area | Status | Reason |
| --- | --- | --- |
| Windows NSIS install, Start Menu/desktop shortcuts, uninstall, first-launch activation | **BLOCKED** | No Windows host, Wine, NSIS or `makensis` in sandbox; requires `windows-latest` CI + owner hardware |
| Physical 58/80 mm thermal printing and paper cut | **BLOCKED** | No printer attached |
| USB/Bluetooth barcode scanner wedge input | **BLOCKED** | No scanner attached |
| Windows multi-component device fingerprint / hardware-change transfer | **BLOCKED** | Windows-only PowerShell/CIM identifiers |
| Browser visual QA at multiple window sizes, no-overlap/dead-control checks | **BLOCKED** | No Chromium/Firefox/Playwright binary available; browser download host not permitted |
| Startup time, memory, CPU, barcode-scan latency, crash-recovery under power loss | **NOT TESTED** | Not yet instrumented |
| Cross-PC backup migration and restore on a second machine | **NOT TESTED** | Single sandbox only |
| GitHub Actions CI, tag-triggered release, checksums, signed artefacts | **BLOCKED** | No workflow run or code-signing certificate |

No test result in this document is inferred. UI screens are implemented and their data path
is exercised by the preview API smoke test, but visual rendering is explicitly untested.
