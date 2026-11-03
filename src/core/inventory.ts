/** Weighted-average inventory valuation and stock movements. */
import type { DB } from './db';
import type { FilterPayload, Page } from './types';
import { AppError, ERR } from './errors';
import { mulDivRound, parseQuantity, normalizeText } from './money';
import { uid, nowIso, pagedQuery, rangeClause } from './util';

export interface StockMovementInput {
  productId: string;
  direction: 'in' | 'out';
  quantityMinor: number;
  unitCostMinor?: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  actorId?: string | null;
  allowNegative?: boolean;
}
export function applyStockMovement(db: DB, input: StockMovementInput): string {
  if (input.quantityMinor <= 0) throw new AppError(ERR.VALIDATION, 'পরিমাণ শূন্যের বেশি হতে হবে।');
  const p = db
    .prepare(
      'SELECT id, current_stock_minor, average_cost_minor, unit_id, name, status FROM products WHERE id = ?',
    )
    .get(input.productId) as
    | {
        id: string;
        current_stock_minor: number;
        average_cost_minor: number;
        unit_id: string;
        name: string;
        status: string;
      }
    | undefined;
  if (!p) throw new AppError(ERR.NOT_FOUND, 'প্রোডাক্ট পাওয়া যায়নি।');
  if (p.status !== 'active') throw new AppError(ERR.INVALID_STATE, `${p.name} সক্রিয় নয়।`);
  const delta = input.direction === 'in' ? input.quantityMinor : -input.quantityMinor;
  const balance = p.current_stock_minor + delta;
  if (balance < 0 && !input.allowNegative) {
    throw new AppError(ERR.INSUFFICIENT_STOCK, `${p.name}: পর্যাপ্ত স্টক নেই।`);
  }
  let newAverage = p.average_cost_minor;
  if (input.direction === 'in' && input.unitCostMinor !== undefined) {
    // Weighted average: (oldStock*oldAvg + qty*unitCost) / (oldStock + qty)
    const oldValue = mulDivRound(p.current_stock_minor, p.average_cost_minor, 1000);
    const addedValue = mulDivRound(input.quantityMinor, input.unitCostMinor, 1000);
    const totalQty = p.current_stock_minor + input.quantityMinor;
    newAverage = totalQty > 0 ? mulDivRound(oldValue + addedValue, 1000, totalQty) : input.unitCostMinor;
  }
  const id = uid();
  db.prepare(
    `INSERT INTO stock_movements(id, product_id, direction, quantity_minor, unit_cost_minor,
    reason, reference_type, reference_id, balance_after_minor, actor_id, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.productId,
    input.direction,
    input.quantityMinor,
    input.unitCostMinor ?? p.average_cost_minor,
    normalizeText(input.reason, 120),
    input.referenceType ?? '',
    input.referenceId ?? '',
    balance,
    input.actorId ?? null,
    nowIso(),
  );
  db.prepare(
    'UPDATE products SET current_stock_minor = ?, average_cost_minor = ?, updated_at = ? WHERE id = ?',
  ).run(balance, newAverage, nowIso(), input.productId);
  return id;
}
export function adjustStock(
  db: DB,
  input: {
    productId: string;
    direction: 'in' | 'out';
    quantity: unknown;
    reason: string;
    note?: string;
    actorId?: string | null;
  },
): { movementId: string; adjustmentId: string } {
  const quantityMinor = parseQuantity(input.quantity, 'পরিমাণ');
  const movementId = applyStockMovement(db, {
    productId: input.productId,
    direction: input.direction,
    quantityMinor,
    reason: `স্টক অ্যাডজাস্ট: ${input.reason}`,
    referenceType: 'stock_adjustment',
    actorId: input.actorId,
  });
  const adjustmentId = uid();
  db.prepare(
    `INSERT INTO stock_adjustments(id, product_id, direction, quantity_minor, reason, note, movement_id, actor_id, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    adjustmentId,
    input.productId,
    input.direction,
    quantityMinor,
    normalizeText(input.reason, 120),
    normalizeText(input.note ?? '', 300),
    movementId,
    input.actorId ?? null,
    nowIso(),
  );
  return { movementId, adjustmentId };
}
export function listStockMovements(db: DB, filter: FilterPayload): Page<Record<string, unknown>> {
  const args: unknown[] = [];
  let sql = `SELECT m.*, p.name AS product_name, u.symbol AS unit_symbol FROM stock_movements m
    JOIN products p ON p.id = m.product_id JOIN units u ON u.id = p.unit_id WHERE 1=1`;
  const range = rangeClause(filter, 'm.created_at');
  sql += range.clause;
  args.push(...range.args);
  if (filter.productId) {
    sql += ' AND m.product_id = ?';
    args.push(String(filter.productId));
  }
  if (filter.reason) {
    sql += ' AND m.reason LIKE ?';
    args.push(`%${String(filter.reason)}%`);
  }
  return pagedQuery(db, sql, args, filter, ['m.created_at', 'm.quantity_minor', 'p.name'], 'm.created_at');
}
export interface InventorySummary {
  products: number;
  in_stock: number;
  out_of_stock: number;
  low_stock: number;
  stock_value_minor: number;
}
export function inventorySummary(db: DB): InventorySummary {
  const r = db
    .prepare(
      `SELECT
    COUNT(*) AS products,
    COALESCE(SUM(CASE WHEN current_stock_minor > 0 THEN 1 ELSE 0 END),0) AS in_stock,
    COALESCE(SUM(CASE WHEN current_stock_minor <= 0 THEN 1 ELSE 0 END),0) AS out_of_stock,
    COALESCE(SUM(CASE WHEN current_stock_minor > 0 AND current_stock_minor <= min_stock_minor AND min_stock_minor > 0 THEN 1 ELSE 0 END),0) AS low_stock,
    COALESCE(SUM(current_stock_minor * average_cost_minor / 1000),0) AS stock_value_minor
    FROM products WHERE status='active' AND archived_at IS NULL`,
    )
    .get() as InventorySummary;
  return r;
}
export function lowStockProducts(db: DB, limit = 20): Record<string, unknown>[] {
  return db
    .prepare(
      `SELECT p.id, p.name, p.code, p.current_stock_minor, p.min_stock_minor, u.symbol
    FROM products p JOIN units u ON u.id = p.unit_id
    WHERE p.status='active' AND p.archived_at IS NULL AND p.min_stock_minor > 0
      AND p.current_stock_minor <= p.min_stock_minor ORDER BY p.current_stock_minor ASC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
}
