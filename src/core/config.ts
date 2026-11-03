import { resolve, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { AppConfig } from './types';
import { MERQO_PUBLIC_KEY_PEM } from './public-key';

export const PRODUCT = {
  id: 'MERQO-POS',
  name: 'MERQO',
  company: 'MERQO',
  founder: 'Shohan Khan',
  email: 'merqoonline@gmail.com',
  version: '0.1.0',
} as const;

/** Stable, non-secret development fingerprint; production uses Windows identifiers. */
export function developmentFingerprint(): string {
  return 'dev-sandbox-majority-match-fingerprint';
}
export function deviceFingerprint(): string {
  // Electron main overrides this through setDeviceFingerprintProvider().
  return provider?.() ?? developmentFingerprint();
}
let provider: (() => string) | undefined;
export function setDeviceFingerprintProvider(fn: () => string): void {
  provider = fn;
}

export function createConfig(dataDir?: string): AppConfig {
  const dir = resolve(dataDir ?? process.env.MERQO_DATA_DIR ?? join(process.cwd(), '.merqo-data'));
  const dbPath = join(dir, 'data', 'merqo.sqlite');
  const backupDir = join(dir, 'backups');
  const logDir = join(dir, 'logs');
  for (const p of [dir, join(dir, 'data'), backupDir, logDir, join(dir, 'license')])
    mkdirSync(p, { recursive: true });
  return {
    productId: PRODUCT.id,
    productName: PRODUCT.name,
    company: PRODUCT.company,
    founder: PRODUCT.founder,
    contactEmail: PRODUCT.email,
    version: PRODUCT.version,
    dataDir: dir,
    dbPath,
    backupDir,
    logDir,
    isDevelopment: process.env.NODE_ENV !== 'production',
    publicKeyPem: MERQO_PUBLIC_KEY_PEM,
    deviceFingerprint: deviceFingerprint(),
  };
}
