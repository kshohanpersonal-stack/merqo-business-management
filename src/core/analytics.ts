/** Dashboard analytics — every figure comes from real database rows. */
import type { DB } from './db';
import type { FilterPayload } from './types';
import { todayIso } from './util';
import { getSetting } from './settings';

export function greeting(at = new Date()): string {
  const h = at.getHours();
  if (h < 12) return 'শুভ সকাল।';
  if (h < 16) return 'শুভ দুপুর।';
  if (h < 19) return 'শুভ বিকেল।';
  return 'শুভ রাত্রি।';
}
function one(db: DB, sql: string, args: unknown[] = []): number {
  return Number((db.prepare(sql).get(...args) as { n: number | null }).n ?? 0);
}
export function getDashboard(db: DB, filter: FilterPayload = {}): Record<string, unknown> {
  const from = String(filter.from ?? todayIso());
  const to = String(filter.to ?? todayIso());
  const a = [from, to];
  const sales = one(
    db,
    `SELECT COALESCE(SUM(total_minor),0) AS n FROM sales
    WHERE status <> 'cancelled' AND sale_date BETWEEN ? AND ?`,
    a,
  );
  const purchases = one(
    db,
    'SELECT COALESCE(SUM(total_minor),0) AS n FROM purchases WHERE purchase_date BETWEEN ? AND ?',
    a,
  );
  const grossProfit = one(
    db,
    `SELECT COALESCE(SUM(gross_profit_minor),0) AS n FROM sales
    WHERE status <> 'cancelled' AND sale_date BETWEEN ? AND ?`,
    a,
  );
  const expenses = one(
    db,
    `SELECT COALESCE(SUM(amount_minor),0) AS n FROM expenses
    WHERE voided_at IS NULL AND expense_date BETWEEN ? AND ?`,
    a,
  );
  const otherIncome = one(
    db,
    `SELECT COALESCE(SUM(amount_minor),0) AS n FROM financial_transactions
    WHERE kind='other_income' AND substr(txn_date,1,10) BETWEEN ? AND ?`,
    a,
  );
  const customerDue = one(
    db,
    'SELECT COALESCE(SUM(balance_minor),0) AS n FROM customers WHERE archived_at IS NULL',
  );
  const supplierDue = one(
    db,
    'SELECT COALESCE(SUM(balance_minor),0) AS n FROM suppliers WHERE archived_at IS NULL',
  );
  const byType = (type: string) =>
    one(db, `SELECT COALESCE(SUM(balance_minor),0) AS n FROM accounts WHERE type=? AND archived_at IS NULL`, [
      type,
    ]);
  const productRows = db
    .prepare(
      `SELECT COUNT(*) AS products,
    COALESCE(SUM(CASE WHEN current_stock_minor > 0 THEN 1 ELSE 0 END),0) AS in_stock,
    COALESCE(SUM(CASE WHEN current_stock_minor <= 0 THEN 1 ELSE 0 END),0) AS out_of_stock,
    COALESCE(SUM(CASE WHEN current_stock_minor > 0 AND current_stock_minor <= min_stock_minor AND min_stock_minor > 0 THEN 1 ELSE 0 END),0) AS low_stock
    FROM products WHERE archived_at IS NULL`,
    )
    .get() as Record<string, number>;
  const transactionCount = one(
    db,
    `SELECT
    (SELECT COUNT(*) FROM sales WHERE sale_date BETWEEN ? AND ?) +
    (SELECT COUNT(*) FROM purchases WHERE purchase_date BETWEEN ? AND ?) +
    (SELECT COUNT(*) FROM financial_transactions WHERE substr(txn_date,1,10) BETWEEN ? AND ?) AS n`,
    [...a, ...a, ...a],
  );
  const dailySeries = db
    .prepare(
      `SELECT sale_date AS label, SUM(total_minor) AS sales_minor,
    SUM(gross_profit_minor) AS profit_minor FROM sales WHERE status <> 'cancelled'
    AND sale_date BETWEEN ? AND ? GROUP BY sale_date ORDER BY sale_date`,
    )
    .all(from, to) as Record<string, unknown>[];
  const weeklySeries = db
    .prepare(
      `SELECT strftime('%Y-W%W', sale_date) AS label, SUM(total_minor) AS sales_minor,
    SUM(gross_profit_minor) AS profit_minor FROM sales WHERE status <> 'cancelled'
    GROUP BY label ORDER BY label DESC LIMIT 8`,
    )
    .all()
    .reverse() as Record<string, unknown>[];
  const monthlySeries = db
    .prepare(
      `SELECT substr(sale_date,1,7) AS label, SUM(total_minor) AS sales_minor,
    SUM(gross_profit_minor) AS profit_minor FROM sales WHERE status <> 'cancelled'
    GROUP BY label ORDER BY label DESC LIMIT 12`,
    )
    .all()
    .reverse() as Record<string, unknown>[];
  const annualSeries = db
    .prepare(
      `SELECT substr(sale_date,1,4) AS label, SUM(total_minor) AS sales_minor,
    SUM(gross_profit_minor) AS profit_minor FROM sales WHERE status <> 'cancelled'
    GROUP BY label ORDER BY label DESC LIMIT 5`,
    )
    .all()
    .reverse() as Record<string, unknown>[];
  const topSelling = db
    .prepare(
      `SELECT i.product_name AS name, SUM(i.quantity_minor) AS qty_minor,
    SUM(i.line_total_minor - i.discount_minor) AS revenue_minor FROM sale_items i
    JOIN sales s ON s.id=i.sale_id WHERE s.status <> 'cancelled' AND s.sale_date BETWEEN ? AND ?
    GROUP BY i.product_id ORDER BY qty_minor DESC LIMIT 8`,
    )
    .all(from, to);
  const slowMoving = db
    .prepare(
      `SELECT p.name, p.code, p.current_stock_minor,
    COALESCE((SELECT SUM(i.quantity_minor) FROM sale_items i JOIN sales s ON s.id=i.sale_id
      WHERE i.product_id=p.id AND s.status <> 'cancelled' AND s.sale_date BETWEEN ? AND ?),0) AS sold_qty_minor
    FROM products p WHERE p.archived_at IS NULL ORDER BY sold_qty_minor ASC LIMIT 8`,
    )
    .all(from, to);
  const mostProfitable = db
    .prepare(
      `SELECT i.product_name AS name,
    SUM(i.line_total_minor - i.discount_minor - i.line_cogs_minor) AS profit_minor
    FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.status <> 'cancelled'
    AND s.sale_date BETWEEN ? AND ? GROUP BY i.product_id ORDER BY profit_minor DESC LIMIT 8`,
    )
    .all(from, to);
  const recentSales = db
    .prepare(
      `SELECT s.id, s.invoice_no, s.total_minor, s.sale_date, c.name AS customer_name
    FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.created_at DESC LIMIT 8`,
    )
    .all();
  const recentPurchases = db
    .prepare(
      `SELECT p.id, p.invoice_no, p.total_minor, p.purchase_date, sp.name AS supplier_name
    FROM purchases p LEFT JOIN suppliers sp ON sp.id=p.supplier_id ORDER BY p.created_at DESC LIMIT 8`,
    )
    .all();
  const recentPayments = db
    .prepare(
      `SELECT f.id, f.kind, f.amount_minor, f.direction, f.txn_date, a.name AS account_name
    FROM financial_transactions f JOIN accounts a ON a.id=f.account_id ORDER BY f.created_at DESC LIMIT 8`,
    )
    .all();
  const dueCollections = db
    .prepare(
      `SELECT l.id, l.txn_date, l.credit_minor, c.name AS customer_name
    FROM party_ledger l JOIN customers c ON c.id=l.party_id
    WHERE l.party_type='customer' AND l.kind='payment' ORDER BY l.created_at DESC LIMIT 8`,
    )
    .all();
  const recentActivities = db
    .prepare(
      `SELECT id, actor_name, action, entity, created_at FROM audit_logs
    ORDER BY created_at DESC LIMIT 10`,
    )
    .all();
  return {
    period: { from, to },
    greeting: greeting(),
    kpis: {
      todaySales: sales,
      todayPurchases: purchases,
      grossProfit,
      netProfit: grossProfit - expenses + otherIncome,
      todayExpenses: expenses,
      otherIncome,
      customerDue,
      supplierDue,
      cashBalance: byType('cash'),
      bankBalance: byType('bank'),
      mobileBalance: byType('mobile'),
      otherBalances: byType('custom') + byType('other'),
      totalProducts: productRows.products ?? 0,
      inStock: productRows.in_stock ?? 0,
      lowStock: productRows.low_stock ?? 0,
      outOfStock: productRows.out_of_stock ?? 0,
      transactionCount,
    },
    dailySalesOverview: dailySeries,
    weeklySalesOverview: weeklySeries,
    monthlySalesOverview: monthlySeries,
    annualSalesOverview: annualSeries,
    salesChart: dailySeries,
    profitChart: dailySeries,
    topSellingProducts: topSelling,
    slowMovingProducts: slowMoving,
    mostProfitableProducts: mostProfitable,
    recentSales,
    recentPurchases,
    recentPayments,
    dueCollections,
    recentActivities,
    quickActions: [
      { key: 'pos', label: 'নতুন সেল', permission: 'sale.create' },
      { key: 'product', label: 'প্রোডাক্ট যোগ', permission: 'product.manage' },
      { key: 'purchase', label: 'নতুন ক্রয়', permission: 'purchase.manage' },
      { key: 'due', label: 'বাকি আদায়', permission: 'payment.manage' },
      { key: 'report', label: 'রিপোর্ট', permission: 'report.view' },
    ],
    lowStockAlerts: db
      .prepare(
        `SELECT id, name, current_stock_minor, min_stock_minor FROM products
      WHERE archived_at IS NULL AND status='active' AND min_stock_minor > 0 AND current_stock_minor <= min_stock_minor ORDER BY current_stock_minor ASC LIMIT 10`,
      )
      .all(),
    settings: {
      banglaDigits: Boolean(getSetting<{ banglaDigits?: boolean }>(db, 'numberFormat').banglaDigits),
    },
  };
}
