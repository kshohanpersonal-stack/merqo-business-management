# Implementation / Completion Checklist

Status values: `NOT STARTED`, `IMPLEMENTED`, `TESTING`, `PASSED`, `FAILED`, `BLOCKED`.
This is the session-level execution checklist; the 247-item requirement register remains
`docs/MASTER_REQUIREMENT_CHECKLIST.md` / `docs/requirements.json`
(`17 IMPLEMENTED / 154 TESTING / 51 PASSED / 0 FAILED / 25 BLOCKED`).

| ID | Description | Location / evidence | Status | Remaining issue / blocker |
| --- | --- | --- | --- | --- |
| EX-01 | Preserve existing architecture and working modules | 127 dispatcher actions, 49-table schema, reproducible tests | **PASSED** | none |
| EX-02 | Reproduce previous local checks on `f7d78d5` | `docs/PROJECT_STATUS.md` checkpoint | **PASSED** | none |
| EX-03 | Honest unsigned Windows distribution policy | `docs/INSTALLATION_GUIDE.md`, `docs/KNOWN_LIMITATIONS.md`, `release.yml`, refreshed docs | **PASSED** | owner explicitly declined OV/EV; no bypass added |
| EX-04 | Real headless-browser visual QA at four sizes | `scripts/dev/visual-qa.mjs`, `docs/visual-qa/report.json`, six screenshots | **PASSED** | Electron-window QA still not executed |
| EX-05 | Full 18-step end-to-end workflow evidence | `scripts/dev/e2e-workflow.mjs`, `docs/e2e-workflow.json` | **PASSED** | 18/18 checks against real SQLite and `/api` |
| EX-06 | Functional Bangla/English UI language layer | `src/renderer/i18n.ts`, `App.tsx`, `Auth.tsx`, `System.tsx`, visual QA | **TESTING** | dictionary coverage is partial; 18/18 nav labels verified, all app strings not translated |
| EX-07 | Missing delivery/progress guides | `docs/PROJECT_STATUS.md`, `IMPLEMENTATION_CHECKLIST.md`, `KNOWN_LIMITATIONS.md`, `INSTALLATION_GUIDE.md`, `BUILD_RELEASE_GUIDE.md`, `BACKUP_RESTORE_GUIDE.md`, `DEVELOPMENT_GUIDE.md` | **PASSED** | final run IDs recorded in the delivery answer |
| EX-08 | Windows installer/generator artifacts on final commit | `.github/workflows/build-windows.yml` | **TESTING** | re-run on final commit; conclusions recorded in delivery answer |
| EX-09 | Final CI/Security/Windows green on final HEAD | `gh run list` | **TESTING** | re-run on final commit; conclusions recorded in delivery answer |
| EX-10 | Production Ed25519 public key | `src/core/public-key.ts` | **BLOCKED** | owner has not supplied production key |
| EX-11 | Real Windows install/activation/uninstall QA | Windows hardware | **BLOCKED** | no Windows host in sandbox |
| EX-12 | Thermal printer / barcode scanner QA | physical devices | **BLOCKED** | no hardware attached |
| EX-13 | Version tag / public GitHub Release | tag-triggered `release.yml` | **BLOCKED** | owner authorisation and readiness gates not met; no release published |
| EX-14 | Trusted Authenticode signature / SmartScreen clearance | owner certificate | **NOT APPLICABLE** | owner explicitly declined purchase; unsigned build accepted |
| EX-15 | Final unsigned production build report | `docs/FINAL_BUILD_REPORT.md` | **TESTING** | cannot be a released-product report until EX-10..EX-13 are resolved or explicitly disclosed |

Every status change requires executed evidence. `NOT APPLICABLE` is used only for the
owner's explicit decision to distribute unsigned builds, not to hide a defect.
