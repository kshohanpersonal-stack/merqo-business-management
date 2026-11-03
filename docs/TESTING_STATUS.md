# Testing Status — actual executed results

Last updated: 2026-11-03. Every number below comes from an executed command; compilation
is never counted as an application test. Machine-readable Vitest output:
`docs/test-results.json` (latest local full run: 11 files / 41 tests, 26.45 s).

## Executed suites (local Linux sandbox, current worktree)

| Suite | Command | Result | Evidence |
| --- | --- | --- | --- |
| Unit (money, schema, licensing, barcode) | `npm test` | **17/17 PASSED** | `tests/unit/*.test.ts` |
| Sales integration | `npm test` | **5/5 PASSED** | `tests/integration/sales.test.ts` |
| Returns / refunds / exchange / adjustments | `npm test` | **6/6 PASSED** | `tests/integration/returns.test.ts` |
| Reports / 28 report families / exports | `npm test` | **3/3 PASSED** | `tests/integration/reports.test.ts` |
| Activation / first-run setup | `npm test` | **2/2 PASSED** | `tests/integration/activation.test.ts` |
| Backup / tamper / encryption / safe restore | `npm test` | **2/2 PASSED** | `tests/integration/backup.test.ts` |
| Security / auth / RBAC / injection / paths / logs | `npm test` | **5/5 PASSED** | `tests/security/auth.test.ts` |
| Performance (10,000 products) | `npm test` | **1/1 PASSED** — search p95 **8.0 ms**, dashboard **5.6 ms** | `tests/performance/large-dataset.test.ts` |
| **Full Vitest suite** | `npm test` | **11 files / 41 tests PASSED, 0 failed** (26.45 s) | `docs/test-results.json` |
| Database verification | `npm run db:verify` | **30/30 checks PASSED** | `scripts/database/verify.mjs` |
| TypeScript | `npm run typecheck` | **PASSED** (0 errors) | — |
| ESLint | `npm run lint` | **PASSED** (0 errors, 0 warnings) | — |
| Prettier | `npm run format:check` | **PASSED** | — |
| Third-party licences | `npm run licenses` | **PASSED** — 682 installed packages allow-listed | `docs/architecture/THIRD_PARTY_LICENSES.md` |
| Dependency audit | `npm audit --audit-level=high` | **PASSED** — 0 high/critical, 28 moderate advisories disclosed | local command; `docs/KNOWN_ISSUES.md` KI-018 |
| Secret scan (tracked files) | `npm run secrets` | **PASSED** — 173 tracked files after staging all delivery files | `scripts/dev/secret_scan.py` |
| Renderer + Electron bundles | `npm run build` | **PASSED** | `dist/`, `dist-electron/` |
| Owner-only generator | `npm run build:generator` | **PASSED** — SEA blob 17,756 bytes; CLI `help` smoke test | `dist-electron/license-generator.blob` |
| Live preview API end-to-end | `npm run smoke` | **12/12 PASSED** | fresh DB → activation → setup → product → sale → dashboard → report → backup → reconcile |
| 18-step owner workflow | `npm run qa:e2e` | **18/18 PASSED** | `docs/e2e-workflow.json` — activation, setup, product/customer/supplier, purchase→stock, POS, receipt/reprint, due collection, return, expense, reports/CSV, backup/restore, restart, reconcile, audit |
| Headless Chromium visual QA | `npm run qa:visual` | **PASSED** | `docs/visual-qa/report.json`, six screenshots: 18 pages at 1280×720 / 1366×768 / 1440×900 / 1920×1080; 0 horizontal overflow, 0 unnamed controls, focus ring present, Bangla font loaded, 0 console errors |
| Bangla/English switch | `npm run qa:visual` | **PASSED** | 18/18 English navigation labels, no Bangla left in nav, no adjacent-script corruption, `html lang=en`, Bangla restored after BN toggle |

> The final secret scan inspected all 173 tracked files after staging the delivery
> series. Earlier CI rows reporting 152/153 files are historical and remain valid for
> their own commits.

## Executed GitHub Actions runs (historical)

| Run | Workflow | Result | Key steps |
| --- | --- | --- | --- |
| `41642232635` | CI — quality, tests and Linux build | **SUCCESS** | `3b11e3a`: typecheck, lint, `npm test` 41/41, build, 708 licences, 153-file secret scan |
| `41642232646` | Security checks | **SUCCESS** | `3b11e3a`: secret scan, non-blocking `npm audit`, licence allow-list, owner-only-artifact policy |
| `41642232644` | Windows build | **SUCCESS** (4 m 30 s) | `3b11e3a`: 41/41 tests, NSIS installer, generator SEA EXE, checksums, protected artifacts |
| `41645278808` / `41645278586` / `41645278572` | CI / Security / Windows | **SUCCESS** | `efacbaf` docs-only re-verification |
| `41646629269` | CI — quality, tests and Linux build | **SUCCESS** (46 s) | `f7d78d5` re-verification |
| `41646629348` | Security checks | **SUCCESS** (27 s) | `f7d78d5`; `npm audit` produced a non-blocking annotation, all job steps succeeded |
| `41646629301` | Windows build | **SUCCESS** (3 m 34 s) | `f7d78d5`: 41/41 tests, unsigned NSIS installer, owner-only generator, checksums, protected artifacts |
| `41660526854` | CI — quality, tests and Linux build | **SUCCESS** | `8201bc7`: 41/41 tests, 30/30 DB checks, 18/18 E2E, visual QA, build, 723 licences, secret scan, QA evidence artifact `13242311120` |
| `41660526869` | Security checks | **SUCCESS** | `8201bc7`: secret scan, `npm audit` non-blocking annotation at that commit, licence allow-list, owner-only-artifact policy |
| `41660526709` | Windows build | **SUCCESS** (5 m 10 s) | `8201bc7`: 41/41 tests, SQLite 3.53.4, unsigned NSIS installer (131,630,712 bytes), owner-only generator, checksums, protected artifacts |

Earlier Windows/CI failures were fixed: `41637701817`, `41637702024`, `41638809098`,
`41638808942`, `41639542221`, `41640347730`, `41641120508`. See
`docs/BUILD_HISTORY.md`. The `8201bc7` Security run still had a non-blocking `npm audit`
annotation; security-driven dependency upgrades after that commit reduce high/critical
findings to zero and the workflow now fails on high/critical advisories rather than
suppressing them. Final CI/Security/Windows runs are executed on the exact
security-upgrade delivery commit; their conclusions and run IDs are verified in
`gh run list` and recorded in the final delivery answer. Workflows were extended with `format:check`, `db:verify`,
`qa:e2e` and `qa:visual`.

## NOT TESTED / BLOCKED

| Area | Status | Reason |
| --- | --- | --- |
| Windows NSIS install, Start Menu/desktop shortcuts, uninstall, upgrade, first-launch activation | **BLOCKED** | Installer built in CI, never installed or activated on real Windows hardware |
| Physical 58/80 mm thermal printing and paper cut | **BLOCKED** | No printer attached |
| USB/Bluetooth barcode scanner wedge input | **BLOCKED** | No scanner attached |
| Windows multi-component device fingerprint / hardware-change transfer | **BLOCKED** | Windows-only identifiers; dev fingerprint used in preview |
| Electron-window-specific visual QA | **NOT TESTED** | Renderer QA executed in headless Chromium, not an installed Electron window |
| Functional click test for every interactive control | **BLOCKED** | Visual QA visited 18 pages and checked focus/naming, but did not click every control |
| Startup time, memory, CPU, barcode-scan latency, crash-recovery under power loss | **NOT TESTED** | Not yet instrumented |
| Cross-PC backup migration and restore on a second machine | **NOT TESTED** | Single sandbox only |
| Tag-triggered `release.yml`, versioned GitHub Release, release notes | **BLOCKED** | No `v0.1.0` tag pushed; owner approval required |
| Production Ed25519 public key in installer | **BLOCKED** | `src/core/public-key.ts` still embeds the development key (KI-011) |

Unsigned distribution is an explicit owner decision, not a failed test: the publisher is
unverified and SmartScreen/Defender warnings may vary. No security bypass is used or
recommended. Windows CI artifacts are technical build outputs, not a released product.
