/** Customers, suppliers, due collection and party statements. */
import type { DB } from './db';
import type { FilterPayload, Page } from './types';
import { AppError, ERR } from './errors';
import { normalizeText, parseMoney, formatMoney } from './money';
import { uid, nowIso, pagedQuery, searchPattern, rangeClause, makeIdempotencyKey } from './util';
import { applyAccountMovement, applyPartyLedger } from './finance';

export type PartyType = 'customer' | 'supplier';
export interface PartyInput {
  name: string;
  nameEn?: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  openingBalance?: unknown;
  creditLimit?: unknown;
  status?: string;
}
const TABLE: Record<PartyType, string> = { customer: 'customers', supplier: 'suppliers' };

export function createParty(db: DB, type: PartyType, input: PartyInput): string {
  const name = normalizeText(input.name, 200);
  if (!name) throw new AppError(ERR.VALIDATION, 'নাম দিন।');
  const opening = parseMoney(input.openingBalance ?? 0, 'ওপেনিং ব্যালেন্স', true);
  const id = uid();
  const stamp = nowIso();
  if (type === 'customer') {
    db.prepare(
      `INSERT INTO customers(id, name, name_en, phone, address, notes, opening_balance_minor,
      balance_minor, credit_limit_minor, status, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      name,
      normalizeText(input.nameEn ?? '', 200),
      normalizeText(input.phone ?? '', 40),
      normalizeText(input.address ?? '', 500),
      normalizeText(input.notes ?? '', 1000),
      opening,
      opening,
      input.creditLimit === undefined ? 0 : parseMoney(input.creditLimit, 'ক্রেডিট লিমিট'),
      input.status ?? 'active',
      stamp,
      stamp,
    );
  } else {
    db.prepare(
      `INSERT INTO suppliers(id, name, name_en, company, phone, email, address, notes,
      opening_balance_minor, balance_minor, status, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      name,
      normalizeText(input.nameEn ?? '', 200),
      normalizeText(input.company ?? '', 200),
      normalizeText(input.phone ?? '', 40),
      normalizeText(input.email ?? '', 120),
      normalizeText(input.address ?? '', 500),
      normalizeText(input.notes ?? '', 1000),
      opening,
      opening,
      input.status ?? 'active',
      stamp,
      stamp,
    );
  }
  if (opening !== 0) {
    applyPartyLedger(db, {
      partyType: type,
      partyId: id,
      kind: 'opening',
      debitMinor: Math.max(0, opening),
      creditMinor: Math.max(0, -opening),
      referenceType: 'opening',
      referenceId: id,
      idempotencyKey: `opening-${id}`,
      note: 'ওপেনিং ব্যালেন্স',
    });
  }
  return id;
}
export function updateParty(db: DB, type: PartyType, id: string, input: Partial<PartyInput>): void {
  const row = db.prepare(`SELECT * FROM ${TABLE[type]} WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new AppError(ERR.NOT_FOUND, 'রেকর্ড পাওয়া যায়নি।');
  const fields: Record<string, string> =
    type === 'customer'
      ? {
          name: 'name',
          nameEn: 'name_en',
          phone: 'phone',
          address: 'address',
          notes: 'notes',
          status: 'status',
        }
      : {
          name: 'name',
          nameEn: 'name_en',
          company: 'company',
          phone: 'phone',
          email: 'email',
          address: 'address',
          notes: 'notes',
          status: 'status',
        };
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const [key, column] of Object.entries(fields)) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      args.push(normalizeText(String(value), 1000));
    }
  }
  if (input.creditLimit !== undefined && type === 'customer') {
    sets.push('credit_limit_minor = ?');
    args.push(parseMoney(input.creditLimit, 'ক্রেডিট লিমিট'));
  }
  if (!sets.length) return;
  sets.push('updated_at = ?');
  args.push(nowIso(), id);
  db.prepare(`UPDATE ${TABLE[type]} SET ${sets.join(', ')} WHERE id = ?`).run(...args);
}
export function archiveParty(db: DB, type: PartyType, id: string): void {
  const row = db.prepare(`SELECT id, balance_minor FROM ${TABLE[type]} WHERE id = ?`).get(id) as
    | { balance_minor: number }
    | undefined;
  if (!row) throw new AppError(ERR.NOT_FOUND, 'রেকর্ড পাওয়া যায়নি।');
  if (row.balance_minor !== 0)
    throw new AppError(ERR.INVALID_STATE, 'বাকি থাকা অবস্থায় আর্কাইভ করা যাবে না।');
  db.prepare(`UPDATE ${TABLE[type]} SET archived_at=?, status='inactive', updated_at=? WHERE id=?`).run(
    nowIso(),
    nowIso(),
    id,
  );
}
export function getParty(db: DB, type: PartyType, id: string): Record<string, unknown> {
  const row = db.prepare(`SELECT * FROM ${TABLE[type]} WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new AppError(ERR.NOT_FOUND, 'রেকর্ড পাওয়া যায়নি।');
  return row;
}
export function listParties(db: DB, type: PartyType, filter: FilterPayload): Page<Record<string, unknown>> {
  const args: unknown[] = [];
  let sql = `SELECT * FROM ${TABLE[type]} WHERE 1=1`;
  if (filter.includeArchived !== true) sql += ' AND archived_at IS NULL';
  if (filter.search) {
    const s = searchPattern(filter);
    sql += ' AND (name LIKE ? OR name_en LIKE ? OR phone LIKE ?)';
    args.push(s, s, s);
  }
  if (filter.status) {
    sql += ' AND status = ?';
    args.push(String(filter.status));
  }
  if (filter.onlyDue === true) sql += ' AND balance_minor > 0';
  return pagedQuery(db, sql, args, filter, ['name', 'balance_minor', 'created_at', 'phone'], 'created_at');
}
export function partyProfile(db: DB, type: PartyType, id: string): Record<string, unknown> {
  const party = getParty(db, type, id);
  if (type === 'customer') {
    const totals = db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total_minor ELSE 0 END),0) AS total_purchase_minor,
      COUNT(*) AS invoice_count FROM sales WHERE customer_id = ?`,
      )
      .get(id) as Record<string, number>;
    const paid = db
      .prepare(
        `SELECT COALESCE(SUM(sp.amount_minor),0) AS total_paid_minor FROM sale_payments sp
      JOIN sales s ON s.id=sp.sale_id WHERE s.customer_id=?`,
      )
      .get(id) as { total_paid_minor: number };
    return { ...party, ...totals, total_paid_minor: paid.total_paid_minor };
  }
  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(total_minor),0) AS total_purchase_minor, COUNT(*) AS invoice_count
    FROM purchases WHERE supplier_id = ?`,
    )
    .get(id) as Record<string, number>;
  const paid = db
    .prepare(
      `SELECT COALESCE(SUM(pp.amount_minor),0) AS total_paid_minor FROM purchase_payments pp
    JOIN purchases p ON p.id=pp.purchase_id WHERE p.supplier_id=?`,
    )
    .get(id) as { total_paid_minor: number };
  return { ...party, ...totals, total_paid_minor: paid.total_paid_minor };
}
export function partyStatement(
  db: DB,
  type: PartyType,
  id: string,
  filter: FilterPayload,
): Page<Record<string, unknown>> {
  const args: unknown[] = [type, id];
  let sql = `SELECT * FROM party_ledger WHERE party_type = ? AND party_id = ?`;
  const range = rangeClause(filter, 'txn_date');
  sql += range.clause;
  args.push(...range.args);
  return pagedQuery(db, sql, args, filter, ['txn_date', 'created_at', 'balance_after_minor'], 'created_at');
}
export function collectDue(
  db: DB,
  input: {
    customerId: string;
    amount: unknown;
    accountId: string;
    paymentMethodId?: string;
    note?: string;
    actorId?: string | null;
    idempotencyKey?: string;
  },
): { ledgerId: string; transactionId: string } {
  const amount = parseMoney(input.amount, 'বাকি আদায়');
  if (amount <= 0) throw new AppError(ERR.VALIDATION, 'অর্থ শূন্যের বেশি হতে হবে।');
  const customer = db.prepare('SELECT balance_minor FROM customers WHERE id = ?').get(input.customerId) as
    | { balance_minor: number }
    | undefined;
  if (!customer) throw new AppError(ERR.NOT_FOUND, 'কাস্টমার পাওয়া যায়নি।');
  if (amount > customer.balance_minor)
    throw new AppError(ERR.VALIDATION, 'বাকির চেয়ে বেশি টাকা আদায় করা যাবে না।');
  const key = makeIdempotencyKey('due-collection', input.idempotencyKey);
  const ledgerId = applyPartyLedger(db, {
    partyType: 'customer',
    partyId: input.customerId,
    kind: 'payment',
    debitMinor: 0,
    creditMinor: amount,
    referenceType: 'due_collection',
    referenceId: key,
    idempotencyKey: key,
    note: input.note,
    actorId: input.actorId,
  });
  const transactionId = applyAccountMovement(db, {
    accountId: input.accountId,
    direction: 'in',
    amountMinor: amount,
    kind: 'due_collection',
    referenceType: 'due_collection',
    referenceId: key,
    idempotencyKey: `${key}-account`,
    actorId: input.actorId,
    note: input.note,
  });
  return { ledgerId, transactionId };
}
export function paySupplier(
  db: DB,
  input: {
    supplierId: string;
    amount: unknown;
    accountId: string;
    paymentMethodId?: string;
    note?: string;
    actorId?: string | null;
    idempotencyKey?: string;
  },
): { ledgerId: string; transactionId: string } {
  const amount = parseMoney(input.amount, 'সাপ্লায়ার পেমেন্ট');
  if (amount <= 0) throw new AppError(ERR.VALIDATION, 'অর্থ শূন্যের বেশি হতে হবে।');
  const supplier = db.prepare('SELECT balance_minor FROM suppliers WHERE id = ?').get(input.supplierId) as
    | { balance_minor: number }
    | undefined;
  if (!supplier) throw new AppError(ERR.NOT_FOUND, 'সাপ্লায়ার পাওয়া যায়নি।');
  if (amount > supplier.balance_minor)
    throw new AppError(ERR.VALIDATION, 'বাকির চেয়ে বেশি টাকা পরিশোধ করা যাবে না।');
  const key = makeIdempotencyKey('supplier-payment', input.idempotencyKey);
  const ledgerId = applyPartyLedger(db, {
    partyType: 'supplier',
    partyId: input.supplierId,
    kind: 'payment',
    debitMinor: 0,
    creditMinor: amount,
    referenceType: 'supplier_payment',
    referenceId: key,
    idempotencyKey: key,
    note: input.note,
    actorId: input.actorId,
  });
  const transactionId = applyAccountMovement(db, {
    accountId: input.accountId,
    direction: 'out',
    amountMinor: amount,
    kind: 'supplier_payment',
    referenceType: 'supplier_payment',
    referenceId: key,
    idempotencyKey: `${key}-account`,
    actorId: input.actorId,
    note: input.note,
  });
  return { ledgerId, transactionId };
}
export function totalDue(db: DB, type: PartyType): number {
  const r = db
    .prepare(`SELECT COALESCE(SUM(balance_minor),0) AS n FROM ${TABLE[type]} WHERE archived_at IS NULL`)
    .get() as { n: number };
  return r.n;
}
export function dueSummaryText(db: DB): string {
  return `কাস্টমার বাকি ${formatMoney(totalDue(db, 'customer'))}, সাপ্লায়ার বাকি ${formatMoney(totalDue(db, 'supplier'))}`;
}
