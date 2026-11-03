/** Expense tracking and categories. */
import type { DB } from './db';
import type { FilterPayload, Page } from './types';
import { AppError, ERR } from './errors';
import { normalizeText, parseMoney } from './money';
import { uid, nowIso, todayIso, pagedQuery, rangeClause, makeIdempotencyKey } from './util';
import { applyAccountMovement } from './finance';
import { assertSafeRelativePath } from './validation';

export function listExpenseCategories(db: DB): Record<string, unknown>[] {
  return db
    .prepare('SELECT * FROM expense_categories WHERE archived_at IS NULL ORDER BY name')
    .all() as Record<string, unknown>[];
}
export function createExpenseCategory(db: DB, name: string, nameEn?: string): string {
  const n = normalizeText(name, 120);
  if (!n) throw new AppError(ERR.VALIDATION, 'খরচের ক্যাটাগরির নাম দিন।');
  if (db.prepare('SELECT id FROM expense_categories WHERE name=?').get(n))
    throw new AppError(ERR.CONFLICT, 'এই ক্যাটাগরি আগে থেকেই আছে।');
  const id = uid();
  db.prepare('INSERT INTO expense_categories(id, name, name_en, created_at) VALUES (?,?,?,?)').run(
    id,
    n,
    normalizeText(nameEn ?? '', 120),
    nowIso(),
  );
  return id;
}
export function updateExpenseCategory(db: DB, id: string, name: string, nameEn?: string): void {
  const r = db
    .prepare('UPDATE expense_categories SET name=?, name_en=? WHERE id=?')
    .run(normalizeText(name, 120), normalizeText(nameEn ?? '', 120), id);
  if (!r.changes) throw new AppError(ERR.NOT_FOUND, 'ক্যাটাগরি পাওয়া যায়নি।');
}
export function archiveExpenseCategory(db: DB, id: string): void {
  db.prepare('UPDATE expense_categories SET archived_at=? WHERE id=?').run(nowIso(), id);
}
export function createExpense(
  db: DB,
  input: {
    expenseDate?: string;
    categoryId: string;
    amount: unknown;
    paymentMethodId: string;
    accountId: string;
    description?: string;
    attachmentPath?: string;
    actorId?: string | null;
    idempotencyKey?: string;
  },
): string {
  const amount = parseMoney(input.amount, 'খরচ');
  if (amount <= 0) throw new AppError(ERR.VALIDATION, 'খরচ শূন্যের বেশি হতে হবে।');
  if (!db.prepare('SELECT id FROM expense_categories WHERE id=?').get(input.categoryId)) {
    throw new AppError(ERR.NOT_FOUND, 'খরচের ক্যাটাগরি পাওয়া যায়নি।');
  }
  const key = makeIdempotencyKey('expense', input.idempotencyKey);
  const id = uid();
  const date = input.expenseDate ?? todayIso();
  const txnId = applyAccountMovement(db, {
    accountId: input.accountId,
    direction: 'out',
    amountMinor: amount,
    kind: 'expense',
    referenceType: 'expense',
    referenceId: id,
    idempotencyKey: `${key}-account`,
    actorId: input.actorId,
    note: normalizeText(input.description ?? '', 200),
    txnDate: date + 'T12:00:00.000Z',
  });
  db.prepare(
    `INSERT INTO expenses(id, expense_date, category_id, amount_minor, payment_method_id,
    account_id, description, attachment_path, financial_transaction_id, idempotency_key, actor_id, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    date,
    input.categoryId,
    amount,
    input.paymentMethodId,
    input.accountId,
    normalizeText(input.description ?? '', 500),
    input.attachmentPath ? assertSafeRelativePath(input.attachmentPath) : '',
    txnId,
    key,
    input.actorId ?? null,
    nowIso(),
  );
  return id;
}
export function voidExpense(
  db: DB,
  input: { id: string; reason: string; actorId?: string | null; idempotencyKey?: string },
): void {
  const row = db.prepare('SELECT * FROM expenses WHERE id=?').get(input.id) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new AppError(ERR.NOT_FOUND, 'খরচ রেকর্ড পাওয়া যায়নি।');
  if (row.voided_at) throw new AppError(ERR.INVALID_STATE, 'এই খরচ আগেই বাতিল হয়েছে।');
  const key = makeIdempotencyKey('expense-void', input.idempotencyKey);
  applyAccountMovement(db, {
    accountId: String(row.account_id),
    direction: 'in',
    amountMinor: Number(row.amount_minor),
    kind: 'expense_void',
    referenceType: 'expense_void',
    referenceId: input.id,
    idempotencyKey: `${key}-account`,
    actorId: input.actorId,
    note: input.reason,
  });
  db.prepare('UPDATE expenses SET voided_at=? WHERE id=?').run(nowIso(), input.id);
}
export function listExpenses(db: DB, filter: FilterPayload): Page<Record<string, unknown>> {
  const args: unknown[] = [];
  let sql = `SELECT e.*, c.name AS category_name, pm.name AS payment_method_name, a.name AS account_name
    FROM expenses e JOIN expense_categories c ON c.id=e.category_id
    JOIN payment_methods pm ON pm.id=e.payment_method_id JOIN accounts a ON a.id=e.account_id WHERE 1=1`;
  const range = rangeClause(filter, 'e.expense_date');
  sql += range.clause;
  args.push(...range.args);
  if (filter.categoryId) {
    sql += ' AND e.category_id=?';
    args.push(String(filter.categoryId));
  }
  if (filter.paymentMethodId) {
    sql += ' AND e.payment_method_id=?';
    args.push(String(filter.paymentMethodId));
  }
  if (filter.search) {
    sql += ' AND (e.description LIKE ? OR c.name LIKE ?)';
    const s = `%${String(filter.search)}%`;
    args.push(s, s);
  }
  return pagedQuery(
    db,
    sql,
    args,
    filter,
    ['e.expense_date', 'e.amount_minor', 'e.created_at'],
    'e.created_at',
  );
}
export function expenseTotals(db: DB, from?: string, to?: string): number {
  const args: unknown[] = [];
  let sql = 'SELECT COALESCE(SUM(amount_minor),0) AS n FROM expenses WHERE voided_at IS NULL';
  if (from) {
    sql += ' AND expense_date >= ?';
    args.push(from);
  }
  if (to) {
    sql += ' AND expense_date <= ?';
    args.push(to);
  }
  return (db.prepare(sql).get(...args) as { n: number }).n;
}
