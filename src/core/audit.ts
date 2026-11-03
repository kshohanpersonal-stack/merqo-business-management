import { randomUUID } from 'node:crypto';
import type { DB } from './db';
import type { Actor } from './types';
import type { FilterPayload, Page } from './types';
import { clampPage } from './validation';

export interface AuditInput {
  action: string;
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  actor?: Actor | null;
}
export function recordAudit(db: DB, input: AuditInput): void {
  db.prepare(
    `INSERT INTO audit_logs(id, actor_id, actor_name, action, entity, entity_id, before_json, after_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.actor?.userId ?? null,
    input.actor?.fullName ?? 'system',
    input.action,
    input.entity ?? '',
    input.entityId ?? '',
    input.before === undefined ? null : JSON.stringify(input.before),
    input.after === undefined ? null : JSON.stringify(input.after),
    new Date().toISOString(),
  );
}
export function listAudit(db: DB, filter: FilterPayload): Page<Record<string, unknown>> {
  const { page, pageSize, offset } = clampPage(filter);
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.search) {
    where.push('(action LIKE ? OR actor_name LIKE ? OR entity LIKE ?)');
    const s = `%${filter.search}%`;
    args.push(s, s, s);
  }
  if (filter.from) {
    where.push('created_at >= ?');
    args.push(filter.from);
  }
  if (filter.to) {
    where.push('created_at <= ?');
    args.push(filter.to + 'T23:59:59.999Z');
  }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM audit_logs ${clause}`).get(...args) as { n: number })
    .n;
  const rows = db
    .prepare(`SELECT * FROM audit_logs ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...args, pageSize, offset) as Record<string, unknown>[];
  return { rows, total, page, pageSize };
}
