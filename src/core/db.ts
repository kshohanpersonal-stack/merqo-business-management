import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MIGRATION_SQL, LATEST_SCHEMA_VERSION } from './schema.generated';
import { seedPermissions } from './permissions';
import { AppError, ERR } from './errors';

export type DB = Database.Database;

export function openDatabase(dbPath: string): DB {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('temp_store = MEMORY');
  applyMigrations(db);
  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') {
    db.close();
    throw new AppError(ERR.IO, 'ডাটাবেজ অখণ্ডতা যাচাই ব্যর্থ হয়েছে। ব্যাকআপ থেকে রিস্টোর করুন।');
  }
  seedPermissions(db);
  seedDefaults(db);
  return db;
}

export function applyMigrations(db: DB): number {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_meta'").get();
  if (!exists) {
    const version = 1;
    db.transaction(() => {
      db.exec(MIGRATION_SQL[version]!);
    })();
  }
  let current = Number(
    (db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get() as { value: string }).value,
  );
  for (let v = current + 1; v <= LATEST_SCHEMA_VERSION; v++) {
    const sql = MIGRATION_SQL[v];
    if (!sql) throw new AppError(ERR.IO, `মাইগ্রেশন ${v} পাওয়া যায়নি।`);
    db.transaction(() => {
      db.exec(sql);
      db.prepare("UPDATE app_meta SET value = ? WHERE key='schema_version'").run(String(v));
    })();
    current = v;
  }
  return current;
}

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  currency: { code: 'BDT', symbol: '৳', position: 'before', decimals: 2 },
  dateFormat: 'dd/MM/yyyy',
  numberFormat: { banglaDigits: false, groupSeparator: ',', decimalSeparator: '.' },
  tax: { enabled: false, rateBps: 0, mode: 'exclusive', label: 'ভ্যাট' },
  receipt: {
    width: '80mm',
    font: 12,
    alignment: 'left',
    showLogo: true,
    footer: 'ধন্যবাদ! আবার আসুন।',
    duplicate: false,
    cut: true,
  },
  barcode: { format: 'CODE128', prefix: 'MERQ', autoGenerate: true },
  alerts: { lowStock: true, expiryDays: 30 },
  backup: { automatic: false, frequencyHours: 24, retention: 10, location: '', encrypted: false },
  startup: { openDashboard: true, minimizeToTray: false },
  language: 'bn',
};

export function seedDefaults(db: DB): void {
  const now = new Date().toISOString();
  const set = db.prepare('INSERT OR IGNORE INTO settings(key, value_json, updated_at) VALUES (?, ?, ?)');
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) set.run(key, JSON.stringify(value), now);
    db.prepare('INSERT OR IGNORE INTO business_profile(singleton_id, updated_at) VALUES (1, ?)').run(now);
    db.prepare(
      `INSERT OR IGNORE INTO customers(id, name, name_en, is_walk_in, created_at, updated_at)
      VALUES ('customer-walk-in', 'ওয়াক-ইন কাস্টমার', 'Walk-in customer', 1, ?, ?)`,
    ).run(now, now);
  });
  tx();
}

export function tableExists(db: DB, name: string): boolean {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}
export function countRows(db: DB, table: string): number {
  if (!/^[a-z_]+$/.test(table)) throw new AppError(ERR.VALIDATION, 'অবৈধ টেবিল নাম।');
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}
export function isFreshDatabase(dbPath: string): boolean {
  return !existsSync(dbPath);
}
