import type { SafeError } from './types';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
  toSafe(): SafeError {
    return { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) };
  }
}

export const ERR = {
  VALIDATION: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_STATE: 'INVALID_STATE',
  LICENSE_INVALID: 'LICENSE_INVALID',
  IO: 'IO_ERROR',
  INTERNAL: 'INTERNAL',
} as const;

export function fail(code: string, message: string, details?: Record<string, string>): never {
  throw new AppError(code, message, details);
}
export function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) fail(ERR.NOT_FOUND, message);
  return value;
}
export function toSafeError(err: unknown, isDevelopment = false): SafeError {
  if (err instanceof AppError) return err.toSafe();
  // Never leak SQL, stack traces or secrets to the renderer.
  if (isDevelopment && err instanceof Error) {
    console.error('[core]', err.message);
  }
  return { code: ERR.INTERNAL, message: 'কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন অথবা লগ দেখুন।' };
}
