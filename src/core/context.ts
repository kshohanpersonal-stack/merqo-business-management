import type { DB } from './db';
import { openDatabase } from './db';
import { createConfig } from './config';
import type { AppConfig } from './types';
import { createLogger, type Logger } from './logger';

export interface AppContext {
  db: DB;
  config: AppConfig;
  logger: Logger;
  now(): string;
  close(): void;
  /** Optional platform providers, supplied by Electron main only. */
  printers?: () => Promise<string[]>;
  printReceipt?: (
    html: string,
    options: Record<string, unknown>,
  ) => Promise<{ ok: boolean; message?: string }>;
  exportPdf?: (html: string) => Promise<Buffer>;
}
let singleton: AppContext | undefined;
export function createAppContext(options?: { dataDir?: string; dbPath?: string }): AppContext {
  const config = createConfig(options?.dataDir);
  if (options?.dbPath) config.dbPath = options.dbPath;
  const db = openDatabase(config.dbPath);
  const logger = createLogger(config);
  const ctx: AppContext = {
    db,
    config,
    logger,
    now: () => new Date().toISOString(),
    close: () => {
      db.close();
      if (singleton === ctx) singleton = undefined;
    },
  };
  singleton = ctx;
  return ctx;
}
export function getAppContext(): AppContext {
  if (!singleton) throw new Error('Application context not initialized');
  return singleton;
}
export function closeAppContext(): void {
  singleton?.close();
}
