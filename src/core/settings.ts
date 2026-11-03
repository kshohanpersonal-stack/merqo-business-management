import type { DB } from './db';
import { DEFAULT_SETTINGS } from './db';
import type { BusinessProfile } from './types';
import { normalizeText } from './money';
import { AppError, ERR } from './errors';

export function getAllSettings(db: DB): Record<string, unknown> {
  const rows = db.prepare('SELECT key, value_json FROM settings').all() as {
    key: string;
    value_json: string;
  }[];
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value_json);
    } catch {
      /* keep default */
    }
  }
  return out;
}
export function getSetting<T = unknown>(db: DB, key: string): T {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as
    | { value_json: string }
    | undefined;
  if (!row) return DEFAULT_SETTINGS[key] as T;
  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return DEFAULT_SETTINGS[key] as T;
  }
}
export function setSetting(db: DB, key: string, value: unknown): void {
  if (!/^[a-zA-Z0-9_.]{1,64}$/.test(key)) throw new AppError(ERR.VALIDATION, 'অবৈধ সেটিংস কী।');
  db.prepare(
    `INSERT INTO settings(key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), new Date().toISOString());
}
export function getBusinessProfile(db: DB): BusinessProfile {
  return db.prepare('SELECT * FROM business_profile WHERE singleton_id = 1').get() as BusinessProfile;
}
export function updateBusinessProfile(db: DB, input: Partial<BusinessProfile>): BusinessProfile {
  const current = getBusinessProfile(db);
  const next: BusinessProfile = {
    business_name: normalizeText(input.business_name ?? current.business_name, 200),
    business_name_en: normalizeText(input.business_name_en ?? current.business_name_en, 200),
    address: normalizeText(input.address ?? current.address, 500),
    phone: normalizeText(input.phone ?? current.phone, 40),
    email: normalizeText(input.email ?? current.email, 120),
    logo_path: normalizeText(input.logo_path ?? current.logo_path, 500),
    invoice_footer: normalizeText(input.invoice_footer ?? current.invoice_footer, 500),
    tax_registration: normalizeText(input.tax_registration ?? current.tax_registration, 100),
  };
  db.prepare(
    `UPDATE business_profile SET business_name=?, business_name_en=?, address=?, phone=?, email=?,
    logo_path=?, invoice_footer=?, tax_registration=?, updated_at=? WHERE singleton_id=1`,
  ).run(
    next.business_name,
    next.business_name_en,
    next.address,
    next.phone,
    next.email,
    next.logo_path,
    next.invoice_footer,
    next.tax_registration,
    new Date().toISOString(),
  );
  return next;
}
export function moneyFormat(db: DB): {
  symbol: string;
  position: 'before' | 'after';
  decimals: number;
  banglaDigits: boolean;
} {
  const currency = getSetting<{ symbol?: string; position?: 'before' | 'after'; decimals?: number }>(
    db,
    'currency',
  );
  const number = getSetting<{ banglaDigits?: boolean }>(db, 'numberFormat');
  return {
    symbol: currency.symbol ?? '৳',
    position: currency.position ?? 'before',
    decimals: currency.decimals ?? 2,
    banglaDigits: number.banglaDigits ?? false,
  };
}
