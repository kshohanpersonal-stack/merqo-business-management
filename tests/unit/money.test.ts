import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  parseQuantity,
  mulDivRound,
  applyBps,
  formatMoney,
  formatQuantity,
  discountFromSpec,
  toBanglaDigits,
} from '../../src/core/money';
import { AppError } from '../../src/core/errors';

describe('TC-001 money parsing and fixed precision', () => {
  it('parses Bangla and Latin digits into integer minor units', () => {
    expect(parseMoney('১২৩.৪৫')).toBe(12345);
    expect(parseMoney('123.456')).toBe(12346);
    expect(parseMoney('৳ 1,234.50')).toBe(123450);
    expect(parseMoney('0.005')).toBe(1);
  });
  it('rejects invalid money and negative values by default', () => {
    expect(() => parseMoney('abc')).toThrow(AppError);
    expect(() => parseMoney('-5')).toThrow(AppError);
    expect(parseMoney('-5', 'adjustment', true)).toBe(-500);
  });
  it('parses quantities with three implied decimals', () => {
    expect(parseQuantity('1.5')).toBe(1500);
    expect(parseQuantity('০.২৫')).toBe(250);
    expect(() => parseQuantity('0')).toThrow(AppError);
    expect(() => parseQuantity('1.2345')).toThrow(AppError);
  });
  it('does exact integer rounding without floating point drift', () => {
    expect(mulDivRound(1000, 1, 3)).toBe(333);
    expect(mulDivRound(1500, 1500, 1000)).toBe(2250);
    expect(applyBps(12345, 1250)).toBe(1543);
    expect(discountFromSpec(10000, 'percent', 10)).toBe(1000);
    expect(() => discountFromSpec(10000, 'percent', 101)).toThrow(AppError);
    expect(discountFromSpec(10000, 'fixed', '15.00')).toBe(1500);
  });
  it('formats money and quantities with Bangla numerals when requested', () => {
    expect(formatMoney(12345)).toBe('৳123.45');
    expect(formatMoney(12345, { banglaDigits: true })).toBe('৳১২৩.৪৫');
    expect(formatQuantity(1500)).toBe('1.5');
    expect(toBanglaDigits('2026-11-03')).toBe('২০২৬-১১-০৩');
  });
});
