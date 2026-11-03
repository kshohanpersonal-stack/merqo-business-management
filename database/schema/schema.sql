-- MERQO canonical schema, migration 001.
-- All money is INTEGER minor units. All quantities are INTEGER with 3 implied decimals.
-- All timestamps are ISO-8601 UTC TEXT. Financial rows are immutable; corrections are reversals.

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO app_meta(key, value) VALUES ('schema_version', '1'), ('product_id', 'MERQO-POS');

CREATE TABLE business_profile (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  business_name TEXT NOT NULL DEFAULT '',
  business_name_en TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  logo_path TEXT NOT NULL DEFAULT '',
  invoice_footer TEXT NOT NULL DEFAULT 'ধন্যবাদ! আবার আসুন।',
  tax_registration TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE currencies (
  code TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  minor_unit INTEGER NOT NULL DEFAULT 2,
  position TEXT NOT NULL DEFAULT 'before' CHECK (position IN ('before','after'))
);
INSERT INTO currencies(code, symbol, name, minor_unit, position) VALUES
  ('BDT', '৳', 'Bangladesh Taka', 2, 'before'),
  ('USD', '$', 'US Dollar', 2, 'before');

CREATE TABLE units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  symbol TEXT NOT NULL,
  base_unit TEXT NOT NULL,
  factor_minor INTEGER NOT NULL DEFAULT 1000 CHECK (factor_minor > 0),
  decimals INTEGER NOT NULL DEFAULT 3 CHECK (decimals BETWEEN 0 AND 3),
  is_custom INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  UNIQUE (name, base_unit)
);
-- factor_minor is relative to the base unit, with 3 implied decimals: 1000 = 1x.
INSERT INTO units(id, name, name_en, symbol, base_unit, factor_minor, decimals, is_custom) VALUES
  ('u-piece','পিস','Piece','পিস','piece',1000,0,0),
  ('u-gram','গ্রাম','Gram','গ','gram',1000,3,0),
  ('u-kg','কেজি','Kilogram','কেজি','gram',1000000,3,0),
  ('u-ml','মিলি','Milliliter','মিলি','milliliter',1000,3,0),
  ('u-liter','লিটার','Liter','লি','milliliter',1000000,3,0),
  ('u-meter','মিটার','Meter','মি','meter',1000,3,0),
  ('u-box','বক্স','Box','বক্স','piece',1000,0,0),
  ('u-packet','প্যাকেট','Packet','প্যাকেট','piece',1000,0,0),
  ('u-dozen','ডজন','Dozen','ডজন','piece',12000,0,0),
  ('u-bottle','বোতল','Bottle','বোতল','piece',1000,0,0),
  ('u-carton','কার্টন','Carton','কার্টন','piece',1000,0,0),
  ('u-set','সেট','Set','সেট','piece',1000,0,0),
  ('u-pair','জোড়া','Pair','জোড়া','piece',2000,0,0);

CREATE TABLE unit_conversions (
  id TEXT PRIMARY KEY,
  from_unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  to_unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  factor_minor INTEGER NOT NULL CHECK (factor_minor > 0),
  UNIQUE (from_unit_id, to_unit_id)
);
INSERT INTO unit_conversions(id, from_unit_id, to_unit_id, factor_minor) VALUES
  ('c-kg-gram','u-kg','u-gram',1000000),
  ('c-gram-kg','u-gram','u-kg',1),
  ('c-liter-ml','u-liter','u-ml',1000000),
  ('c-ml-liter','u-ml','u-liter',1);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (name, parent_id)
);

CREATE TABLE brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'cash' CHECK (type IN ('cash','bank','mobile','custom','other')),
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
INSERT INTO payment_methods(id, name, name_en, type, sort_order, created_at) VALUES
  ('pm-cash','নগদ','Cash','cash',1,'2026-01-01T00:00:00.000Z'),
  ('pm-bkash','bKash','bKash','mobile',2,'2026-01-01T00:00:00.000Z'),
  ('pm-nagad','Nagad','Nagad','mobile',3,'2026-01-01T00:00:00.000Z'),
  ('pm-rocket','Rocket','Rocket','mobile',4,'2026-01-01T00:00:00.000Z'),
  ('pm-bank','ব্যাংক','Bank','bank',5,'2026-01-01T00:00:00.000Z'),
  ('pm-other','অন্যান্য','Other','other',6,'2026-01-01T00:00:00.000Z');

CREATE TABLE expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO expense_categories(id, name, name_en, created_at) VALUES
  ('ec-rent','দোকান ভাড়া','Shop rent','2026-01-01T00:00:00.000Z'),
  ('ec-electricity','বিদ্যুৎ','Electricity','2026-01-01T00:00:00.000Z'),
  ('ec-water','পানি','Water','2026-01-01T00:00:00.000Z'),
  ('ec-internet','ইন্টারনেট','Internet','2026-01-01T00:00:00.000Z'),
  ('ec-salary','কর্মচারী বেতন','Employee salary','2026-01-01T00:00:00.000Z'),
  ('ec-transport','পরিবহন','Transport','2026-01-01T00:00:00.000Z'),
  ('ec-goods-transport','পণ্য পরিবহন','Goods transportation','2026-01-01T00:00:00.000Z'),
  ('ec-repair','মেরামত','Repair','2026-01-01T00:00:00.000Z'),
  ('ec-other','অন্যান্য','Other','2026-01-01T00:00:00.000Z');

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL
);
CREATE TABLE role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  full_name_en TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  scrypt_params TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','locked')),
  phone TEXT NOT NULL DEFAULT '',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE app_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('info','warn','error')),
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','error')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  entity TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE notification_rules (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  threshold_json TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO notification_rules(key, enabled, threshold_json) VALUES
  ('low_stock',1,'{"days":0}'), ('expiry',1,'{"days":30}'),
  ('customer_due',1,'{"amount_minor":0}'), ('backup_reminder',1,'{"hours":24}');

CREATE TABLE shortcuts (
  action_key TEXT PRIMARY KEY,
  shortcut TEXT NOT NULL,
  label TEXT NOT NULL
);
INSERT INTO shortcuts(action_key, shortcut, label) VALUES
  ('newSale','F1','নতুন সেল'), ('productSearch','F2','প্রোডাক্ট খোঁজা'),
  ('barcodeFocus','F3','বারকোড ফোকাস'), ('customer','F4','কাস্টমার'),
  ('discount','F5','ডিসকাউন্ট'), ('holdSale','F6','সেল হোল্ড'),
  ('resumeSale','F7','সেল রিজিউম'), ('completePayment','F8','পেমেন্ট সম্পন্ন'),
  ('printReceipt','F9','রিসিট প্রিন্ট'), ('dashboard','Ctrl+Alt+D','ড্যাশবোর্ড'),
  ('products','Ctrl+Alt+P','প্রোডাক্ট'), ('reports','Ctrl+Alt+R','রিপোর্ট'),
  ('closeDialog','Escape','ডায়ালগ বন্ধ');

CREATE TABLE printer_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  paper_width TEXT NOT NULL DEFAULT '80mm' CHECK (paper_width IN ('58mm','80mm')),
  font_size INTEGER NOT NULL DEFAULT 12 CHECK (font_size BETWEEN 8 AND 20),
  alignment TEXT NOT NULL DEFAULT 'left' CHECK (alignment IN ('left','center','right')),
  characters_per_line INTEGER NOT NULL DEFAULT 32,
  cut_paper INTEGER NOT NULL DEFAULT 1,
  print_duplicate INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
INSERT INTO printer_profiles(id, name, paper_width, characters_per_line, is_default, created_at) VALUES
  ('printer-default','ডিফল্ট থার্মাল প্রিন্টার','80mm',32,1,'2026-01-01T00:00:00.000Z');

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  opening_balance_minor INTEGER NOT NULL DEFAULT 0,
  balance_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  opening_balance_minor INTEGER NOT NULL DEFAULT 0,
  balance_minor INTEGER NOT NULL DEFAULT 0,
  credit_limit_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_walk_in INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  qr_payload TEXT,
  image_path TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id TEXT REFERENCES brands(id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  purchase_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (purchase_price_minor >= 0),
  selling_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (selling_price_minor >= 0),
  wholesale_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (wholesale_price_minor >= 0),
  retail_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (retail_price_minor >= 0),
  discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none','percent','fixed')),
  discount_value INTEGER NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  current_stock_minor INTEGER NOT NULL DEFAULT 0,
  min_stock_minor INTEGER NOT NULL DEFAULT 0,
  max_stock_minor INTEGER NOT NULL DEFAULT 0,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE RESTRICT,
  expiry_date TEXT,
  batch_no TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  average_cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (average_cost_minor >= 0),
  tax_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  qr_code TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE product_barcodes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE product_batches (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_no TEXT NOT NULL,
  expiry_date TEXT,
  quantity_minor INTEGER NOT NULL DEFAULT 0,
  cost_minor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (product_id, batch_no)
);
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  quantity_minor INTEGER NOT NULL CHECK (quantity_minor > 0),
  unit_cost_minor INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  reference_type TEXT NOT NULL DEFAULT '',
  reference_id TEXT NOT NULL DEFAULT '',
  balance_after_minor INTEGER NOT NULL,
  actor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE stock_adjustments (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  quantity_minor INTEGER NOT NULL CHECK (quantity_minor > 0),
  reason TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  movement_id TEXT NOT NULL REFERENCES stock_movements(id) ON DELETE RESTRICT,
  actor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE held_sales (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  user_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('cash','bank','mobile','custom','other')),
  payment_method_id TEXT REFERENCES payment_methods(id) ON DELETE RESTRICT,
  opening_balance_minor INTEGER NOT NULL DEFAULT 0,
  balance_minor INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO accounts(id, name, name_en, type, payment_method_id, is_default, created_at) VALUES
  ('acc-cash','নগদ ক্যাশ','Cash','cash','pm-cash',1,'2026-01-01T00:00:00.000Z');

CREATE TABLE financial_transactions (
  id TEXT PRIMARY KEY,
  txn_date TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  balance_after_minor INTEGER NOT NULL,
  kind TEXT NOT NULL,
  reference_type TEXT NOT NULL DEFAULT '',
  reference_id TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT UNIQUE,
  actor_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE RESTRICT,
  supplier_invoice_no TEXT NOT NULL DEFAULT '',
  purchase_date TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL DEFAULT 0,
  extra_cost_minor INTEGER NOT NULL DEFAULT 0,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL DEFAULT 0,
  paid_minor INTEGER NOT NULL DEFAULT 0,
  due_minor INTEGER NOT NULL DEFAULT 0,
  cogs_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','partial_return','void')),
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity_minor INTEGER NOT NULL CHECK (quantity_minor > 0),
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  line_discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  line_total_minor INTEGER NOT NULL,
  unit_cost_minor INTEGER NOT NULL,
  batch_no TEXT,
  expiry_date TEXT,
  received_qty_minor INTEGER NOT NULL,
  returned_qty_minor INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE purchase_payments (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  reference TEXT NOT NULL DEFAULT '',
  financial_transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);
CREATE TABLE purchase_returns (
  id TEXT PRIMARY KEY,
  purchase_id TEXT REFERENCES purchases(id) ON DELETE RESTRICT,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE RESTRICT,
  return_date TEXT NOT NULL,
  total_minor INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE purchase_return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  purchase_item_id TEXT NOT NULL REFERENCES purchase_items(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_minor INTEGER NOT NULL CHECK (quantity_minor > 0),
  unit_cost_minor INTEGER NOT NULL,
  line_total_minor INTEGER NOT NULL
);

CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
  sale_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','partial_return','cancelled','refunded')),
  subtotal_minor INTEGER NOT NULL DEFAULT 0,
  item_discount_minor INTEGER NOT NULL DEFAULT 0,
  cart_discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL DEFAULT 0,
  paid_minor INTEGER NOT NULL DEFAULT 0,
  due_minor INTEGER NOT NULL DEFAULT 0,
  cogs_minor INTEGER NOT NULL DEFAULT 0,
  gross_profit_minor INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  cancelled_at TEXT,
  cancel_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity_minor INTEGER NOT NULL CHECK (quantity_minor > 0),
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  unit_cost_minor INTEGER NOT NULL CHECK (unit_cost_minor >= 0),
  discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  line_total_minor INTEGER NOT NULL,
  line_cogs_minor INTEGER NOT NULL DEFAULT 0,
  returned_qty_minor INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sale_payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  reference TEXT NOT NULL DEFAULT '',
  financial_transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL UNIQUE REFERENCES sales(id) ON DELETE RESTRICT,
  invoice_no TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  footer TEXT NOT NULL DEFAULT '',
  printed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE sales_returns (
  id TEXT PRIMARY KEY,
  sale_id TEXT REFERENCES sales(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
  return_date TEXT NOT NULL,
  total_minor INTEGER NOT NULL,
  cogs_reversal_minor INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE sales_return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  sale_item_id TEXT NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_minor INTEGER NOT NULL CHECK (quantity_minor > 0),
  unit_price_minor INTEGER NOT NULL,
  unit_cost_minor INTEGER NOT NULL,
  line_total_minor INTEGER NOT NULL
);
CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  sale_id TEXT REFERENCES sales(id) ON DELETE RESTRICT,
  return_id TEXT REFERENCES sales_returns(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  financial_transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE exchanges (
  id TEXT PRIMARY KEY,
  sale_id TEXT REFERENCES sales(id) ON DELETE RESTRICT,
  return_id TEXT REFERENCES sales_returns(id) ON DELETE RESTRICT,
  replacement_sale_id TEXT REFERENCES sales(id) ON DELETE RESTRICT,
  note TEXT NOT NULL DEFAULT '',
  actor_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  expense_date TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  attachment_path TEXT NOT NULL DEFAULT '',
  financial_transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_id TEXT,
  created_at TEXT NOT NULL,
  voided_at TEXT
);
CREATE TABLE party_ledger (
  id TEXT PRIMARY KEY,
  party_type TEXT NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id TEXT NOT NULL,
  txn_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('opening','invoice','purchase','payment','return','refund','adjustment')),
  debit_minor INTEGER NOT NULL DEFAULT 0,
  credit_minor INTEGER NOT NULL DEFAULT 0,
  balance_after_minor INTEGER NOT NULL,
  reference_type TEXT NOT NULL DEFAULT '',
  reference_id TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT UNIQUE,
  note TEXT NOT NULL DEFAULT '',
  actor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE cash_closings (
  date TEXT PRIMARY KEY,
  opening_minor INTEGER NOT NULL DEFAULT 0,
  expected_minor INTEGER NOT NULL DEFAULT 0,
  counted_minor INTEGER NOT NULL DEFAULT 0,
  difference_minor INTEGER NOT NULL DEFAULT 0,
  actor_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE license_info (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  status TEXT NOT NULL DEFAULT 'unactivated' CHECK (status IN ('unactivated','active','recovery_pending')),
  license_id TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL DEFAULT '',
  issuer TEXT NOT NULL DEFAULT '',
  issued_at TEXT NOT NULL DEFAULT '',
  activated_at TEXT NOT NULL DEFAULT '',
  device_fingerprint TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  signature TEXT NOT NULL DEFAULT '',
  public_key_fingerprint TEXT NOT NULL DEFAULT '',
  recovery_count INTEGER NOT NULL DEFAULT 0
);
INSERT INTO license_info(singleton_id) VALUES (1);

CREATE TABLE backup_history (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','automatic','safety','pre_migration')),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','verified','failed','restored')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_name_en ON products(name_en);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_stock ON products(current_stock_minor, min_stock_minor);
CREATE INDEX idx_products_expiry ON products(expiry_date);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_purchases_date ON purchases(purchase_date);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchase_items_product ON purchase_items(product_id);
CREATE INDEX idx_stock_movements_product_date ON stock_movements(product_id, created_at);
CREATE INDEX idx_financial_txn_date ON financial_transactions(txn_date);
CREATE INDEX idx_financial_txn_account ON financial_transactions(account_id);
CREATE INDEX idx_party_ledger_party_date ON party_ledger(party_type, party_id, txn_date);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_suppliers_phone ON suppliers(phone);
