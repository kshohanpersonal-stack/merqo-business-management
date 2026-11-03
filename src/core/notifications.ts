import type { DB } from './db';
import type { FilterPayload, Page } from './types';
import { uid, nowIso, pagedQuery } from './util';
import { formatMoney, normalizeText } from './money';
import { lowStockProducts } from './inventory';
import { getSetting } from './settings';

export function createNotification(
  db: DB,
  input: {
    kind: string;
    severity?: 'info' | 'success' | 'warning' | 'error';
    title: string;
    body?: string;
    entity?: string;
    entityId?: string;
    dedupeHours?: number;
  },
): string | null {
  const dedupeHours = input.dedupeHours ?? 24;
  const since = new Date(Date.now() - dedupeHours * 3600_000).toISOString();
  if (input.entityId) {
    const exists = db
      .prepare(`SELECT id FROM notifications WHERE kind=? AND entity_id=? AND created_at > ?`)
      .get(input.kind, input.entityId, since);
    if (exists) return null;
  }
  const id = uid();
  db.prepare(
    `INSERT INTO notifications(id, kind, severity, title, body, entity, entity_id, created_at)
    VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.kind,
    input.severity ?? 'info',
    normalizeText(input.title, 200),
    normalizeText(input.body ?? '', 500),
    input.entity ?? '',
    input.entityId ?? '',
    nowIso(),
  );
  return id;
}
export function listNotifications(db: DB, filter: FilterPayload): Page<Record<string, unknown>> {
  return pagedQuery(
    db,
    'SELECT * FROM notifications WHERE 1=1',
    [],
    filter,
    ['created_at', 'severity', 'kind'],
    'created_at',
  );
}
export function markRead(db: DB, ids: string[] | 'all'): number {
  if (ids === 'all')
    return db.prepare('UPDATE notifications SET read_at = ? WHERE read_at IS NULL').run(nowIso()).changes;
  const stmt = db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL');
  let n = 0;
  for (const id of ids) n += stmt.run(nowIso(), id).changes;
  return n;
}
export function unreadCount(db: DB): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE read_at IS NULL').get() as { n: number })
    .n;
}
export function refreshSystemNotifications(db: DB): number {
  let created = 0;
  for (const p of lowStockProducts(db, 100)) {
    const out = Number(p.current_stock_minor) <= 0;
    if (
      createNotification(db, {
        kind: out ? 'out_of_stock' : 'low_stock',
        severity: out ? 'error' : 'warning',
        title: out ? 'স্টক আউট' : 'কম স্টক',
        body: `${p.name} (${p.code}): বর্তমান স্টক ${Number(p.current_stock_minor) / 1000}`,
        entity: 'product',
        entityId: String(p.id),
      })
    )
      created++;
  }
  const expiryDays = Number(getSetting<{ expiryDays?: number }>(db, 'alerts').expiryDays ?? 30);
  const until = new Date(Date.now() + expiryDays * 86400_000).toISOString().slice(0, 10);
  const expiring = db
    .prepare(
      `SELECT id, name, expiry_date FROM products WHERE expiry_date IS NOT NULL
    AND expiry_date <= ? AND status='active' AND archived_at IS NULL`,
    )
    .all(until) as { id: string; name: string; expiry_date: string }[];
  for (const p of expiring) {
    if (
      createNotification(db, {
        kind: 'expiry',
        severity: 'warning',
        title: 'মেয়াদ শেষ হওয়ার আগাম জানানো',
        body: `${p.name}: ${p.expiry_date}`,
        entity: 'product',
        entityId: p.id,
      })
    )
      created++;
  }
  const dueCustomers = db
    .prepare(
      `SELECT id, name, balance_minor FROM customers WHERE balance_minor > 0
    AND archived_at IS NULL ORDER BY balance_minor DESC LIMIT 20`,
    )
    .all() as { id: string; name: string; balance_minor: number }[];
  for (const c of dueCustomers) {
    if (
      createNotification(db, {
        kind: 'customer_due',
        severity: 'info',
        title: 'কাস্টমার বাকি',
        body: `${c.name}: ${formatMoney(c.balance_minor)}`,
        entity: 'customer',
        entityId: c.id,
      })
    )
      created++;
  }
  const backup = getSetting<{ automatic?: boolean; frequencyHours?: number }>(db, 'backup');
  if (
    backup.automatic &&
    createNotification(db, {
      kind: 'backup_reminder',
      severity: 'info',
      title: 'ব্যাকআপ রিমাইন্ডার',
      body: `স্বয়ংক্রিয় ব্যাকআপ প্রতি ${backup.frequencyHours ?? 24} ঘণ্টা পরপর নির্ধারিত।`,
      dedupeHours: backup.frequencyHours ?? 24,
    })
  )
    created++;
  return created;
}
