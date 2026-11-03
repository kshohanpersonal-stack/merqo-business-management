# Build History

Last updated: 2026-11-03. Compilation is recorded separately from application testing.
Local Linux builds, GitHub Actions failures and the final green CI runs are all listed.

| Build ID | Date (UTC) | Command / run | Platform | Version | Result | Artefacts / notes |
| --- | --- | --- | --- | --- | --- | --- |
| B-001 | 2026-11-03 | `npm run build:renderer` | Linux (Vite 7.2.2) | 0.1.0 | **PASS** | `dist/index.html` 2.35 kB, JS 693.19 kB, CSS 14.83 kB, 6 WOFF2 fonts, `merqo-*.png` |
| B-002 | 2026-11-03 | `npm run build:electron` | Linux (esbuild) | 0.1.0 | **PASS** | `dist-electron/main.cjs` 700.3 kB, `dist-electron/preload.cjs` 1.5 kB |
| B-003 | 2026-11-03 | `npm run build` | Linux | 0.1.0 | **PASS** | B-001 + B-002 |
| B-004 | 2026-11-03 | `npm run build:generator` | Linux SEA verification | 0.1.0 | **PASS** | `license-generator.cjs` 17.1 kB, `license-generator.blob` 17,538 bytes; CLI smoke test passed |
| B-005 | 2026-11-03 | Windows `41637701817` (commit `2e5747a`) | `windows-latest` | 0.1.0 | **FAIL** | `npm test` 2/41 failed: `tests/unit/schema.test.ts` compared embedded LF SQL to CRLF SQL from a Windows checkout |
| B-006 | 2026-11-03 | CI `41637702024` (commit `2e5747a`) | `ubuntu-latest` | 0.1.0 | **FAIL** | `git diff --exit-code` after regenerating checklist failed because `generatedAt` was a wall-clock timestamp |
| B-007 | 2026-11-03 | CI `41638809098` (commit `4e5eb31`) | `ubuntu-latest` | 0.1.0 | **FAIL** | `npm run build` could not find `scripts/build/build-electron.mjs`: broad `build/` rule in `.gitignore` excluded the whole directory |
| B-008 | 2026-11-03 | Windows `41638808942` (commit `4e5eb31`) | `windows-latest` | 0.1.0 | **FAIL** | `npm test` 1/41 failed: `EBUSY` deleting `merqo.sqlite` because `restoreBackup()` reopens `ctx.db` but cleanup closed the old handle |
| B-009 | 2026-11-03 | Windows `41639542221` (commit `3234e8e`) | `windows-latest` | 0.1.0 | **FAIL** | `electron-builder install-app-deps` / `@electron/node-gyp` could not recognise Visual Studio 2026 (major 18) |
| B-010 | 2026-11-03 | Windows `41640347730` (commit `9ef4763`) | `windows-latest` | 0.1.0 | **FAIL** | With VS detection worked around, `better-sqlite3@12.4.1` failed 14 V8 API compile errors against Electron 43 headers |
| B-011 | 2026-11-03 | Windows `41641120508` (commit `cda840e`) | `windows-latest` | 0.1.0 | **FAIL** | After upgrading to `better-sqlite3@13.0.3`, plain `npm ci` auto-ran `node-gyp rebuild` on `binding.gyp` and failed again |
| B-012 | 2026-11-03 | Windows `41642232644` (commit `3b11e3a`) | `windows-latest` | 0.1.0 | **PASS** | `npm ci --ignore-scripts`, explicit `node node_modules/electron/install.js`, 41/41 tests (23.84 s), NSIS installer, generator SEA EXE, checksums, two protected artifacts |
| B-013 | 2026-11-03 | CI `41642232635` (commit `3b11e3a`) | `ubuntu-latest` | 0.1.0 | **PASS** | Full quality gate green; test evidence artifact `ci-test-results` |
| B-014 | 2026-11-03 | Security `41642232646` (commit `3b11e3a`) | `ubuntu-latest` | 0.1.0 | **PASS** | Secret scan, audit, 708-package licence allow-list, owner-only-artifact policy |
| B-015 | 2026-11-03 | Windows `41645278572` (commit `efacbaf`) | `windows-latest` | 0.1.0 | **PASS** | Docs-only push re-verification: 41/41 tests (22.51 s), `npm ci --ignore-scripts`, explicit Electron install, NSIS installer, 152-file secret scan, generator SEA EXE, checksums, two artifacts |
| B-016 | 2026-11-03 | CI `41645278808` (commit `efacbaf`) | `ubuntu-latest` | 0.1.0 | **PASS** | Full quality gate green after removing an accidentally tracked `.pyc`; 152 tracked files scanned |
| B-017 | 2026-11-03 | Security `41645278586` (commit `efacbaf`) | `ubuntu-latest` | 0.1.0 | **PASS** | Secret scan, audit, 708-package licence allow-list, owner-only-artifact policy |
| B-018 | 2026-11-03 | Windows `41646629301` (commit `f7d78d5`) | `windows-latest` | 0.1.0 | **PASS** | 41/41 tests, unsigned NSIS installer, owner-only generator EXE, checksums, protected artifacts; installer ZIP SHA-256 `a0e868675dbc50a9a5244db9d9646f24d3820394e1df649988a4a4e605393413` |
| B-019 | 2026-11-03 | CI `41646629269` (commit `f7d78d5`) | `ubuntu-latest` | 0.1.0 | **PASS** | Full quality gate green; test evidence artifact |
| B-020 | 2026-11-03 | Security `41646629348` (commit `f7d78d5`) | `ubuntu-latest` | 0.1.0 | **PASS** | Secret scan, non-blocking `npm audit` annotation, licence allow-list, owner-only-artifact policy |

### Windows CI artifacts from B-012 (not released)

| Artifact | File | Size | Artifact ID | Uploaded ZIP SHA-256 |
| --- | --- | --- | --- | --- |
| `MERQO-Windows-Installer` | `MERQO-Setup-0.1.0-x64.exe` | 131,626,408 bytes | 13232244667 | `b6b839c20657ed46c8f44ec29c3de4a94d64de6528d40208e9f1a2be95d64323` (ZIP 131,637,527 bytes) |
| `MERQO-OWNER-ONLY-License-Generator` | `MERQO-License-Generator.exe` + `SHA256SUMS-PRIVATE.txt` | — | 13232224614 | `9cd526803fa2f398e567f0bc4c102aabed46655046eec08d128cccb3a16c2a80` (ZIP 34,334,219 bytes) |

### Windows CI artifacts from B-015 (not released)

| Artifact | File | Size | Artifact ID | Uploaded ZIP SHA-256 |
| --- | --- | --- | --- | --- |
| `MERQO-Windows-Installer` | `MERQO-Setup-0.1.0-x64.exe` | 131,626,411 bytes | 13235565390 | `a961248398bdae438b055bb6b30e45dd7bf3db88961c32570b761c6d6ea8067b` (ZIP 131,637,535 bytes) |
| `MERQO-OWNER-ONLY-License-Generator` | `MERQO-License-Generator.exe` + `SHA256SUMS-PRIVATE.txt` | — | 13235615213 | `64c5f6c8a3f30c248cd5ad6d6dd1aac4cab6339304f8a95ec05f7ff92ea7ee1d` (ZIP 34,334,219 bytes, 7-day retention) |

B-012, B-015 and B-018 outputs are unsigned and embed the development public key.
`SHA256SUMS.txt` and `SHA256SUMS-PRIVATE.txt` were generated and uploaded in B-012; the
sandbox cannot download the artifact blobs, so the individual per-file hashes are not
reproduced here. The owner-only artifact has 7-day retention and is never a public
release asset. The installer is **intentionally unsigned** by owner decision (no OV/EV certificate
will be purchased) and embeds the development Ed25519 public key. Publisher is
unverified; SmartScreen/Defender warnings vary. No security bypass is included.

### Windows CI artifacts from B-018 / `f7d78d5` (not released)

| Artifact | File | Artifact ID | Uploaded ZIP SHA-256 |
| --- | --- | --- | --- |
| `MERQO-Windows-Installer` | `MERQO-Setup-0.1.0-x64.exe` | 13235581789 | `a0e868675dbc50a9a5244db9d9646f24d3820394e1df649988a4a4e605393413` (ZIP 131,637,527 bytes) |
| `MERQO-OWNER-ONLY-License-Generator` | `MERQO-License-Generator.exe` + `SHA256SUMS-PRIVATE.txt` | 13235615213 | `b65f2bcfcf7bfb611bcaa25c927164bd61c497801ab2ccfd4bfe5869d8b37130` (ZIP 34,334,219 bytes, 7-day retention) |

Development-only artefacts intentionally **not** shipped: `private/dev-license.merqolic`,
`private/merqo-dev-ed25519-private.pem`, `private/generator-test.merqolic`,
`private/generator-records.json`, `.merqo-data/`. All are ignored by `.gitignore`.

Before any customer release the owner must replace `src/core/public-key.ts` with the
production public key derived from the real owner-only private key, re-run the Windows
pipeline, verify installation/hardware QA and disclose the unsigned/unverified-publisher
status. No code-signing certificate is required by the owner's distribution decision.
