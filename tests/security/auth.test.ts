import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeHarness, seedProduct, type TestHarness } from '../helpers';
import { hashPassword, verifyPassword, authenticate, SCRYPT_PARAMS, createUser } from '../../src/core/auth';
import { dispatch } from '../../src/core/dispatch';
import { createSession } from '../../src/core/sessions';

let h: TestHarness;
afterEach(() => {
  h?.cleanup();
});

describe('TC-007 authentication, authorization, injection and log safety', () => {
  it('hashes passwords with scrypt, per-user salt and timing-safe verification', () => {
    const a = hashPassword('SecurePass123!');
    const b = hashPassword('SecurePass123!');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(verifyPassword('SecurePass123!', a.hash, a.salt)).toBe(true);
    expect(verifyPassword('wrong', a.hash, a.salt)).toBe(false);
    expect(JSON.parse(SCRYPT_PARAMS)).toMatchObject({ algorithm: 'scrypt', N: 131072, r: 8, p: 1 });
  });

  it('locks an account after five failed attempts and rejects invalid login', async () => {
    h = makeHarness();
    createUser(h.ctx.db, {
      username: 'staff',
      fullName: 'স্টাফ',
      password: 'StaffPass123!',
      roleId: 'role-staff',
    });
    for (let i = 0; i < 5; i++) {
      const r = await dispatch(h.ctx, 'auth.login', { username: 'staff', password: 'bad' }, '');
      expect(r.ok).toBe(false);
    }
    const row = h.ctx.db
      .prepare('SELECT failed_attempts, locked_until FROM users WHERE username=?')
      .get('staff') as { failed_attempts: number; locked_until: string };
    expect(row.failed_attempts).toBe(5);
    expect(row.locked_until).toBeTruthy();
    const blocked = await dispatch(h.ctx, 'auth.login', { username: 'staff', password: 'StaffPass123!' }, '');
    expect(blocked.ok).toBe(false);
    expect(authenticate).toBeTypeOf('function');
  });

  it('enforces permissions server-side, not just in the UI', async () => {
    h = makeHarness();
    createUser(h.ctx.db, {
      username: 'cashier',
      fullName: 'ক্যাশিয়ার',
      password: 'CashierPass123!',
      roleId: 'role-cashier',
    });
    const row = h.ctx.db.prepare('SELECT * FROM users WHERE username=?').get('cashier') as any;
    const token = createSession(h.ctx.db, row).token;
    const allowed = await dispatch(h.ctx, 'product.list', {}, token);
    expect(allowed.ok).toBe(true);
    const denied = await dispatch(h.ctx, 'user.list', {}, token);
    expect(denied.ok).toBe(false);
    expect(denied.ok === false && denied.error.code).toBe('FORBIDDEN');
    const denied2 = await dispatch(h.ctx, 'backup.create', {}, token);
    expect(denied2.ok === false && denied2.error.code).toBe('FORBIDDEN');
    const noSession = await dispatch(h.ctx, 'dashboard.get', {}, '');
    expect(noSession.ok === false && noSession.error.code).toBe('UNAUTHENTICATED');
  });

  it('makes SQL-injection strings inert and rejects unsafe paths', async () => {
    h = makeHarness();
    seedProduct(h, { name: 'বাংলা চাল' });
    const injection = await h.call('product.list', { search: "' OR 1=1 --" });
    expect((injection as { total: number }).total).toBe(0);
    const weird = await h.call('product.create', {
      name: "চাল'; DROP TABLE products; --",
      code: 'INJ1',
      sku: 'INJ1',
      barcode: '8900000000001',
    });
    expect((weird as { id: string }).id).toBeTruthy();
    expect(((await h.call('product.list', { search: 'DROP TABLE' })) as { total: number }).total).toBe(1);
    await expect(
      h.call('product.create', {
        name: 'পথ পরীক্ষা',
        code: 'P3',
        sku: 'P3',
        barcode: '8900000000003',
        imagePath: '../secret.png',
      }),
    ).rejects.toThrow(/অবৈধ ফাইল পাথ/);
  });

  it('never writes sensitive values into local logs', async () => {
    h = makeHarness();
    h.ctx.logger.info('TEST', 'password=SuperSecret123 token abc', {
      password: 'SuperSecret123',
      note: 'safe',
    });
    const logFile = join(h.ctx.config.logDir, 'merqo.log');
    expect(existsSync(logFile)).toBe(true);
    const text = readFileSync(logFile, 'utf8');
    expect(text).not.toContain('SuperSecret123');
    expect(text).toContain('[redacted]');
  });
});
