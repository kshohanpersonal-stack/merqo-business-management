import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AppContext } from '../../src/core/context';
import { openDatabase } from '../../src/core/db';
import { createConfig } from '../../src/core/config';
import { createLogger } from '../../src/core/logger';
import { dispatch } from '../../src/core/dispatch';
import { generateTestKeyPair, createLicensePayload, signLicense } from '../../src/core/licensing';

function freshUnactivated(): {
  ctx: AppContext;
  dir: string;
  keys: { publicKey: string; privateKey: string };
} {
  const dir = mkdtempSync(join(tmpdir(), 'merqo-activation-'));
  const keys = generateTestKeyPair();
  const config = createConfig(dir);
  config.publicKeyPem = keys.publicKey;
  config.deviceFingerprint = JSON.stringify({ machine: 'a', disk: 'b', cpu: 'c', user: 'd' });
  const db = openDatabase(config.dbPath);
  const ctx: AppContext = {
    db,
    config,
    logger: createLogger(config),
    now: () => new Date().toISOString(),
    close: () => db.close(),
  };
  return { ctx, dir, keys };
}
describe('offline first-launch, activation and setup wizard', () => {
  it('keeps the app locked until a valid signed licence is imported', async () => {
    const { ctx, dir, keys } = freshUnactivated();
    const status = await dispatch(ctx, 'bootstrap.status', {}, '');
    expect(status.ok && (status.data as any).needsActivation).toBe(true);
    expect(status.ok && (status.data as any).needsSetup).toBe(true);
    const invalid = await dispatch(
      ctx,
      'license.activate',
      { text: '{"format":"MERQO-LICENSE-1","payload":{},"signature":"AA=="}' },
      '',
    );
    expect(invalid.ok).toBe(false);
    expect(invalid.ok === false && invalid.error.code).toBe('LICENSE_INVALID');
    expect((ctx.db.prepare('SELECT status FROM license_info').get() as { status: string }).status).toBe(
      'unactivated',
    );

    const payload = createLicensePayload({
      businessName: 'মেসার্স করিম স্টোর্স',
      deviceFingerprint: ctx.config.deviceFingerprint,
    });
    const file = JSON.stringify(signLicense(payload, keys.privateKey));
    const activated = await dispatch(ctx, 'license.activate', { text: file }, '');
    expect(activated.ok).toBe(true);
    expect(activated.ok && (activated.data as any).activated).toBe(true);
    const setup = await dispatch(
      ctx,
      'bootstrap.setup',
      {
        business: { business_name: 'করিম স্টোর্স', address: 'টাঙ্গাইল', phone: '01700000000' },
        username: 'owner',
        fullName: 'করিম',
        password: 'SecurePass123!',
        settings: { currency: { code: 'BDT', symbol: '৳', position: 'before', decimals: 2 } },
      },
      '',
    );
    expect(setup.ok).toBe(true);
    expect(setup.ok && (setup.data as any).token).toHaveLength(64);
    const login = await dispatch(ctx, 'auth.login', { username: 'owner', password: 'SecurePass123!' }, '');
    expect(login.ok).toBe(true);
    const status2 = await dispatch(ctx, 'bootstrap.status', {}, '');
    expect(status2.ok && (status2.data as any).needsActivation).toBe(false);
    expect(status2.ok && (status2.data as any).needsSetup).toBe(false);
    expect(status2.ok && (status2.data as any).integrity).toBe(true);
    ctx.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects a licence bound to a different device and produces transfer device info', async () => {
    const { ctx, dir, keys } = freshUnactivated();
    const payload = createLicensePayload({
      businessName: 'টেস্ট',
      deviceFingerprint: JSON.stringify({ machine: 'x', disk: 'y', cpu: 'z', user: 'w' }),
    });
    const bad = await dispatch(
      ctx,
      'license.activate',
      { text: JSON.stringify(signLicense(payload, keys.privateKey)) },
      '',
    );
    expect(bad.ok).toBe(false);
    expect(bad.ok === false && bad.error.message).toContain('ডিভাইস');
    const info = await dispatch(ctx, 'license.deviceInfo', {}, '');
    expect(info.ok && (info.data as any).deviceFingerprint).toBe(ctx.config.deviceFingerprint);
    ctx.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
