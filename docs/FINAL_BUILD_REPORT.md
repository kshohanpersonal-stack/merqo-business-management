# Final Build Report — NOT A PRODUCTION RELEASE

Last updated: 2026-11-03 · Phase A checkpoint `7cd19bb`; delivery commit `8201bc7` is green; final security-upgrade delivery commit and CI run IDs are recorded in the final delivery answer.
This is an evidence report, not a released-product claim. Windows NSIS installer and
owner-only generator EXEs exist as protected, **unsigned**, development-key CI artifacts
from historical runs. There is no installation/activation test, no production public key,
no version tag, no GitHub Release and no published production build. The strict
completion gate remains **BLOCKED** for external/hardware and production-key items.

## What has been built and verified locally on the current worktree

| Item | Result | Evidence |
| --- | --- | --- |
| Renderer + Electron main/preload bundles | PASS (Vite 7.3.7; `main.cjs` 1002.2 kB) | `npm run build` |
| Owner-only generator SEA blob + CLI | PASS | `npm run build:generator` (17,756-byte blob) |
| Full Vitest suite (local) | 41/41 PASS, 26.45 s | `docs/test-results.json` |
| Database verification | 30/30 PASS | `npm run db:verify` |
| Typecheck / lint / format | PASS | local commands |
| Third-party licences | 682 packages allow-listed, PASS | `npm run licenses` |
| Dependency audit | `npm audit --audit-level=high` PASS: 0 high/critical, 28 moderate advisories disclosed | local command; `docs/KNOWN_ISSUES.md` KI-018 |
| Tracked-file secret scan | PASS | `npm run secrets` |
| Preview API smoke | 12/12 PASS | `npm run smoke` |
| 18-step owner E2E workflow | 18/18 PASS | `docs/e2e-workflow.json` |
| Headless Chromium visual QA | 18 pages / 4 viewports / 6 screenshots; 18/18 English nav probes; Bangla restored; no overflow, unnamed controls, focus, font or console errors | `docs/visual-qa/report.json`, `docs/visual-qa/*.png` |
| Offline Ed25519 activation, tamper/device checks | PASS in unit/integration/E2E | `tests/unit/licensing.test.ts`, `tests/integration/activation.test.ts`, `docs/e2e-workflow.json` |
| Backup create/verify/restore/restart persistence | PASS | `tests/integration/backup.test.ts`, `docs/e2e-workflow.json` |
| Financial reconciliation and audit trail after restore/restart | PASS (10 checks, audit rows present) | `docs/e2e-workflow.json` |

## Historical Windows CI artifacts (not released)

| Run / commit | Artifact | Uploaded ZIP SHA-256 | Notes |
| --- | --- | --- | --- |
| `41646629301` / `f7d78d5` | `MERQO-Windows-Installer` (artifact `13235581789`) | `a0e868675dbc50a9a5244db9d9646f24d3820394e1df649988a4a4e605393413` (ZIP 131,637,527 bytes) | unsigned NSIS installer, development public key |
| `41646629301` / `f7d78d5` | `MERQO-OWNER-ONLY-License-Generator` (artifact `13235615213`) | `b65f2bcfcf7bfb611bcaa25c927164bd61c497801ab2ccfd4bfe5869d8b37130` (ZIP 34,334,219 bytes) | protected 7-day artifact; never a public release asset |
| `41645278572` / `efacbaf` | installer artifact `13235565390` | `a961248398bdae438b055bb6b30e45dd7bf3db88961c32570b761c6d6ea8067b` | earlier unsigned technical build |
| `41660526709` / `8201bc7` | `MERQO-Windows-Installer` (artifact `13242046945`) | `5f953eceb37e8743e29c0f2084e98bf603deab0a2e29ed43ab507ab340206e8b` (ZIP 131,641,727 bytes) | unsigned NSIS installer, development public key |
| `41660526709` / `8201bc7` | `MERQO-OWNER-ONLY-License-Generator` (artifact `13241417765`) | `3d4943c09c333df9fb87c567263a94b4a48fed01763419ecf1c48141347d18b5` (ZIP 34,334,219 bytes) | protected 7-day artifact; never a public release asset |
| `41642232644` / `3b11e3a` | installer artifact `13232244667` | `b6b839c20657ed46c8f44ec29c3de4a94d64de6528d40208e9f1a2be95d64323` | earlier unsigned technical build |

Per-file `SHA256SUMS.txt` / `SHA256SUMS-PRIVATE.txt` were generated in CI but the
sandbox cannot download artifact blobs; the values above are uploaded ZIP checksums
from successful run logs/artifact metadata, not invented per-file installer hashes.

## Unsigned distribution policy

The owner explicitly decided **not** to purchase an OV/EV code-signing certificate.
Builds are intentionally unsigned with an unverified publisher. Windows SmartScreen /
Defender warnings vary by file reputation, distribution method and system policy; no
claim of SmartScreen clearance or Microsoft-verified publisher is made. The app does
not disable Defender, SmartScreen or antivirus, and no bypass script is included.

## Remaining gates before any public production release

| Area | Status | Reason |
| --- | --- | --- |
| Windows NSIS install, shortcuts, first-launch activation, uninstall, upgrade | **BLOCKED** | no Windows host / real installation executed |
| Physical 58/80 mm printer, scanner, hardware-change transfer | **BLOCKED** | no hardware attached |
| Production Ed25519 public key | **BLOCKED** | owner has not supplied it; development key embedded |
| Electron-window-specific visual QA | **NOT TESTED** | renderer QA is headless Chromium on Linux |
| Tag-triggered `release.yml`, versioned GitHub Release | **BLOCKED** | owner authorisation and readiness gates not met |
| Final CI/Security/Windows runs on the exact final commit | **TESTING** | re-run on final pushed commit after security upgrades; conclusions and run IDs recorded in final delivery answer |

A successful CI build is not a production release. No tag or Release has been created.
