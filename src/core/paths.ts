import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
export function findAsset(relative: string): string {
  const candidates = [join(process.cwd(), 'assets', relative), join(process.cwd(), relative)];
  if (typeof __dirname !== 'undefined') {
    candidates.push(
      join(__dirname, '..', 'assets', relative),
      join(__dirname, '..', '..', 'assets', relative),
    );
  }
  for (const c of candidates) if (existsSync(c)) return resolve(c);
  return resolve(candidates[0]!);
}
/** Fonts are embedded as data URIs so HTML works in Electron, preview and printToPDF alike. */
export function fontDataUri(relative: string): string {
  try {
    const b64 = readFileSync(findAsset(relative)).toString('base64');
    return `data:font/woff2;base64,${b64}`;
  } catch {
    return '';
  }
}
