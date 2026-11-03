/**
 * Make the ignored development licence available for local/CI browser QA.
 * In a clean CI checkout the development private key is absent, so an ephemeral
 * Ed25519 keypair is generated, the matching public key is written into the
 * workspace copy of src/core/public-key.ts, and a signed development licence is
 * produced. Nothing is committed; no production key material is used.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const privateKeyPath = 'private/merqo-dev-ed25519-private.pem';
const publicKeyPath = 'src/core/public-key.ts';

if (!existsSync(privateKeyPath)) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const pem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  mkdirSync('private', { recursive: true });
  writeFileSync(privateKeyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
  const escaped = pem.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/'/g, "\\'");
  const header = [
    '// MERQO development Ed25519 PUBLIC verification key.',
    '// The matching private key is owner-only and NEVER committed. Replace this constant',
    "// with the owner's production public key before commercial distribution.",
  ].join('\n');
  writeFileSync(publicKeyPath, `${header}\nexport const MERQO_PUBLIC_KEY_PEM: string =\n  '${escaped}';\n`);
  console.log('[qa] generated ephemeral development keypair for browser QA');
} else {
  // Local development already owns an ignored private key; make-dev-license.mjs
  // verifies that the tracked public key matches and warns if it does not.
  console.log('[qa] using existing ignored development private key');
}

execFileSync(process.execPath, ['scripts/dev/make-dev-license.mjs'], { stdio: 'inherit' });
