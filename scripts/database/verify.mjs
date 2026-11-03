/** Verify the forward-only SQL schema: integrity, constraints, indexes, WAL and rollback. */
import Database from 'better-sqlite3';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const lf = (text) => text.replace(/\r\n/g, '\n');
const migration = lf(readFileSync('database/migrations/001_initial.sql', 'utf8'));
const snapshot = lf(readFileSync('database/schema/schema.sql', 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'merqo-schema-'));
const dbPath = join(tmp, 'verify.sqlite');
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok, detail }); if (!ok) process.exitCode = 1; };
try {
  check('schema.sql matches migration', migration.trim() === snapshot.trim(), migration.trim() === snapshot.trim() ? '' : 'Snapshot must be regenerated from the migration.');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(migration);
  check('integrity_check', db.pragma('integrity_check', { simple: true }) === 'ok');
  check('foreign_key_check', (db.pragma('foreign_key_check') ?? []).length === 0);
  const tables = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n;
  check('tables present', tables >= 45, `${tables} tables`);
  const indexes = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").get().n;
  check('indexes present', indexes >= 20, `${indexes} indexes`);
  const version = db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get()?.value;
  check('schema version recorded', String(version) === '1', `version=${version}`);
  const required = ['products', 'sales', 'sale_items', 'purchases', 'customers', 'suppliers', 'accounts',
    'party_ledger', 'financial_transactions', 'audit_logs', 'backup_history', 'license_info', 'held_sales',
    'stock_movements', 'expenses', 'notifications', 'settings', 'users', 'roles', 'role_permissions'];
  for (const t of required) check(`table ${t}`, Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t)));
  // Money and quantity columns are INTEGER (never REAL).
  const moneyCols = db.prepare(`SELECT name, type FROM pragma_table_info('sales')`).all();
  check('sales amounts are INTEGER', ['subtotal_minor', 'total_minor', 'paid_minor', 'due_minor', 'cogs_minor']
    .every((c) => moneyCols.find((x) => x.name === c)?.type === 'INTEGER'));
  // FK enforcement.
  let fkRejected = false;
  try { db.prepare("INSERT INTO sale_items(id, sale_id, product_id, product_name, quantity_minor, unit_id, unit_price_minor, unit_cost_minor, discount_minor, tax_minor, line_total_minor, line_cogs_minor) VALUES ('bad','no-sale','no-product','x',1,'u-piece',0,0,0,0,0,0)").run(); }
  catch { fkRejected = true; }
  check('foreign key rejects orphan rows', fkRejected);
  // ACID rollback.
  const before = db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n;
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO audit_logs(id, action, entity, created_at) VALUES ('verify-rollback','test','test','2026-01-01')").run();
    throw new Error('rollback');
  });
  try { tx(); } catch { /* expected */ }
  const after = db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n;
  check('transaction rollback', before === after);
  // Prepared statements with parameters (no interpolation of user input).
  const p = db.prepare('SELECT COUNT(*) AS n FROM products WHERE name = ?').get('nonexistent');
  check('parameterized query', p.n === 0);
  db.close();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
console.log(`${checks.filter((c) => c.ok).length}/${checks.length} database checks passed.`);
