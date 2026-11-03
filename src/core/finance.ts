/** Financial ledger primitives. Every money movement passes through here. */
import type { DB } from './db';
import type { FilterPayload, Page } from './types';
import { AppError, ERR } from './errors';
import { uid, nowIso, rangeClause, pagedQuery } from './util';
import { normalizeText, parseMoney, sumMinor } from './money';

export interface AccountMovement {
  accountId: string;
  direction: 'in' | 'out';
  amountMinor: number;
  kind: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  actorId?: string | null;
  txnDate?: string;
  note?: string;
}
export function applyAccountMovement(db: DB, input: AccountMovement): string {
  const account = db
    .prepare('SELECT id, balance_minor FROM accounts WHERE id = ? AND archived_at IS NULL')
    .get(input.accountId) as { id: string; balance_minor: number } | undefined;
  if (!account) throw new AppError(ERR.NOT_FOUND, 'অ্যাকাউন্ট পাওয়া যায়নি।');
  if (input.amountMinor < 0) throw new AppError(ERR.VALIDATION, 'অর্থের পরিমাণ ঋণাত্মক হতে পারে না।');
  if (
    db.prepare('SELECT id FROM financial_transactions WHERE idempotency_key = ?').get(input.idempotencyKey)
  ) {
    throw new AppError(ERR.CONFLICT, 'এই লেনদেন আগেই সম্পন্ন হয়েছে।');
  }
  const delta = input.direction === 'in' ? input.amountMinor : -input.amountMinor;
  const balance = account.balance_minor + delta;
  const id = uid();
  db.prepare(
    `INSERT INTO financial_transactions(id, txn_date, account_id, direction, amount_minor,
    balance_after_minor, kind, reference_type, reference_id, idempotency_key, actor_id, note, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.txnDate ?? nowIso(),
    input.accountId,
    input.direction,
    input.amountMinor,
    balance,
    input.kind,
    input.referenceType ?? '',
    input.referenceId ?? '',
    input.idempotencyKey,
    input.actorId ?? null,
    normalizeText(input.note ?? '', 300),
    nowIso(),
  );
  db.prepare('UPDATE accounts SET balance_minor = ? WHERE id = ?').run(balance, input.accountId);
  return id;
}

export interface PartyLedgerEntry {
  partyType: 'customer' | 'supplier';
  partyId: string;
  kind: 'opening' | 'invoice' | 'purchase' | 'payment' | 'return' | 'refund' | 'adjustment';
  debitMinor: number;
  creditMinor: number;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  note?: string;
  actorId?: string | null;
  txnDate?: string;
}
/** Convention for BOTH party types: balance increases with debit, decreases with credit. */
export function applyPartyLedger(db: DB, input: PartyLedgerEntry): string {
  const table = input.partyType === 'customer' ? 'customers' : 'suppliers';
  const party = db.prepare(`SELECT id, balance_minor FROM ${table} WHERE id = ?`).get(input.partyId) as
    | { id: string; balance_minor: number }
    | undefined;
  if (!party) throw new AppError(ERR.NOT_FOUND, 'কাস্টমার/সাপ্লায়ার পাওয়া যায়নি।');
  if (db.prepare('SELECT id FROM party_ledger WHERE idempotency_key = ?').get(input.idempotencyKey)) {
    throw new AppError(ERR.CONFLICT, 'এই লেজার এন্ট্রি আগেই আছে।');
  }
  const balance = party.balance_minor + input.debitMinor - input.creditMinor;
  const id = uid();
  db.prepare(
    `INSERT INTO party_ledger(id, party_type, party_id, txn_date, kind, debit_minor, credit_minor,
    balance_after_minor, reference_type, reference_id, idempotency_key, note, actor_id, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.partyType,
    input.partyId,
    input.txnDate ?? nowIso(),
    input.kind,
    input.debitMinor,
    input.creditMinor,
    balance,
    input.referenceType ?? '',
    input.referenceId ?? '',
    input.idempotencyKey,
    normalizeText(input.note ?? '', 300),
    input.actorId ?? null,
    nowIso(),
  );
  db.prepare(`UPDATE ${table} SET balance_minor = ?, updated_at = ? WHERE id = ?`).run(
    balance,
    nowIso(),
    input.partyId,
  );
  return id;
}

export function listAccounts(db: DB): Record<string, unknown>[] {
  return db
    .prepare(
      `SELECT a.*, pm.name AS payment_method_name FROM accounts a
    LEFT JOIN payment_methods pm ON pm.id = a.payment_method_id
    WHERE a.archived_at IS NULL ORDER BY a.is_default DESC, a.name`,
    )
    .all() as Record<string, unknown>[];
}
export function createAccount(
  db: DB,
  input: {
    name: string;
    type: string;
    paymentMethodId?: string;
    openingBalance?: unknown;
    isDefault?: boolean;
  },
): string {
  const name = normalizeText(input.name, 120);
  if (!name) throw new AppError(ERR.VALIDATION, 'অ্যাকাউন্টের নাম দিন।');
  if (!['cash', 'bank', 'mobile', 'custom', 'other'].includes(input.type))
    throw new AppError(ERR.VALIDATION, 'অবৈধ অ্যাকাউন্ট ধরন।');
  const opening =
    input.openingBalance === undefined ? 0 : parseMoney(input.openingBalance, 'ওপেনিং ব্যালেন্স');
  const id = uid();
  db.prepare(
    `INSERT INTO accounts(id, name, name_en, type, payment_method_id, opening_balance_minor,
    balance_minor, is_default, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    name,
    name,
    input.type,
    input.paymentMethodId ?? null,
    opening,
    opening,
    input.isDefault ? 1 : 0,
    nowIso(),
  );
  // Opening balance is a balance, not a cash movement; it is stored on the account.
  return id;
}
export function cashInOut(
  db: DB,
  input: {
    direction: 'in' | 'out';
    accountId: string;
    amount: unknown;
    note?: string;
    kind?: string;
    actorId?: string | null;
    idempotencyKey?: string;
  },
): string {
  const amount = parseMoney(input.amount, 'অর্থ');
  if (amount <= 0) throw new AppError(ERR.VALIDATION, 'অর্থ শূন্যের বেশি হতে হবে।');
  return applyAccountMovement(db, {
    accountId: input.accountId,
    direction: input.direction,
    amountMinor: amount,
    kind: input.kind ?? (input.direction === 'in' ? 'other_income' : 'cash_out'),
    idempotencyKey: input.idempotencyKey ?? `cash-${uid()}`,
    actorId: input.actorId,
    note: input.note,
  });
}
export function listFinancialTransactions(db: DB, filter: FilterPayload): Page<Record<string, unknown>> {
  const args: unknown[] = [];
  let sql = `SELECT f.*, a.name AS account_name FROM financial_transactions f
    JOIN accounts a ON a.id = f.account_id WHERE 1=1`;
  const range = rangeClause(filter, 'f.txn_date');
  sql += range.clause;
  args.push(...range.args);
  if (filter.accountId) {
    sql += ' AND f.account_id = ?';
    args.push(String(filter.accountId));
  }
  if (filter.kind) {
    sql += ' AND f.kind = ?';
    args.push(String(filter.kind));
  }
  if (filter.direction) {
    sql += ' AND f.direction = ?';
    args.push(String(filter.direction));
  }
  return pagedQuery(
    db,
    sql,
    args,
    filter,
    ['f.txn_date', 'f.amount_minor', 'f.kind', 'f.created_at'],
    'f.txn_date',
  );
}
export interface CashSummary {
  cash_in_minor: number;
  cash_out_minor: number;
  net_minor: number;
  all_accounts_minor: number;
}
export function getCashSummary(db: DB, date: string): CashSummary {
  const from = date + 'T00:00:00.000Z',
    to = date + 'T23:59:59.999Z';
  const row = db
    .prepare(
      `SELECT
    COALESCE(SUM(CASE WHEN direction='in' THEN amount_minor ELSE 0 END),0) AS cash_in,
    COALESCE(SUM(CASE WHEN direction='out' THEN amount_minor ELSE 0 END),0) AS cash_out
    FROM financial_transactions WHERE txn_date >= ? AND txn_date <= ?`,
    )
    .get(from, to) as { cash_in: number; cash_out: number };
  const accounts = db
    .prepare('SELECT COALESCE(SUM(balance_minor),0) AS b FROM accounts WHERE archived_at IS NULL')
    .get() as { b: number };
  return {
    cash_in_minor: row.cash_in,
    cash_out_minor: row.cash_out,
    net_minor: row.cash_in - row.cash_out,
    all_accounts_minor: accounts.b,
  };
}
export function closeCash(
  db: DB,
  input: { date: string; counted: unknown; actorId?: string | null; note?: string },
): void {
  const counted = parseMoney(input.counted, 'গণনা করা টাকা');
  const summary = getCashSummary(db, input.date);
  const opening =
    (
      db.prepare('SELECT opening_minor FROM cash_closings WHERE date = ?').get(input.date) as
        | { opening_minor: number }
        | undefined
    )?.opening_minor ?? 0;
  const expected = opening + summary.net_minor;
  db.prepare(
    `INSERT INTO cash_closings(date, opening_minor, expected_minor, counted_minor, difference_minor, actor_id, note, created_at)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(date) DO UPDATE SET expected_minor=excluded.expected_minor,
    counted_minor=excluded.counted_minor, difference_minor=excluded.difference_minor, note=excluded.note`,
  ).run(
    input.date,
    opening,
    expected,
    counted,
    counted - expected,
    input.actorId ?? null,
    normalizeText(input.note ?? '', 300),
    nowIso(),
  );
}
export interface ReconciliationReport {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
}
export function reconcile(db: DB): ReconciliationReport {
  const checks: ReconciliationReport['checks'] = [];
  const check = (name: string, mismatch: number, detail = '') =>
    checks.push({ name, ok: mismatch === 0, detail: detail || `${mismatch} mismatch(es)` });
  check(
    'account_balances',
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM accounts a WHERE a.balance_minor <>
    a.opening_balance_minor + COALESCE((SELECT SUM(CASE WHEN direction='in' THEN amount_minor ELSE -amount_minor END)
    FROM financial_transactions f WHERE f.account_id = a.id),0)`,
        )
        .get() as { n: number }
    ).n,
  );
  check(
    'customer_balances',
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM customers c WHERE c.balance_minor <>
    COALESCE((SELECT SUM(debit_minor - credit_minor) FROM party_ledger l
    WHERE l.party_type='customer' AND l.party_id=c.id),0)`,
        )
        .get() as { n: number }
    ).n,
  );
  check(
    'supplier_balances',
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM suppliers s WHERE s.balance_minor <>
    COALESCE((SELECT SUM(debit_minor - credit_minor) FROM party_ledger l
    WHERE l.party_type='supplier' AND l.party_id=s.id),0)`,
        )
        .get() as { n: number }
    ).n,
  );
  check(
    'product_stock',
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM products p WHERE p.current_stock_minor <>
    COALESCE((SELECT SUM(CASE WHEN direction='in' THEN quantity_minor ELSE -quantity_minor END)
    FROM stock_movements m WHERE m.product_id=p.id),0)`,
        )
        .get() as { n: number }
    ).n,
  );
  check(
    'sale_payments',
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM sales s WHERE s.status <> 'cancelled' AND s.paid_minor <>
    COALESCE((SELECT SUM(amount_minor) FROM sale_payments p WHERE p.sale_id=s.id),0)`,
        )
        .get() as { n: number }
    ).n,
  );
  check(
    'sale_totals',
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM sales s WHERE s.total_minor <>
    (SELECT COALESCE(SUM(line_total_minor),0) FROM sale_items i WHERE i.sale_id=s.id)
    - s.item_discount_minor - s.cart_discount_minor + s.tax_minor`,
        )
        .get() as { n: number }
    ).n,
  );
  check(
    'sale_cogs',
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM sales s WHERE s.cogs_minor <>
    COALESCE((SELECT SUM(i.line_cogs_minor) FROM sale_items i WHERE i.sale_id=s.id),0)`,
        )
        .get() as { n: number }
    ).n,
  );
  check(
    'purchase_payments',
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM purchases p WHERE p.paid_minor <>
    COALESCE((SELECT SUM(amount_minor) FROM purchase_payments pp WHERE pp.purchase_id=p.id),0)`,
        )
        .get() as { n: number }
    ).n,
  );
  check(
    'financial_vs_documents',
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM financial_transactions f
    WHERE f.kind IN ('sale_payment','purchase_payment','expense','refund')
    AND f.reference_id <> '' AND f.reference_type <> ''
    AND NOT EXISTS (SELECT 1 FROM sale_payments sp WHERE 'sale_payment' = f.kind AND sp.sale_id = f.reference_id
      UNION ALL SELECT 1 FROM purchase_payments pp WHERE 'purchase_payment' = f.kind AND pp.purchase_id = f.reference_id
      UNION ALL SELECT 1 FROM expenses e WHERE 'expense' = f.kind AND e.id = f.reference_id
      UNION ALL SELECT 1 FROM refunds r WHERE 'refund' = f.kind AND r.id = f.reference_id)`,
        )
        .get() as { n: number }
    ).n,
  );
  const fk = db.pragma('foreign_key_check') as unknown[];
  check('foreign_keys', fk.length);
  return { ok: checks.every((c) => c.ok), checks };
}
export function sumAmounts(db: DB, sql: string, args: unknown[] = []): number {
  const row = db.prepare(sql).get(...args) as { n: number | null };
  return Number(row.n ?? 0);
}
export { sumMinor };
