import { appendFileSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from './types';

const SENSITIVE = /(password|token|signature|private.?key|secret|authorization)/gi;
function redact(input: string): string {
  return input.replace(SENSITIVE, '[redacted]');
}
export interface Logger {
  info(code: string, message: string, context?: Record<string, unknown>): void;
  warn(code: string, message: string, context?: Record<string, unknown>): void;
  error(code: string, message: string, context?: Record<string, unknown>): void;
}
export function createLogger(config: AppConfig): Logger {
  const file = join(config.logDir, 'merqo.log');
  const rotate = () => {
    try {
      if (statSync(file).size < 2 * 1024 * 1024) return;
      for (let i = 4; i >= 1; i--) {
        const src = join(config.logDir, `merqo.${i}.log`);
        if (statSyncSafe(src)) renameSync(src, join(config.logDir, `merqo.${i + 1}.log`));
      }
      renameSync(file, join(config.logDir, 'merqo.1.log'));
      for (const f of readdirSync(config.logDir)) {
        if (/^merqo\.[6-9]\.log$/.test(f)) unlinkSync(join(config.logDir, f));
      }
    } catch {
      /* logging must never break a sale */
    }
  };
  const write = (level: string, code: string, message: string, context?: Record<string, unknown>) => {
    try {
      rotate();
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        id: randomUUID(),
        level,
        code,
        message: redact(message).slice(0, 300),
        context: context ? JSON.parse(redact(JSON.stringify(context)).slice(0, 800)) : {},
      });
      appendFileSync(file, line + '\n', 'utf8');
    } catch {
      /* never throw from logger */
    }
  };
  return {
    info: (code, message, context) => write('info', code, message, context),
    warn: (code, message, context) => write('warn', code, message, context),
    error: (code, message, context) => write('error', code, message, context),
  };
}
function statSyncSafe(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
