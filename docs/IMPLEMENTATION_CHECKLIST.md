# Implementation / Completion Checklist

Status values: `NOT STARTED`, `IMPLEMENTED`, `TESTING`, `PASSED`, `FAILED`, `BLOCKED`.
This is the session-level execution checklist; the 247-item requirement register remains
`docs/MASTER_REQUIREMENT_CHECKLIST.md` / `docs/requirements.json`.

| ID | Description | Location / evidence | Status | Remaining issue / blocker |
| --- | --- | --- | --- | --- |
| EX-01 | Preserve existing architecture and working modules | 127 dispatcher actions, 49-table schema, CI green | **PASSED** | none |
| EX-02 | Reproduce previous local checks on `f7d78d5` | `docs/PROJECT_STATUS.md` | **PASSED** | none |
| EX-03 | Honest unsigned Windows distribution policy | `docs/INSTALLATION_GUIDE.md`, `docs/KNOWN_LIMITATIONS.md` | **TESTING** | docs update pending |
| EX-04 | Real headless-browser visual QA at four sizes | `scripts/dev/visual-qa.mjs` | **NOT STARTED** | implementation pending |
| EX-05 | Full 18-step end-to-end workflow evidence | `scripts/dev/e2e-workflow.mjs` | **NOT STARTED** | implementation pending |
| EX-06 | Functional Bangla/English UI language layer | `src/renderer/i18n.ts` | **NOT STARTED** | implementation pending |
| EX-07 | Missing delivery/progress guides | `docs/*` | **NOT STARTED** | authoring pending |
| EX-08 | Windows installer/generator artifacts on final commit | `.github/workflows/build-windows.yml` | **TESTING** | must re-run after final changes |
| EX-09 | Final CI/Security/Windows green on final HEAD | `gh run list` | **TESTING** | must re-run after final changes |
| EX-10 | Production Ed25519 public key | `src/core/public-key.ts` | **BLOCKED** | owner has not supplied production key |
| EX-11 | Real Windows install/activation/uninstall QA | Windows hardware | **BLOCKED** | no Windows host in sandbox |
| EX-12 | Thermal printer / barcode scanner QA | physical devices | **BLOCKED** | no hardware attached |
| EX-13 | Version tag / public GitHub Release | tag-triggered `release.yml` | **BLOCKED** | mandatory gates not met; no release published |
| EX-14 | Trusted Authenticode signature / SmartScreen clearance | owner certificate | **NOT APPLICABLE** | owner explicitly declined purchase; unsigned build accepted |
| EX-15 | Final signed production build report | `docs/FINAL_BUILD_REPORT.md` | **BLOCKED** | cannot be truthful until EX-10..EX-13 are resolved |

Every status change requires executed evidence. `NOT APPLICABLE` is used only for the
owner's explicit decision to distribute unsigned builds, not to hide a defect.
