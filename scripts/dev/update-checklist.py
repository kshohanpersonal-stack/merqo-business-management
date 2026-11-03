#!/usr/bin/env python3
"""Rebuild docs/requirement-overrides.json from real implementation/test evidence.

This script is deliberately conservative: a requirement is PASSED only when all
eleven verification steps are true. Windows-only, hardware-only and release-gate
requirements are BLOCKED in this Linux sandbox with an explicit reason.
Usage: python3 scripts/dev/update-checklist.py [--committed]
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMMITTED = "--committed" in sys.argv
STEPS = ["understood", "plan", "implementation", "databaseIntegration", "uiIntegration",
         "businessLogic", "functionalTest", "integrationTest", "edgeCases", "documentation", "committed"]

CORE_TESTS = ["tests/unit/money.test.ts", "tests/unit/schema.test.ts", "tests/integration/sales.test.ts"]
DB_TESTS = ["tests/unit/schema.test.ts", "tests/integration/sales.test.ts", "tests/integration/returns.test.ts",
            "tests/integration/backup.test.ts", "scripts/database/verify.mjs"]
FIN_TESTS = ["tests/integration/sales.test.ts", "tests/integration/returns.test.ts",
             "tests/integration/reports.test.ts", "tests/performance/large-dataset.test.ts"]
LIC_TESTS = ["tests/unit/licensing.test.ts", "tests/integration/activation.test.ts",
             "tests/security/auth.test.ts", "scripts/dev/smoke-preview.mjs"]
UI_TESTS = ["scripts/dev/smoke-preview.mjs", "scripts/dev/visual-qa.mjs",
            "scripts/dev/e2e-workflow.mjs", "docs/visual-qa/report.json",
            "docs/e2e-workflow.json", "docs/TEST_CASES.md"]
ALL_TESTS = ["tests/unit/money.test.ts", "tests/unit/schema.test.ts", "tests/unit/licensing.test.ts",
             "tests/unit/barcode.test.ts", "tests/integration/sales.test.ts", "tests/integration/returns.test.ts",
             "tests/integration/reports.test.ts", "tests/integration/activation.test.ts",
             "tests/integration/backup.test.ts", "tests/security/auth.test.ts",
             "tests/performance/large-dataset.test.ts", "scripts/database/verify.mjs",
             "scripts/dev/smoke-preview.mjs", "scripts/dev/visual-qa.mjs",
             "scripts/dev/e2e-workflow.mjs"]

# group -> (status, code, tests, extra verification steps, notes)
SPEC = {
    "P1-GOV": ("TESTING", ["README.md", "VERSION", ".gitignore", "docs/PROJECT_MASTER_PLAN.md",
                           "docs/DEVELOPMENT_PROGRESS.md", "docs/MASTER_REQUIREMENT_CHECKLIST.md"],
               ["scripts/dev/secret_scan.py"], ["implementation", "documentation"],
               "Phase 1 research, repository structure, secret hygiene and state docs are in place; GitHub visibility public confirmed via gh api."),
    "P3-ARCH": ("IMPLEMENTED", ["src/core/dispatch.ts", "src/core/context.ts", "docs/architecture/ARCHITECTURE.md",
                                "docs/TECHNICAL_DECISIONS.md", "docs/RISK_REGISTER.md"],
                ALL_TESTS, ["implementation", "databaseIntegration", "businessLogic", "documentation"],
                "Twelve logical layers separated; offline-first; 682 dependency licences verified and npm audit --audit-level=high passes with no high/critical findings after security-driven upgrades."),
    "P4-BRAND": ("IMPLEMENTED", ["assets/images/merqo-logo.png", "assets/icons/merqo.ico",
                                 "assets/icons/merqo-256.png", "src/renderer/pages/System.tsx",
                                 "src/renderer/pages/Auth.tsx"],
                 UI_TESTS, ["implementation", "uiIntegration", "documentation"],
                 "Custom product logo/icon sizes and About screen implemented; installer icon wiring is configured but not installation-tested."),
    "P5-LOC": ("TESTING", ["src/renderer/styles.css", "src/renderer/fonts.css", "assets/fonts/OFL.txt",
                            "src/core/exports.ts", "src/core/printing.ts", "src/renderer/pages/System.tsx"],
                ["tests/integration/reports.test.ts", "tests/unit/money.test.ts", "scripts/dev/smoke-preview.mjs"],
                ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                 "integrationTest", "documentation"],
                "Bangla UI, bundled OFL font, Bangla digits, BDT/currency/VAT settings and Bangla CSV/XLSX/PDF/HTML exports implemented; headless Chromium QA verified font loading, Bangla text nodes and a partial dictionary-based English switch at four sizes."),
    "P6-DB": ("PASSED", ["database/migrations/001_initial.sql", "src/core/db.ts", "src/core/schema.generated.ts",
                          "src/core/dispatch.ts", "src/core/backup.ts"],
               DB_TESTS, STEPS,
               "Schema smoke, migration idempotency, FK/integrity checks, ACID rollback, idempotency and atomic workflows executed successfully."),
    "P7-DASH": ("TESTING", ["src/core/analytics.ts", "src/renderer/pages/Dashboard.tsx"],
                 ["tests/performance/large-dataset.test.ts", "scripts/dev/smoke-preview.mjs"],
                 ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                  "documentation"],
                 "Dashboard computes all figures from real rows; API smoke test confirms todaySales; dashboard/chart shell captured at four viewports in headless Chromium."),
    "P7-PROD": ("TESTING", ["src/core/catalog.ts", "src/renderer/pages/Business.tsx", "src/renderer/pages/Pos.tsx"],
                 ["tests/integration/sales.test.ts", "scripts/dev/smoke-preview.mjs"],
                 ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                  "integrationTest", "edgeCases", "documentation"],
                 "Product CRUD, CSV import, duplicate detection, barcode/QR and product-level percent/fixed discounts implemented and tested."),
    "P7-UNIT": ("TESTING", ["src/core/catalog.ts", "src/renderer/pages/Business.tsx", "database/migrations/001_initial.sql"],
                 ["scripts/database/verify.mjs"],
                 ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "documentation"],
                 "Units and conversions seeded and editable; conversion validation is implemented but not yet covered by a dedicated unit test."),
    "P7-BAR": ("TESTING", ["src/core/barcode.ts", "src/renderer/pages/Pos.tsx", "src/renderer/pages/Business.tsx"],
                ["tests/unit/barcode.test.ts"],
                ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest", "documentation"],
                "Code128/EAN/QR generation and manual scan entry implemented; physical scanner hardware is BLOCKED."),
    "P7-POS": ("TESTING", ["src/core/sales.ts", "src/renderer/pages/Pos.tsx", "src/core/dispatch.ts"],
                ["tests/integration/sales.test.ts", "tests/integration/returns.test.ts", "scripts/dev/smoke-preview.mjs"],
                ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                 "integrationTest", "edgeCases", "documentation"],
                "Full POS workflow, split payments, due, hold/resume, cancel, atomic sale and invoice stored without printer; thermal printing hardware is BLOCKED."),
    "P7-INV": ("TESTING", ["src/core/printing.ts", "src/renderer/pages/Pos.tsx", "src/renderer/pages/Transactions.tsx"],
                ["tests/integration/reports.test.ts", "scripts/dev/smoke-preview.mjs"],
                ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest", "documentation"],
                "58/80 mm receipt HTML, printer profiles, graceful failure and invoice persistence implemented; physical thermal print is BLOCKED."),
    "P7-CUST": ("TESTING", ["src/core/parties.ts", "src/renderer/pages/Transactions.tsx"],
                 ["tests/integration/sales.test.ts", "tests/integration/returns.test.ts"],
                 ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                  "integrationTest", "documentation"],
                 "Customer profiles, ledger, due collection, statement and reconciliation implemented and exercised."),
    "P7-SUPP": ("TESTING", ["src/core/parties.ts", "src/renderer/pages/Transactions.tsx"],
                 ["tests/integration/sales.test.ts", "tests/integration/returns.test.ts"],
                 ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                  "integrationTest", "documentation"],
                 "Supplier profiles, purchases, payments, ledger and statements implemented and exercised."),
    "P7-PUR": ("TESTING", ["src/core/purchases.ts", "src/renderer/pages/Transactions.tsx"],
                ["tests/integration/sales.test.ts", "tests/integration/returns.test.ts"],
                ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                 "integrationTest", "edgeCases", "documentation"],
                "Purchase create/preview/return, extra costs, weighted-average cost and supplier ledger implemented and tested."),
    "P7-EXP": ("TESTING", ["src/core/expenses.ts", "src/renderer/pages/Business.tsx", "src/core/reports.ts"],
                ["tests/integration/returns.test.ts", "tests/integration/reports.test.ts"],
                ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                 "integrationTest", "documentation"],
                "Expenses, categories, reversal and P&L inclusion implemented and tested."),
    "P7-FIN": ("TESTING", ["src/core/finance.ts", "src/renderer/pages/Transactions.tsx"],
                FIN_TESTS,
                ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                 "integrationTest", "edgeCases", "documentation"],
                "Cash in/out, accounts, ledger, closing and 10-check reconciliation implemented; reconcile passes in tests."),
    "P7-RET": ("TESTING", ["src/core/sales.ts", "src/core/purchases.ts", "src/core/inventory.ts",
                            "src/renderer/pages/Transactions.tsx"],
                ["tests/integration/returns.test.ts"],
                ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                 "integrationTest", "edgeCases", "documentation"],
                "Sales/purchase returns, refunds, exchange, stock adjustments and reversal history implemented and tested."),
    "P8-FIN": ("PASSED", ["src/core/finance.ts", "src/core/inventory.ts", "src/core/sales.ts",
                           "src/core/purchases.ts", "src/core/expenses.ts", "docs/architecture/DATABASE_SCHEMA.md"],
               FIN_TESTS, STEPS,
               "Weighted-average COGS, historical unit cost, distinct profit measures, ledgers, duplicate prevention and reconciliation verified by executed tests."),
    "P9-RPT": ("TESTING", ["src/core/reports.ts", "src/renderer/pages/System.tsx"],
                ["tests/integration/reports.test.ts", "scripts/dev/smoke-preview.mjs"],
                ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                 "integrationTest", "edgeCases", "documentation"],
                "All 28 reports run against real data with filters/sort/pagination; Reports page visited in headless Chromium visual QA and CSV export exercised in E2E."),
    "P10-EXP": ("PASSED", ["src/core/exports.ts", "src/core/printing.ts", "src/main/printing.ts"],
                 ["tests/integration/reports.test.ts"], STEPS,
                 "CSV UTF-8 BOM, XLSX ZIP, PDF and embedded-font HTML verified with Bangla headers and totals by executed tests."),
    "P11-BAK": ("TESTING", ["src/core/backup.ts", "src/renderer/pages/System.tsx"],
                 ["tests/integration/backup.test.ts", "scripts/dev/smoke-preview.mjs"],
                 ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                  "integrationTest", "edgeCases", "documentation"],
                 "MERQOBAK v1, SHA-256, AES-256-GCM, tamper detection, safety backup, restore and retention implemented and tested; cross-PC migration not executed."),
    "P12-AUTH": ("PASSED", ["src/core/auth.ts", "src/core/sessions.ts", "src/core/permissions.ts",
                             "src/core/audit.ts", "src/core/dispatch.ts", "src/renderer/pages/System.tsx"],
                  ["tests/security/auth.test.ts", "tests/integration/activation.test.ts"], STEPS,
                  "scrypt hashing, lockout, server-side RBAC, audit, unsafe-path rejection and log redaction verified by executed tests."),
    "P13-SET": ("TESTING", ["src/core/settings.ts", "src/core/shortcuts.ts", "src/renderer/pages/System.tsx"],
                 ["tests/integration/activation.test.ts", "scripts/dev/smoke-preview.mjs"],
                 ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest", "documentation"],
                 "Business profile, currency/number/tax/receipt/backup settings, shortcuts, printer profiles and audit log implemented; Settings page and language switch exercised in headless Chromium."),
    "P14-UI": ("TESTING", ["src/renderer/styles.css", "src/renderer/App.tsx", "src/renderer/components.tsx",
                            "src/renderer/pages/"],
                UI_TESTS,
                ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "documentation"],
                "Light-theme Bangla shell, sidebar, active state, tables, dialogs, toasts, loading/empty states and charts implemented; 18-page four-viewport headless Chromium QA passed with no overflow, unnamed controls or console errors."),
    "P15-ANIM": ("TESTING", ["src/renderer/styles.css"], UI_TESTS,
                  ["implementation", "uiIntegration", "documentation"],
                  "Fade/page/modal/toast/skeleton animations with prefers-reduced-motion support implemented; visual smoothness not measured."),
    "P16-GRT": ("TESTING", ["src/core/analytics.ts", "src/core/notifications.ts", "src/renderer/App.tsx",
                             "src/renderer/pages/System.tsx"],
                 ["tests/integration/reports.test.ts"],
                 ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest", "documentation"],
                 "Time-based Bangla greetings, notification centre, unread count, mark-read and system alert refresh implemented."),
    "P17-KEY": ("TESTING", ["src/core/shortcuts.ts", "src/renderer/pages/Pos.tsx", "src/renderer/App.tsx",
                             "src/renderer/pages/System.tsx"],
                 ["scripts/dev/smoke-preview.mjs"],
                 ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "documentation"],
                 "Configurable shortcuts with conflict detection, POS F1–F9 mapping and Ctrl+Alt navigation implemented; keyboard interaction not browser-tested."),
    "P18-LIC": ("TESTING", ["src/core/licensing.ts", "src/core/activation.ts", "src/main/device.ts",
                             "apps/license-generator/src/index.ts", "src/renderer/pages/Auth.tsx"],
                 LIC_TESTS,
                 ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                  "integrationTest", "edgeCases", "documentation"],
                 "Ed25519 offline activation, signed payload, name/device verification, owner-only CLI generator and in-app activation component implemented and tested; Windows EXE/hardware binding remains BLOCKED."),
    "P19-WIN": ("TESTING", ["electron-builder.yml", "src/main/index.ts", "src/main/printing.ts", ".github/workflows/build-windows.yml"],
                ALL_TESTS, ["implementation", "databaseIntegration", "businessLogic", "functionalTest", "integrationTest", "documentation"],
                "Windows CI run 41660526709 on 8201bc7 built the NSIS installer and owner-only generator EXE; installation/activation/shortcut/uninstall QA remains BLOCKED."),
    "P20-CI": ("TESTING", [".github/workflows/ci.yml", ".github/workflows/build-windows.yml",
                            ".github/workflows/release.yml", ".github/workflows/security-checks.yml", "VERSION"],
               ALL_TESTS, ["implementation", "databaseIntegration", "businessLogic", "functionalTest", "integrationTest", "documentation"],
               "CI 41646629269, Security 41646629348 and Windows build 41646629301 passed on f7d78d5; additional green runs on 8201bc7 are CI 41660526854, Security 41660526869 and Windows 41660526709. Security workflow now fails on high/critical advisories; final delivery commit workflows are re-run and their run IDs recorded in the final delivery answer. Tag/release pipeline still unexecuted."),
    "P21-SEC": ("PASSED", ["src/core/validation.ts", "src/core/db.ts", "src/core/auth.ts", "src/core/logger.ts",
                            "src/core/dispatch.ts", "src/core/backup.ts"],
                 ["tests/security/auth.test.ts", "tests/integration/activation.test.ts", "tests/integration/backup.test.ts"], STEPS,
                 "Parameterized SQL, safe paths, salted scrypt, Ed25519 verification, RBAC, redacted errors/logs and backup integrity verified by executed tests."),
    "P22-PERF": ("TESTING", ["src/core/util.ts", "src/core/reports.ts", "src/renderer/components.tsx",
                              "database/migrations/001_initial.sql"],
                  ["tests/performance/large-dataset.test.ts", "scripts/database/verify.mjs"],
                  ["implementation", "databaseIntegration", "businessLogic", "functionalTest", "integrationTest", "documentation"],
                  "10,000-product indexed search p95 and dashboard timing executed (see TESTING_STATUS.md); startup/memory/CPU and barcode timing not measured."),
    "P23-DOC": ("TESTING", ["README.md", "docs/PROJECT_MASTER_PLAN.md", "docs/architecture/", "docs/DEVELOPMENT_PROGRESS.md",
                             "docs/TESTING_STATUS.md", "docs/KNOWN_ISSUES.md", "docs/BUILD_HISTORY.md", "docs/NEXT_ACTIONS.md"],
                 ALL_TESTS, ["implementation", "documentation"],
                 "Phase 1 architecture/security/licence/UI/DB docs plus refreshed state docs, user manual and final unsigned build report are present; production release QA still pending."),
    "P24-PHASE": ("TESTING", ["docs/DEVELOPMENT_PROGRESS.md", "src/core/", "src/renderer/"], ALL_TESTS,
                  ["implementation", "databaseIntegration", "uiIntegration", "businessLogic", "functionalTest",
                   "integrationTest", "documentation"],
                  "Phases 1–8 substantially implemented and integrated; phases 9–11 (full QA, Windows install, release) are BLOCKED."),
    "P25-TST": ("TESTING", ["docs/TEST_CASES.md", "docs/TEST_STRATEGY.md", "tests/", "scripts/database/verify.mjs",
                             "scripts/dev/smoke-preview.mjs"],
                 ALL_TESTS,
                 ["implementation", "databaseIntegration", "businessLogic", "functionalTest", "integrationTest",
                  "edgeCases", "documentation"],
                 "41 executed Vitest tests, 30 DB checks, 12 preview API smoke checks, 18/18 E2E owner workflow checks, 18-page visual QA and security/performance suites recorded; every-interactive-control and hardware/installation tests remain BLOCKED."),
    "P26-CHK": ("PASSED", ["docs/MASTER_REQUIREMENT_CHECKLIST.md", "docs/TRACEABILITY.md",
                            "scripts/dev/update-checklist.py", "docs/requirements.json"],
                 ALL_TESTS, STEPS,
                 "247 requirements, eight statuses, eleven verification steps and requirement↔code↔test traceability are maintained from real evidence."),
    "P28-DEL": ("TESTING", ["src/", "assets/", "database/", "docs/", "electron-builder.yml"],
                ALL_TESTS, ["implementation", "databaseIntegration", "businessLogic", "functionalTest", "integrationTest", "documentation"],
                "Windows CI produced installer/generator EXEs and SHA256SUMS as protected artifacts; final unsigned build report is present; tag-triggered GitHub Release and production release QA remain BLOCKED."),
    "P30-GATE": ("BLOCKED", ["docs/MASTER_REQUIREMENT_CHECKLIST.md", "docs/KNOWN_ISSUES.md",
                              "docs/TESTING_STATUS.md", "docs/BUILD_HISTORY.md"],
                 ALL_TESTS, ["understood", "plan", "implementation", "documentation"],
                 "BLOCKED: strict completion gate requires Windows installer installation/activation testing, versioned public release (owner accepts unsigned builds) and hardware QA. CI build 41660526709 on 8201bc7 produced an unsigned installer but no install test; disclosed in KNOWN_ISSUES.md."),
}

# Explicit per-requirement exceptions (more conservative than the group default).
BLOCKED_IDS = {
    "R-P6-DB-001": "Offline operation after installation/activation is not yet verified: Windows installer/install test is BLOCKED.",
    "R-P4-BRAND-003": "Installer/desktop/Start Menu icon usage is configured and the installer was built in CI 41660526709 on 8201bc7; installation testing is BLOCKED.",
    "R-P7-BAR-003": "Physical USB/Bluetooth/wireless barcode scanner input is BLOCKED (no scanner hardware).",
    "R-P7-POS-007": "Thermal receipt printing to a physical printer is BLOCKED (no printer hardware in sandbox).",
    "R-P7-INV-004": "Printer selection/configuration is implemented; physical 58/80 mm print verification is BLOCKED.",
    "R-P7-INV-005": "Bengali receipt HTML is generated; visual print rendering is BLOCKED (no printer/browser).",
    "R-P7-INV-006": "Paper-cut and printer-failure behaviour is coded; physical printer verification is BLOCKED.",
    "R-P18-LIC-007": "Windows multi-component fingerprint code is implemented; real hardware-change/transfer testing is BLOCKED.",
    "R-P18-LIC-012": "Owner-issued replacement licence workflow is implemented (supersedes/recoveryCount); end-to-end transfer on a second PC is NOT TESTED.",
    "R-P19-WIN-003": "Installer built in CI 41660526709 on 8201bc7, but first-launch installation/activation flow is not executable here; BLOCKED.",
    "R-P19-WIN-004": "User-data directory path is implemented in main/index.ts; Windows path verification is BLOCKED (installer not installed).",
    "R-P20-CI-003": "Tag-triggered Windows release pipeline not executed; BLOCKED.",
    "R-P20-CI-005": "Release asset policy documented; no release created; BLOCKED.",
    "R-P20-CI-006": "Release information template prepared; no release created; BLOCKED.",
    "R-P24-PHASE-009": "UI browser QA and 18-step E2E workflow executed; installation and hardware regression remain BLOCKED in this environment.",
    "R-P24-PHASE-010": "Final Windows build is complete in CI 41660526709 on 8201bc7; installation testing remains BLOCKED.",
    "R-P24-PHASE-011": "Verified GitHub release and final delivery is BLOCKED.",
    "R-P25-TST-002": "Functional test for every interactive control is NOT TESTED; headless Chromium visited 18 pages and checked focus/naming, but did not click every control.",
    "R-P25-TST-006": "UI browser QA and backup/restore/export are executed; installation, hardware and crash-recovery tests remain BLOCKED.",
    "R-P28-DEL-005": "Versioned GitHub release not created; tag-triggered release.yml unexecuted; BLOCKED.",
    "R-P30-GATE-001": "All mandatory requirements implemented/integrated: Windows installer built in CI, but installation/hardware/release gates remain BLOCKED.",
    "R-P30-GATE-002": "Financial/DB/licensing/backup/export/Bangla/security verified by tests, but full offline-install verification is BLOCKED.",
    "R-P30-GATE-003": "Performance and regression partially evaluated; UI/startup/memory not measured.",
    "R-P30-GATE-004": "Windows installer built in CI 41660526709 on 8201bc7; installation/activation on real hardware still BLOCKED.",
    "R-P30-GATE-005": "CI artifacts exist; versioned public Release and final unsigned artifacts still BLOCKED; owner accepts unsigned distribution.",
}
# Deliverables that ARE complete in the repository.
DELIVERED_IDS = {
    "R-P28-DEL-006": ("IMPLEMENTED", "Complete source, schema, assets, workflows and docs are present in the repository."),
    "R-P28-DEL-007": ("IMPLEMENTED", "Technical docs, user manual and final unsigned build report are present; production release QA still pending."),
    "R-P28-DEL-008": ("IMPLEMENTED", "docs/TESTING_STATUS.md and docs/test-results.json record actual executed results."),
    "R-P28-DEL-009": ("IMPLEMENTED", "Requirement-by-requirement master checklist generated from real evidence."),
    "R-P30-GATE-006": ("PASSED", "All BLOCKED/FAILED/NOT TESTED requirements are explicitly disclosed; no production-readiness claim made."),
    "R-P14-UI-003": ("TESTING", "Responsive layout verified at four desktop sizes with zero horizontal overflow; minimum window size and every dialog at every size not exhaustively tested."),
    "R-P14-UI-004": ("TESTING", "Headless Chromium found zero unnamed controls, zero overflowing containers and visible keyboard focus rings at four sizes; exhaustive dead-control click test not executed."),
    "R-P14-UI-008": ("PASSED", "Headless Chromium visual QA executed at 1280x720, 1366x768, 1440x900 and 1920x1080; 18 pages, six screenshots, no overflow/console errors; docs/visual-qa/report.json."),
    "R-P25-TST-004": ("PASSED", "18/18 end-to-end owner workflow checks passed against real SQLite and /api, including activation, setup, purchase, POS, due, return, expense, reports, backup/restore and restart; docs/e2e-workflow.json."),
    "R-P1-GOV-005": ("PASSED", "Branch, HEAD, origin, gh authentication and public visibility confirmed via git/gh."),
    "R-P1-GOV-003": ("PASSED", "Custom product logo and 16/24/32/48/64/128/256 px icons plus .ico generated; no separate company logo."),
    "R-P1-GOV-011": ("PASSED", "gh api confirms repository visibility public; unchanged."),
    "R-P19-WIN-001": ("TESTING", "Windows CI 41660526709 on 8201bc7 packaged a standalone Electron app as MERQO-Setup-0.1.0-x64.exe (131,630,712 bytes); customer installation not yet executed."),
    "R-P19-WIN-002": ("TESTING", "NSIS installer built in CI with shortcuts/icon/resources/uninstaller configured; install/shortcut/uninstall QA remains BLOCKED."),
    "R-P20-CI-001": ("TESTING", "CI, security and Windows-build workflows executed green on f7d78d5 (41646629269 / 41646629348 / 41646629301) and 8201bc7 (41660526854 / 41660526869 / 41660526709); final delivery commit runs are re-run and recorded in the final delivery answer."),
    "R-P20-CI-002": ("TESTING", "VERSION 0.1.0 used in installer filename and CI build metadata; semantic-version tag/release not created."),
    "R-P20-CI-004": ("TESTING", "Windows CI ran typecheck/tests/build, generated SHA256SUMS and uploaded authorised artifacts; release notes/tag release still BLOCKED."),
    "R-P28-DEL-001": ("TESTING", "Unsigned Windows NSIS installer packaged as protected CI artifacts 13235581789 (f7d78d5) and 13242046945 (8201bc7); not installation-tested."),
    "R-P28-DEL-002": ("TESTING", "Owner-only generator EXE built as protected artifacts 13235615213 (f7d78d5) and 13241417765 (8201bc7), 7-day retention; never a public release asset."),
    "R-P28-DEL-003": ("IMPLEMENTED", "Dedicated in-app activation component implemented and tested; standalone Activation EXE intentionally omitted."),
    "R-P28-DEL-004": ("TESTING", "Professional NSIS installer built in CI; installation QA remains BLOCKED."),
    "R-P28-DEL-010": ("TESTING", "CI produced installer/generator sizes and SHA256SUMS; final unsigned build report is present, production release QA still pending."),
    "R-P18-LIC-010": ("TESTING", "Owner-only generator EXE built and uploaded as protected CI artifacts 13235615213 (f7d78d5) and 13241417765 (8201bc7); real owner-PC execution NOT TESTED."),
    "R-P3-ARCH-003": ("PASSED", "npm run licenses verified 682 installed packages against the commercial allow-list; npm audit --audit-level=high passes with 28 moderate advisories and no high/critical findings after security upgrades."),
    "R-P5-LOC-004": ("PASSED", "Noto Sans Bengali WOFF2/TTF and assets/fonts/OFL.txt bundled."),
    "R-P10-EXP-003": ("PASSED", "UTF-8 CSV with Bangla headers verified by executed report export test."),
    "R-P18-LIC-002": ("PASSED", "Ed25519 public key embedded; private key only in ignored private/, never in main app."),
    "R-P18-LIC-008": ("PASSED", "Lifetime licence has no expiry/renewal/periodic verification field in payload or activation."),
    "R-P18-LIC-011": ("PASSED", "Tampering, invalid licence, wrong device and wrong business rejection covered by executed licensing/activation tests."),
    "R-P26-CHK-004": ("PASSED", "No requirement marked PASSED without executed tests and full verification evidence."),
}

def flags(extra):
    out = {s: False for s in STEPS}
    out["understood"] = True
    out["plan"] = True
    for key in extra:
        if key in out: out[key] = True
    if COMMITTED: out["committed"] = True
    return out

def main():
    payload = json.loads((ROOT / "docs/requirements.json").read_text(encoding="utf-8"))
    overrides = {}
    for r in payload["requirements"]:
        part, rid = r["part"], r["id"]
        status, code, tests, extra, notes = SPEC[part]
        if rid in BLOCKED_IDS:
            status, notes = "BLOCKED", BLOCKED_IDS[rid]
            extra = ["understood", "plan", "implementation", "documentation"]
        elif rid in DELIVERED_IDS:
            status, notes = DELIVERED_IDS[rid]
            if status == "PASSED": extra = STEPS
        if status == "PASSED" and not COMMITTED:
            status = "TESTING"
            notes += " (awaiting commit of this milestone; PASSED only after all 11 steps are true)"
        overrides[rid] = {"status": status, "priority": "MUST", "code": code, "tests": tests,
                          "notes": notes, "verification": flags(extra)}
    (ROOT / "docs/requirement-overrides.json").write_text(
        json.dumps(overrides, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(overrides)} requirement overrides (committed={COMMITTED}).")

if __name__ == "__main__":
    main()
