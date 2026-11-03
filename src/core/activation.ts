/** Offline activation state stored in the local database. */
import type { DB } from './db';
import type { AppConfig } from './types';
import { AppError, ERR } from './errors';
import { verifyLicense, publicKeyFingerprint, type LicenseFile } from './licensing';
import { nowIso } from './util';
import { recordAudit } from './audit';

export interface ActivationStatus {
  activated: boolean;
  status: string;
  licenseId: string;
  businessName: string;
  issuer: string;
  issuedAt: string;
  activatedAt: string;
  deviceFingerprint: string;
  recoveryCount: number;
  publicKeyFingerprint: string;
}
export function getActivation(db: DB, config: AppConfig): ActivationStatus {
  const r = db.prepare('SELECT * FROM license_info WHERE singleton_id=1').get() as Record<string, unknown>;
  return {
    activated: r.status === 'active',
    status: String(r.status),
    licenseId: String(r.license_id),
    businessName: String(r.business_name),
    issuer: String(r.issuer),
    issuedAt: String(r.issued_at),
    activatedAt: String(r.activated_at),
    deviceFingerprint: String(r.device_fingerprint),
    recoveryCount: Number(r.recovery_count),
    publicKeyFingerprint: publicKeyFingerprint(config.publicKeyPem),
  };
}
export function activateFromLicense(
  db: DB,
  config: AppConfig,
  raw: string | LicenseFile,
  expectedBusinessName?: string,
): ActivationStatus {
  const result = verifyLicense(raw, config.publicKeyPem, {
    expectedProductId: config.productId,
    expectedBusinessName,
    currentDevice: config.deviceFingerprint,
  });
  if (!result.valid || !result.payload) {
    throw new AppError(ERR.LICENSE_INVALID, `লাইসেন্স গ্রহণযোগ্য নয়: ${result.reasons.join(' ')}`);
  }
  const p = result.payload;
  const previous = db
    .prepare('SELECT license_id, recovery_count FROM license_info WHERE singleton_id=1')
    .get() as { license_id: string; recovery_count: number };
  const isRecovery = previous.license_id && previous.license_id !== p.licenseId;
  db.prepare(
    `UPDATE license_info SET status='active', license_id=?, business_name=?, issuer=?, issued_at=?,
    activated_at=?, device_fingerprint=?, payload_json=?, signature=?, public_key_fingerprint=?,
    recovery_count=? WHERE singleton_id=1`,
  ).run(
    p.licenseId,
    p.businessName,
    p.issuer,
    p.issuedAt,
    nowIso(),
    p.deviceFingerprint,
    JSON.stringify(p),
    typeof raw === 'string' ? (JSON.parse(raw) as LicenseFile).signature : raw.signature,
    publicKeyFingerprint(config.publicKeyPem),
    isRecovery ? previous.recovery_count + 1 : previous.recovery_count,
  );
  recordAudit(db, {
    action: isRecovery ? 'license.recovery' : 'license.activate',
    entity: 'license',
    entityId: p.licenseId,
    after: { licenseId: p.licenseId, businessName: p.businessName },
  });
  return getActivation(db, config);
}
export function deviceInfo(config: AppConfig): Record<string, unknown> {
  return {
    format: 'MERQO-DEVICE-INFO-1',
    productId: config.productId,
    generatedAt: nowIso(),
    deviceFingerprint: config.deviceFingerprint,
    publicKeyFingerprint: publicKeyFingerprint(config.publicKeyPem),
    note: 'এই ফাইলে কোনো ব্যবসায়িক তথ্য নেই। লাইসেন্স ট্রান্সফারের জন্য MERQO-কে পাঠান।',
  };
}
