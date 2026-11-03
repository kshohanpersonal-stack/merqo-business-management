/**
 * Build the OWNER-ONLY licence generator into a standalone executable.
 * Node SEA (single executable applications) is used so no Node runtime is needed.
 * The private key is never an input to this script.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('installers/output/private');
mkdirSync(out, { recursive: true });
const seaConfig = {
  main: 'dist-electron/license-generator.cjs',
  output: 'dist-electron/license-generator.blob',
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets: {},
};
writeFileSync('dist-electron/sea-config.json', JSON.stringify(seaConfig, null, 2));

// Bundle generator source (private key is read at runtime from owner's machine only).
const { build } = await import('esbuild');
await build({
  entryPoints: ['apps/license-generator/src/index.ts'],
  outfile: seaConfig.main,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['node:*'],
  logLevel: 'info',
});

if (process.platform !== 'win32') {
  // Verify the SEA build on the Linux sandbox; the actual Windows EXE is created
  // only on windows-latest by build-windows.yml (no Wine in this environment).
  execFileSync(process.execPath, ['--experimental-sea-config', 'dist-electron/sea-config.json'], { stdio: 'inherit' });
  console.log('[generator] SEA blob verified:', readFileSync(seaConfig.output).length, 'bytes');
  const smoke = execFileSync(process.execPath, [seaConfig.main, 'help'], { encoding: 'utf8' });
  if (!smoke.includes('keygen')) throw new Error('Generator CLI smoke test failed');
  console.log(smoke.trim());
  console.log('[generator] Windows owner-only EXE is produced by build-windows.yml on windows-latest.');
} else {
  execFileSync(process.execPath, ['--experimental-sea-config', 'dist-electron/sea-config.json'], { stdio: 'inherit' });
  copyFileSync(process.execPath, `${out}/MERQO-License-Generator.exe`);
  execFileSync(process.execPath, [resolve('node_modules/postject/dist/cli.js'),
    `${out}/MERQO-License-Generator.exe`, 'NODE_SEA_BLOB', seaConfig.output,
    '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'], { stdio: 'inherit' });
  console.log('[generator] OWNER-ONLY EXE:', `${out}/MERQO-License-Generator.exe`);
}
if (!existsSync('apps/license-generator/README.md')) throw new Error('generator docs missing');
