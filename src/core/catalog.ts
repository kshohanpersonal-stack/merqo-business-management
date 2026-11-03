/** Product catalogue, categories, brands, units and conversions. */
import type { DB } from './db';
import type { FilterPayload, Page } from './types';
import { AppError, ERR } from './errors';
import { normalizeText, parseMoney, parseQuantity, mulDivRound, sumMinor } from './money';
import { uid, nowIso, pagedQuery, searchPattern } from './util';
import { assertSafeRelativePath } from './validation';

const DISCOUNT_TYPES = ['none', 'percent', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface ProductInput {
  name: string;
  nameEn?: string;
  code?: string;
  sku?: string;
  barcode?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  brandId?: string | null;
  description?: string;
  purchasePrice?: unknown;
  sellingPrice?: unknown;
  wholesalePrice?: unknown;
  retailPrice?: unknown;
  discountType?: DiscountType;
  discountValue?: unknown;
  minStock?: unknown;
  maxStock?: unknown;
  unitId?: string;
  supplierId?: string | null;
  expiryDate?: string | null;
  batchNo?: string | null;
  status?: string;
  taxRateBps?: number;
  imagePath?: string;
  openingStock?: unknown;
  openingCost?: unknown;
}
export function generateProductCode(db: DB): string {
  const n = (db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n + 1;
  return `PRD-${String(n).padStart(6, '0')}`;
}
export function generateEan13(seed: number): string {
  const body = '890' + String(Math.abs(Math.trunc(seed)) % 1_000_000_000).padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + String((10 - (sum % 10)) % 10);
}
export function createProduct(db: DB, input: ProductInput, actorId?: string | null): string {
  const name = normalizeText(input.name, 200);
  if (!name) throw new AppError(ERR.VALIDATION, 'প্রোডাক্টের নাম দিন।');
  const unitId = input.unitId || 'u-piece';
  if (!db.prepare('SELECT id FROM units WHERE id = ?').get(unitId))
    throw new AppError(ERR.VALIDATION, 'ইউনিট পাওয়া যায়নি।');
  const code = normalizeText(input.code || generateProductCode(db), 60).toUpperCase();
  const sku = normalizeText(input.sku || code, 60).toUpperCase();
  const barcode = normalizeText(
    input.barcode || generateEan13(Date.now() + Math.floor(Math.random() * 1000)),
    60,
  );
  const dt = input.discountType ?? 'none';
  if (!DISCOUNT_TYPES.includes(dt)) throw new AppError(ERR.VALIDATION, 'অবৈধ ডিসকাউন্ট ধরন।');
  const purchasePriceMinor = parseMoney(input.purchasePrice ?? 0, 'ক্রয়মূল্য');
  const sellingPriceMinor = parseMoney(input.sellingPrice ?? 0, 'বিক্রয়মূল্য');
  const id = uid();
  const stamp = nowIso();
  if (
    db.prepare('SELECT id FROM products WHERE code = ? OR sku = ? OR barcode = ?').get(code, sku, barcode)
  ) {
    throw new AppError(ERR.CONFLICT, 'এই কোড, SKU বা বারকোড আগে থেকেই আছে।');
  }
  const imagePath = input.imagePath ? assertSafeRelativePath(input.imagePath) : '';
  db.prepare(
    `INSERT INTO products(id, name, name_en, code, sku, barcode, qr_payload, image_path,
    category_id, subcategory_id, brand_id, description, purchase_price_minor, selling_price_minor,
    wholesale_price_minor, retail_price_minor, discount_type, discount_value, current_stock_minor,
    min_stock_minor, max_stock_minor, unit_id, supplier_id, expiry_date, batch_no, status,
    average_cost_minor, tax_rate_bps, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    name,
    normalizeText(input.nameEn ?? '', 200),
    code,
    sku,
    barcode,
    `MERQO:${code}:${id}`,
    imagePath,
    input.categoryId ?? null,
    input.subcategoryId ?? null,
    input.brandId ?? null,
    normalizeText(input.description ?? '', 1000),
    purchasePriceMinor,
    sellingPriceMinor,
    input.wholesalePrice === undefined
      ? sellingPriceMinor
      : parseMoney(input.wholesalePrice, 'পাইকারি মূল্য'),
    input.retailPrice === undefined ? sellingPriceMinor : parseMoney(input.retailPrice, 'খুচরা মূল্য'),
    dt,
    dt === 'percent'
      ? Math.round(Number(input.discountValue ?? 0)) * 100
      : parseMoney(input.discountValue ?? 0, 'ডিসকাউন্ট'),
    0,
    input.minStock === undefined ? 0 : parseQuantity(input.minStock, 'ন্যূনতম স্টক'),
    input.maxStock === undefined ? 0 : parseQuantity(input.maxStock, 'সর্বোচ্চ স্টক'),
    unitId,
    input.supplierId ?? null,
    input.expiryDate ?? null,
    normalizeText(input.batchNo ?? '', 60) || null,
    input.status ?? 'active',
    purchasePriceMinor,
    Math.max(0, Math.min(10000, Number(input.taxRateBps ?? 0))),
    stamp,
    stamp,
  );
  if (input.openingStock !== undefined) {
    const qty = parseQuantity(input.openingStock, 'ওপেনিং স্টক');
    const cost = parseMoney(input.openingCost ?? input.purchasePrice ?? 0, 'ওপেনিং খরচ');
    // Deliberately avoid importing inventory here to keep module direction simple.
    db.prepare(
      `INSERT INTO stock_movements(id, product_id, direction, quantity_minor, unit_cost_minor,
      reason, reference_type, reference_id, balance_after_minor, actor_id, created_at)
      VALUES (?,?,'in',?,?,?,?,?,?,?,?)`,
    ).run(uid(), id, qty, cost, 'ওপেনিং স্টক', 'product', id, qty, actorId ?? null, stamp);
    db.prepare('UPDATE products SET current_stock_minor = ?, average_cost_minor = ? WHERE id = ?').run(
      qty,
      cost,
      id,
    );
  }
  return id;
}
const UPDATABLE: Record<string, string> = {
  name: 'name',
  nameEn: 'name_en',
  description: 'description',
  purchasePrice: 'purchase_price_minor',
  sellingPrice: 'selling_price_minor',
  wholesalePrice: 'wholesale_price_minor',
  retailPrice: 'retail_price_minor',
  categoryId: 'category_id',
  subcategoryId: 'subcategory_id',
  brandId: 'brand_id',
  unitId: 'unit_id',
  supplierId: 'supplier_id',
  expiryDate: 'expiry_date',
  batchNo: 'batch_no',
  status: 'status',
  minStock: 'min_stock_minor',
  maxStock: 'max_stock_minor',
  barcode: 'barcode',
  sku: 'sku',
  imagePath: 'image_path',
  taxRateBps: 'tax_rate_bps',
  discountType: 'discount_type',
  discountValue: 'discount_value',
};
export function updateProduct(db: DB, id: string, input: Partial<ProductInput>): void {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) throw new AppError(ERR.NOT_FOUND, 'প্রোডাক্ট পাওয়া যায়নি।');
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    const column = UPDATABLE[key];
    if (!column || value === undefined) continue;
    if (value === null) {
      args.push(null);
    } else if (['purchasePrice', 'sellingPrice', 'wholesalePrice', 'retailPrice'].includes(key)) {
      args.push(parseMoney(value, 'মূল্য'));
    } else if (key === 'discountValue') {
      const type = (input.discountType ?? (existing as Record<string, unknown>).discount_type) as string;
      args.push(type === 'percent' ? Math.round(Number(value) * 100) : parseMoney(value, 'ডিসকাউন্ট'));
    } else if (['minStock', 'maxStock'].includes(key)) {
      args.push(parseQuantity(value, 'স্টক'));
    } else if (key === 'imagePath') {
      args.push(value ? assertSafeRelativePath(String(value)) : '');
    } else if (key === 'taxRateBps') {
      args.push(Math.max(0, Math.min(10000, Number(value))));
    } else if (key === 'discountType') {
      if (!DISCOUNT_TYPES.includes(value as DiscountType))
        throw new AppError(ERR.VALIDATION, 'অবৈধ ডিসকাউন্ট ধরন।');
      args.push(value);
    } else args.push(normalizeText(String(value ?? ''), 1000) || null);
    sets.push(`${column} = ?`);
  }
  if (!sets.length) return;
  sets.push('updated_at = ?');
  args.push(nowIso(), id);
  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...args);
}
export function archiveProduct(db: DB, id: string): void {
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!p) throw new AppError(ERR.NOT_FOUND, 'প্রোডাক্ট পাওয়া যায়নি।');
  const referenced = db.prepare('SELECT COUNT(*) AS n FROM sale_items WHERE product_id = ?').get(id) as {
    n: number;
  };
  if (referenced.n > 0) {
    db.prepare("UPDATE products SET status='archived', archived_at=?, updated_at=? WHERE id=?").run(
      nowIso(),
      nowIso(),
      id,
    );
  } else {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
}
export function duplicateProduct(db: DB, id: string): string {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new AppError(ERR.NOT_FOUND, 'প্রোডাক্ট পাওয়া যায়নি।');
  return createProduct(db, {
    name: `${row.name} (কপি)`,
    nameEn: String(row.name_en ?? ''),
    categoryId: row.category_id as string | null,
    subcategoryId: row.subcategory_id as string | null,
    brandId: row.brand_id as string | null,
    description: String(row.description ?? ''),
    purchasePrice: Number(row.purchase_price_minor) / 100,
    sellingPrice: Number(row.selling_price_minor) / 100,
    wholesalePrice: Number(row.wholesale_price_minor) / 100,
    retailPrice: Number(row.retail_price_minor) / 100,
    unitId: String(row.unit_id),
    supplierId: row.supplier_id as string | null,
    minStock: Number(row.min_stock_minor) / 1000,
    maxStock: Number(row.max_stock_minor) / 1000,
    status: 'active',
  });
}
export function getProduct(db: DB, id: string): Record<string, unknown> {
  const row = db
    .prepare(
      `SELECT p.*, c.name AS category_name, b.name AS brand_name, u.name AS unit_name,
    s.name AS supplier_name FROM products p LEFT JOIN categories c ON c.id=p.category_id
    LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN units u ON u.id=p.unit_id
    LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError(ERR.NOT_FOUND, 'প্রোডাক্ট পাওয়া যায়নি।');
  return row;
}
export function findByBarcode(db: DB, raw: string): Record<string, unknown> | undefined {
  const code = normalizeText(raw, 60).replace(/\s/g, '');
  return db
    .prepare(
      `SELECT p.*, u.name AS unit_name, u.symbol AS unit_symbol FROM products p
    JOIN units u ON u.id=p.unit_id
    WHERE p.barcode = ? OR p.code = ? OR p.sku = ? OR p.id IN (SELECT product_id FROM product_barcodes WHERE barcode = ?)
    LIMIT 1`,
    )
    .get(code, code, code, code) as Record<string, unknown> | undefined;
}
export function listProducts(db: DB, filter: FilterPayload): Page<Record<string, unknown>> {
  const args: unknown[] = [];
  let sql = `SELECT p.*, c.name AS category_name, b.name AS brand_name, u.name AS unit_name, u.symbol AS unit_symbol
    FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
    LEFT JOIN units u ON u.id=p.unit_id WHERE 1=1`;
  if (filter.includeArchived !== true) sql += ' AND p.archived_at IS NULL';
  if (filter.search) {
    const s = searchPattern(filter);
    sql += ' AND (p.name LIKE ? OR p.name_en LIKE ? OR p.code LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    args.push(s, s, s, s, s);
  }
  if (filter.categoryId) {
    sql += ' AND p.category_id = ?';
    args.push(String(filter.categoryId));
  }
  if (filter.brandId) {
    sql += ' AND p.brand_id = ?';
    args.push(String(filter.brandId));
  }
  if (filter.status) {
    sql += ' AND p.status = ?';
    args.push(String(filter.status));
  }
  if (filter.stockStatus === 'low')
    sql += ' AND p.current_stock_minor <= p.min_stock_minor AND p.min_stock_minor > 0';
  if (filter.stockStatus === 'out') sql += ' AND p.current_stock_minor <= 0';
  if (filter.stockStatus === 'in') sql += ' AND p.current_stock_minor > 0';
  return pagedQuery(
    db,
    sql,
    args,
    filter,
    ['p.name', 'p.code', 'p.selling_price_minor', 'p.current_stock_minor', 'p.created_at', 'p.updated_at'],
    'p.created_at',
  );
}
export function listCategories(db: DB): Record<string, unknown>[] {
  return db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) AS product_count
    FROM categories c WHERE c.archived_at IS NULL ORDER BY c.name`,
    )
    .all() as Record<string, unknown>[];
}
export function createCategory(
  db: DB,
  input: { name: string; nameEn?: string; parentId?: string | null; description?: string },
): string {
  const name = normalizeText(input.name, 120);
  if (!name) throw new AppError(ERR.VALIDATION, 'ক্যাটাগরির নাম দিন।');
  if (
    db
      .prepare('SELECT id FROM categories WHERE name = ? AND parent_id IS ?')
      .get(name, input.parentId ?? null)
  ) {
    throw new AppError(ERR.CONFLICT, 'এই ক্যাটাগরি আগে থেকেই আছে।');
  }
  const id = uid();
  db.prepare(
    'INSERT INTO categories(id, name, name_en, parent_id, description, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
  ).run(
    id,
    name,
    normalizeText(input.nameEn ?? '', 120),
    input.parentId ?? null,
    normalizeText(input.description ?? '', 300),
    nowIso(),
    nowIso(),
  );
  return id;
}
export function updateCategory(
  db: DB,
  id: string,
  input: { name?: string; nameEn?: string; description?: string },
): void {
  const row = db.prepare('SELECT * FROM categories WHERE id=?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new AppError(ERR.NOT_FOUND, 'ক্যাটাগরি পাওয়া যায়নি।');
  db.prepare('UPDATE categories SET name=?, name_en=?, description=?, updated_at=? WHERE id=?').run(
    normalizeText(input.name ?? String(row.name), 120),
    normalizeText(input.nameEn ?? String(row.name_en ?? ''), 120),
    normalizeText(input.description ?? String(row.description ?? ''), 300),
    nowIso(),
    id,
  );
}
export function archiveCategory(db: DB, id: string): void {
  db.prepare('UPDATE categories SET archived_at=? WHERE id=?').run(nowIso(), id);
}
export function listBrands(db: DB): Record<string, unknown>[] {
  return db.prepare('SELECT * FROM brands WHERE archived_at IS NULL ORDER BY name').all() as Record<
    string,
    unknown
  >[];
}
export function createBrand(db: DB, name: string): string {
  const n = normalizeText(name, 120);
  if (!n) throw new AppError(ERR.VALIDATION, 'ব্র্যান্ডের নাম দিন।');
  const id = uid();
  db.prepare('INSERT INTO brands(id, name, created_at) VALUES (?,?,?)').run(id, n, nowIso());
  return id;
}
export function listUnits(db: DB): Record<string, unknown>[] {
  return db.prepare('SELECT * FROM units WHERE archived_at IS NULL ORDER BY is_custom, name').all() as Record<
    string,
    unknown
  >[];
}
export function createUnit(
  db: DB,
  input: { name: string; symbol: string; baseUnit: string; factor: unknown; decimals?: number },
): string {
  const name = normalizeText(input.name, 60);
  const factor = parseQuantity(input.factor, 'রূপান্তর হার');
  const base = normalizeText(input.baseUnit, 60);
  if (!name || !base) throw new AppError(ERR.VALIDATION, 'ইউনিটের নাম ও বেস ইউনিট দিন।');
  const id = uid();
  db.prepare(
    `INSERT INTO units(id, name, name_en, symbol, base_unit, factor_minor, decimals, is_custom)
    VALUES (?,?,?,?,?,?,?,1)`,
  ).run(
    id,
    name,
    name,
    normalizeText(input.symbol, 20),
    base,
    factor,
    Math.max(0, Math.min(3, Number(input.decimals ?? 3))),
  );
  return id;
}
export function convertQuantity(db: DB, fromUnitId: string, toUnitId: string, quantityMinor: number): number {
  const from = db.prepare('SELECT * FROM units WHERE id=?').get(fromUnitId) as
    | { base_unit: string; factor_minor: number }
    | undefined;
  const to = db.prepare('SELECT * FROM units WHERE id=?').get(toUnitId) as
    | { base_unit: string; factor_minor: number }
    | undefined;
  if (!from || !to) throw new AppError(ERR.NOT_FOUND, 'ইউনিট পাওয়া যায়নি।');
  if (from.base_unit !== to.base_unit)
    throw new AppError(ERR.VALIDATION, 'এই দুটি ইউনিটের মধ্যে রূপান্তর সম্ভব নয়।');
  return mulDivRound(quantityMinor, from.factor_minor, to.factor_minor);
}
export function detectDuplicateProducts(db: DB): Record<string, unknown>[] {
  return db
    .prepare(
      `SELECT LOWER(name) AS normalized_name, COUNT(*) AS n, GROUP_CONCAT(code) AS codes
    FROM products WHERE archived_at IS NULL GROUP BY LOWER(name) HAVING COUNT(*) > 1`,
    )
    .all() as Record<string, unknown>[];
}
export function bulkCreateProducts(
  db: DB,
  rows: ProductInput[],
): { created: number; errors: { row: number; message: string }[] } {
  const errors: { row: number; message: string }[] = [];
  let created = 0;
  rows.forEach((row, i) => {
    try {
      createProduct(db, row);
      created++;
    } catch (e) {
      errors.push({ row: i + 1, message: (e as Error).message });
    }
  });
  return { created, errors };
}
export function parseProductImportRows(rows: Record<string, string>[]): ProductInput[] {
  const map: Record<string, keyof ProductInput> = {
    name: 'name',
    নাম: 'name',
    productname: 'name',
    nameEn: 'nameEn',
    'ইংরেজি নাম': 'nameEn',
    code: 'code',
    কোড: 'code',
    sku: 'sku',
    barcode: 'barcode',
    বারকোড: 'barcode',
    purchasePrice: 'purchasePrice',
    ক্রয়মূল্য: 'purchasePrice',
    sellingPrice: 'sellingPrice',
    বিক্রয়মূল্য: 'sellingPrice',
    category: 'categoryId',
    ক্যাটাগরি: 'categoryId',
    unit: 'unitId',
    ইউনিট: 'unitId',
    minStock: 'minStock',
    'ন্যূনতম স্টক': 'minStock',
    description: 'description',
    বিবরণ: 'description',
  };
  return rows.map((raw) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = map[k.trim().toLowerCase()] ?? map[k.trim()];
      if (key) out[key as string] = String(v);
    }
    if (!out.unitId) out.unitId = 'u-piece';
    return out as unknown as ProductInput;
  });
}
export { sumMinor };
