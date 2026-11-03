# Development Progress

Last updated: 2026-11-03 · Branch: `arena/e53fcc9d-merqo-business-management`
Base commit: `3a42431 Initial commit`. Pushed commits include `c0c620d` (integrated
source), `e571a71` / `2e5747a` (evidence refresh), `4e5eb31`, `3234e8e`, `9ef4763`,
`cda840e`, `3b11e3a`, `efacbaf`, `f7d78d5` and the Phase A checkpoint `7cd19bb`.
Repository visibility: **public** (`gh api`). The delivery series after `7cd19bb` adds
the bilingual renderer, headless-Chromium visual QA, 18-step E2E workflow, CI additions
and unsigned-policy corrections; it is committed after local verification.

## Current phase

**Phase H/I — final verification and honest delivery, not a production release.**
Phases A–G are substantially implemented and exercised: a 127-action dispatcher,
49-table SQLite schema, 28 report families, offline Ed25519 licensing, backup/restore,
Electron shell, light-theme Bangla UI with a partial English layer, four CI workflows,
headless-Chromium visual QA at four desktop sizes and an 18/18 real-dispatcher owner
workflow. Historical green workflows on `f7d78d5` are CI `41646629269`, Security
`41646629348`, Windows `41646629301`; final delivery commit workflows are re-run and
their run IDs recorded in the delivery answer.
Phases requiring real Windows installation, hardware, production key and owner-authorised
public Release remain **BLOCKED**. This is not a completion claim.

## Completed in this session

1. **Phase 1** — 38 requirement groups / 247 tracked requirements, architecture, database,
   security, licence, UI/UX, testing, risk and third-party-licence documents.
2. **Phase 2** — pinned dependency manifest, TypeScript/Vite/Vitest/ESLint/Prettier/esbuild
   config, `electron-builder.yml`, four GitHub Actions workflows, `.gitignore`, secret scan,
   custom product logo/splash/icons (16–256 px + `.ico`), bundled Noto Sans Bengali with OFL.
3. **Phase 3** — 661-line forward-only SQLite migration (49 tables, 26 indexes, WAL, FKs,
   ACID, idempotency), 30 permissions/4 roles, and ~30 `src/core/*` modules covering money,
   validation, auth/sessions/RBAC/audit, settings, notifications, catalogue, parties,
   purchases, sales/returns, expenses, finance, 28 reports, exports, printing, backup and a
   single permission/transaction/audit dispatcher.
4. **Phase 4/5** — light-theme Bangla design system, React shell, 18 navigation pages,
   dashboard, catalogue, inventory, POS, purchases, sales/returns, parties, expenses,
   finance, reports, backup/restore, RBAC, notifications, settings, About and audit.
5. **Phase 6/7** — `src/server/api.ts` preview bridge, `src/main/index.ts`, `device.ts`,
   `printing.ts`, `src/preload/index.ts`, owner-only generator, database verify, preview
   smoke and development-licence helpers.
6. **Bilingual UI** — `src/renderer/i18n.ts` with boundary-aware Bangla→English dictionary,
   `MutationObserver`, localStorage/settings persistence, top-bar toggle, setup language
   and `:focus-visible` styles. English coverage is partial and documented.
7. **Visual/E2E QA** — `scripts/dev/visual-qa.mjs` + `ensure-dev-license.mjs` and
   `scripts/dev/e2e-workflow.mjs`, wired as `npm run qa:visual` / `qa:e2e`; evidence in
   `docs/visual-qa/` and `docs/e2e-workflow.json`. Linux CI now executes both.
8. **Verification (current local worktree)** — `npm test` 41/41 (24.10 s),
   `npm run typecheck`, `lint`, `format:check`, `licenses` (723 packages),
   `db:verify` 30/30, `build`, `build:generator`, `secrets`, `smoke` 12/12,
   `qa:e2e` 18/18 and `qa:visual` at four viewports.
9. **CI and Windows build** — fixed CRLF schema comparisons, deterministic requirement
   generation, ignored build scripts, Windows SQLite file locks, VS 2026 detection,
   Electron 43 / V8 incompatibility and npm's automatic node-gyp rebuild. Upgraded
   `better-sqlite3` to 13.0.3 N-API and set `npmRebuild: false`. Added `format:check`,
   `db:verify`, `qa:e2e`, `qa:visual` and QA evidence upload to CI workflows.

## Not done / blocked

* No real Windows installation, first-run activation, shortcut/uninstall, upgrade or
  startup/shutdown test — the installer exists only as an unsigned CI artifact.
* No physical thermal printer, barcode scanner, hardware-change transfer or crash-recovery
  test.
* No Electron-window-specific visual QA; renderer QA is headless Chromium on Linux.
* `src/core/public-key.ts` still embeds the **development** public key; production
  activation requires an owner-supplied production key.
* No version tag, public GitHub Release or final unsigned build report with real
  installation results.
* Final CI/Security/Windows runs are executed on the exact delivery commit and their conclusions recorded in the final delivery answer.

Unsigned distribution is an explicit owner decision, not a blocker: no OV/EV certificate
will be purchased, publisher is unverified, SmartScreen/Defender warnings vary and no
security bypass is included.

See `docs/KNOWN_ISSUES.md`, `docs/MASTER_REQUIREMENT_CHECKLIST.md`
(**17 IMPLEMENTED, 154 TESTING, 51 PASSED, 0 FAILED, 25 BLOCKED**) and
`docs/NEXT_ACTIONS.md`. The 51 `PASSED` entries have all eleven verification steps
satisfied by executed tests and committed source; 25 `BLOCKED` entries are external
hardware/install/release items.
