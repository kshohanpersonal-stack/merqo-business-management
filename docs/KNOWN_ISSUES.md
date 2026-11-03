# Known Issues & Limitations

Last updated: 2026-11-03. Every entry is real; nothing is hidden to protect a status claim.

| ID | Severity | Area | Description | Status / mitigation |
| --- | --- | --- | --- | --- |
| KI-001 | HIGH | Environment | Linux sandbox has no Wine, Xvfb or Windows host, so the NSIS installer cannot be installed or exercised here. | Windows build delegated to `windows-latest` CI; run `41642232644` produced the installer, but physical install QA remains `BLOCKED` |
| KI-002 | HIGH | Release | No owner code-signing certificate is configured. CI artifacts are not signed with a trusted Authenticode certificate, so Windows SmartScreen will warn. | Owner must provision an OV/EV certificate via GitHub Actions secrets before any public final release |
| KI-003 | MEDIUM | Hardware | No thermal printer or barcode scanner attached to the sandbox. | Software paths tested; physical device tests `NOT TESTED` |
| KI-004 | MEDIUM | PDF | Node/pdfkit fallback does not perform full Indic glyph shaping. | Production PDF uses Chromium `printToPDF`; fallback documented as limited |
| KI-005 | MEDIUM | Security | Password hashing uses scrypt (OWASP fallback) rather than Argon2id to avoid a native module. | Parameters stored per user for future migration; recorded as post-1.0 hardening |
| KI-006 | MEDIUM | Security | Main database is not encrypted at rest; Windows ACLs are the control. Encrypted backups are supported. | SQLCipher + key management is a roadmap item |
| KI-007 | LOW | Licensing | Device fingerprint majority-matching cannot resist deliberate hardware spoofing or binary patching. | Documented threat-model boundary; owner-controlled transfer policy |
| KI-008 | LOW | Localization | VAT/tax reporting is generic, not an NBR-certified statutory return. | Owner must confirm required statutory format |
| KI-009 | LOW | Branding | Final product name/trademark clearance is pending owner review. | MERQO remains company identity |
| KI-010 | RESOLVED | Process | First session had no build or test result. | Resolved: see `docs/TESTING_STATUS.md` and `docs/BUILD_HISTORY.md` |
| KI-011 | HIGH | Licensing | `src/core/public-key.ts` embeds the **development** Ed25519 public key; the matching private key exists only in ignored `private/`. The Windows CI installer also embeds this key. | Owner must generate a production keypair, replace the embedded public key, rebuild, and keep the private key off all public assets |
| KI-012 | MEDIUM | UI QA | No browser/Chromium/Playwright binary is available in the sandbox, so visual layout, multi-size responsiveness, keyboard navigation and dead-control checks are untested. | Run a real Windows browser/Electron QA pass; `R-P14-UI-003/004/008` are `BLOCKED` |
| KI-013 | RESOLVED | CI | Four GitHub Actions workflows had never been executed; the first Windows build failed on CRLF SQL comparisons. | Resolved: CI `41642232635`, Security `41642232646`, Windows `41642232644` all green on `3b11e3a`; installer/generator artifacts and checksums produced |
| KI-014 | LOW | Dependencies | ExcelJS 4.4.0 is MIT but ~3 years stale; a maintained MIT fork `@excel.js/exceljs` exists. | `npm run licenses` passes (708 packages); consider migration before commercial release |
| KI-015 | MEDIUM | Completeness | Final strict completion gate cannot be met yet: real Windows installation/activation testing, hardware QA, trusted code signing, signed release and final build report are outstanding. | 28 requirements are explicitly `BLOCKED` in the master checklist; no production-readiness claim is made |
| KI-016 | HIGH | Release | Tag-triggered `release.yml` has not been executed; no `v0.1.0` tag, GitHub Release, release notes or authorised public release assets exist. | Owner must push a semantic version tag after production key/certificate and install QA |
| KI-017 | LOW | Dependencies | `better-sqlite3@13.0.3` ships N-API prebuilds but also contains `binding.gyp`; a plain Windows `npm ci` auto-runs `node-gyp` and fails on VS 2026. | Windows workflows use `npm ci --ignore-scripts` followed by `node node_modules/electron/install.js`; `electron-builder.yml` sets `npmRebuild: false` |

The owner-only generator EXE and private signing key must never be published as public repo
or release assets. Customer-facing receipts contain no MERQO software advertising.
