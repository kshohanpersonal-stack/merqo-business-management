/** Report descriptor registry: 28 report families, real SQL, filters, pagination, totals. */
import type { DB } from './db';
import type { FilterPayload, Page } from './types';
import { AppError, ERR } from './errors';
import { pagedQuery } from './util';

export interface ReportDef {
  key: string;
  title: string;
  titleEn: string;
  group: string;
  moneyColumns?: string[];
  dateColumn?: string;
  sortable: string[];
  defaultSort: string;
  build(filter: FilterPayload): { sql: string; args: unknown[] };
}
const dateFilter = (column: string, f: FilterPayload): { clause: string; args: unknown[] } => {
  const args: unknown[] = [];
  const parts: string[] = [];
  if (f.from) {
    parts.push(`${column} >= ?`);
    args.push(f.from);
  }
  if (f.to) {
    parts.push(`${column} <= ?`);
    args.push(f.to);
  }
  return { clause: parts.length ? ' AND ' + parts.join(' AND ') : '', args };
};
const search = (columns: string[], f: FilterPayload): { clause: string; args: unknown[] } => {
  if (!f.search) return { clause: '', args: [] };
  const p = `%${String(f.search).slice(0, 100)}%`;
  return {
    clause: ' AND (' + columns.map((c) => `${c} LIKE ?`).join(' OR ') + ')',
    args: columns.map(() => p),
  };
};
const optional = (column: string, value: unknown): { clause: string; args: unknown[] } =>
  value ? { clause: ` AND ${column} = ?`, args: [String(value)] } : { clause: '', args: [] };

export const REPORTS: ReportDef[] = [
  {
    key: 'daily-sales',
    title: 'দৈনিক সেল রিপোর্ট',
    titleEn: 'Daily sales',
    group: 'sales',
    moneyColumns: ['total_minor', 'cogs_minor', 'gross_profit_minor'],
    sortable: ['period', 'total_minor', 'invoice_count'],
    defaultSort: 'period',
    build: (f) => {
      const d = dateFilter('sale_date', f);
      return {
        sql: `SELECT sale_date AS period, COUNT(*) AS invoice_count, SUM(total_minor) AS total_minor, SUM(cogs_minor) AS cogs_minor, SUM(gross_profit_minor) AS gross_profit_minor FROM sales WHERE status <> 'cancelled'${d.clause} GROUP BY sale_date`,
        args: d.args,
      };
    },
  },
  {
    key: 'weekly-sales',
    title: 'সাপ্তাহিক সেল রিপোর্ট',
    titleEn: 'Weekly sales',
    group: 'sales',
    moneyColumns: ['total_minor', 'gross_profit_minor'],
    sortable: ['period', 'total_minor'],
    defaultSort: 'period',
    build: (f) => {
      const d = dateFilter('sale_date', f);
      return {
        sql: `SELECT strftime('%Y-W%W', sale_date) AS period, COUNT(*) AS invoice_count, SUM(total_minor) AS total_minor, SUM(gross_profit_minor) AS gross_profit_minor FROM sales WHERE status <> 'cancelled'${d.clause} GROUP BY period`,
        args: d.args,
      };
    },
  },
  {
    key: 'monthly-sales',
    title: 'মাসিক সেল রিপোর্ট',
    titleEn: 'Monthly sales',
    group: 'sales',
    moneyColumns: ['total_minor', 'gross_profit_minor'],
    sortable: ['period', 'total_minor'],
    defaultSort: 'period',
    build: (f) => {
      const d = dateFilter('sale_date', f);
      return {
        sql: `SELECT substr(sale_date,1,7) AS period, COUNT(*) AS invoice_count, SUM(total_minor) AS total_minor, SUM(gross_profit_minor) AS gross_profit_minor FROM sales WHERE status <> 'cancelled'${d.clause} GROUP BY period`,
        args: d.args,
      };
    },
  },
  {
    key: 'yearly-sales',
    title: 'বার্ষিক সেল রিপোর্ট',
    titleEn: 'Yearly sales',
    group: 'sales',
    moneyColumns: ['total_minor', 'gross_profit_minor'],
    sortable: ['period', 'total_minor'],
    defaultSort: 'period',
    build: (f) => {
      const d = dateFilter('sale_date', f);
      return {
        sql: `SELECT substr(sale_date,1,4) AS period, COUNT(*) AS invoice_count, SUM(total_minor) AS total_minor, SUM(gross_profit_minor) AS gross_profit_minor FROM sales WHERE status <> 'cancelled'${d.clause} GROUP BY period`,
        args: d.args,
      };
    },
  },
  {
    key: 'custom-sales',
    title: 'নির্দিষ্ট তারিখের সেল রিপোর্ট',
    titleEn: 'Custom date range sales',
    group: 'sales',
    moneyColumns: ['total_minor', 'due_minor', 'gross_profit_minor'],
    sortable: ['sale_date', 'total_minor', 'invoice_no'],
    defaultSort: 'sale_date',
    build: (f) => {
      const d = dateFilter('sale_date', f);
      const c = optional('customer_id', f.customerId);
      const s = search(['invoice_no'], f);
      return {
        sql: `SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.status <> 'cancelled'${d.clause}${c.clause}${s.clause}`,
        args: [...d.args, ...c.args, ...s.args],
      };
    },
  },
  {
    key: 'profit-loss',
    title: 'লাভ-লস রিপোর্ট',
    titleEn: 'Profit and loss',
    group: 'finance',
    moneyColumns: [
      'net_sales_minor',
      'cogs_minor',
      'gross_profit_minor',
      'expenses_minor',
      'net_profit_minor',
    ],
    sortable: ['s.period', 'net_profit_minor'],
    defaultSort: 's.period',
    build: (f) => {
      const d = dateFilter('sale_date', f);
      return {
        sql: `WITH s AS (
      SELECT sale_date AS period, SUM(subtotal_minor - item_discount_minor - cart_discount_minor) AS net_sales_minor,
        SUM(cogs_minor) AS cogs_minor, SUM(gross_profit_minor) AS gross_profit_minor
      FROM sales WHERE status <> 'cancelled'${d.clause} GROUP BY sale_date),
      e AS (SELECT expense_date AS period, SUM(amount_minor) AS expenses_minor FROM expenses
        WHERE voided_at IS NULL GROUP BY expense_date),
      i AS (SELECT substr(txn_date,1,10) AS period, SUM(amount_minor) AS other_income_minor
        FROM financial_transactions WHERE kind='other_income' GROUP BY substr(txn_date,1,10))
      SELECT s.period, s.net_sales_minor, s.cogs_minor, s.gross_profit_minor,
        COALESCE(e.expenses_minor,0) AS expenses_minor,
        s.gross_profit_minor - COALESCE(e.expenses_minor,0) + COALESCE(i.other_income_minor,0) AS net_profit_minor
      FROM s LEFT JOIN e ON e.period=s.period LEFT JOIN i ON i.period=s.period`,
        args: d.args,
      };
    },
  },
  {
    key: 'purchases',
    title: 'ক্রয় রিপোর্ট',
    titleEn: 'Purchase report',
    group: 'purchases',
    moneyColumns: ['total_minor', 'paid_minor', 'due_minor'],
    sortable: ['purchase_date', 'total_minor', 'invoice_no'],
    defaultSort: 'purchase_date',
    build: (f) => {
      const d = dateFilter('purchase_date', f);
      const s = optional('supplier_id', f.supplierId);
      return {
        sql: `SELECT p.*, sp.name AS supplier_name FROM purchases p LEFT JOIN suppliers sp ON sp.id=p.supplier_id WHERE 1=1${d.clause}${s.clause}`,
        args: [...d.args, ...s.args],
      };
    },
  },
  {
    key: 'expenses',
    title: 'খরচ রিপোর্ট',
    titleEn: 'Expense report',
    group: 'expenses',
    moneyColumns: ['amount_minor'],
    sortable: ['expense_date', 'amount_minor'],
    defaultSort: 'expense_date',
    build: (f) => {
      const d = dateFilter('expense_date', f);
      const c = optional('category_id', f.categoryId);
      return {
        sql: `SELECT e.*, c.name AS category_name FROM expenses e JOIN expense_categories c ON c.id=e.category_id WHERE e.voided_at IS NULL${d.clause}${c.clause}`,
        args: [...d.args, ...c.args],
      };
    },
  },
  {
    key: 'customer-due',
    title: 'কাস্টমার বাকি রিপোর্ট',
    titleEn: 'Customer due',
    group: 'parties',
    moneyColumns: ['balance_minor'],
    sortable: ['balance_minor', 'name'],
    defaultSort: 'balance_minor',
    build: (f) => {
      const s = search(['name', 'phone'], f);
      return {
        sql: `SELECT id, name, phone, address, balance_minor, opening_balance_minor, status FROM customers WHERE archived_at IS NULL AND balance_minor > 0${s.clause}`,
        args: s.args,
      };
    },
  },
  {
    key: 'supplier-due',
    title: 'সাপ্লায়ার বাকি রিপোর্ট',
    titleEn: 'Supplier due',
    group: 'parties',
    moneyColumns: ['balance_minor'],
    sortable: ['balance_minor', 'name'],
    defaultSort: 'balance_minor',
    build: (f) => {
      const s = search(['name', 'phone'], f);
      return {
        sql: `SELECT id, name, company, phone, balance_minor, opening_balance_minor, status FROM suppliers WHERE archived_at IS NULL AND balance_minor > 0${s.clause}`,
        args: s.args,
      };
    },
  },
  {
    key: 'payments',
    title: 'পেমেন্ট রিপোর্ট',
    titleEn: 'Payment report',
    group: 'finance',
    moneyColumns: ['amount_minor'],
    sortable: ['txn_date', 'amount_minor'],
    defaultSort: 'txn_date',
    build: (f) => {
      const d = dateFilter('substr(f.txn_date,1,10)', f);
      const p = optional('f.kind', f.kind);
      return {
        sql: `SELECT f.*, a.name AS account_name FROM financial_transactions f JOIN accounts a ON a.id=f.account_id WHERE 1=1${d.clause}${p.clause}`,
        args: [...d.args, ...p.args],
      };
    },
  },
  {
    key: 'cash-flow',
    title: 'ক্যাশ ফ্লো রিপোর্ট',
    titleEn: 'Cash flow',
    group: 'finance',
    moneyColumns: ['cash_in_minor', 'cash_out_minor', 'net_minor'],
    sortable: ['period'],
    defaultSort: 'period',
    build: (f) => {
      const d = dateFilter('substr(txn_date,1,10)', f);
      return {
        sql: `SELECT substr(txn_date,1,10) AS period,
      SUM(CASE WHEN direction='in' THEN amount_minor ELSE 0 END) AS cash_in_minor,
      SUM(CASE WHEN direction='out' THEN amount_minor ELSE 0 END) AS cash_out_minor,
      SUM(CASE WHEN direction='in' THEN amount_minor ELSE -amount_minor END) AS net_minor
      FROM financial_transactions WHERE 1=1${d.clause} GROUP BY period`,
        args: d.args,
      };
    },
  },
  {
    key: 'stock',
    title: 'স্টক রিপোর্ট',
    titleEn: 'Stock report',
    group: 'inventory',
    moneyColumns: ['stock_value_minor', 'selling_price_minor'],
    sortable: ['p.name', 'p.current_stock_minor'],
    defaultSort: 'p.name',
    build: (f) => {
      const s = search(['p.name', 'p.code', 'p.barcode'], f);
      const c = optional('p.category_id', f.categoryId);
      return {
        sql: `SELECT p.id, p.name, p.code, p.barcode, c.name AS category_name, u.name AS unit_name,
      p.current_stock_minor, p.min_stock_minor, p.selling_price_minor, p.average_cost_minor,
      p.current_stock_minor * p.average_cost_minor / 1000 AS stock_value_minor, p.expiry_date
      FROM products p LEFT JOIN categories c ON c.id=p.category_id JOIN units u ON u.id=p.unit_id
      WHERE p.archived_at IS NULL${s.clause}${c.clause}`,
        args: [...s.args, ...c.args],
      };
    },
  },
  {
    key: 'low-stock',
    title: 'কম স্টক রিপোর্ট',
    titleEn: 'Low stock',
    group: 'inventory',
    moneyColumns: ['selling_price_minor'],
    sortable: ['p.current_stock_minor', 'p.name'],
    defaultSort: 'p.current_stock_minor',
    build: (f) => {
      const s = search(['p.name', 'p.code'], f);
      return {
        sql: `SELECT p.*, u.name AS unit_name FROM products p JOIN units u ON u.id=p.unit_id
      WHERE p.archived_at IS NULL AND p.status='active' AND p.min_stock_minor > 0 AND p.current_stock_minor <= p.min_stock_minor${s.clause}`,
        args: s.args,
      };
    },
  },
  {
    key: 'out-of-stock',
    title: 'স্টক আউট রিপোর্ট',
    titleEn: 'Out of stock',
    group: 'inventory',
    sortable: ['p.name', 'p.updated_at'],
    defaultSort: 'p.name',
    build: (f) => {
      const s = search(['p.name', 'p.code'], f);
      return {
        sql: `SELECT p.*, u.name AS unit_name FROM products p JOIN units u ON u.id=p.unit_id
      WHERE p.archived_at IS NULL AND p.status='active' AND p.current_stock_minor <= 0${s.clause}`,
        args: s.args,
      };
    },
  },
  {
    key: 'product-wise-sales',
    title: 'প্রোডাক্টভিত্তিক সেল',
    titleEn: 'Product-wise sales',
    group: 'sales',
    moneyColumns: ['revenue_minor', 'cogs_minor', 'profit_minor'],
    sortable: ['product_name', 'revenue_minor', 'qty_minor'],
    defaultSort: 'revenue_minor',
    build: (f) => {
      const d = dateFilter('s.sale_date', f);
      const p = optional('i.product_id', f.productId);
      return {
        sql: `SELECT i.product_id, i.product_name, SUM(i.quantity_minor) AS qty_minor,
      SUM(i.line_total_minor - i.discount_minor) AS revenue_minor, SUM(i.line_cogs_minor) AS cogs_minor,
      SUM(i.line_total_minor - i.discount_minor - i.line_cogs_minor) AS profit_minor
      FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.status <> 'cancelled'${d.clause}${p.clause} GROUP BY i.product_id, i.product_name`,
        args: [...d.args, ...p.args],
      };
    },
  },
  {
    key: 'category-wise-sales',
    title: 'ক্যাটাগরিভিত্তিক সেল',
    titleEn: 'Category-wise sales',
    group: 'sales',
    moneyColumns: ['revenue_minor', 'profit_minor'],
    sortable: ['category_name', 'revenue_minor'],
    defaultSort: 'revenue_minor',
    build: (f) => {
      const d = dateFilter('s.sale_date', f);
      return {
        sql: `SELECT COALESCE(c.name,'ক্যাটাগরি নেই') AS category_name,
      SUM(i.quantity_minor) AS qty_minor, SUM(i.line_total_minor - i.discount_minor) AS revenue_minor,
      SUM(i.line_total_minor - i.discount_minor - i.line_cogs_minor) AS profit_minor
      FROM sale_items i JOIN sales s ON s.id=i.sale_id JOIN products p ON p.id=i.product_id
      LEFT JOIN categories c ON c.id=p.category_id WHERE s.status <> 'cancelled'${d.clause} GROUP BY category_name`,
        args: d.args,
      };
    },
  },
  {
    key: 'top-selling-products',
    title: 'সর্বাধিক বিক্রিত পণ্য',
    titleEn: 'Top-selling products',
    group: 'analytics',
    moneyColumns: ['revenue_minor'],
    sortable: ['qty_minor', 'revenue_minor'],
    defaultSort: 'qty_minor',
    build: (f) => {
      const d = dateFilter('s.sale_date', f);
      return {
        sql: `SELECT i.product_id, i.product_name, SUM(i.quantity_minor) AS qty_minor,
      SUM(i.line_total_minor - i.discount_minor) AS revenue_minor FROM sale_items i JOIN sales s ON s.id=i.sale_id
      WHERE s.status <> 'cancelled'${d.clause} GROUP BY i.product_id, i.product_name`,
        args: d.args,
      };
    },
  },
  {
    key: 'slow-moving-products',
    title: 'কম বিক্রিত পণ্য',
    titleEn: 'Slow-moving products',
    group: 'analytics',
    moneyColumns: ['current_stock_minor'],
    sortable: ['sold_qty_minor', 'name'],
    defaultSort: 'sold_qty_minor',
    build: (f) => {
      const d = dateFilter('s.sale_date', f);
      return {
        sql: `SELECT p.id, p.name, p.code, p.current_stock_minor,
      COALESCE((SELECT SUM(i.quantity_minor) FROM sale_items i JOIN sales s ON s.id=i.sale_id
        WHERE i.product_id=p.id AND s.status <> 'cancelled'${d.clause}),0) AS sold_qty_minor
      FROM products p WHERE p.archived_at IS NULL AND p.status='active'`,
        args: d.args,
      };
    },
  },
  {
    key: 'product-profitability',
    title: 'প্রোডাক্ট লাভজনকতা',
    titleEn: 'Product profitability',
    group: 'analytics',
    moneyColumns: ['revenue_minor', 'cogs_minor', 'profit_minor'],
    sortable: ['profit_minor', 'product_name'],
    defaultSort: 'profit_minor',
    build: (f) => {
      const d = dateFilter('s.sale_date', f);
      return {
        sql: `SELECT i.product_id, i.product_name,
      SUM(i.line_total_minor - i.discount_minor) AS revenue_minor, SUM(i.line_cogs_minor) AS cogs_minor,
      SUM(i.line_total_minor - i.discount_minor - i.line_cogs_minor) AS profit_minor
      FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.status <> 'cancelled'${d.clause} GROUP BY i.product_id, i.product_name`,
        args: d.args,
      };
    },
  },
  {
    key: 'customer-wise-sales',
    title: 'কাস্টমারভিত্তিক সেল',
    titleEn: 'Customer-wise sales',
    group: 'parties',
    moneyColumns: ['total_minor', 'paid_minor', 'due_minor'],
    sortable: ['customer_name', 'total_minor'],
    defaultSort: 'total_minor',
    build: (f) => {
      const d = dateFilter('s.sale_date', f);
      const c = optional('s.customer_id', f.customerId);
      return {
        sql: `SELECT c.id, c.name AS customer_name, COUNT(s.id) AS invoice_count,
      SUM(s.total_minor) AS total_minor, SUM(s.paid_minor) AS paid_minor, SUM(s.due_minor) AS due_minor
      FROM sales s JOIN customers c ON c.id=s.customer_id WHERE s.status <> 'cancelled'${d.clause}${c.clause} GROUP BY c.id, c.name`,
        args: [...d.args, ...c.args],
      };
    },
  },
  {
    key: 'supplier-wise-purchases',
    title: 'সাপ্লায়ারভিত্তিক ক্রয়',
    titleEn: 'Supplier-wise purchases',
    group: 'purchases',
    moneyColumns: ['total_minor', 'paid_minor', 'due_minor'],
    sortable: ['supplier_name', 'total_minor'],
    defaultSort: 'total_minor',
    build: (f) => {
      const d = dateFilter('p.purchase_date', f);
      const s = optional('p.supplier_id', f.supplierId);
      return {
        sql: `SELECT sp.id, sp.name AS supplier_name, COUNT(p.id) AS invoice_count,
      SUM(p.total_minor) AS total_minor, SUM(p.paid_minor) AS paid_minor, SUM(p.due_minor) AS due_minor
      FROM purchases p JOIN suppliers sp ON sp.id=p.supplier_id WHERE 1=1${d.clause}${s.clause} GROUP BY sp.id, sp.name`,
        args: [...d.args, ...s.args],
      };
    },
  },
  {
    key: 'sales-returns',
    title: 'সেল রিটার্ন রিপোর্ট',
    titleEn: 'Sales returns',
    group: 'returns',
    moneyColumns: ['total_minor', 'cogs_reversal_minor'],
    sortable: ['return_date', 'total_minor'],
    defaultSort: 'return_date',
    build: (f) => {
      const d = dateFilter('return_date', f);
      return {
        sql: `SELECT r.*, s.invoice_no, c.name AS customer_name FROM sales_returns r
      LEFT JOIN sales s ON s.id=r.sale_id LEFT JOIN customers c ON c.id=r.customer_id WHERE 1=1${d.clause}`,
        args: d.args,
      };
    },
  },
  {
    key: 'purchase-returns',
    title: 'ক্রয় রিটার্ন রিপোর্ট',
    titleEn: 'Purchase returns',
    group: 'returns',
    moneyColumns: ['total_minor'],
    sortable: ['return_date', 'total_minor'],
    defaultSort: 'return_date',
    build: (f) => {
      const d = dateFilter('return_date', f);
      return {
        sql: `SELECT r.*, p.invoice_no, s.name AS supplier_name FROM purchase_returns r
      LEFT JOIN purchases p ON p.id=r.purchase_id LEFT JOIN suppliers s ON s.id=r.supplier_id WHERE 1=1${d.clause}`,
        args: d.args,
      };
    },
  },
  {
    key: 'stock-adjustments',
    title: 'স্টক অ্যাডজাস্টমেন্ট রিপোর্ট',
    titleEn: 'Stock adjustments',
    group: 'inventory',
    sortable: ['a.created_at', 'a.reason'],
    defaultSort: 'a.created_at',
    build: (f) => {
      const d = dateFilter('substr(a.created_at,1,10)', f);
      return {
        sql: `SELECT a.*, p.name AS product_name, p.code FROM stock_adjustments a
      JOIN products p ON p.id=a.product_id WHERE 1=1${d.clause}`,
        args: d.args,
      };
    },
  },
  {
    key: 'vat-tax',
    title: 'ভ্যাট/ট্যাক্স রিপোর্ট',
    titleEn: 'VAT / tax',
    group: 'finance',
    moneyColumns: ['tax_minor', 'total_minor'],
    sortable: ['sale_date', 'tax_minor'],
    defaultSort: 'sale_date',
    build: (f) => {
      const d = dateFilter('sale_date', f);
      return {
        sql: `SELECT sale_date, COUNT(*) AS invoice_count,
      SUM(tax_minor) AS tax_minor, SUM(total_minor) AS total_minor FROM sales WHERE status <> 'cancelled' AND tax_minor > 0${d.clause} GROUP BY sale_date`,
        args: d.args,
      };
    },
  },
  {
    key: 'transaction-history',
    title: 'লেনদেনের ইতিহাস',
    titleEn: 'Transaction history',
    group: 'finance',
    moneyColumns: ['amount_minor'],
    sortable: ['txn_date', 'amount_minor'],
    defaultSort: 'txn_date',
    build: (f) => {
      const d = dateFilter('substr(f.txn_date,1,10)', f);
      const s = search(['f.kind', 'a.name'], f);
      return {
        sql: `SELECT f.*, a.name AS account_name FROM financial_transactions f JOIN accounts a ON a.id=f.account_id WHERE 1=1${d.clause}${s.clause}`,
        args: [...d.args, ...s.args],
      };
    },
  },
  {
    key: 'audit-log',
    title: 'অডিট লগ রিপোর্ট',
    titleEn: 'Audit log',
    group: 'security',
    sortable: ['created_at', 'action', 'actor_name'],
    defaultSort: 'created_at',
    build: (f) => {
      const d = dateFilter('substr(created_at,1,10)', f);
      const s = search(['action', 'actor_name', 'entity'], f);
      return {
        sql: `SELECT id, actor_id, actor_name, action, entity, entity_id, before_json, after_json, created_at FROM audit_logs WHERE 1=1${d.clause}${s.clause}`,
        args: [...d.args, ...s.args],
      };
    },
  },
];
export const REPORT_KEYS = REPORTS.map((r) => r.key);
export function getReport(key: string): ReportDef {
  const def = REPORTS.find((r) => r.key === key);
  if (!def) throw new AppError(ERR.NOT_FOUND, 'রিপোর্ট পাওয়া যায়নি।');
  return def;
}
export function runReport(
  db: DB,
  key: string,
  filter: FilterPayload,
): Page<Record<string, unknown>> & { report: ReportDef; totals: Record<string, number> } {
  const def = getReport(key);
  const { sql, args } = def.build(filter);
  const page = pagedQuery(db, sql, args, filter, def.sortable, def.defaultSort);
  const totals: Record<string, number> = {};
  for (const col of def.moneyColumns ?? []) {
    const row = db
      .prepare(`SELECT COALESCE(SUM("${col}"),0) AS n FROM (${sql}) report_totals`)
      .get(...args) as { n: number };
    totals[col] = row.n;
  }
  return { ...page, report: def, totals };
}
