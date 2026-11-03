import { randomUUID } from 'node:crypto';
import type { DB } from './db';
import type { FilterPayload, Page } from './types';
import { clampPage, whitelist } from './validation';
import { normalizeText } from './money';

export const uid = () => randomUUID();
export const nowIso = () => new Date().toISOString();
export const todayIso = () => nowIso().slice(0, 10);

export function rangeClause(filter: FilterPayload, column: string): { clause: string; args: unknown[] } {
  const parts: string[] = [];
  const args: unknown[] = [];
  if (filter.from) {
    parts.push(`${column} >= ?`);
    args.push(filter.from + 'T00:00:00.000Z');
  }
  if (filter.to) {
    parts.push(`${column} <= ?`);
    args.push(filter.to + 'T23:59:59.999Z');
  }
  return { clause: parts.length ? ` AND ${parts.join(' AND ')}` : '', args };
}
export function pagedQuery<T = Record<string, unknown>>(
  db: DB,
  sql: string,
  args: unknown[],
  filter: FilterPayload,
  sortable: readonly string[],
  defaultSort: string,
): Page<T> {
  const { page, pageSize, offset } = clampPage(filter);
  const sortBy = whitelist(filter.sortBy, sortable, defaultSort);
  const sortDir = filter.sortDir === 'asc' ? 'ASC' : 'DESC';
  const countSql = `SELECT COUNT(*) AS n FROM (${sql}) q`;
  const total = (db.prepare(countSql).get(...args) as { n: number }).n;
  const rows = db
    .prepare(`${sql} ORDER BY ${sortBy} ${sortDir} LIMIT ? OFFSET ?`)
    .all(...args, pageSize, offset) as T[];
  return { rows, total, page, pageSize };
}
export function searchPattern(filter: FilterPayload): string {
  return `%${normalizeText(filter.search ?? '', 100)}%`;
}
export function asInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
export function makeIdempotencyKey(prefix: string, provided?: unknown): string {
  return provided && typeof provided === 'string' && provided.length <= 120
    ? normalizeText(provided, 120)
    : `${prefix}-${uid()}`;
}
