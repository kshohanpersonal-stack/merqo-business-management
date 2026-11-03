/** Barcode / QR generation and keyboard-wedge scanner support. */
import QRCode from 'qrcode';

// Full Code128 patterns table (values 0..106), used for SVG bar widths.
const PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];
export function code128Svg(value: string, height = 60): string {
  const text = String(value).normalize('NFC');
  if (!text || text.length > 80 || /[^\x20-\x7E]/.test(text)) {
    throw new Error('Code128-B supports printable ASCII up to 80 characters.');
  }
  const start = 104; // Code B
  let checksum = start;
  const values: number[] = [start];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    values.push(code);
    checksum += code * (i + 1);
  }
  values.push(checksum % 103, 106);
  let bars = '';
  let x = 0;
  const unit = 2;
  for (const v of values) {
    const pattern = PATTERNS[v];
    if (!pattern) continue;
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]) * unit;
      if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#12233B"/>`;
      x += w;
    }
  }
  const width = x + 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 22}" viewBox="0 0 ${width} ${height + 22}" role="img" aria-label="${escapeXml(text)}"><rect width="${width}" height="${height + 22}" fill="#fff"/><g transform="translate(10,0)">${bars}</g><text x="${width / 2}" y="${height + 16}" text-anchor="middle" font-family="monospace" font-size="12" fill="#12233B">${escapeXml(text)}</text></svg>`;
}
function escapeXml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c,
  );
}
export async function qrSvg(value: string): Promise<string> {
  return QRCode.toString(String(value), { type: 'svg', margin: 1, width: 160, errorCorrectionLevel: 'M' });
}
export interface ScannerBuffer {
  chars: string;
  lastKeyAt: number;
}
/** Keyboard-wedge detection: fast inter-key interval + Enter terminator. */
export function feedScanner(
  buffer: ScannerBuffer,
  key: string,
  at = Date.now(),
): { code?: string; buffer: ScannerBuffer } {
  const gap = at - buffer.lastKeyAt;
  const fresh = gap > 120 ? '' : buffer.chars;
  if (key === 'Enter')
    return { code: fresh.length >= 3 ? fresh : undefined, buffer: { chars: '', lastKeyAt: at } };
  if (key.length !== 1 || gap > 60) return { buffer: { chars: key.length === 1 ? key : '', lastKeyAt: at } };
  return { buffer: { chars: fresh + key, lastKeyAt: at } };
}
export function normalizeBarcode(raw: string): string {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/[\s\r\n\t]/g, '');
}
