# Known Limitations

Last updated: 2026-11-03. This file restates the real boundaries of the current MERQO
build. It does not replace `docs/KNOWN_ISSUES.md`; it is the owner-facing limitation list.

## Distribution

* MERQO is distributed as an **unsigned** Windows NSIS installer by explicit owner
  decision. No OV/EV code-signing certificate will be purchased. Windows SmartScreen may
  show an "unverified publisher" warning. The application does not disable Defender,
  SmartScreen or antivirus, and no security bypass is included.
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
  uninstall or user-data-directory survival test has been executed.
* No physical 58/80 mm thermal printer or USB/Bluetooth barcode scanner test.
* No Electron-window-specific visual QA; renderer visual QA is executed in headless
  Chromium on Linux (see `docs/TESTING_STATUS.md`).
* Startup time, long-session memory, crash recovery under power loss and cross-PC backup
  migration remain NOT TESTED.

## Product scope boundaries

* VAT/tax reporting is generic, not an NBR-certified statutory return.
* The main database is not encrypted at rest; Windows ACLs are the control. Encrypted
  backups are supported.
* Password hashing uses scrypt (OWASP fallback), not Argon2id.
* ExcelJS 4.4.0 is MIT but stale; a maintained fork is a post-1.0 consideration.
* English UI coverage is described honestly in `docs/USER_MANUAL.md`; Bangla is primary.

## Security

* No private signing key, customer database, `.merqolic` file or `.pem` file is tracked.
  `npm run secrets` and the Security workflow enforce this on every push.
