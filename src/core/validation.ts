import { z } from 'zod';
import { AppError, ERR } from './errors';
import { normalizeText, parseMoney, parseQuantity } from './money';

export const zText = (max = 255) =>
  z
    .string()
    .max(max)
    .transform((s) => normalizeText(s, max));
export const zOptionalText = (max = 255) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((s) => normalizeText(s ?? '', max));
export const zId = z.string().uuid();
export const zMoney = z.union([z.string(), z.number()]).transform((v) => parseMoney(v));
export const zQuantity = z.union([z.string(), z.number()]).transform((v) => parseQuantity(v));
export const zIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'তারিখ YYYY-MM-DD ফরম্যাটে লিখুন।');
export const zIsoDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'অবৈধ সময় ফরম্যাট।');
export const zBooleanish = z
  .union([z.boolean(), z.number(), z.string()])
  .transform((v) => v === true || v === 1 || v === '1' || v === 'true');

export function validate<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.join('.') || 'input';
    throw new AppError(ERR.VALIDATION, `${path}: ${first?.message ?? 'অবৈধ ইনপুট'}`);
  }
  return parsed.data;
}
export function assertSafeRelativePath(input: string): string {
  const p = normalizeText(input, 500);
  if (!p || p.startsWith('/') || p.startsWith('\\') || /^[A-Za-z]:/.test(p) || p.includes('..')) {
    throw new AppError(ERR.VALIDATION, 'অবৈধ ফাইল পাথ।');
  }
  return p;
}
export function assertWithin(base: string, target: string): string {
  const resolvedBase = base.endsWith('/') || base.endsWith('\\') ? base : base + '/';
  if (!target.startsWith(resolvedBase))
    throw new AppError(ERR.VALIDATION, 'অনুমোদিত ফোল্ডারের বাইরে অ্যাক্সেস নিষিদ্ধ।');
  return target;
}
export function clampPage(payload: { page?: unknown; pageSize?: unknown }): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = Math.max(1, Math.min(100000, Number(payload.page) || 1));
  const pageSize = Math.max(1, Math.min(500, Number(payload.pageSize) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
export function whitelist(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}
