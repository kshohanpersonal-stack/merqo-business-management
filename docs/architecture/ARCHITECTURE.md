# System Architecture

## 1. Layer map

| # | Layer | Location | Responsibility |
| --- | --- | --- | --- |
| 1 | Presentation | `src/renderer/` | React pages/components, design system, keyboard shortcuts, Bangla strings |
| 2 | Application | `src/core/dispatch.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/server/api.ts` | Single action dispatcher, hardened IPC bridge, session/permission gate, error normalization |
| 3 | Business logic | `src/core/{sales,purchases,inventory,finance,parties,expenses,analytics}.ts` | Transactional workflows, returns/refunds, invariants, financial policy |
| 4 | Database | `src/core/db.ts`, `src/core/schema.generated.ts`, `database/migrations/001_initial.sql` | SQLite connection, embedded forward-only migration, schema, indexes, integrity |
| 5 | Authentication | `src/core/auth.ts`, `src/core/sessions.ts` | scrypt hashing, sessions, account status |
| 6 | Licensing | `src/core/licensing.ts`, `apps/license-generator/` | Ed25519 verification, device binding, activation |
| 7 | Reporting | `src/core/reports.ts` | Report descriptor registry, filters, pagination, totals |
| 8 | Printing | `src/core/printing.ts`, `src/main/printing.ts` | Receipt HTML, ESC/POS builder, printer queue |
| 9 | Hardware | `src/core/barcode.ts`, `src/renderer/pages/Pos.tsx` | Keyboard-wedge scanner detection in POS, barcode/QR generation |
| 10 | Backup/recovery | `src/core/backup.ts` | Online backup, manifest/checksum, optional encryption, safe restore |
| 11 | Logging/monitoring | `src/core/audit.ts`, `src/core/logger.ts` | Audit trail, sanitized local logs |
| 12 | Configuration | `src/core/settings.ts`, `src/core/config.ts` | Business profile, formats, payment methods, shortcuts, paths |

Dependency direction is strictly downward: presentation → application → business →
database. Domain modules never import React or Electron. Configuration and logging are
cross-cutting leaves. The Vite preview plugin and Electron main both construct the same
`createContext({ db, ... })` and call the same `dispatch()`.

## 2. Runtime topologies

### Production (customer PC)

```
Electron BrowserWindow (React, contextIsolation: true, nodeIntegration: false)
        │  window.merqo.call(action, payload, token)  [preload, allow-listed channel]
        ▼
Electron main process → dispatch() → Core services → better-sqlite3
                                    │
                                    ├─ printToPDF / webContents.print()
                                    ├─ fs (backup/restore, logs, licence import)
                                    └─ crypto (license verify, scrypt)
```

### Development preview (this sandbox and CI Linux runners)

```
Browser → Vite dev server (0.0.0.0)
          ├─ static React assets
          └─ /api  → Vite middleware → same dispatch() → better-sqlite3 (Node ABI)
```

Browser-facing code always uses the relative URL `/api`, never `localhost`, so the
Arena proxied preview host works. The preview is a development tool, not a customer
deliverable.

### Tests

`vitest` imports core modules directly with an in-memory/temporary SQLite file. Tests
never require Electron, a display, a network, or a printer.

## 3. The dispatcher contract

`call(action, payload, token)` → `{ ok: true, data } | { ok: false, error: { code,
message } }`. Actions are namespaced (`product.create`, `sale.complete`, `report.run`).
The dispatcher:

1. resolves the action descriptor (permission, validator, handler);
2. verifies the session token (except `bootstrap.*`, `auth.login`, `license.*`);
3. checks the caller's permission;
4. validates payload with Zod schemas and normalizes money strings;
5. executes the handler inside `db.transaction()` when declared transactional;
6. writes an audit record for sensitive actions;
7. converts thrown `AppError`s into safe Bangla/English messages.

No raw SQL, file paths or arbitrary action strings reach the renderer. Idempotency keys
are part of payloads for all money-moving actions; unique indexes reject duplicates.

## 4. Data flow example — a completed sale

1. POS builds a cart, computes totals in the core (`sale.preview`) so UI and DB agree.
2. `sale.complete` validates stock, price, discount, payment sum and idempotency key.
3. One SQLite transaction inserts `sales`, `sale_items` (with `unit_cost_minor` snapshot),
   `sale_payments`, `invoices`, `stock_movements`, `financial_transactions`,
   `party_ledger` entries, `notifications`, and `audit_logs`; updates `products.stock`,
   `accounts.balance_minor`, `customers.balance_minor` and `held_sales` state.
4. Commit. Receipt printing happens **after** commit and cannot roll back the sale.
5. A printer failure returns a non-fatal warning; the invoice remains printable later.

## 5. Error, concurrency and recovery model

* SQLite WAL + `foreign_keys=ON` + `busy_timeout` + `synchronous=NORMAL` (documented
  durability trade-off) or `FULL` when configured for maximum durability.
* All multi-row workflows use `db.transaction(...).immediate(...)`.
* Idempotency keys are unique per transaction type.
* Crashes: WAL recovery on next open; `PRAGMA integrity_check` at startup; automatic
  safety backup before migrations and restores.
* No hidden telemetry; logger writes sanitized lines to `logs/` in the user data dir.

## 6. Non-functional targets (to be measured, not assumed)

| Metric | Target | Test |
| --- | --- | --- |
| Cold start to login | < 3 s on reference SSD | NOT TESTED — no startup benchmark in this environment |
| POS add-to-cart | < 50 ms p95 | NOT TESTED — no POS latency benchmark in this environment |
| 10k product search | < 200 ms p95 with index | `tests/performance/large-dataset.test.ts` (p95 8.0 ms, dashboard 5.6 ms) |
| Sale commit (10 items) | < 100 ms | NOT TESTED — no dedicated integration benchmark |
| Memory after 1h session | no unbounded growth | NOT TESTED — manual long-session checklist |

## 7. Rejected architecture ideas

* Renderer-side SQL (exposes database, breaks permissions).
* A separate REST microservice (extra port, extra failure mode, no benefit offline).
* Per-module databases (destroys atomic cross-module transactions).
