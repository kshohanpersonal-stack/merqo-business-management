/** Purchase workflow: atomic inventory, cost, supplier ledger and account updates. */
import type { DB } from './db';
import type { FilterPayload, Page } from './types';
import { AppError, ERR } from './errors';
import {
  normalizeText,
  parseMoney,
  parseQuantity,
  mulDivRound,
  applyBps,
  discountFromSpec,
  sumMinor,
} from './money';
import { uid, nowIso, todayIso, pagedQuery, rangeClause, makeIdempotencyKey } from './util';
import { applyStockMovement } from './inventory';
import { applyAccountMovement, applyPartyLedger } from './finance';
import { convertQuantity } from './catalog';
import { getSetting } from './settings';

export interface PurchaseLineInput {
  productId: string;
  quantity: unknown;
  unitId?: string;
  unitPrice: unknown;
  discountType?: 'none' | 'percent' | 'fixed';
  discountValue?: unknown;
  batchNo?: string;
  expiryDate?: string | null;
}
export interface PurchasePaymentInput {
  paymentMethodId: string;
  accountId: string;
  amount: unknown;
  reference?: string;
}
export interface PurchaseInput {
  supplierId?: string | null;
  supplierInvoiceNo?: string;
  purchaseDate?: string;
  lines: PurchaseLineInput[];
  extraCost?: unknown;
  discountType?: 'none' | 'percent' | 'fixed';
  discountValue?: unknown;
  taxRateBps?: number;
  payments?: PurchasePaymentInput[];
  note?: string;
  idempotencyKey?: string;
}
export interface ComputedPurchaseLine {
  productId: string;
  productName: string;
  quantityMinor: number;
  unitId: string;
  unitPriceMinor: number;
  lineGrossMinor: number;
  lineDiscountMinor: number;
  taxMinor: number;
  lineTotalMinor: number;
  unitCostMinor: number;
  batchNo: string | null;
  expiryDate: string | null;
}
export function computePurchase(
  db: DB,
  input: PurchaseInput,
): {
  lines: ComputedPurchaseLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  extraCostMinor: number;
  totalMinor: number;
} {
  if (!input.lines?.length) throw new AppError(ERR.VALIDATION, 'কমপক্ষে একটি পণ্য যোগ করুন।');
  const taxCfg = getSetting<{ enabled?: boolean; rateBps?: number }>(db, 'tax');
  const rateBps = Math.max(
    0,
    Math.min(10000, Number(input.taxRateBps ?? (taxCfg.enabled ? (taxCfg.rateBps ?? 0) : 0))),
  );
  const extraCostMinor = parseMoney(input.extraCost ?? 0, 'অতিরিক্ত খরচ');
  const grossLines: ComputedPurchaseLine[] = [];
  for (const line of input.lines) {
    const product = db
      .prepare(`SELECT p.*, u.base_unit FROM products p JOIN units u ON u.id=p.unit_id WHERE p.id=?`)
      .get(line.productId) as Record<string, unknown> | undefined;
    if (!product) throw new AppError(ERR.NOT_FOUND, 'পণ্য পাওয়া যায়নি।');
    if (product.status !== 'active') throw new AppError(ERR.INVALID_STATE, `${product.name} সক্রিয় নয়।`);
    let quantityMinor = parseQuantity(line.quantity, 'পরিমাণ');
    if (line.unitId && line.unitId !== product.unit_id)
      quantityMinor = convertQuantity(db, line.unitId, String(product.unit_id), quantityMinor);
    const unitPriceMinor = parseMoney(line.unitPrice, 'ক্রয়মূল্য');
    const lineGross = mulDivRound(quantityMinor, unitPriceMinor, 1000);
    const lineDiscount = discountFromSpec(
      lineGross,
      line.discountType ?? 'none',
      Number(line.discountValue ?? 0),
    );
    const tax = rateBps ? applyBps(lineGross - lineDiscount, rateBps) : 0;
    grossLines.push({
      productId: line.productId,
      productName: String(product.name),
      quantityMinor,
      unitId: String(product.unit_id),
      unitPriceMinor,
      lineGrossMinor: lineGross,
      lineDiscountMinor: lineDiscount,
      taxMinor: tax,
      lineTotalMinor: lineGross - lineDiscount + tax,
      unitCostMinor: 0,
      batchNo: normalizeText(line.batchNo ?? '', 60) || null,
      expiryDate: line.expiryDate ?? null,
    });
  }
  const subtotal = sumMinor(grossLines.map((l) => l.lineGrossMinor));
  const lineDiscounts = sumMinor(grossLines.map((l) => l.lineDiscountMinor));
  const cartDiscount = discountFromSpec(
    subtotal - lineDiscounts,
    input.discountType ?? 'none',
    Number(input.discountValue ?? 0),
  );
  // Allocate extra cost proportionally so weighted-average cost includes it.
  for (const l of grossLines) {
    const allocated = subtotal > 0 ? mulDivRound(extraCostMinor, l.lineGrossMinor, subtotal) : 0;
    const net = l.lineGrossMinor - l.lineDiscountMinor + allocated;
    l.unitCostMinor = mulDivRound(net, 1000, l.quantityMinor);
  }
  const discountMinor = lineDiscounts + cartDiscount;
  const taxMinor = sumMinor(grossLines.map((l) => l.taxMinor));
  const total = subtotal - discountMinor + taxMinor + extraCostMinor;
  return {
    lines: grossLines,
    subtotalMinor: subtotal,
    discountMinor,
    taxMinor,
    extraCostMinor,
    totalMinor: total,
  };
}
export function createPurchase(
  db: DB,
  input: PurchaseInput,
  actorId?: string | null,
): {
  id: string;
  invoiceNo: string;
  totalMinor: number;
  paidMinor: number;
  dueMinor: number;
} {
  const key = makeIdempotencyKey('purchase', input.idempotencyKey);
  if (db.prepare('SELECT id FROM purchases WHERE idempotency_key = ?').get(key)) {
    throw new AppError(ERR.CONFLICT, 'এই ক্রয় আগেই সংরক্ষিত হয়েছে।');
  }
  const c = computePurchase(db, input);
  const payments = input.payments ?? [];
  let paidMinor = 0;
  for (const p of payments) {
    const amount = parseMoney(p.amount, 'পেমেন্ট');
    if (amount <= 0) throw new AppError(ERR.VALIDATION, 'পেমেন্ট শূন্যের বেশি হতে হবে।');
    paidMinor += amount;
  }
  if (paidMinor > c.totalMinor)
    throw new AppError(ERR.VALIDATION, 'মোট টাকার চেয়ে বেশি পেমেন্ট দেওয়া যাবে না।');
  const dueMinor = c.totalMinor - paidMinor;
  const supplierId = input.supplierId ?? null;
  if (supplierId && !db.prepare('SELECT id FROM suppliers WHERE id=?').get(supplierId)) {
    throw new AppError(ERR.NOT_FOUND, 'সাপ্লায়ার পাওয়া যায়নি।');
  }
  const id = uid();
  const stamp = nowIso();
  const invoiceNo = `PUR-${stamp.slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
  const purchaseDate = input.purchaseDate ?? todayIso();
  db.prepare(
    `INSERT INTO purchases(id, invoice_no, supplier_id, supplier_invoice_no, purchase_date,
    subtotal_minor, extra_cost_minor, discount_minor, tax_minor, total_minor, paid_minor, due_minor,
    cogs_minor, status, idempotency_key, actor_id, note, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'completed',?,?,?,?)`,
  ).run(
    id,
    invoiceNo,
    supplierId,
    normalizeText(input.supplierInvoiceNo ?? '', 80),
    purchaseDate,
    c.subtotalMinor,
    c.extraCostMinor,
    c.discountMinor,
    c.taxMinor,
    c.totalMinor,
    paidMinor,
    dueMinor,
    sumMinor(c.lines.map((l) => l.lineGrossMinor - l.lineDiscountMinor)),
    key,
    actorId ?? null,
    normalizeText(input.note ?? '', 500),
    stamp,
  );
  for (const l of c.lines) {
    const itemId = uid();
    db.prepare(
      `INSERT INTO purchase_items(id, purchase_id, product_id, product_name, quantity_minor, unit_id,
      unit_price_minor, line_discount_minor, tax_minor, line_total_minor, unit_cost_minor, batch_no,
      expiry_date, received_qty_minor, returned_qty_minor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    ).run(
      itemId,
      id,
      l.productId,
      l.productName,
      l.quantityMinor,
      l.unitId,
      l.unitPriceMinor,
      l.lineDiscountMinor,
      l.taxMinor,
      l.lineTotalMinor,
      l.unitCostMinor,
      l.batchNo,
      l.expiryDate,
      l.quantityMinor,
    );
    applyStockMovement(db, {
      productId: l.productId,
      direction: 'in',
      quantityMinor: l.quantityMinor,
      unitCostMinor: l.unitCostMinor,
      reason: 'ক্রয়',
      referenceType: 'purchase',
      referenceId: id,
      actorId,
    });
    if (l.batchNo) {
      db.prepare(
        `INSERT INTO product_batches(id, product_id, batch_no, expiry_date, quantity_minor, cost_minor, created_at)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(product_id, batch_no) DO UPDATE SET
        quantity_minor = quantity_minor + excluded.quantity_minor`,
      ).run(uid(), l.productId, l.batchNo, l.expiryDate, l.quantityMinor, l.unitCostMinor, stamp);
    }
    const oldPurchasePrice = (
      db.prepare('SELECT purchase_price_minor FROM products WHERE id=?').get(l.productId) as {
        purchase_price_minor: number;
      }
    ).purchase_price_minor;
    if (l.unitPriceMinor !== oldPurchasePrice) {
      db.prepare('UPDATE products SET purchase_price_minor = ?, updated_at = ? WHERE id = ?').run(
        l.unitPriceMinor,
        stamp,
        l.productId,
      );
    }
  }
  for (const p of payments) {
    const amount = parseMoney(p.amount, 'পেমেন্ট');
    const txnId = applyAccountMovement(db, {
      accountId: p.accountId,
      direction: 'out',
      amountMinor: amount,
      kind: 'purchase_payment',
      referenceType: 'purchase',
      referenceId: id,
      idempotencyKey: `${key}-pay-${uid()}`,
      actorId,
      note: `ক্রয় ${invoiceNo}`,
      txnDate: purchaseDate + 'T12:00:00.000Z',
    });
    db.prepare(
      `INSERT INTO purchase_payments(id, purchase_id, payment_method_id, account_id, amount_minor,
      reference, financial_transaction_id, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    ).run(
      uid(),
      id,
      p.paymentMethodId,
      p.accountId,
      amount,
      normalizeText(p.reference ?? '', 100),
      txnId,
      stamp,
    );
  }
  if (supplierId) {
    applyPartyLedger(db, {
      partyType: 'supplier',
      partyId: supplierId,
      kind: 'purchase',
      debitMinor: c.totalMinor,
      creditMinor: paidMinor,
      referenceType: 'purchase',
      referenceId: id,
      idempotencyKey: `${key}-ledger`,
      note: `ক্রয় ${invoiceNo}`,
      actorId,
      txnDate: purchaseDate + 'T12:00:00.000Z',
    });
  }
  return { id, invoiceNo, totalMinor: c.totalMinor, paidMinor, dueMinor };
}
export function listPurchases(db: DB, filter: FilterPayload): Page<Record<string, unknown>> {
  const args: unknown[] = [];
  let sql = `SELECT p.*, s.name AS supplier_name FROM purchases p
    LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE 1=1`;
  const range = rangeClause(filter, 'p.purchase_date');
  sql += range.clause;
  args.push(...range.args);
  if (filter.supplierId) {
    sql += ' AND p.supplier_id = ?';
    args.push(String(filter.supplierId));
  }
  if (filter.search) {
    sql += ' AND (p.invoice_no LIKE ? OR s.name LIKE ? OR p.supplier_invoice_no LIKE ?)';
    const s = `%${String(filter.search)}%`;
    args.push(s, s, s);
  }
  return pagedQuery(
    db,
    sql,
    args,
    filter,
    ['p.purchase_date', 'p.total_minor', 'p.created_at'],
    'p.created_at',
  );
}
export function getPurchase(db: DB, id: string): Record<string, unknown> {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id=?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!purchase) throw new AppError(ERR.NOT_FOUND, 'ক্রয় রেকর্ড পাওয়া যায়নি।');
  const items = db
    .prepare(
      `SELECT i.*, u.name AS unit_name FROM purchase_items i
    JOIN units u ON u.id=i.unit_id WHERE i.purchase_id=?`,
    )
    .all(id);
  const payments = db.prepare('SELECT * FROM purchase_payments WHERE purchase_id=?').all(id);
  return { ...purchase, items, payments };
}
export function returnPurchase(
  db: DB,
  input: {
    purchaseId: string;
    lines: { itemId: string; quantity: unknown }[];
    reason?: string;
    refundAccountId?: string;
    actorId?: string | null;
    idempotencyKey?: string;
  },
): { returnId: string; totalMinor: number } {
  if (!input.lines?.length) throw new AppError(ERR.VALIDATION, 'রিটার্নের পণ্য দিন।');
  const purchase = db.prepare('SELECT * FROM purchases WHERE id=?').get(input.purchaseId) as
    | Record<string, unknown>
    | undefined;
  if (!purchase || purchase.status === 'void') throw new AppError(ERR.NOT_FOUND, 'ক্রয় রেকর্ড পাওয়া যায়নি।');
  const key = makeIdempotencyKey('purchase-return', input.idempotencyKey);
  const returnId = uid();
  const stamp = nowIso();
  db.prepare(
    `INSERT INTO purchase_returns(id, purchase_id, supplier_id, return_date, total_minor, reason,
    idempotency_key, actor_id, created_at) VALUES (?,?,?,?,0,?,?,?,?)`,
  ).run(
    returnId,
    input.purchaseId,
    purchase.supplier_id,
    stamp.slice(0, 10),
    normalizeText(input.reason ?? '', 300),
    key,
    input.actorId ?? null,
    stamp,
  );
  let total = 0;
  for (const line of input.lines) {
    const item = db
      .prepare('SELECT * FROM purchase_items WHERE id=? AND purchase_id=?')
      .get(line.itemId, input.purchaseId) as Record<string, unknown> | undefined;
    if (!item) throw new AppError(ERR.NOT_FOUND, 'ক্রয় আইটেম পাওয়া যায়নি।');
    const qty = parseQuantity(line.quantity, 'রিটার্ন পরিমাণ');
    const remaining = Number(item.received_qty_minor) - Number(item.returned_qty_minor);
    if (qty > remaining) throw new AppError(ERR.VALIDATION, 'রিটার্ন পরিমাণ বেশি।');
    const lineTotal = mulDivRound(qty, Number(item.unit_price_minor), 1000);
    const unitCost = Number(item.unit_cost_minor);
    db.prepare(
      `INSERT INTO purchase_return_items(id, return_id, purchase_item_id, product_id, quantity_minor,
      unit_cost_minor, line_total_minor) VALUES (?,?,?,?,?,?,?)`,
    ).run(uid(), returnId, line.itemId, item.product_id, qty, unitCost, lineTotal);
    db.prepare('UPDATE purchase_items SET returned_qty_minor = returned_qty_minor + ? WHERE id=?').run(
      qty,
      line.itemId,
    );
    // Remove the returned quantity at its original unit cost, then recompute average cost.
    const before = db
      .prepare('SELECT current_stock_minor, average_cost_minor FROM products WHERE id=?')
      .get(item.product_id) as { current_stock_minor: number; average_cost_minor: number };
    applyStockMovement(db, {
      productId: String(item.product_id),
      direction: 'out',
      quantityMinor: qty,
      unitCostMinor: unitCost,
      reason: 'ক্রয় রিটার্ন',
      referenceType: 'purchase_return',
      referenceId: returnId,
      actorId: input.actorId,
    });
    const remainingQty = Math.max(0, before.current_stock_minor - qty);
    if (remainingQty > 0) {
      const oldValue = mulDivRound(before.current_stock_minor, before.average_cost_minor, 1000);
      const removed = mulDivRound(qty, unitCost, 1000);
      const newAvg = mulDivRound(Math.max(0, oldValue - removed), 1000, remainingQty);
      db.prepare('UPDATE products SET average_cost_minor = ? WHERE id = ?').run(newAvg, item.product_id);
    }
    total += lineTotal;
  }
  db.prepare('UPDATE purchase_returns SET total_minor=? WHERE id=?').run(total, returnId);
  db.prepare("UPDATE purchases SET status='partial_return' WHERE id=?").run(input.purchaseId);
  if (purchase.supplier_id) {
    applyPartyLedger(db, {
      partyType: 'supplier',
      partyId: String(purchase.supplier_id),
      kind: 'return',
      debitMinor: 0,
      creditMinor: total,
      referenceType: 'purchase_return',
      referenceId: returnId,
      idempotencyKey: `${key}-ledger`,
      actorId: input.actorId,
      note: 'ক্রয় রিটার্ন',
    });
  }
  if (input.refundAccountId) {
    applyAccountMovement(db, {
      accountId: input.refundAccountId,
      direction: 'in',
      amountMinor: total,
      kind: 'purchase_return_refund',
      referenceType: 'purchase_return',
      referenceId: returnId,
      idempotencyKey: `${key}-refund`,
      actorId: input.actorId,
      note: 'ক্রয় রিটার্ন ফেরত',
    });
  }
  return { returnId, totalMinor: total };
}
