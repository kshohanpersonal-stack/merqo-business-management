/** Verify installed third-party package licences are compatible with commercial redistribution. */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const allow = ['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'CC0-1.0',
  'Unlicense', 'Python-2.0', 'BlueOak-1.0.0', 'OFL-1.1', 'SIL-OFL-1.1', 'CC-BY-4.0', 'MPL-2.0',
  'LGPL-3.0-or-later', 'WTFPL', 'MIT/X11'];
/**
 * Documented overrides for packages whose published package.json omits the
 * licence. Evidence is retained in docs/THIRD_PARTY_LICENSES.md.
 */
const overrides = new Map([
  ['png-js@1.1.0', 'MIT'],       // node_modules/png-js/LICENSE contains the full MIT text.
  ['buffers@0.1.1', 'MIT/X11'], // upstream node-buffers package.json declares MIT/X11; Snyk reports MIT.
  ['truncate-utf8-bytes@1.0.2', 'WTFPL'], // declared in package.json; permissive/public-domain equivalent.
]);
function licenceOf(pkg) {
  const raw = pkg.license ?? pkg.licenses;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return String(raw.type ?? 'UNKNOWN');
  if (Array.isArray(raw)) return raw.map((r) => (typeof r === 'string' ? r : r.type)).join(' OR ');
  return 'UNKNOWN';
}
const seen = new Map();
function scan(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.name.startsWith('@')) { scan(path); continue; }
    const pkgPath = join(path, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        const key = `${String(pkg.name ?? entry.name)}@${String(pkg.version ?? '')}`;
        if (!seen.has(key)) seen.set(key, overrides.get(key) ?? licenceOf(pkg));
      } catch { /* unreadable package.json */ }
    }
    const nested = join(path, 'node_modules');
    if (existsSync(nested)) scan(nested);
  }
}
scan('node_modules');
const unexpected = [...seen.entries()].filter(([, lic]) => !allow.some((a) => String(lic).includes(a)));
console.log(`Checked ${seen.size} installed packages against the commercial-distribution allow-list.`);
if (unexpected.length) {
  console.log(`Packages requiring manual licence review: ${unexpected.length}`);
  for (const [dep, lic] of unexpected) console.log(`  ${dep}: ${lic}`);
  console.error('Resolve every unexpected licence before a public commercial release.');
  process.exitCode = 1;
} else {
  console.log('PASS — all installed packages report an allow-listed licence.');
}
