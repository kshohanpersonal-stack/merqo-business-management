# Testing Status — actual executed results

Last updated: 2026-11-03. Every number below comes from an executed command; compilation
is never counted as an application test. Machine-readable Vitest output:
`docs/test-results.json` (latest local full run: 11 files / 41 tests, ≈22 s).

## Executed suites (local Linux sandbox)

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
| **Full Vitest suite** | `npm test` | **11 files / 41 tests PASSED, 0 failed** (≈22 s) | `docs/test-results.json` |
| Database verification | `npm run db:verify` | **30/30 checks PASSED** | `scripts/database/verify.mjs` |
| TypeScript | `npm run typecheck` | **PASSED** (0 errors) | — |
| ESLint | `npm run lint` | **PASSED** (0 errors, 0 warnings) | — |
| Prettier | `npm run format:check` | **PASSED** | — |
| Third-party licences | `npm run licenses` | **PASSED** — 708 installed packages allow-listed | `docs/architecture/THIRD_PARTY_LICENSES.md` |
| Secret scan (tracked files) | `npm run secrets` | **PASSED** — 152 tracked files | `scripts/dev/secret_scan.py` |
| Renderer + Electron bundles | `npm run build` | **PASSED** | `dist/`, `dist-electron/` |
| Owner-only generator | `npm run build:generator` | **PASSED** — SEA blob 17,538 bytes; CLI `help` smoke test | `dist-electron/license-generator.blob` |
| Generator issue/verify/list | `node dist-electron/license-generator.cjs …` | **PASSED** — Ed25519 signature verified | ignored `private/` artefacts |
| Live preview API end-to-end | `npm run smoke` | **12/12 PASSED** | fresh DB → activation → setup → product → sale → dashboard → report → backup → reconcile |

> Note: the `3b11e3a` CI rows below report 153 tracked files because that commit still
> tracked one generated `.pyc`; it was removed in the evidence refresh, so the current
> local scan and the `efacbaf` CI rows inspect 152 files. Both CI results remain valid.

## Executed GitHub Actions runs (`3b11e3a` and docs-refresh `efacbaf`)

| Run | Workflow | Result | Key steps |
| --- | --- | --- | --- |
| `41642232635` | CI — quality, tests and Linux build | **SUCCESS** | regenerate checklist, typecheck, lint, `npm test` 41/41, build, 708 licences, 153-file secret scan |
| `41642232646` | Security checks | **SUCCESS** | secret scan, `npm audit` (non-blocking), licence allow-list, owner-only-artifact policy |
| `41642232644` | Windows build — installer and owner-only generator | **SUCCESS** (4 m 30 s) | `npm ci --ignore-scripts`, `node node_modules/electron/install.js`, typecheck, `npm test` 41/41 (23.84 s), build, SQLite N-API 3.53.4 load, NSIS installer, 153-file secret scan, generator SEA EXE, SHA-256 checksums, two protected artifacts |
| `41645278808` | CI — quality, tests and Linux build | **SUCCESS** (41 s) | regenerate checklist, typecheck, lint, `npm test` 41/41, build, 708 licences, 152-file secret scan |
| `41645278586` | Security checks | **SUCCESS** | secret scan, `npm audit` (non-blocking), licence allow-list, owner-only-artifact policy |
| `41645278572` | Windows build — installer and owner-only generator | **SUCCESS** (4 m 39 s) | `npm ci --ignore-scripts`, explicit Electron install, typecheck, `npm test` 41/41 (22.51 s), build, SQLite N-API 3.53.4 load, NSIS installer, 152-file secret scan, generator SEA EXE, SHA-256 checksums, two protected artifacts |

Earlier Windows/CI runs failed and were fixed: `41637701817` (CRLF schema diff),
`41637702024` (non-deterministic checklist timestamp), `41638809098` (`scripts/build/`
ignored), `41638808942` (Windows SQLite `EBUSY`), `41639542221` (VS 2026 not recognised
by `@electron/node-gyp`), `41640347730` (better-sqlite3 12 V8 API incompatible with
Electron 43), `41641120508` (npm auto-ran node-gyp during `npm ci`). See
`docs/BUILD_HISTORY.md`.

## NOT TESTED / BLOCKED

| Area | Status | Reason |
| --- | --- | --- |
| Windows NSIS install, Start Menu/desktop shortcuts, uninstall, first-launch activation | **BLOCKED** | Installer built in CI `41642232644` and re-built in `41645278572`, but never installed or activated on real Windows hardware |
| Physical 58/80 mm thermal printing and paper cut | **BLOCKED** | No printer attached |
| USB/Bluetooth barcode scanner wedge input | **BLOCKED** | No scanner attached |
| Windows multi-component device fingerprint / hardware-change transfer | **BLOCKED** | Windows-only PowerShell/CIM identifiers; dev fingerprint used in preview |
| Browser visual QA at multiple window sizes, no-overlap/dead-control checks | **BLOCKED** | No Chromium/Firefox/Playwright binary available; browser download host not permitted |
| Startup time, memory, CPU, barcode-scan latency, crash-recovery under power loss | **NOT TESTED** | Not yet instrumented |
| Cross-PC backup migration and restore on a second machine | **NOT TESTED** | Single sandbox only |
| Tag-triggered `release.yml`, versioned GitHub Release, release notes | **BLOCKED** | No `v0.1.0` tag pushed; owner approval required |
| Trusted code signing / SmartScreen clearance | **BLOCKED** | No owner OV/EV certificate configured; CI artifacts are unsigned for release purposes |
| Production Ed25519 public key in installer | **BLOCKED** | `src/core/public-key.ts` still embeds the development key (KI-011) |

No test result in this document is inferred. UI screens are implemented and their data path
is exercised by the preview API smoke test, but visual rendering is explicitly untested.
Windows CI artifacts from both runs are technical build outputs, not a released or
production-ready product.
