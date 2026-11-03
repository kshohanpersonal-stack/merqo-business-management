# Database Architecture & Schema

Engine: SQLite 3 (via `better-sqlite3`). File: `<userData>/data/merqo.sqlite`.
Journal: WAL. `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL` by default.
All money columns are `INTEGER` minor units (paisa for BDT) with `CHECK` guards. All
timestamps are ISO-8601 UTC `TEXT`. All primary keys are TEXT UUIDv4 unless noted.

## 1. Design rules

1. Every row has `created_at`; mutable entities also have `updated_at`.
2. Historical financial rows are immutable: corrections are reversal rows.
3. Deletion is soft (`archived_at`, `deleted_at`) for entities referenced by history.
4. Every quantity is stored in the product's base unit with `quantity_minor` (3 decimals)
   to avoid float stock drift; display conversion uses `units.factor`.
5. Monetary rounding is half-up at the minor unit, performed once per line and once per
   document; percentages are integer basis points (`discount_bps`).
6. Foreign keys use `ON DELETE RESTRICT` for accounting references and `ON DELETE CASCADE`
   only for owned child rows such as `sale_items`.
7. Idempotency keys have `UNIQUE` indexes per transaction family.

## 2. Entity groups (canonical `database/schema/schema.sql`)

### Configuration and identity
`app_meta(key,value)` · `business_profile` · `settings(key,value_json)` ·
`currencies` · `payment_methods` · `units` · `unit_conversions` · `categories`
(self-referencing `parent_id`) · `brands` · `expense_categories` · `shortcuts` ·
`printer_profiles` · `backup_history` · `notification_rules`.

### Users, roles, audit
`roles` · `permissions` · `role_permissions` · `users(username UNIQUE, password_hash,
password_salt, scrypt_params, role_id, status, failed_attempts, locked_until)` ·
`sessions(token_hash UNIQUE, user_id, created_at, expires_at, revoked_at)` ·
`audit_logs(actor_id, action, entity, entity_id, before_json, after_json, ip, created_at)` ·
`notifications(kind, severity, title, body, entity, entity_id, read_at, created_at)` ·
`app_logs(level, message, context_json, created_at)`.

### Catalog and inventory
`products(id, name, name_en, code UNIQUE, sku UNIQUE, barcode, qr_payload, image_path,
category_id, subcategory_id, brand_id, description, purchase_price_minor,
selling_price_minor, wholesale_price_minor, retail_price_minor, discount_type,
discount_value, current_stock_minor, min_stock_minor, max_stock_minor, unit_id,
supplier_id, expiry_date, batch_no, status, average_cost_minor, tax_rate_bps,
archived_at, created_at, updated_at)` · `product_barcodes(product_id, barcode UNIQUE)` ·
`product_batches(product_id, batch_no, expiry_date, quantity_minor, cost_minor)` ·
`stock_movements(product_id, direction, quantity_minor, unit_cost_minor, reason,
reference_type, reference_id, balance_after_minor, actor_id, created_at)` ·
`stock_adjustments` · `held_sales(payload_json, user_id, note, created_at)`.

### Parties
`customers(id, name, phone, address, notes, opening_balance_minor, balance_minor,
credit_limit_minor, status, archived_at, created_at, updated_at)` ·
`suppliers(id, name, company, phone, email, address, notes, opening_balance_minor,
balance_minor, status, archived_at, created_at, updated_at)`.

### Purchases
`purchases(id, invoice_no UNIQUE, supplier_id, supplier_invoice_no, purchase_date,
subtotal_minor, extra_cost_minor, discount_minor, tax_minor, total_minor, paid_minor,
due_minor, status, idempotency_key UNIQUE, actor_id, note, created_at)` ·
`purchase_items(purchase_id, product_id, quantity_minor, unit_id, unit_price_minor,
line_discount_minor, tax_minor, line_total_minor, unit_cost_minor, batch_no,
expiry_date, received_qty_minor, returned_qty_minor)` ·
`purchase_payments` · `purchase_returns` · `purchase_return_items`.

### Sales and POS
`sales(id, invoice_no UNIQUE, customer_id, sale_date, status, subtotal_minor,
item_discount_minor, cart_discount_minor, tax_minor, total_minor, paid_minor,
due_minor, cogs_minor, gross_profit_minor, idempotency_key UNIQUE, user_id,
note, cancelled_at, cancel_reason, created_at)` ·
`sale_items(sale_id, product_id, product_name, quantity_minor, unit_id,
unit_price_minor, unit_cost_minor, discount_minor, tax_minor, line_total_minor,
returned_qty_minor)` · `sale_payments(sale_id, payment_method_id, account_id,
amount_minor, reference)` · `invoices(sale_id UNIQUE, invoice_no, payload_json,
footer, printed_count, created_at)` · `sales_returns` · `sales_return_items` ·
`refunds` · `exchanges`.

### Finance
`accounts(id, name, type CHECK(cash,bank,mobile,custom,other), opening_balance_minor,
balance_minor, is_default, archived_at)` ·
`financial_transactions(id, txn_date, account_id, direction CHECK(in,out),
amount_minor, balance_after_minor, kind, reference_type, reference_id,
idempotency_key UNIQUE, actor_id, note, created_at)` ·
`expenses(id, expense_date, category_id, amount_minor, payment_method_id, account_id,
description, attachment_path, actor_id, created_at, voided_at)` ·
`party_ledger(id, party_type CHECK(customer,supplier), party_id, txn_date,
kind CHECK(opening,invoice,purchase,payment,return,refund,adjustment),
debit_minor, credit_minor, balance_after_minor, reference_type, reference_id,
idempotency_key UNIQUE, note, actor_id, created_at)` ·
`cash_closings(date UNIQUE, opening_minor, expected_minor, counted_minor,
difference_minor, actor_id, note)`.

### Licensing
`license_info(singleton_id CHECK=1, status, license_id, business_name, issuer,
issued_at, activated_at, device_fingerprint, payload_json, signature,
public_key_fingerprint, recovery_count)`.

## 3. Index strategy

| Index | Purpose |
| --- | --- |
| `idx_products_name`, `idx_products_code`, `idx_products_barcode` | Fast POS/Bangla name and scanner lookup |
| `idx_products_category`, `idx_products_status` | Filters and low-stock queries |
| `idx_sales_date`, `idx_sales_customer`, `idx_sales_status` | Period reports and customer history |
| `idx_sale_items_product`, `idx_sale_items_sale` | Product-wise sales / COGS aggregation |
| `idx_purchases_date`, `idx_purchase_items_product` | Purchase reports |
| `idx_stock_movements_product_date` | Stock ledger and valuation |
| `idx_financial_txn_date`, `idx_financial_txn_account` | Cash flow and reconciliation |
| `idx_party_ledger_party_date` | Customer/supplier statements |
| `idx_audit_logs_created`, `idx_audit_logs_actor` | Audit report |
| `UNIQUE` idempotency indexes | Duplicate submission prevention |

`sqlite_stat1` is refreshed with `ANALYZE` after bulk import and migration.

## 4. Migrations and compatibility

`database/migrations/001_initial.sql` … are applied in numeric order inside a
transaction; `app_meta.schema_version` records the applied version. A migration is
never edited after release. Before any migration the engine takes a verified safety
backup. On startup, `PRAGMA integrity_check`, `foreign_key_check` and migration
validation run; a failed check blocks writes and shows a restore prompt.

## 5. Reconciliation invariants (checked by `tests/integration/reconciliation.test.ts`)

1. `accounts.balance_minor = opening + SUM(in) − SUM(out)` for every account.
2. `customers.balance_minor = opening + debits − credits` (supplier balance is the mirror).
3. `products.current_stock_minor = SUM(stock_movements signed quantity)`.
4. `sales.paid_minor = SUM(sale_payments.amount_minor)`; `total − paid = due`.
5. `SUM(sale_items.line_total_minor) + tax − discounts = sales.total_minor`.
6. `SUM(sale_items.unit_cost_minor × qty) = sales.cogs_minor`.
7. `SUM(financial_transactions) = SUM(document payment rows)` per account.
8. No orphaned ledger/audit/stock references (`PRAGMA foreign_key_check`).
