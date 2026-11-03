/**
 * MERQO OWNER-ONLY LICENCE GENERATOR.
 *
 * This executable is NEVER shipped to customers and is NEVER published as a
 * public release asset. The Ed25519 private key lives only on the owner's
 * machine and is read at runtime; it is not embedded in this program, the main
 * application, the installer, or the repository.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createPublicKey } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  createLicensePayload, signLicense, verifyLicense, publicKeyFingerprint,
  generateTestKeyPair, type LicenseFile,
} from '../../../src/core/licensing';

const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const flags = new Map<string, string>();
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a?.startsWith('--')) {
    const key = a.slice(2);
    const value = args[i + 1] && !args[i + 1]!.startsWith('--') ? args[++i]! : 'true';
    flags.set(key, value);
  }
}
const flag = (key: string, fallback = ''): string => flags.get(key) ?? fallback;
async function ask(label: string, fallback = ''): Promise<string> {
  if (flags.has('non-interactive')) return fallback;
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`${label}${fallback ? ` [${fallback}]` : ''}: `);
  rl.close();
  return answer.trim() || fallback;
}
function ensure(path: string): void { mkdirSync(dirname(resolve(path)), { recursive: true }); }
function readDevice(value: string): string {
  if (!value) throw new Error('ডিভাইস তথ্য প্রয়োজন (--device <device-info.json | fingerprint>)।');
  if (existsSync(value)) {
    const raw = readFileSync(value, 'utf8').trim();
    try {
      const parsed = JSON.parse(raw) as { deviceFingerprint?: string };
      if (parsed.deviceFingerprint) return parsed.deviceFingerprint;
      // A full device-info object may contain the fingerprint components directly.
      const { machine, disk, cpu, user } = parsed as Record<string, string>;
      if (machine && disk && cpu && user) return JSON.stringify({ machine, disk, cpu, user });
    } catch { return raw; }
  }
  return value;
}
function recordsPath(): string { return flag('records', 'private/generator-records.json'); }
function readRecords(): Record<string, unknown>[] {
  const p = recordsPath();
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>[]; } catch { return []; }
}
function saveRecord(record: Record<string, unknown>): void {
  const p = recordsPath(); ensure(p);
  writeFileSync(p, JSON.stringify([record, ...readRecords()], null, 2));
  chmodSync(p, 0o600);
}
function publicFromPrivate(privateKeyPem: string): string {
  return createPublicKey(privateKeyPem).export({ format: 'pem', type: 'spki' }).toString();
}
function showHelp(): void {
  console.log(`MERQO — মালিকের জন্য লাইসেন্স জেনারেটর (গোপন; কাস্টমারকে দেওয়া যাবে না)

  keygen  --out private/owner-private.pem [--public-out private/owner-public.pem]
  issue   --key private/owner-private.pem --business "ব্যবসার নাম" --device device-info.json
          [--info "ঠিকানা/ফোন"] [--out private/licenses/MQ-XXXX.merqolic]
          [--supersedes MQ-OLDER] [--records private/generator-records.json]
  verify  --file licence.merqolic [--public-key private/owner-public.pem]
  list    [--records private/generator-records.json]

নোট: প্রাইভেট কী, জেনারেটর EXE ও রেকর্ড কখনো পাবলিক রিপোজিটরি বা রিলিজে প্রকাশ করবেন না।`);
}
async function main(): Promise<void> {
try {
  if (command === 'help' || command === '--help') showHelp();
  else if (command === 'keygen') {
    const out = flag('out', 'private/owner-ed25519-private.pem');
    const pubOut = flag('public-out', 'private/owner-ed25519-public.pem');
    const { publicKey, privateKey } = generateTestKeyPair();
    ensure(out); ensure(pubOut);
    writeFileSync(out, privateKey); chmodSync(out, 0o600);
    writeFileSync(pubOut, publicKey); chmodSync(pubOut, 0o600);
    console.log('প্রাইভেট কী:', resolve(out));
    console.log('পাবলিক কী :', resolve(pubOut));
    console.log('পাবলিক কী ফিঙ্গারপ্রিন্ট:', publicKeyFingerprint(publicKey));
    console.log('সতর্কতা: এই প্রাইভেট কী ও জেনারেটর EXE শুধুমাত্র মালিকের কাছে রাখুন।');
  } else if (command === 'issue') {
    const keyPath = flag('key', 'private/owner-ed25519-private.pem');
    const businessName = flag('business') || await ask('ব্যবসার পূর্ণ নাম');
    const businessInfo = flag('info') || await ask('ব্যবসার অতিরিক্ত তথ্য (ঠিকানা/ফোন)', '');
    const device = readDevice(flag('device') || await ask('ডিভাইস তথ্য ফাইল / ফিঙ্গারপ্রিন্ট'));
    const privateKey = readFileSync(keyPath, 'utf8');
    const publicKey = publicFromPrivate(privateKey);
    const payload = createLicensePayload({ businessName, businessInfo, deviceFingerprint: device,
      supersedes: flag('supersedes') || undefined });
    const file = signLicense(payload, privateKey);
    const check = verifyLicense(file, publicKey, { skipDevice: true });
    if (!check.valid) throw new Error('স্বাক্ষর যাচাই ব্যর্থ: ' + check.reasons.join(' '));
    const out = flag('out', `private/licenses/${payload.licenseId}.merqolic`);
    ensure(out); writeFileSync(out, JSON.stringify(file, null, 2)); chmodSync(out, 0o600);
    saveRecord({ licenseId: payload.licenseId, businessName: payload.businessName,
      businessInfo: payload.businessInfo, issuedAt: payload.issuedAt, issuer: payload.issuer,
      deviceFingerprint: payload.deviceFingerprint, publicKeyFingerprint: publicKeyFingerprint(publicKey),
      filePath: resolve(out), supersedes: payload.policy.supersedes ?? null, revoked: false });
    console.log('লাইসেন্স তৈরি ও স্বাক্ষর যাচাই সফল।');
    console.log('লাইসেন্স আইডি :', payload.licenseId);
    console.log('ব্যবসা        :', payload.businessName);
    console.log('ফাইল          :', resolve(out));
  } else if (command === 'verify') {
    const filePath = flag('file') || await ask('লাইসেন্স ফাইল');
    const raw = readFileSync(filePath, 'utf8');
    const file = JSON.parse(raw) as LicenseFile;
    let publicKey = flag('public-key');
    if (publicKey) publicKey = readFileSync(publicKey, 'utf8');
    else {
      const match = readFileSync('src/core/public-key.ts', 'utf8').match(/= "([\s\S]*?)";/);
      publicKey = match?.[1]?.replace(/\\n/g, '\n') ?? '';
    }
    const result = verifyLicense(file, publicKey, { skipDevice: true });
    console.log(result.valid ? 'স্বাক্ষর বৈধ।' : 'স্বাক্ষর অবৈধ: ' + result.reasons.join(' '));
    if (result.payload) console.log(JSON.stringify(result.payload, null, 2));
    if (!result.valid) process.exitCode = 1;
  } else if (command === 'list') {
    const rows = readRecords();
    console.log(`মোট ${rows.length} টি লাইসেন্স রেকর্ড:`);
    for (const r of rows) console.log(`${String(r.licenseId)} | ${String(r.businessName)} | ${String(r.issuedAt)} | ${r.revoked ? 'বাতিল' : 'সক্রিয়'}`);
  } else { console.error('অজানা কমান্ড:', command); showHelp(); process.exitCode = 1; }
} catch (e) {
  console.error('ত্রুটি:', (e as Error).message);
  process.exitCode = 1;
}
}
void main();
