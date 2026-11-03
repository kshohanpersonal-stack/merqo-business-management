/** Fixed-precision money helpers. Every stored amount is an integer minor unit. */
import { AppError, ERR } from './errors';

const BN_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};
const EN_TO_BN: Record<string, string> = Object.fromEntries(
  Object.entries(BN_DIGITS).map(([bn, en]) => [en, bn]),
);

export function normalizeDigits(input: string): string {
  return input.replace(/[০-৯]/g, (c) => BN_DIGITS[c] ?? c);
}
export function toBanglaDigits(input: string): string {
  return input.replace(/[0-9]/g, (c) => EN_TO_BN[c] ?? c);
}
function stripControlCharacters(text: string): string {
  return Array.from(text)
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return !(c <= 8 || c === 11 || c === 12 || (c >= 14 && c <= 31) || c === 127);
    })
    .join('');
}
export function normalizeText(input: unknown, maxLength = 500): string {
  if (input === null || input === undefined) return '';
  const s = stripControlCharacters(String(input).normalize('NFC')).trim();
  if (s.length > maxLength)
    throw new AppError(ERR.VALIDATION, `লেখা সর্বোচ্চ ${maxLength} অক্ষরের হতে পারে।`);
  return s;
}

/** Parse a decimal amount (Bangla or Latin digits) into integer minor units, half-up. */
export function parseMoney(input: unknown, field = 'অর্থ', allowNegative = false): number {
  const raw = normalizeDigits(String(input ?? '')).replace(/[,\s৳$]/g, '');
  if (!/^-?\d+(\.\d{1,4})?$/.test(raw)) {
    throw new AppError(ERR.VALIDATION, `${field}: সঠিক সংখ্যা লিখুন।`);
  }
  const negative = raw.startsWith('-');
  if (negative && !allowNegative) throw new AppError(ERR.VALIDATION, `${field}: ঋণাত্মক মান গ্রহণযোগ্য নয়।`);
  const [whole = '0', frac = ''] = raw.replace('-', '').split('.');
  const fracPadded = (frac + '0000').slice(0, 4);
  // 4 decimal input places -> minor units (2 places), half-up rounding.
  const scaled = BigInt(whole) * 10_000n + BigInt(fracPadded);
  let minor = (scaled + 50n) / 100n;
  if (negative) minor = -minor;
  if (minor > 9_000_000_000_000_000n || minor < -9_000_000_000_000_000n) {
    throw new AppError(ERR.VALIDATION, `${field}: মান অনেক বড়।`);
  }
  return Number(minor);
}

/** Parse a quantity with 3 implied decimals into an integer. */
export function parseQuantity(input: unknown, field = 'পরিমাণ'): number {
  const raw = normalizeDigits(String(input ?? '')).replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,3})?$/.test(raw)) throw new AppError(ERR.VALIDATION, `${field}: সঠিক পরিমাণ লিখুন।`);
  const [whole = '0', frac = ''] = raw.split('.');
  const value = BigInt(whole) * 1000n + BigInt((frac + '000').slice(0, 3));
  if (value <= 0n) throw new AppError(ERR.VALIDATION, `${field}: শূন্যের বেশি হতে হবে।`);
  if (value > 9_000_000_000_000_000n) throw new AppError(ERR.VALIDATION, `${field}: মান অনেক বড়।`);
  return Number(value);
}

/** Exact integer multiply/divide with half-up rounding (no floating point). */
export function mulDivRound(amount: number, numerator: number, denominator: number): number {
  const a = BigInt(Math.trunc(amount));
  const n = BigInt(Math.trunc(numerator));
  const d = BigInt(Math.trunc(denominator));
  if (d <= 0n) throw new AppError(ERR.VALIDATION, 'ভাজক শূন্য হতে পারে না।');
  const negative = a < 0n !== n < 0n;
  const product = a * n;
  const abs = product < 0n ? -product : product;
  const rounded = (abs + d / 2n) / d;
  return Number(negative ? -rounded : rounded);
}
/** Basis points: 10000 = 100%, 1250 = 12.5%. */
export function applyBps(amount: number, bps: number): number {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
    throw new AppError(ERR.VALIDATION, 'শতাংশ ০ থেকে ১০০ এর মধ্যে হতে হবে।');
  }
  return mulDivRound(amount, bps, 10_000);
}
export function applyFixedDiscount(amount: number, discountMinor: number): number {
  if (discountMinor < 0) throw new AppError(ERR.VALIDATION, 'ডিসকাউন্ট ঋণাত্মক হতে পারে না।');
  return Math.min(amount, discountMinor);
}
export function discountFromSpec(
  amount: number,
  type: 'none' | 'percent' | 'fixed',
  value: number | string,
): number {
  if (type === 'none') return 0;
  if (type === 'percent') return applyBps(amount, Math.round(Number(value) * 100));
  return applyFixedDiscount(amount, parseMoney(value, 'ডিসকাউন্ট'));
}
export function formatMoney(
  minor: number,
  opts: { symbol?: string; position?: 'before' | 'after'; banglaDigits?: boolean; decimals?: number } = {},
): string {
  const { symbol = '৳', position = 'before', banglaDigits = false, decimals = 2 } = opts;
  const negative = minor < 0;
  const abs = BigInt(Math.abs(Math.trunc(minor)));
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, '0');
  let out = `${whole.toString()}${decimals ? '.' + frac : ''}`;
  if (banglaDigits) out = toBanglaDigits(out);
  const withSymbol = position === 'before' ? `${symbol}${out}` : `${out}${symbol}`;
  return `${negative ? '-' : ''}${withSymbol}`;
}
export function formatQuantity(minor: number, decimals = 3, banglaDigits = false): string {
  const negative = minor < 0;
  const abs = BigInt(Math.abs(Math.trunc(minor)));
  const base = 10n ** BigInt(decimals);
  let out = `${abs / base}${decimals ? '.' + (abs % base).toString().padStart(decimals, '0') : ''}`;
  if (decimals && out.includes('.')) {
    const [whole, frac = ''] = out.split('.');
    const trimmed = frac.replace(/0+$/, '');
    out = trimmed ? `${whole}.${trimmed}` : whole!;
  }
  if (banglaDigits) out = toBanglaDigits(out);
  return (negative ? '-' : '') + out;
}
export function sumMinor(values: number[]): number {
  return values.reduce((a, b) => {
    if (!Number.isSafeInteger(a + b)) throw new AppError(ERR.VALIDATION, 'হিসাবের মান সীমা অতিক্রম করেছে।');
    return a + b;
  }, 0);
}
