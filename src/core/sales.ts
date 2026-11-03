/** POS sales, invoices, holds, cancellation, returns, refunds and exchange. */
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
  formatMoney,
} from './money';
import { uid, nowIso, todayIso, pagedQuery, rangeClause, makeIdempotencyKey } from './util';
import { applyStockMovement } from './inventory';
import { applyAccountMovement, applyPartyLedger } from './finance';
import { convertQuantity } from './catalog';
import { getSetting, getBusinessProfile } from './settings';

export interface SaleLineInput {
  productId: string;
  quantity: unknown;
  unitId?: string;
  unitPrice?: unknown;
  discountType?: 'none' | 'percent' | 'fixed';
  discountValue?: unknown;
}
export interface SalePaymentInput {
  paymentMethodId: string;
  accountId: string;
  amount: unknown;
  reference?: string;
}
export interface SaleInput {
  customerId?: string | null;
  saleDate?: string;
  lines: SaleLineInput[];
  cartDiscountType?: 'none' | 'percent' | 'fixed';
  cartDiscountValue?: unknown;
  taxRateBps?: number;
  payments?: SalePaymentInput[];
  note?: string;
  idempotencyKey?: string;
  allowPriceOverride?: boolean;
  actorId?: string | null;
}
export interface ComputedSaleLine {
  productId: string;
  productName: string;
  productCode: string;
  quantityMinor: number;
  unitId: string;
  unitSymbol: string;
  unitPriceMinor: number;
  lineGrossMinor: number;
  discountMinor: number;
  taxMinor: number;
  lineTotalMinor: number;
  unitCostMinor: number;
  lineCogsMinor: number;
  availableStockMinor: number;
}
export interface SalePreview {
  lines: ComputedSaleLine[];
  subtotalMinor: number;
  itemDiscountMinor: number;
  cartDiscountMinor: number;
  taxMinor: number;
  totalMinor: number;
  cogsMinor: number;
  grossProfitMinor: number;
  paidMinor: number;
  dueMinor: number;
}
export function computeSale(db: DB, input: SaleInput): SalePreview {
  if (!input.lines?.length) throw new AppError(ERR.VALIDATION, 'কমপক্ষে একটি পণ্য যোগ করুন।');
  const taxCfg = getSetting<{ enabled?: boolean; rateBps?: number }>(db, 'tax');
  const rateBps = Math.max(
    0,
    Math.min(10000, Number(input.taxRateBps ?? (taxCfg.enabled ? (taxCfg.rateBps ?? 0) : 0))),
  );
  const lines: ComputedSaleLine[] = [];
  for (const line of input.lines) {
    const p = db
      .prepare(
        `SELECT p.*, u.symbol AS unit_symbol FROM products p JOIN units u ON u.id=p.unit_id WHERE p.id=?`,
      )
      .get(line.productId) as Record<string, unknown> | undefined;
    if (!p) throw new AppError(ERR.NOT_FOUND, 'পণ্য পাওয়া যায়নি।');
    if (p.status !== 'active') throw new AppError(ERR.INVALID_STATE, `${p.name} সক্রিয় নয়।`);
    let qty = parseQuantity(line.quantity, 'পরিমাণ');
    if (line.unitId && line.unitId !== p.unit_id)
      qty = convertQuantity(db, line.unitId, String(p.unit_id), qty);
    if (qty > Number(p.current_stock_minor)) {
      throw new AppError(
        ERR.INSUFFICIENT_STOCK,
        `${p.name}: স্টকে ${Number(p.current_stock_minor) / 1000} টি আছে।`,
      );
    }
    const price =
      line.unitPrice === undefined
        ? Number(p.selling_price_minor)
        : parseMoney(line.unitPrice, 'বিক্রয়মূল্য');
    if (price !== Number(p.selling_price_minor) && !input.allowPriceOverride) {
      throw new AppError(ERR.FORBIDDEN, 'দাম পরিবর্তনের অনুমতি নেই।');
    }
    const gross = mulDivRound(qty, price, 1000);
    // An explicit line discount overrides the product's configured discount;
    // otherwise the product-level discount (stored as bps / minor units) applies.
    const explicit = Boolean(line.discountType && line.discountType !== 'none');
    const productDiscountType = String(p.discount_type ?? 'none') as 'none' | 'percent' | 'fixed';
    const discountType = explicit ? line.discountType! : productDiscountType;
    let discountValue: number | string = Number(line.discountValue ?? 0);
    if (!explicit && productDiscountType === 'percent') discountValue = Number(p.discount_value ?? 0) / 100;
    if (!explicit && productDiscountType === 'fixed')
      discountValue = (Number(p.discount_value ?? 0) / 100).toFixed(2);
    const discount = discountFromSpec(gross, discountType ?? 'none', discountValue);
    const tax = rateBps ? applyBps(gross - discount, rateBps) : 0;
    const unitCost = Number(p.average_cost_minor);
    const cogs = mulDivRound(qty, unitCost, 1000);
    lines.push({
      productId: String(p.id),
      productName: String(p.name),
      productCode: String(p.code),
      quantityMinor: qty,
      unitId: String(p.unit_id),
      unitSymbol: String(p.unit_symbol),
      unitPriceMinor: price,
      lineGrossMinor: gross,
      discountMinor: discount,
      taxMinor: tax,
      lineTotalMinor: gross,
      unitCostMinor: unitCost,
      lineCogsMinor: cogs,
      availableStockMinor: Number(p.current_stock_minor),
    });
  }
  const subtotal = sumMinor(lines.map((l) => l.lineGrossMinor));
  const itemDiscount = sumMinor(lines.map((l) => l.discountMinor));
  const cartDiscount = discountFromSpec(
    subtotal - itemDiscount,
    input.cartDiscountType ?? 'none',
    Number(input.cartDiscountValue ?? 0),
  );
  const tax = rateBps ? applyBps(subtotal - itemDiscount - cartDiscount, rateBps) : 0;
  const total = subtotal - itemDiscount - cartDiscount + tax;
  const cogs = sumMinor(lines.map((l) => l.lineCogsMinor));
  let paid = 0;
  for (const p of input.payments ?? []) {
    const amount = parseMoney(p.amount, 'পেমেন্ট');
    if (amount <= 0) throw new AppError(ERR.VALIDATION, 'পেমেন্ট শূন্যের বেশি হতে হবে।');
    paid += amount;
  }
  if (paid > total) throw new AppError(ERR.VALIDATION, 'মোট টাকার চেয়ে বেশি পেমেন্ট দেওয়া যাবে না।');
  return {
    lines,
    subtotalMinor: subtotal,
    itemDiscountMinor: itemDiscount,
    cartDiscountMinor: cartDiscount,
    taxMinor: tax,
    totalMinor: total,
    cogsMinor: cogs,
    grossProfitMinor: subtotal - itemDiscount - cartDiscount - cogs,
    paidMinor: paid,
    dueMinor: total - paid,
  };
}
export function completeSale(
  db: DB,
  input: SaleInput,
  actorId?: string | null,
): {
  id: string;
  invoiceNo: string;
  preview: SalePreview;
  invoice: Record<string, unknown>;
} {
  actorId = actorId ?? input.actorId ?? null;
  const key = makeIdempotencyKey('sale', input.idempotencyKey);
  if (db.prepare('SELECT id FROM sales WHERE idempotency_key = ?').get(key)) {
    throw new AppError(ERR.CONFLICT, 'এই সেল আগেই সম্পন্ন হয়েছে।');
  }
  const preview = computeSale(db, input);
  const customerId = input.customerId || 'customer-walk-in';
  if (!db.prepare('SELECT id FROM customers WHERE id=?').get(customerId)) {
    throw new AppError(ERR.NOT_FOUND, 'কাস্টমার পাওয়া যায়নি।');
  }
  const stamp = nowIso();
  const saleDate = input.saleDate ?? todayIso();
  const id = uid();
  const invoiceNo = `INV-${stamp.slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
  db.prepare(
    `INSERT INTO sales(id, invoice_no, customer_id, sale_date, status, subtotal_minor,
    item_discount_minor, cart_discount_minor, tax_minor, total_minor, paid_minor, due_minor,
    cogs_minor, gross_profit_minor, idempotency_key, user_id, note, created_at)
    VALUES (?,?,?,?,'completed',?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    invoiceNo,
    customerId,
    saleDate,
    preview.subtotalMinor,
    preview.itemDiscountMinor,
    preview.cartDiscountMinor,
    preview.taxMinor,
    preview.totalMinor,
    preview.paidMinor,
    preview.dueMinor,
    preview.cogsMinor,
    preview.grossProfitMinor,
    key,
    actorId ?? null,
    normalizeText(input.note ?? '', 500),
    stamp,
  );
  for (const l of preview.lines) {
    db.prepare(
      `INSERT INTO sale_items(id, sale_id, product_id, product_name, quantity_minor, unit_id,
      unit_price_minor, unit_cost_minor, discount_minor, tax_minor, line_total_minor, line_cogs_minor, returned_qty_minor)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    ).run(
      uid(),
      id,
      l.productId,
      l.productName,
      l.quantityMinor,
      l.unitId,
      l.unitPriceMinor,
      l.unitCostMinor,
      l.discountMinor,
      l.taxMinor,
      l.lineTotalMinor,
      l.lineCogsMinor,
    );
    applyStockMovement(db, {
      productId: l.productId,
      direction: 'out',
      quantityMinor: l.quantityMinor,
      unitCostMinor: l.unitCostMinor,
      reason: 'সেল',
      referenceType: 'sale',
      referenceId: id,
      actorId,
    });
  }
  for (const p of input.payments ?? []) {
    const amount = parseMoney(p.amount, 'পেমেন্ট');
    const txnId = applyAccountMovement(db, {
      accountId: p.accountId,
      direction: 'in',
      amountMinor: amount,
      kind: 'sale_payment',
      referenceType: 'sale',
      referenceId: id,
      idempotencyKey: `${key}-pay-${uid()}`,
      actorId,
      txnDate: saleDate + 'T12:00:00.000Z',
      note: `সেল ${invoiceNo}`,
    });
    db.prepare(
      `INSERT INTO sale_payments(id, sale_id, payment_method_id, account_id, amount_minor,
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
  applyPartyLedger(db, {
    partyType: 'customer',
    partyId: customerId,
    kind: 'invoice',
    debitMinor: preview.totalMinor,
    creditMinor: preview.paidMinor,
    referenceType: 'sale',
    referenceId: id,
    idempotencyKey: `${key}-ledger`,
    actorId,
    txnDate: saleDate + 'T12:00:00.000Z',
    note: `ইনভয়েস ${invoiceNo}`,
  });
  const invoice = buildInvoicePayload(db, id, invoiceNo, preview, saleDate);
  db.prepare(
    `INSERT INTO invoices(id, sale_id, invoice_no, payload_json, footer, created_at) VALUES (?,?,?,?,?,?)`,
  ).run(uid(), id, invoiceNo, JSON.stringify(invoice), String(invoice.footer ?? ''), stamp);
  return { id, invoiceNo, preview, invoice };
}
export function buildInvoicePayload(
  db: DB,
  saleId: string,
  invoiceNo: string,
  preview: SalePreview,
  saleDate: string,
): Record<string, unknown> {
  const profile = getBusinessProfile(db);
  return {
    type: 'MERQO-INVOICE-1',
    invoiceNo,
    date: saleDate,
    time: nowIso().slice(11, 19),
    business: {
      name: profile.business_name || profile.business_name_en || 'আপনার ব্যবসা',
      address: profile.address,
      phone: profile.phone,
      email: profile.email,
      logoPath: profile.logo_path,
      taxRegistration: profile.tax_registration,
    },
    customer:
      (db
        .prepare(
          'SELECT name, phone, address FROM customers WHERE id=(SELECT customer_id FROM sales WHERE id=?)',
        )
        .get(saleId) as Record<string, unknown> | undefined) ?? {},
    lines: preview.lines.map((l) => ({
      name: l.productName,
      code: l.productCode,
      quantity: l.quantityMinor / 1000,
      unit: l.unitSymbol,
      unitPrice: l.unitPriceMinor / 100,
      discount: l.discountMinor / 100,
      lineTotal: (l.lineTotalMinor - l.discountMinor) / 100,
    })),
    subtotal: preview.subtotalMinor / 100,
    itemDiscount: preview.itemDiscountMinor / 100,
    cartDiscount: preview.cartDiscountMinor / 100,
    tax: preview.taxMinor / 100,
    total: preview.totalMinor / 100,
    paid: preview.paidMinor / 100,
    due: preview.dueMinor / 100,
    footer: profile.invoice_footer,
    thankYou: 'ধন্যবাদ!',
    // No MERQO software branding appears anywhere in the customer document.
  };
}
export function listSales(db: DB, filter: FilterPayload): Page<Record<string, unknown>> {
  const args: unknown[] = [];
  let sql = `SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE 1=1`;
  const range = rangeClause(filter, 's.sale_date');
  sql += range.clause;
  args.push(...range.args);
  if (filter.customerId) {
    sql += ' AND s.customer_id = ?';
    args.push(String(filter.customerId));
  }
  if (filter.status) {
    sql += ' AND s.status = ?';
    args.push(String(filter.status));
  }
  if (filter.search) {
    sql += ' AND (s.invoice_no LIKE ? OR c.name LIKE ?)';
    const p = `%${String(filter.search)}%`;
    args.push(p, p);
  }
  return pagedQuery(
    db,
    sql,
    args,
    filter,
    ['s.sale_date', 's.total_minor', 's.created_at', 's.invoice_no'],
    's.created_at',
  );
}
export function getSale(db: DB, id: string): Record<string, unknown> {
  const sale = db
    .prepare(
      `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone FROM sales s
    LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!sale) throw new AppError(ERR.NOT_FOUND, 'সেল রেকর্ড পাওয়া যায়নি।');
  const items = db
    .prepare(
      `SELECT i.*, u.symbol AS unit_symbol FROM sale_items i JOIN units u ON u.id=i.unit_id WHERE i.sale_id=?`,
    )
    .all(id);
  const payments = db
    .prepare(
      `SELECT sp.*, pm.name AS payment_method_name FROM sale_payments sp
    JOIN payment_methods pm ON pm.id=sp.payment_method_id WHERE sp.sale_id=?`,
    )
    .all(id);
  const invoice = db.prepare('SELECT * FROM invoices WHERE sale_id=?').get(id);
  return { ...sale, items, payments, invoice };
}
export function getInvoice(db: DB, saleId: string): Record<string, unknown> {
  const row = db.prepare('SELECT * FROM invoices WHERE sale_id=?').get(saleId) as
    | { payload_json: string; printed_count: number }
    | undefined;
  if (!row) throw new AppError(ERR.NOT_FOUND, 'ইনভয়েস পাওয়া যায়নি।');
  return { ...(JSON.parse(row.payload_json) as Record<string, unknown>), printedCount: row.printed_count };
}
export function incrementPrintCount(db: DB, saleId: string): number {
  const r = db.prepare('UPDATE invoices SET printed_count = printed_count + 1 WHERE sale_id=?').run(saleId);
  if (!r.changes) throw new AppError(ERR.NOT_FOUND, 'ইনভয়েস পাওয়া যায়নি।');
  return (
    db.prepare('SELECT printed_count FROM invoices WHERE sale_id=?').get(saleId) as { printed_count: number }
  ).printed_count;
}
export function holdSale(db: DB, input: { cart: unknown; note?: string; actorId?: string | null }): string {
  const id = uid();
  const reference = `HOLD-${Date.now().toString().slice(-8)}`;
  db.prepare(
    'INSERT INTO held_sales(id, reference, payload_json, user_id, note, created_at) VALUES (?,?,?,?,?,?)',
  ).run(
    id,
    reference,
    JSON.stringify(input.cart),
    input.actorId ?? null,
    normalizeText(input.note ?? '', 300),
    nowIso(),
  );
  return reference;
}
export function listHeldSales(db: DB): Record<string, unknown>[] {
  return db
    .prepare('SELECT id, reference, note, created_at, payload_json FROM held_sales ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
}
export function resumeSale(db: DB, reference: string): Record<string, unknown> {
  const row = db.prepare('SELECT * FROM held_sales WHERE reference=?').get(reference) as
    | { payload_json: string }
    | undefined;
  if (!row) throw new AppError(ERR.NOT_FOUND, 'হোল্ড করা সেল পাওয়া যায়নি।');
  return JSON.parse(row.payload_json) as Record<string, unknown>;
}
export function removeHeldSale(db: DB, reference: string): void {
  db.prepare('DELETE FROM held_sales WHERE reference=?').run(reference);
}
export function cancelSale(
  db: DB,
  input: {
    saleId: string;
    reason: string;
    actorId?: string | null;
    idempotencyKey?: string;
  },
): void {
  const sale = db.prepare('SELECT * FROM sales WHERE id=?').get(input.saleId) as
    | Record<string, unknown>
    | undefined;
  if (!sale) throw new AppError(ERR.NOT_FOUND, 'সেল রেকর্ড পাওয়া যায়নি।');
  if (sale.status === 'cancelled') throw new AppError(ERR.INVALID_STATE, 'এই সেল আগেই বাতিল হয়েছে।');
  const key = makeIdempotencyKey('sale-cancel', input.idempotencyKey);
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id=?').all(input.saleId) as Record<
    string,
    unknown
  >[];
  for (const item of items) {
    const qty = Number(item.quantity_minor) - Number(item.returned_qty_minor);
    if (qty > 0)
      applyStockMovement(db, {
        productId: String(item.product_id),
        direction: 'in',
        quantityMinor: qty,
        unitCostMinor: Number(item.unit_cost_minor),
        reason: 'সেল বাতিল',
        referenceType: 'sale_cancel',
        referenceId: input.saleId,
        actorId: input.actorId,
      });
  }
  const payments = db.prepare('SELECT * FROM sale_payments WHERE sale_id=?').all(input.saleId) as Record<
    string,
    unknown
  >[];
  for (const p of payments) {
    applyAccountMovement(db, {
      accountId: String(p.account_id),
      direction: 'out',
      amountMinor: Number(p.amount_minor),
      kind: 'sale_cancel_refund',
      referenceType: 'sale_cancel',
      referenceId: input.saleId,
      idempotencyKey: `${key}-rev-${uid()}`,
      actorId: input.actorId,
      note: 'সেল বাতিল ফেরত',
    });
  }
  const due = Number(sale.due_minor);
  if (due > 0) {
    applyPartyLedger(db, {
      partyType: 'customer',
      partyId: String(sale.customer_id),
      kind: 'adjustment',
      debitMinor: 0,
      creditMinor: due,
      referenceType: 'sale_cancel',
      referenceId: input.saleId,
      idempotencyKey: `${key}-ledger`,
      actorId: input.actorId,
      note: 'সেল বাতিল: বাকি বাদ',
    });
  }
  db.prepare("UPDATE sales SET status='cancelled', cancelled_at=?, cancel_reason=? WHERE id=?").run(
    nowIso(),
    normalizeText(input.reason, 300),
    input.saleId,
  );
}
export function returnSale(
  db: DB,
  input: {
    saleId: string;
    lines: { itemId: string; quantity: unknown }[];
    reason?: string;
    mode: 'refund' | 'adjust_due';
    refundAccountId?: string;
    actorId?: string | null;
    idempotencyKey?: string;
  },
): { returnId: string; totalMinor: number; cogsReversalMinor: number } {
  if (!input.lines?.length) throw new AppError(ERR.VALIDATION, 'রিটার্নের পণ্য দিন।');
  const sale = db.prepare('SELECT * FROM sales WHERE id=?').get(input.saleId) as
    | Record<string, unknown>
    | undefined;
  if (!sale || sale.status === 'cancelled') throw new AppError(ERR.NOT_FOUND, 'সেল রেকর্ড পাওয়া যায়নি।');
  if (input.mode === 'refund' && !input.refundAccountId)
    throw new AppError(ERR.VALIDATION, 'রিফান্ড অ্যাকাউন্ট দিন।');
  const key = makeIdempotencyKey('sale-return', input.idempotencyKey);
  const returnId = uid();
  const stamp = nowIso();
  // Insert the parent first so child rows satisfy the foreign key immediately.
  db.prepare(
    `INSERT INTO sales_returns(id, sale_id, customer_id, return_date, total_minor,
    cogs_reversal_minor, reason, idempotency_key, actor_id, created_at) VALUES (?,?,?,?,0,0,?,?,?,?)`,
  ).run(
    returnId,
    input.saleId,
    sale.customer_id,
    stamp.slice(0, 10),
    normalizeText(input.reason ?? '', 300),
    key,
    input.actorId ?? null,
    stamp,
  );
  let total = 0,
    cogsReversal = 0;
  for (const line of input.lines) {
    const item = db
      .prepare('SELECT * FROM sale_items WHERE id=? AND sale_id=?')
      .get(line.itemId, input.saleId) as Record<string, unknown> | undefined;
    if (!item) throw new AppError(ERR.NOT_FOUND, 'সেল আইটেম পাওয়া যায়নি।');
    const qty = parseQuantity(line.quantity, 'রিটার্ন পরিমাণ');
    const remaining = Number(item.quantity_minor) - Number(item.returned_qty_minor);
    if (qty > remaining) throw new AppError(ERR.VALIDATION, `${item.product_name}: রিটার্ন পরিমাণ বেশি।`);
    const lineTotal = mulDivRound(qty, Number(item.unit_price_minor), 1000);
    const lineCogs = mulDivRound(qty, Number(item.unit_cost_minor), 1000);
    db.prepare(
      `INSERT INTO sales_return_items(id, return_id, sale_item_id, product_id, quantity_minor,
      unit_price_minor, unit_cost_minor, line_total_minor) VALUES (?,?,?,?,?,?,?,?)`,
    ).run(
      uid(),
      returnId,
      line.itemId,
      item.product_id,
      qty,
      item.unit_price_minor,
      item.unit_cost_minor,
      lineTotal,
    );
    db.prepare('UPDATE sale_items SET returned_qty_minor = returned_qty_minor + ? WHERE id=?').run(
      qty,
      line.itemId,
    );
    applyStockMovement(db, {
      productId: String(item.product_id),
      direction: 'in',
      quantityMinor: qty,
      unitCostMinor: Number(item.unit_cost_minor),
      reason: 'সেল রিটার্ন',
      referenceType: 'sales_return',
      referenceId: returnId,
      actorId: input.actorId,
    });
    total += lineTotal;
    cogsReversal += lineCogs;
  }
  db.prepare('UPDATE sales_returns SET total_minor=?, cogs_reversal_minor=? WHERE id=?').run(
    total,
    cogsReversal,
    returnId,
  );
  db.prepare("UPDATE sales SET status='partial_return' WHERE id=?").run(input.saleId);
  if (input.mode === 'adjust_due') {
    applyPartyLedger(db, {
      partyType: 'customer',
      partyId: String(sale.customer_id),
      kind: 'return',
      debitMinor: 0,
      creditMinor: total,
      referenceType: 'sales_return',
      referenceId: returnId,
      idempotencyKey: `${key}-ledger`,
      actorId: input.actorId,
      note: 'সেল রিটার্ন: বাকি কমানো',
    });
  } else {
    const refundId = uid();
    const txnId = applyAccountMovement(db, {
      accountId: input.refundAccountId!,
      direction: 'out',
      amountMinor: total,
      kind: 'refund',
      referenceType: 'refund',
      referenceId: refundId,
      idempotencyKey: `${key}-refund`,
      actorId: input.actorId,
      note: 'সেল রিটার্ন রিফান্ড',
    });
    db.prepare(
      `INSERT INTO refunds(id, sale_id, return_id, amount_minor, account_id,
      financial_transaction_id, reason, idempotency_key, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      refundId,
      input.saleId,
      returnId,
      total,
      input.refundAccountId!,
      txnId,
      normalizeText(input.reason ?? '', 300),
      `${key}-refund-row`,
      input.actorId ?? null,
      stamp,
    );
  }
  return { returnId, totalMinor: total, cogsReversalMinor: cogsReversal };
}
export function exchangeSale(
  db: DB,
  input: {
    saleId: string;
    returnLines: { itemId: string; quantity: unknown }[];
    reason?: string;
    replacementLines: SaleLineInput[];
    payments?: SalePaymentInput[];
    actorId?: string | null;
    idempotencyKey?: string;
  },
): { returnId: string; replacementSaleId: string } {
  const returned = returnSale(db, {
    saleId: input.saleId,
    lines: input.returnLines,
    reason: input.reason,
    mode: 'adjust_due',
    actorId: input.actorId,
  });
  const replacement = completeSale(db, {
    lines: input.replacementLines,
    payments: input.payments ?? [],
    note: `বদল: ${input.reason ?? ''}`,
    actorId: input.actorId,
    allowPriceOverride: true,
  });
  db.prepare(
    `INSERT INTO exchanges(id, sale_id, return_id, replacement_sale_id, note, actor_id, created_at)
    VALUES (?,?,?,?,?,?,?)`,
  ).run(
    uid(),
    input.saleId,
    returned.returnId,
    replacement.id,
    normalizeText(input.reason ?? '', 300),
    input.actorId ?? null,
    nowIso(),
  );
  return { returnId: returned.returnId, replacementSaleId: replacement.id };
}
export function receiptText(db: DB, saleId: string): string {
  const invoice = getInvoice(db, saleId);
  const lines = invoice.lines as { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  const business = invoice.business as Record<string, unknown> | undefined;
  const out = [
    String((business && business.name) ?? 'আপনার ব্যবসা'),
    `ইনভয়েস: ${invoice.invoiceNo}`,
    `তারিখ: ${invoice.date}`,
    '--------------------------------',
  ];
  for (const l of lines) out.push(`${l.name}  ${l.quantity} x ${l.unitPrice} = ${l.lineTotal}`);
  out.push(
    '--------------------------------',
    `মোট: ${formatMoney(Math.round(Number(invoice.total) * 100))}`,
    `পরিশোধ: ${formatMoney(Math.round(Number(invoice.paid) * 100))}`,
    `বাকি: ${formatMoney(Math.round(Number(invoice.due) * 100))}`,
    String(invoice.footer ?? ''),
  );
  return out.join('\n');
}
