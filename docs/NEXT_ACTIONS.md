# Next Actions

Last updated: 2026-11-03

## Exact next development task

**Commit and push the integrated Phase 3–8 implementation, then run the Windows pipeline.**
Concretely:

1. `git add -A` (excluding ignored `private/`, `.merqo-data/`, `dist*`, `installers/`),
   re-run `npm run secrets`, and create a meaningful feature commit on
   `arena/e53fcc9d-merqo-business-management`; push with
   `git push origin arena/e53fcc9d-merqo-business-management`.
2. Regenerate `docs/requirement-overrides.json` with
   `python3 scripts/dev/update-checklist.py --committed`, regenerate the checklist, and
   commit the evidence refresh.
3. Replace `src/core/public-key.ts` with the owner's production Ed25519 public key and
   provision a Windows code-signing certificate in GitHub Actions secrets (owner action).
4. Push a semantic version tag (e.g. `v0.1.0`) to trigger
   `.github/workflows/build-windows.yml` and `.github/workflows/release.yml` on
   `windows-latest`; inspect `gh run list`, verify installer/generator outputs, checksums
   and that the generator EXE is **not** a public release asset.
5. On a real Windows machine: install the NSIS package, confirm desktop/Start Menu
   shortcuts and custom icon, first-launch activation with a production licence, business
   setup, first admin, POS → purchase → sale → return → backup → restore, Bangla
   PDF/XLSX/CSV export, 58/80 mm thermal print, barcode scanner input, uninstaller, and
   user-data survival outside the install directory.
6. Run browser/Electron visual QA at 1280×720, 1366×768, 1440×900 and 1920×1080; record
   every interactive control in `docs/TEST_CASES.md`.
7. Produce `docs/FINAL_BUILD_REPORT.md` with real artefact sizes/SHA-256, release URL and
   installation/activation results; then create the versioned GitHub Release with
   authorised assets only.

## Recovery instructions for `CONTINUE`

Read, in order: `git log -1`, `git status`, `docs/DEVELOPMENT_PROGRESS.md`,
`docs/NEXT_ACTIONS.md`, `docs/MASTER_REQUIREMENT_CHECKLIST.md`, `docs/TESTING_STATUS.md`,
`docs/BUILD_HISTORY.md`, `docs/KNOWN_ISSUES.md`, then `gh run list`. Do not rewrite working
modules; resume at step 1 above. The live Vite preview already serves the first-run
activation screen; use the **ডেভেলপমেন্ট লাইসেন্স** button in the preview (the licence is
ignored local development material, not a customer licence).
