import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AppContext } from '../src/core/context';
import { openDatabase } from '../src/core/db';
import { createConfig } from '../src/core/config';
import { createLogger } from '../src/core/logger';
import { createUser } from '../src/core/auth';
import { createSession } from '../src/core/sessions';
import { activateFromLicense } from '../src/core/activation';
import { createLicensePayload, generateTestKeyPair, signLicense } from '../src/core/licensing';
import { dispatch } from '../src/core/dispatch';
import { createProduct } from '../src/core/catalog';
import { createParty } from '../src/core/parties';
import { createAccount } from '../src/core/finance';

export interface TestHarness {
  ctx: AppContext;
  token: string;
  dir: string;
  keys: { publicKey: string; privateKey: string };
  call: (action: string, payload?: unknown) => Promise<any>;
  cleanup: () => void;
}
export function makeHarness(): TestHarness {
  const dir = mkdtempSync(join(tmpdir(), 'merqo-test-'));
  const keys = generateTestKeyPair();
  const config = createConfig(dir);
  config.publicKeyPem = keys.publicKey;
  config.deviceFingerprint = JSON.stringify({
    machine: 'machine-hash',
    disk: 'disk-hash',
    cpu: 'cpu-hash',
    user: 'user-hash',
  });
  config.isDevelopment = true;
  const db = openDatabase(config.dbPath);
  const payload = createLicensePayload({
    businessName: 'টেস্ট ব্যবসা',
    deviceFingerprint: config.deviceFingerprint,
  });
  activateFromLicense(db, config, JSON.stringify(signLicense(payload, keys.privateKey)));
  const user = createUser(db, {
    username: 'admin',
    fullName: 'টেস্ট অ্যাডমিন',
    password: 'TestPass123!',
    roleId: 'role-admin',
  });
  const row = db.prepare('SELECT * FROM users WHERE id=?').get(user.id) as any;
  const session = createSession(db, row);
  const ctx: AppContext = {
    db,
    config,
    logger: createLogger(config),
    now: () => new Date().toISOString(),
    close: () => db.close(),
  };
  const call = async (action: string, p: unknown = {}) => {
    const res = await dispatch(ctx, action, p, session.token);
    if (!res.ok) throw new Error(`${action} failed: ${res.error.code} ${res.error.message}`);
    return res.data;
  };
  return {
    ctx,
    token: session.token,
    dir,
    keys,
    call,
    cleanup: () => {
      // restoreBackup() replaces ctx.db with a freshly opened connection; closing
      // only the originally captured handle leaves that file locked on Windows.
      for (const handle of new Set([ctx.db, db])) {
        try {
          handle.close();
        } catch {
          /* already closed */
        }
      }
      // Windows may release the SQLite file handle a tick later.
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          rmSync(dir, { recursive: true, force: true });
          return;
        } catch (error) {
          if (attempt === 9) throw error;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
        }
      }
    },
  };
}
/** Seed a product with stock and return its id (synchronous, direct core call). */
export function seedProduct(h: TestHarness, overrides: Record<string, unknown> = {}): string {
  return createProduct(h.ctx.db, {
    name: 'চাল',
    nameEn: 'Rice',
    purchasePrice: '10.00',
    sellingPrice: '15.00',
    unitId: 'u-kg',
    minStock: '2',
    openingStock: '10',
    openingCost: '10.00',
    ...overrides,
  } as any);
}
export function seedCustomer(h: TestHarness, name = 'রহিম'): string {
  return createParty(h.ctx.db, 'customer', { name, phone: '01700000000' });
}
export function seedSupplier(h: TestHarness, name = 'সাপ্লায়ার'): string {
  return createParty(h.ctx.db, 'supplier', { name, phone: '01800000000' });
}
export function seedMobileAccount(h: TestHarness): string {
  return createAccount(h.ctx.db, { name: 'bKash মার্চেন্ট', type: 'mobile', paymentMethodId: 'pm-bkash' });
}
