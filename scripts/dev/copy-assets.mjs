/** Copy OFL-licensed Bengali font files from npm packages into tracked assets. */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dest = 'assets/fonts';
mkdirSync(dest, { recursive: true });
for (const f of readdirSync(dest)) if (/\.(woff2|ttf)$/i.test(f)) rmSync(join(dest, f));

const expo = 'node_modules/@expo-google-fonts/noto-sans-bengali';
const fontsource = 'node_modules/@fontsource/noto-sans-bengali/files';
for (const weight of ['400Regular', '700Bold']) {
  const src = join(expo, weight, `NotoSansBengali_${weight}.ttf`);
  if (existsSync(src)) copyFileSync(src, join(dest, `NotoSansBengali-${weight}.ttf`));
}
if (existsSync(fontsource)) {
  for (const f of readdirSync(fontsource)) {
    if (/^noto-sans-bengali-(bengali|latin)-(400|600|700)-normal\.woff2$/i.test(f)) {
      copyFileSync(join(fontsource, f), join(dest, f));
    }
  }
}
const ofl = join(expo, 'LICENSE_FONT');
if (existsSync(ofl)) copyFileSync(ofl, join(dest, 'OFL.txt'));
console.log('[assets] fonts:', readdirSync(dest).join(', '));
