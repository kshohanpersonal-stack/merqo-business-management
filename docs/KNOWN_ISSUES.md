# Known Issues & Limitations

Last updated: 2026-11-03. Every entry is real; nothing is hidden to protect a status claim.

| ID | Severity | Area | Description | Status / mitigation |
| --- | --- | --- | --- | --- |
| KI-001 | HIGH | Environment | Linux sandbox has no Wine, Xvfb or Windows host. NSIS installer cannot be built or installed here. | Windows build delegated to `windows-latest` CI; physical install QA `BLOCKED` until owner runs it |
| KI-002 | HIGH | Release | No code-signing certificate available. Unsigned Windows binaries trigger SmartScreen warnings. | Owner must provision a certificate via GitHub Actions secrets before a public final release |
| KI-003 | MEDIUM | Hardware | No thermal printer or barcode scanner attached to the sandbox. | Software paths tested; physical device tests `NOT TESTED` |
| KI-004 | MEDIUM | PDF | Node/pdfkit fallback does not perform full Indic glyph shaping. | Production PDF uses Chromium `printToPDF`; fallback documented as limited |
| KI-005 | MEDIUM | Security | Password hashing uses scrypt (OWASP fallback) rather than Argon2id to avoid a native module. | Parameters stored per user for future migration; recorded as post-1.0 hardening |
| KI-006 | MEDIUM | Security | Main database is not encrypted at rest; Windows ACLs are the control. Encrypted backups are supported. | SQLCipher + key management is a roadmap item |
| KI-007 | LOW | Licensing | Device fingerprint majority-matching cannot resist deliberate hardware spoofing or binary patching. | Documented threat-model boundary; owner-controlled transfer policy |
| KI-008 | LOW | Localization | VAT/tax reporting is generic, not an NBR-certified statutory return. | Owner must confirm required statutory format |
| KI-009 | LOW | Branding | Final product name/trademark clearance is pending owner review. | MERQO remains company identity |
| KI-010 | RESOLVED | Process | First session had no build or test result. | Resolved: see `docs/TESTING_STATUS.md` and `docs/BUILD_HISTORY.md` |
| KI-011 | HIGH | Licensing | `src/core/public-key.ts` embeds the **development** Ed25519 public key and the matching private key exists only in ignored `private/`. | Owner must generate a production keypair, replace the embedded public key, and keep the private key off all public assets |
| KI-012 | MEDIUM | UI QA | No browser/Chromium/Playwright binary is available in the sandbox, so visual layout, multi-size responsiveness, keyboard navigation and dead-control checks are untested. | Run a real Windows browser/Electron QA pass; `R-P14-UI-003/004/008` are `BLOCKED` |
| KI-013 | MEDIUM | CI | Four GitHub Actions workflows are written but have never been executed; no tag, release, checksum or signed artefact exists. | Owner must push a version tag and review the `windows-latest` run |
| KI-014 | LOW | Dependencies | ExcelJS 4.4.0 is MIT but ~3 years stale; a maintained MIT fork `@excel.js/exceljs` exists. | `npm run licenses` passes; consider migration before commercial release |
| KI-015 | MEDIUM | Completeness | Final strict completion gate cannot be met here: Windows installer, installation/activation testing, hardware QA, signed release and final build report are outstanding. | 39 requirements are explicitly `BLOCKED` in the master checklist; no production-readiness claim is made |

The owner-only generator EXE and private signing key must never be published as public repo
or release assets. Customer-facing receipts contain no MERQO software advertising.
