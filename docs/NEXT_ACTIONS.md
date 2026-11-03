# Next Actions

Last updated: 2026-11-03

## Exact next development task

**Owner action required: provision production signing material, then create the release.**
The integrated Phase 3–8 implementation is committed and pushed through `3b11e3a` on
`arena/e53fcc9d-merqo-business-management`. All three push-triggered workflows are green:
CI `41642232635`, Security `41642232646`, Windows build `41642232644`. The Windows build
produced `MERQO-Setup-0.1.0-x64.exe` and `MERQO-License-Generator.exe` as protected,
unsigned, development-key artifacts with SHA-256 checksum files. The checklist now reports
17 IMPLEMENTED / 153 TESTING / 49 PASSED / 0 FAILED / 28 BLOCKED.

1. Replace `src/core/public-key.ts` with the owner's production Ed25519 public key
   (matching an owner-only private key that is never committed) and provision a Windows
   code-signing certificate in GitHub Actions secrets (KI-002/KI-011). Re-run the Windows
   workflow so the installer is rebuilt with the production key and a trusted signature.
2. Push a semantic version tag (e.g. `v0.1.0`) to trigger
   `.github/workflows/release.yml` on `windows-latest`; inspect `gh run list`, verify the
   draft Release contains **authorised public assets only** (installer, checksums, notes)
   and that the generator EXE remains a private artifact (KI-016).
3. On a real Windows machine: install the NSIS package, confirm desktop/Start Menu
   shortcuts and custom icon, first-launch activation with a production licence, business
   setup, first admin, POS → purchase → sale → return → backup → restore, Bangla
   PDF/XLSX/CSV export, 58/80 mm thermal print, barcode scanner input, uninstaller, and
   user-data survival outside the install directory.
4. Run browser/Electron visual QA at 1280×720, 1366×768, 1440×900 and 1920×1080; record
   every interactive control in `docs/TEST_CASES.md`.
5. Produce `docs/FINAL_BUILD_REPORT.md` with real artefact sizes/SHA-256, release URL and
   installation/activation results; then publish the versioned GitHub Release.
6. After every Windows/CI/release result, re-run `python3 scripts/dev/update-checklist.py
   --committed`, `python3 scripts/dev/generate_requirements.py`, refresh state docs and
   commit/push again.

## Recovery instructions for `CONTINUE`

Read, in order: `git log -1`, `git status`, `docs/DEVELOPMENT_PROGRESS.md`,
`docs/NEXT_ACTIONS.md`, `docs/MASTER_REQUIREMENT_CHECKLIST.md`, `docs/TESTING_STATUS.md`,
`docs/BUILD_HISTORY.md`, `docs/KNOWN_ISSUES.md`, then `gh run list`. Do not rewrite working
modules; resume at step 1 above. On Windows use `npm ci --ignore-scripts` followed by
`node node_modules/electron/install.js`; do **not** run `electron-builder install-app-deps`
because `better-sqlite3@13.0.3` uses N-API prebuilds. The live Vite preview already serves
the first-run activation screen; use the **ডেভেলপমেন্ট লাইসেন্স** button in the preview (the
licence is ignored local development material, not a customer licence).
