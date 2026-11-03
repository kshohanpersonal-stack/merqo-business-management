import { execFileSync } from 'node:child_process';
const python = process.platform === 'win32' ? 'python' : 'python3';
execFileSync(python, ['scripts/dev/secret_scan.py'], { stdio: 'inherit' });
const { readdirSync, statSync } = await import('node:fs');
const out = 'installers/output';
try {
  const files = readdirSync(out).filter((f) => /\.(exe|msi|zip)$/i.test(f));
  for (const f of files) console.log(`[release] candidate public asset: ${f} (${statSync(`${out}/${f}`).size} bytes)`);
  const privateDir = `${out}/private`;
  const priv = readdirSync(privateDir);
  console.log(`[release] owner-only artifacts withheld from public release: ${priv.join(', ')}`);
} catch { console.log('[release] no build output yet'); }
