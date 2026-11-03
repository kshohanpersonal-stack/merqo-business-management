import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist-electron', { recursive: true });
const external = ['electron', 'better-sqlite3', 'pdfkit', 'exceljs', 'qrcode', 'node:*'];

await build({
  entryPoints: ['src/main/index.ts'],
  outfile: 'dist-electron/main.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: false,
  external,
  logLevel: 'info',
});

await build({
  entryPoints: ['src/preload/index.ts'],
  outfile: 'dist-electron/preload.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external,
  logLevel: 'info',
});
console.log('Built Electron main + preload bundles.');
