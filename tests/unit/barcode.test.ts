import { describe, it, expect } from 'vitest';
import { code128Svg, qrSvg, feedScanner, normalizeBarcode } from '../../src/core/barcode';

describe('barcode, QR and keyboard-wedge scanner', () => {
  it('generates a valid Code128-B SVG with bars and checksum', () => {
    const svg = code128Svg('MERQ-000123');
    expect(svg).toContain('<svg');
    expect(svg).toContain('<rect');
    expect(svg).toContain('MERQ-000123');
    expect(() => code128Svg('বাংলা')).toThrow();
  });
  it('generates a QR SVG', async () => {
    const svg = await qrSvg('MERQO:PRD-1');
    expect(svg).toContain('<svg');
  });
  it('detects fast scanner keystrokes and ignores normal typing', () => {
    let buffer = { chars: '', lastKeyAt: 0 };
    let t = 1000;
    for (const ch of '8901234567890') {
      const r = feedScanner(buffer, ch, t);
      buffer = r.buffer;
      t += 20;
    }
    const done = feedScanner(buffer, 'Enter', t + 20);
    expect(done.code).toBe('8901234567890');
    let slow = { chars: '', lastKeyAt: 0 };
    let t2 = 5000;
    for (const ch of 'abc') {
      const r = feedScanner(slow, ch, t2);
      slow = r.buffer;
      t2 += 300;
    }
    expect(feedScanner(slow, 'Enter', t2).code).toBeUndefined();
  });
  it('normalizes scanned barcodes', () => {
    expect(normalizeBarcode(' 890 1234\n')).toBe('8901234');
  });
});
