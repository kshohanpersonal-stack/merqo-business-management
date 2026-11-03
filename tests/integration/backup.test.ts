import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { makeHarness, seedProduct, type TestHarness } from '../helpers';
import { createBackup, verifyBackup, restoreBackup } from '../../src/core/backup';

let h: TestHarness;
afterEach(() => {
  h?.cleanup();
});

describe('TC-006 backup, verification and safe restore', () => {
  it('creates a verified backup, detects tampering and supports encryption', () => {
    h = makeHarness();
    seedProduct(h, { name: 'ব্যাকআপ পণ্য' });
    const info = createBackup(h.ctx.db, h.ctx.config, { trigger: 'manual' });
    expect(info.valid).toBe(true);
    expect(info.sha256).toHaveLength(64);
    expect(info.schemaVersion).toBe(1);
    expect(readFileSync(info.filePath).subarray(0, 8).toString()).toBe('MERQOBAK');

    const tampered = readFileSync(info.filePath);
    tampered[tampered.length - 10] = (tampered[tampered.length - 10] ?? 0) ^ 0xff;
    const badPath = info.filePath + '.tampered';
    writeFileSync(badPath, tampered);
    expect(verifyBackup(badPath).valid).toBe(false);

    const enc = createBackup(h.ctx.db, h.ctx.config, { passphrase: 'গোপন-পাসফ্রেজ', trigger: 'manual' });
    expect(enc.valid).toBe(true);
    expect(verifyBackup(enc.filePath).valid).toBe(false);
    expect(verifyBackup(enc.filePath, 'গোপন-পাসফ্রেজ').valid).toBe(true);
    expect(verifyBackup(enc.filePath, 'ভুল').valid).toBe(false);
  });

  it('restores earlier data, creates a safety backup and verifies the reopened DB', () => {
    h = makeHarness();
    seedProduct(h, { name: 'প্রথম পণ্য' });
    const info = createBackup(h.ctx.db, h.ctx.config, { trigger: 'manual' });
    seedProduct(h, { name: 'দ্বিতীয় পণ্য', code: 'P2', sku: 'P2', barcode: '8900000000009' });
    expect((h.ctx.db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n).toBe(2);
    const restored = restoreBackup(h.ctx, { filePath: info.filePath });
    expect(restored.valid).toBe(true);
    expect((h.ctx.db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n).toBe(1);
    expect(h.ctx.db.pragma('integrity_check', { simple: true })).toBe('ok');
    const safety = h.ctx.db
      .prepare("SELECT COUNT(*) AS n FROM backup_history WHERE trigger='safety'")
      .get() as { n: number };
    expect(safety.n).toBe(1);
    // The reopened connection is live and writable.
    h.ctx.db
      .prepare(
        "INSERT OR REPLACE INTO settings(key, value_json, updated_at) VALUES ('restore_check','\"ok\"',?)",
      )
      .run(new Date().toISOString());
    expect(h.ctx.db.prepare("SELECT value_json FROM settings WHERE key='restore_check'").get()).toBeTruthy();
  });
});
