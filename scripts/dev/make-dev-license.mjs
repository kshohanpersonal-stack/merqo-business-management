/** Generate a real signed DEVELOPMENT licence from the owner-only local private key.
 *  Output is gitignored. Never use this key or licence for customer distribution. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { sign, createPublicKey, randomBytes } from 'node:crypto';
const privateKeyPath = 'private/merqo-dev-ed25519-private.pem';
const privateKey = readFileSync(privateKeyPath, 'utf8');
const payload = {
  alg: 'Ed25519', v: 1, productId: 'MERQO-POS',
  licenseId: 'MQ-' + randomBytes(12).toString('hex').toUpperCase(),
  businessName: 'MERQO ডেভেলপমেন্ট ব্যবসা',
  businessInfo: 'স্থানীয় প্রিভিউ ও টেস্টিংয়ের জন্য only — বিতরণের জন্য নয়',
  licenseType: 'LIFETIME', issuedAt: new Date().toISOString(), issuer: 'MERQO',
  deviceFingerprint: 'dev-sandbox-majority-match-fingerprint',
  policy: { lifetime: true, offline: true, transfer: 'owner-authorized' },
};
const canonical = JSON.stringify(payload);
const signature = sign(null, Buffer.from(canonical, 'utf8'), privateKey).toString('base64');
const file = { format: 'MERQO-LICENSE-1', payload, signature };
mkdirSync('private', { recursive: true });
writeFileSync('private/dev-license.merqolic', JSON.stringify(file, null, 2));
const pub = createPublicKey(privateKey).export({ format: 'pem', type: 'spki' }).toString();
console.log('Development licence written to private/dev-license.merqolic');
console.log('Matching public key (must equal src/core/public-key.ts):');
const source = readFileSync('src/core/public-key.ts', 'utf8');
const match = source.match(/=\s*(['"])([\s\S]*?)\1\s*;/);
const embedded = match ? match[2].replace(/\\n/g, '\n').trim() : '';
console.log(pub.trim() === embedded
  ? 'OK — public key matches'
  : 'WARNING — public key mismatch, regenerate src/core/public-key.ts');
