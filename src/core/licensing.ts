/** Ed25519 offline licence verification. No private key is ever imported here. */
import { createHash, randomBytes, sign, verify, generateKeyPairSync } from 'node:crypto';
import { AppError, ERR } from './errors';
import { normalizeText } from './money';

export const LICENSE_FORMAT = 'MERQO-LICENSE-1';
export const PRODUCT_ID = 'MERQO-POS';

export interface LicensePayload {
  alg: 'Ed25519';
  v: 1;
  productId: string;
  licenseId: string;
  businessName: string;
  businessInfo: string;
  licenseType: 'LIFETIME';
  issuedAt: string;
  issuer: string;
  deviceFingerprint: string;
  policy: { lifetime: true; offline: true; transfer: 'owner-authorized'; supersedes?: string };
}
export interface LicenseFile {
  format: string;
  payload: LicensePayload;
  signature: string;
}
export interface DeviceComponents {
  machine: string;
  disk: string;
  cpu: string;
  user: string;
}

const PAYLOAD_KEYS: (keyof LicensePayload)[] = [
  'alg',
  'v',
  'productId',
  'licenseId',
  'businessName',
  'businessInfo',
  'licenseType',
  'issuedAt',
  'issuer',
  'deviceFingerprint',
  'policy',
];
export function canonicalPayload(payload: LicensePayload): string {
  const ordered: Record<string, unknown> = {};
  for (const k of PAYLOAD_KEYS) ordered[k] = payload[k];
  if (ordered.policy && typeof ordered.policy === 'object') {
    const p = ordered.policy as Record<string, unknown>;
    ordered.policy = {
      lifetime: p.lifetime,
      offline: p.offline,
      transfer: p.transfer,
      ...(p.supersedes ? { supersedes: p.supersedes } : {}),
    };
  }
  return JSON.stringify(ordered);
}
export function generateLicenseId(): string {
  return 'MQ-' + randomBytes(12).toString('hex').toUpperCase();
}
export function createLicensePayload(input: {
  businessName: string;
  businessInfo?: string;
  deviceFingerprint: string;
  licenseId?: string;
  supersedes?: string;
  issuedAt?: string;
}): LicensePayload {
  const businessName = normalizeText(input.businessName, 200);
  if (!businessName) throw new AppError(ERR.VALIDATION, 'ব্যবসার নাম দিন।');
  if (!input.deviceFingerprint) throw new AppError(ERR.VALIDATION, 'ডিভাইস তথ্য প্রয়োজন।');
  return {
    alg: 'Ed25519',
    v: 1,
    productId: PRODUCT_ID,
    licenseId: input.licenseId ?? generateLicenseId(),
    businessName,
    businessInfo: normalizeText(input.businessInfo ?? '', 500),
    licenseType: 'LIFETIME',
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    issuer: 'MERQO',
    deviceFingerprint: normalizeText(input.deviceFingerprint, 4000),
    policy: {
      lifetime: true,
      offline: true,
      transfer: 'owner-authorized',
      ...(input.supersedes ? { supersedes: input.supersedes } : {}),
    },
  };
}
export function signLicense(payload: LicensePayload, privateKeyPem: string): LicenseFile {
  const data = Buffer.from(canonicalPayload(payload), 'utf8');
  const signature = sign(null, data, privateKeyPem).toString('base64');
  return { format: LICENSE_FORMAT, payload, signature };
}
export function publicKeyFingerprint(publicKeyPem: string): string {
  return createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 16);
}
export function deviceMatch(
  licensedRaw: string,
  currentRaw: string,
  threshold = 2,
): { matched: boolean; score: number } {
  let licensed: string[];
  try {
    const parsed = JSON.parse(licensedRaw) as DeviceComponents | string[];
    licensed = Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch {
    licensed = [licensedRaw];
  }
  let current: string[];
  try {
    const parsed = JSON.parse(currentRaw) as DeviceComponents | string[];
    current = Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch {
    current = [currentRaw];
  }
  // Development/simple fingerprints are a single opaque string: exact match is required.
  if (licensed.length === 1 && current.length === 1) {
    const equal = String(licensed[0]) === String(current[0]);
    return { matched: equal, score: equal ? 4 : 0 };
  }
  const set = new Set(licensed.map(String));
  const score = current.filter((c) => set.has(String(c))).length;
  return { matched: score >= threshold, score };
}
export interface VerificationResult {
  valid: boolean;
  payload?: LicensePayload;
  reasons: string[];
}
export function verifyLicense(
  raw: string | LicenseFile,
  publicKeyPem: string,
  options: {
    expectedProductId?: string;
    expectedBusinessName?: string;
    currentDevice?: string;
    skipDevice?: boolean;
  } = {},
): VerificationResult {
  const reasons: string[] = [];
  let file: LicenseFile;
  try {
    file = typeof raw === 'string' ? (JSON.parse(raw) as LicenseFile) : raw;
  } catch {
    return { valid: false, reasons: ['লাইসেন্স ফাইল পড়া যায়নি।'] };
  }
  if (!file || file.format !== LICENSE_FORMAT) reasons.push('লাইসেন্স ফরম্যাট অবৈধ।');
  if (!file.payload || typeof file.payload !== 'object')
    return { valid: false, reasons: [...reasons, 'লাইসেন্স তথ্য নেই।'] };
  const p = file.payload;
  if (p.alg !== 'Ed25519' || p.v !== 1) reasons.push('অসমর্থিত লাইসেন্স সংস্করণ।');
  if (p.productId !== (options.expectedProductId ?? PRODUCT_ID)) reasons.push('পণ্যের পরিচয় মিলছে না।');
  if (p.licenseType !== 'LIFETIME' || p.policy?.lifetime !== true) reasons.push('লাইসেন্সের ধরন অবৈধ।');
  if (!/^MQ-[A-F0-9]{16,}$/.test(p.licenseId ?? '')) reasons.push('লাইসেন্স আইডি অবৈধ।');
  if (!normalizeText(p.businessName ?? '', 200)) reasons.push('ব্যবসার নাম নেই।');
  if (
    options.expectedBusinessName &&
    normalizeText(p.businessName, 200) !== normalizeText(options.expectedBusinessName, 200)
  ) {
    reasons.push('ব্যবসার নাম মিলছে না।');
  }
  try {
    const ok = verify(
      null,
      Buffer.from(canonicalPayload(p), 'utf8'),
      publicKeyPem,
      Buffer.from(file.signature, 'base64'),
    );
    if (!ok) reasons.push('স্বাক্ষর যাচাই ব্যর্থ (ফাইল পরিবর্তন করা হয়েছে?)।');
  } catch {
    reasons.push('স্বাক্ষর যাচাই ব্যর্থ।');
  }
  if (!options.skipDevice && options.currentDevice) {
    const m = deviceMatch(p.deviceFingerprint, options.currentDevice);
    if (!m.matched) reasons.push(`এই ডিভাইসের জন্য লাইসেন্সটি নয় (মিল ${m.score}/4)।`);
  }
  return { valid: reasons.length === 0, payload: reasons.length === 0 ? p : undefined, reasons };
}
/** Test-only helper; the owner's generator creates real keys outside the app. */
export function generateTestKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
  };
}
