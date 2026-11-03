# Final Build Report — NOT COMPLETE

Last updated: 2026-11-03 · source commit `3b11e3a` (plus this evidence refresh).
**This is not a release report.** A Windows NSIS installer and owner-only generator EXE
now exist as protected, unsigned CI artifacts from run `41642232644`, but there is still no
installation/activation test, no trusted code-signed binary, no production public key, no
version tag, no GitHub Release and no final signed build report. The strict completion gate
is **BLOCKED**.

## What has been built and verified

| Item | Result | Evidence |
| --- | --- | --- |
| Renderer bundle | PASS | `docs/BUILD_HISTORY.md` B-001 |
| Electron main + preload bundles | PASS | B-002 |
| Owner-only generator SEA blob + CLI | PASS | B-004 |
| Full Vitest suite (local) | 41/41 PASS, ≈22 s | `docs/TESTING_STATUS.md` |
| Full Vitest suite (Windows CI) | 41/41 PASS, 23.84 s | run `41642232644` |
| Database verification | 30/30 PASS | `scripts/database/verify.mjs` |
| Live preview API end-to-end | 12/12 PASS | `npm run smoke` |
| Typecheck / lint / format / 708 licences / 152-file secret scan | PASS | `docs/TESTING_STATUS.md` |
| Linux CI / Security checks / Windows build workflows | PASS | runs `41642232635` / `41642232646` / `41642232644` |
| Windows NSIS installer (build only) | PASS | `MERQO-Setup-0.1.0-x64.exe`, artifact 13232244667 |
| Owner-only generator EXE (build only) | PASS | artifact 13232224614, 7-day retention |
| SHA-256 checksum files | PASS | `SHA256SUMS.txt`, `SHA256SUMS-PRIVATE.txt` uploaded in B-012 |
| Windows installation / activation / shortcuts / uninstall | **BLOCKED** | KI-001 |
| Trusted code signing / SmartScreen clearance | **BLOCKED** | KI-002 |
| Version tag / GitHub Release / release notes | **BLOCKED** | KI-016 |

## Windows CI artifacts from run 41642232644 (not released)

| Artifact | File | Size | Artifact ID | Uploaded ZIP SHA-256 |
| --- | --- | --- | --- | --- |
| `MERQO-Windows-Installer` | `MERQO-Setup-0.1.0-x64.exe` | 131,626,408 bytes | 13232244667 | `b6b839c20657ed46c8f44ec29c3de4a94d64de6528d40208e9f1a2be95d64323` (ZIP 131,637,527 bytes) |
| `MERQO-OWNER-ONLY-License-Generator` | `MERQO-License-Generator.exe` + `SHA256SUMS-PRIVATE.txt` | — | 13232224614 | `9cd526803fa2f398e567f0bc4c102aabed46655046eec08d128cccb3a16c2a80` (ZIP 34,334,219 bytes) |

The sandbox cannot download artifact blobs, so the individual per-file hashes generated in
`SHA256SUMS.txt` are not reproduced here. The installer embeds the **development** Ed25519
public key and is unsigned for release purposes.

## Required before this file can become a real final build report

1. Owner supplies a production Ed25519 keypair (replace `src/core/public-key.ts`) and a
   Windows code-signing certificate in CI secrets (KI-002/KI-011).
2. Re-run the Windows pipeline so the NSIS installer and generator EXE are built with the
   production key and a trusted signature; record real per-file SHA-256 values.
3. Installation, shortcuts, icon, uninstaller, first-run activation, business setup, POS,
   returns, backup/restore, Bangla exports and thermal printing are tested on real Windows
   hardware; results recorded in `docs/TEST_CASES.md`.
4. A version tag creates the GitHub Release with **authorised public assets only** — main
   installer, checksums and notes. The generator EXE and private key must remain private.
5. `docs/MASTER_REQUIREMENT_CHECKLIST.md` has no mandatory `BLOCKED`/`FAILED`/`NOT TESTED`
   item, and `docs/TESTING_STATUS.md`, `docs/KNOWN_ISSUES.md`, `docs/BUILD_HISTORY.md` and
   this file are refreshed with real artefact sizes, hashes and results.

Until then, MERQO must not be described as a released or production-ready Windows product.
