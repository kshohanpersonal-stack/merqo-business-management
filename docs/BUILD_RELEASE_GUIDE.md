# Build and Release Guide

## Local development build

```bash
npm ci
npm run dev            # Vite preview + /api core bridge
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run db:verify
npm run licenses
npm run secrets
npm run smoke
```

On Windows use `npm ci --ignore-scripts` followed by
`node node_modules/electron/install.js`. `better-sqlite3@13.0.3` ships N-API prebuilds;
`electron-builder.yml` sets `npmRebuild: false`. Never run
`electron-builder install-app-deps`.

## Windows CI artifacts

`.github/workflows/build-windows.yml` runs on `windows-latest`:

1. `npm ci --ignore-scripts`, explicit Electron install, typecheck, 41/41 Vitest tests,
   production build, SQLite N-API load check.
2. `npx electron-builder --win --x64 --publish never` → unsigned NSIS installer.
3. Secret scan of public output, owner-only Node SEA licence generator EXE.
4. SHA-256 checksums for both public and private outputs.
5. Two artifacts: `MERQO-Windows-Installer` (public candidate) and
   `MERQO-OWNER-ONLY-License-Generator` (protected, 7-day retention, never a public
   release asset).

## Release gate

Do **not** push a `v*` tag or create a public Release until all of the following are true:

* critical modules are implemented and covered by executed tests;
* no known critical data-loss defect remains;
* production Ed25519 public key is installed and the private key is protected;
* Windows installation/activation/shortcut/uninstall QA is recorded;
* installer contents and checksums are verified;
* unsigned status is disclosed in the notes;
* documentation matches the application.

`release.yml` creates a **draft** release only after a tag; the owner must review and
publish. The licence generator and private key are never attached to that release.

## Unsigned distribution

The owner explicitly declined an OV/EV certificate. Release notes must state that the
build is unsigned, the publisher is unverified and SmartScreen/Defender warnings may
vary by system. No security bypass instructions are allowed. Final CI/Security/Windows
runs must correspond to the exact release commit.
