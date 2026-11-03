# Known Limitations

Last updated: 2026-11-03. This file restates the real boundaries of the current MERQO
build. It does not replace `docs/KNOWN_ISSUES.md`; it is the owner-facing limitation list.

## Distribution

* MERQO is distributed as an **unsigned** Windows NSIS installer by explicit owner
  decision. No OV/EV code-signing certificate will be purchased. Windows SmartScreen may
  show an "unverified publisher" warning; behaviour varies by reputation and policy. The
  application does not disable Defender, SmartScreen or antivirus, and no security bypass
  is included.
* No trusted Authenticode signature and no Microsoft-verified publisher claim is made.
* No version tag, public GitHub Release or release notes have been published. A successful
  CI build is not a production release.
* The owner-only License Generator EXE and Ed25519 private key are never public release
  assets. The generator is a protected 7-day GitHub Actions artifact.

## Licensing

* `src/core/public-key.ts` contains the **development** Ed25519 public key. Production
  activation requires the owner to replace it with a production public key and keep the
  matching private key outside the repository and all public artifacts.
* Offline lifetime activation, tamper rejection and device binding are implemented and
  tested; real hardware-change/recovery transfer on a second PC is not tested.

## Environment-dependent QA

* No real Windows installation, first-launch activation, Start Menu/desktop shortcut,
  uninstall, upgrade or user-data-directory survival test has been executed.
* No physical 58/80 mm thermal printer or USB/Bluetooth barcode scanner test.
* No Electron-window-specific visual QA. Renderer visual QA **has** been executed in
  headless Chromium at four desktop sizes (18 pages, six screenshots); see
  `docs/visual-qa/report.json` and `docs/TESTING_STATUS.md`.
* Startup time, long-session memory, crash recovery under power loss and cross-PC backup
  migration remain NOT TESTED.
* The 18-step owner workflow was executed against the real dispatcher and SQLite in
  `npm run qa:e2e`; this is not a substitute for installation/hardware QA.

## Localization

* Bangla is the primary UI language. A dictionary-based English layer translates shell
  navigation, settings, setup and common dashboard phrases; coverage is partial and
  untranslated strings remain Bangla rather than mixed-script text. Visual QA verified
  18/18 English navigation labels and Bangla restoration. It is not a complete
  professional translation of every dynamic string.

## Product scope boundaries

* VAT/tax reporting is generic, not an NBR-certified statutory return.
* The main database is not encrypted at rest; Windows ACLs are the control. Encrypted
  backups are supported.
* Password hashing uses scrypt (OWASP fallback), not Argon2id.
* ExcelJS 4.4.0 is MIT but stale; a maintained fork is a post-1.0 consideration.
* `npm audit --audit-level=high` passes after security upgrades and the Security workflow
  now fails on high/critical advisories; 28 moderate transitive build/test-tool advisories
  remain and are disclosed in `docs/KNOWN_ISSUES.md` KI-018.
* English UI coverage is described honestly in `docs/USER_MANUAL.md`; Bangla is primary.

## Security

* RBAC, parameterized SQL, input validation, redacted logs/errors and offline Ed25519
  verification are implemented and covered by unit/integration/security tests.
* No production private key is embedded in the customer app or committed to the repo.
* Owner-only generator and private keys must remain private; never publish them in
  GitHub Releases.
* Dependency versions were upgraded for security (Vite 7.3.7, Vitest 4.1.12, Zod 4.6.7,
  electron-builder 26.18.0, react-is 19.2.0); moderate audit advisories remain disclosed.
