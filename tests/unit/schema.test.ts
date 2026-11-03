import { describe, it, expect } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';

const lf = (text: string): string => text.replace(/\r\n/g, '\n');
import { MIGRATION_SQL, LATEST_SCHEMA_VERSION } from '../../src/core/schema.generated';
import { openDatabase } from '../../src/core/db';
import { makeHarness } from '../helpers';

describe('database schema and migrations', () => {
  it('embedded migration SQL matches the canonical SQL file exactly', () => {
    expect(lf(MIGRATION_SQL[1] ?? '')).toBe(lf(readFileSync('database/migrations/001_initial.sql', 'utf8')));
    expect(lf(readFileSync('database/schema/schema.sql', 'utf8'))).toBe(lf(MIGRATION_SQL[1] ?? ''));
    expect(LATEST_SCHEMA_VERSION).toBe(1);
  });
  it('creates all documented tables, WAL mode, foreign keys and integrity', () => {
    const h = makeHarness();
    const tables = (
      h.ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    for (const t of [
      'products',
      'sales',
      'sale_items',
      'purchases',
      'purchase_items',
      'party_ledger',
      'financial_transactions',
      'audit_logs',
      'license_info',
      'backup_history',
    ]) {
      expect(tables).toContain(t);
    }
    expect(h.ctx.db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(h.ctx.db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(h.ctx.db.pragma('integrity_check', { simple: true })).toBe('ok');
    h.cleanup();
  });
  it('applying migrations twice is idempotent and preserves schema version', () => {
    const h = makeHarness();
    const version = Number(
      (h.ctx.db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get() as { value: string })
        .value,
    );
    h.ctx.db.close();
    const reopened = openDatabase(h.ctx.config.dbPath);
    expect(
      Number(
        (reopened.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get() as { value: string })
          .value,
      ),
    ).toBe(version);
    expect(reopened.pragma('integrity_check', { simple: true })).toBe('ok');
    reopened.close();
    rm(h.dir);
  });
});
function rm(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* noop */
  }
}
