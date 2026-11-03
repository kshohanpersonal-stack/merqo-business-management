# Technical Research & Decision Report (Phase 1)

Date: 2026-11-03 · Status: **complete for Phase 1** · Owner: MERQO engineering

This report is the required research deliverable. It records the alternatives considered,
the evidence used, and the reasoning behind every significant technology choice. It is a
decision record, **not** a claim that all dependent features are implemented.

## 1. Research method and constraints

The product must be a standalone, offline, lifetime-licensed Windows desktop application
for Bangladeshi retailers. Hard constraints:

* Windows 10/11 x64, no developer runtimes installed on the customer machine.
* All business data local; no mandatory network, telemetry or paid API.
* Natural Bangla UI with correct Bengali Unicode in UI, PDF, XLSX, CSV, receipts and backups.
* Financial correctness with historical costs and atomic transactions.
* Commercial redistribution without recurring licence fees for dependencies.
* Owner-controlled asymmetric licensing; private key never in the public repository.

## 2. Desktop shell: Electron vs Tauri vs native WinUI/.NET

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| **Electron 43.x + Chromium** | Bundles its own rendering engine, so Windows 10 machines without WebView2 work unchanged; mature Node main process; mature NSIS installer pipeline; one TypeScript language across UI, main process and domain core; complex Bengali script shaping handled by Chromium | Larger installer and RAM than Tauri | **SELECTED** |
| Tauri 2 (Rust + OS WebView) | Smaller binaries, lower idle memory, scoped command permissions | Windows 10 may need a WebView2 bootstrap installer; Rust + JS dual toolchain; OS-WebView differences require extra QA; harder native SQLite/printing integration | Rejected for this release |
| Native WinUI 3 / WPF / .NET | Best OS integration | Highest UI development cost for a large report-heavy Bangla product; no cross-platform dev preview | Rejected |
| Python + PyInstaller + local web UI | Simple SQLite via stdlib | Hard Windows code-signing/packaging story; weaker premium UI; Python runtime packaging complexity | Rejected |

Independent 2026 comparisons describe Electron as the mature default for complex
web-first desktop products with the deepest packaging ecosystem, while Tauri wins on
footprint but adds OS-WebView QA; Windows 10 WebView2 availability is explicitly called
out as a Tauri weak point [1](https://www.pkgpulse.com/guides/tauri-vs-electron-vs-neutralino-desktop-apps-javascript-2026)
[2](https://www.pkgpulse.com/guides/best-desktop-app-frameworks-2026). Electron releases
in the 44.x line bundle Chromium 152 and Node 24 [1](https://tech-insider.org/electron-44-7-0-chromium-152-node-24-2026/);
we pin a conservative stable Electron line (`43.8.1`) rather than chasing the newest
major, because native module ABI prebuilds follow Electron releases with a delay.

**Consequences accepted:** larger installer (~100 MB), higher idle memory; mitigated by
a single-window design, lazy-loaded report pages and indexed SQLite queries.

## 3. Language and UI

TypeScript + React 19 + Vite. TypeScript gives one statically checked domain core shared
by the main process, the dev preview server and the tests. React's component model fits
a large, form- and table-heavy application. Charts use Recharts (MIT). Icons use
Lucide (ISC). No CSS framework is required: a small custom light-theme design token
system gives tighter control over Bangla typography and avoids utility-class bloat.

Rejected: plain JavaScript (no safety for money/ledger code), Angular (heavier for this
team), Qt/QML (JS UI would still be needed for HTML receipts).

## 4. Local database

| Option | Assessment |
| --- | --- |
| **SQLite via `better-sqlite3`** | ACID, WAL, foreign keys, synchronous API allowing simple `db.transaction()` atomicity, zero server, MIT licence, embeddable in Electron | 
| SQL Server Express / PostgreSQL | Requires a server/service on the customer PC; violates standalone offline requirement | 
| IndexedDB / JSON files | No relational constraints, no SQL reporting, weak crash recovery | 
| `sql.js` (WASM) | No native ABI issues, but no durable WAL journal in Node; whole-file rewrites risk data loss | 
| `node:sqlite` | Promising but flagged as experimental in Electron's bundled Node line; insufficient packaging confidence for a commercial release | 

`better-sqlite3` is MIT-licensed and explicitly recommends `PRAGMA journal_mode = WAL`
[1](https://www.npmjs.com/package/better-sqlite3); its MIT terms permit commercial
redistribution with copyright notice retention [3](https://dev.co/databases/open-source/better-sqlite3).
Selected for real ACID transactions, WAL crash recovery and fast local reporting.

**Cost accepted:** a native module must be rebuilt for the Electron ABI. Mitigation:
`electron-builder install-app-deps` on a `windows-latest` GitHub runner and an automated
ABI smoke test in CI. The same source runs in Node for tests and for the browser preview.

## 5. Money, inventory valuation and reporting

* **Money:** integer minor units (paisa) in `INTEGER` columns. Decimal input is parsed from
  strings by `parseMoney()`; no IEEE-754 float arithmetic is used for stored values.
* **Inventory valuation:** weighted-average cost per product, updated on purchase lines,
  with per-sale-line `unit_cost_minor` snapshots. Choice rationale: simpler and more
  predictable for high-volume grocery retail than FIFO lot tracking, while still satisfying
  "historical cost, not current price". The policy is documented and applied consistently
  to sales returns, purchase returns and adjustments.
* **Profit policy:** `Net Sales = Gross Sales − Discounts − Sales Returns`;
  `Gross Profit = Net Sales − COGS`; `Net Profit = Gross Profit − Operating Expenses +
  Other Income − Other Expenses`. This is a retail management policy, not a statutory
  tax filing; the VAT report is informational and configurable.
* **Reports:** SQL views/queries over real tables with parameterized filters, server-side
  pagination, and a shared report descriptor registry so all 28 report families use the
  same export pipeline.

## 6. Bengali Unicode and documents

* Bundled **Noto Sans Bengali** (SIL Open Font License 1.1, commercial redistribution
  permitted) [1](https://www.fonthubs.com/en/fonts/noto-sans-bengali)
  [3](https://www.ffonts.net/Noto-Sans-Bengali-Regular.font). The UI, HTML receipt and
  HTML→PDF path use the bundled webfont and rely on Chromium's HarfBuzz shaping, which is
  essential for Bengali conjuncts and vowel signs.
* **XLSX:** ExcelJS (MIT) [1](https://www.npmjs.com/package/exceljs). Stores Unicode
  strings natively; no shaping issue in spreadsheet cells.
* **CSV:** UTF-8 with BOM and proper quoting; Excel-compatible.
* **PDF:** Electron's `webContents.printToPDF()` renders the same HTML report through
  Chromium, preserving shaping. A Node/pdfkit fallback exists for headless export tests;
  pdfkit is MIT [1](https://www.npmjs.com/package/pdfkit). The fallback's Indic shaping
  limitation is recorded in `KNOWN_ISSUES.md` — it is not presented as equivalent to the
  Chromium path.
* **Thermal receipts:** Chromium-rendered HTML receipt printed through the selected
  Windows printer queue with custom 58mm/80mm page widths handles Bangla correctly;
  raw ESC/POS text mode is offered for ASCII-only printers as a secondary path. ESC/POS
  raster (`GS v 0`) widths are 384 dots (58mm) and 576 dots (80mm)
  [1](https://download.mikroe.com/documents/datasheets/ESC-POS_commands.pdf); an Indic
  thermal-printing implementation in the wild also rasterises complex-script text and
  sends it to the Windows print queue [3](https://github.com/Someone-anon-coder/escpos-indic).

## 7. Licensing cryptography

* **Ed25519** signatures through Node's built-in `crypto` module (`sign(null, payload,
  key)` / `verify`) [2](https://nodejs.org/download/release/latest-v24.x/docs/api/crypto.html).
  Built-in crypto removes a native dependency and avoids shipping a private key in the app.
* Owner generates a keypair locally; only the **public** key is embedded in source as a
  constant. Private key, generator records and generator EXE are excluded by `.gitignore`.
* Device fingerprint: a stable composite of Windows machine GUID (from the registry,
  hashed), primary disk serial, CPU id, and the Windows user SID, individually SHA-256
  hashed and combined with a majority-match tolerance so a single component swap does not
  immediately invalidate a lifetime licence. Offline transfer uses an owner-issued
  replacement licence file bound to the new approved fingerprint. Binary patching and
  hardware spoofing are outside the threat model (documented, not promised away).
* Password hashing: OWASP prefers Argon2id, with scrypt (N=2^17, r=8, p=1) as the direct
  fallback when Argon2id is unavailable [1](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
  We use Node's built-in `crypto.scrypt` at those parameters with a per-user 16-byte salt
  rather than adding a native Argon2 module that complicates Windows packaging. Risk and
  upgrade path are documented in `SECURITY_DESIGN.md`.

## 8. Installer / release tooling

* **electron-builder** with NSIS. Building Windows installers from Linux requires Wine
  [2](https://www.electron.build/docs/features/multi-platform-build/); therefore the
  authoritative Windows build runs on a `windows-latest` GitHub Actions runner, not in
  this Linux sandbox. The Linux sandbox can build the renderer, main bundle, domain core
  and run tests, but must not claim a verified Windows install.
* Data directory: `app.getPath('userData')/data` (per-user, survives uninstall/reinstall);
  business data is never stored under `Program Files`.
* Owner-only generator EXE: Node SEA (single executable application) built in CI as a
  protected workflow artifact. The activation workflow is a dedicated first-run component
  inside the main app rather than a second EXE — fewer moving parts, no second runtime
  to sign, and identical verification code (documented decision, Part 18.1).
* The owner explicitly decided **not** to purchase an OV/EV code-signing certificate.
  Builds are intentionally **unsigned** with an unverified publisher. SmartScreen /
  Defender warnings vary by reputation and policy; no bypass is included and no trusted
  Authenticode or Microsoft-verified publisher claim is made. This is an accepted
  distribution policy, not a release blocker.

## 9. Rejected shortcuts (explicit)

| Shortcut | Why rejected |
| --- | --- |
| Static dashboard numbers | Violates real-data requirement |
| Floating-point money | Rounding drift in financial reports |
| Cloud licence server | Violates offline lifetime licence |
| Private key in app or repo | Destroys the entire licensing model |
| Mocked "passed" tests | Directly prohibited by the master directive |
| Publishing generator EXE publicly | Explicitly prohibited by Part 18.7 |

## 10. Open decisions requiring owner input

1. Production Ed25519 public key provisioning (owner-controlled; development key is embedded until then).
2. Whether VAT reporting must follow a specific Bangladesh NBR format (currently generic).
3. Approved device-transfer fee/policy and evidence requirements.
4. Final product name/trademark check; `MERQO` remains the company identity.

## Implementation status addendum (2026-11-03)

All decisions above are now reflected in source, not just planned:

* `src/core/dispatch.ts` is the single permission/transaction/audit dispatcher used by
  `src/main/index.ts` (Electron IPC) and `src/server/api.ts` (relative `/api` preview).
* `src/main/device.ts` provides a four-component Windows device fingerprint (MachineGuid,
  disk serial, CPU id, user SID, each SHA-256 hashed) with majority matching; the preview
  uses the documented stable development fingerprint.
* `src/main/printing.ts` renders receipt HTML in a hidden sandboxed BrowserWindow, prints
  silently via `webContents.print`, and produces PDF via `printToPDF` with full Indic
  shaping. PDFKit remains a Node-only fallback (KI-004).
* `apps/license-generator/src/index.ts` is the owner-only CLI built with Node SEA; the
  private key is read at runtime from the owner's machine and is never bundled.
* Activation is a dedicated in-app first-run component (`src/renderer/pages/Auth.tsx` +
  `src/core/activation.ts`), so no separate Activation EXE is generated — the documented
  "equivalent component" decision.
* Light theme only, thermal receipt printing only, no cloud/telemetry, no artificial record
  limits, and no expiry/online-renewal fields in the lifetime licence payload.
* Security-driven dependency upgrades (2026-11-03): Vite `7.2.2` → `7.3.7`, Vitest
  `3.2.4` → `4.1.12`, Zod `4.1.11` → `4.6.7`, electron-builder `26.0.12` → `26.18.0`,
  plus explicit `react-is@19.2.0` for Recharts. These were made because `npm audit`
  reported high/critical advisories in the pinned build/test toolchain; after the upgrades
  `npm audit --audit-level=high` passes with 0 high/critical and 28 moderate advisories.
  No audit warning was suppressed; the Security workflow now fails on high/critical
  advisories and the moderate findings are disclosed in `KNOWN_ISSUES.md` /
  `RISK_REGISTER.md`.
* SQLite driver: `better-sqlite3@13.0.3` (N-API) replaced 12.4.1. The 12.x V8 binding did
  not compile against Electron 43's V8 headers (`v8::External::Value`, `PropertyCallbackInfo::This`
  and `Context::GetIsolate` were removed/changed). Version 13 ships one N-API prebuild per
  platform that loads in both Node 22 and Electron 43, so `electron-builder` uses
  `npmRebuild: false` and the Windows workflow no longer performs an ABI rebuild.

* Historical CI evidence: `3b11e3a` (`41642232635` / `41642232646` / `41642232644`),
  `efacbaf` (`41645278808` / `41645278586` / `41645278572`), `f7d78d5`
  (`41646629269` / `41646629348` / `41646629301`) and `8201bc7` (`41660526854` /
  `41660526869` / `41660526709`) are green. The Windows jobs produced
  unsigned NSIS installers and protected owner-only generator artifacts. Final delivery
  commit workflows are re-run and their run IDs recorded in the delivery answer.
  `npm ci --ignore-scripts` plus an explicit Electron
  install replaces the old ABI rebuild; `electron-builder.yml` sets `npmRebuild: false`.
  Installation, activation, hardware QA and release remain outside this evidence.
