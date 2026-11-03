/** Single application dispatcher: auth, permissions, validation, transactions, audit. */
import type { AppContext } from './context';
import type { Actor, Result, FilterPayload } from './types';
import { AppError, ERR, toSafeError } from './errors';
import { resolveSession, revokeSession, createSession } from './sessions';
import { authenticate, createUser, changePassword } from './auth';
import { hasPermission, PERMISSIONS, SYSTEM_ROLES } from './permissions';
import { recordAudit, listAudit } from './audit';
import { getActivation, activateFromLicense, deviceInfo } from './activation';
import { verifyLicense, generateTestKeyPair } from './licensing';
import {
  getAllSettings,
  getSetting,
  setSetting,
  getBusinessProfile,
  updateBusinessProfile,
} from './settings';
import { getDashboard, greeting } from './analytics';
import * as catalog from './catalog';
import * as inventory from './inventory';
import * as parties from './parties';
import * as purchases from './purchases';
import * as sales from './sales';
import * as expenses from './expenses';
import * as finance from './finance';
import * as reports from './reports';
import * as exportsModule from './exports';
import * as printing from './printing';
import * as backup from './backup';
import * as notifications from './notifications';
import * as shortcuts from './shortcuts';
import * as barcode from './barcode';
import { normalizeText } from './money';
import { PRODUCT } from './config';
import { uid, nowIso } from './util';

export interface CallContext {
  ctx: AppContext;
  actor: Actor | null;
  payload: any;
}
export interface ActionDef {
  permission: string | null;
  public?: boolean;
  transactional?: boolean;
  sensitive?: boolean;
  handler: (c: CallContext) => unknown | Promise<unknown>;
}
const f = (p: any): FilterPayload => (p ?? {}) as FilterPayload;
const actorId = (c: CallContext): string | null => c.actor?.userId ?? null;

export const ACTIONS: Record<string, ActionDef> = {
  // ---------- bootstrap / first run ----------
  'bootstrap.status': {
    public: true,
    permission: null,
    transactional: false,
    handler: ({ ctx }) => {
      const users = (
        ctx.db.prepare('SELECT COUNT(*) AS n FROM users WHERE archived_at IS NULL').get() as { n: number }
      ).n;
      const activation = getActivation(ctx.db, ctx.config);
      return {
        version: PRODUCT.version,
        buildNumber: 'dev-local',
        productId: PRODUCT.id,
        productName: PRODUCT.name,
        company: PRODUCT.company,
        founder: PRODUCT.founder,
        contactEmail: PRODUCT.email,
        needsActivation: !activation.activated,
        needsSetup: users === 0,
        hasUsers: users > 0,
        activation,
        business: getBusinessProfile(ctx.db),
        greeting: greeting(),
        integrity: ctx.db.pragma('integrity_check', { simple: true }) === 'ok',
        platform: process.platform,
      };
    },
  },
  'bootstrap.setup': {
    public: true,
    permission: null,
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => {
      const users = (ctx.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
      if (users > 0) throw new AppError(ERR.CONFLICT, 'প্রথম সেটআপ আগেই সম্পন্ন হয়েছে।');
      const activation = getActivation(ctx.db, ctx.config);
      if (!activation.activated) throw new AppError(ERR.LICENSE_INVALID, 'অ্যাক্টিভেশন সম্পন্ন করুন।');
      if (!payload.password || !payload.username)
        throw new AppError(ERR.VALIDATION, 'অ্যাডমিন ইউজারনেম ও পাসওয়ার্ড দিন।');
      updateBusinessProfile(ctx.db, payload.business ?? {});
      if (payload.settings && typeof payload.settings === 'object') {
        for (const [k, v] of Object.entries(payload.settings)) setSetting(ctx.db, k, v);
      }
      const user = createUser(ctx.db, {
        username: String(payload.username),
        fullName: String(payload.fullName ?? 'অ্যাডমিন'),
        password: String(payload.password),
        roleId: 'role-admin',
      });
      const row = ctx.db.prepare('SELECT * FROM users WHERE id=?').get(user.id) as any;
      const session = createSession(ctx.db, row);
      recordAudit(ctx.db, {
        action: 'bootstrap.setup',
        entity: 'business',
        entityId: user.id,
        after: { business: payload.business, username: user.username },
        actor: session.actor,
      });
      return { token: session.token, actor: session.actor, business: getBusinessProfile(ctx.db) };
    },
  },

  // ---------- licensing ----------
  'license.status': {
    public: true,
    permission: null,
    transactional: false,
    handler: ({ ctx }) => getActivation(ctx.db, ctx.config),
  },
  'license.verify': {
    public: true,
    permission: null,
    transactional: false,
    handler: ({ ctx, payload }) =>
      verifyLicense(String(payload.text ?? ''), ctx.config.publicKeyPem, {
        expectedProductId: ctx.config.productId,
        currentDevice: ctx.config.deviceFingerprint,
      }),
  },
  'license.activate': {
    public: true,
    permission: null,
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) =>
      activateFromLicense(
        ctx.db,
        ctx.config,
        String(payload.text ?? ''),
        payload.businessName ? String(payload.businessName) : undefined,
      ),
  },
  'license.deviceInfo': {
    public: true,
    permission: null,
    transactional: false,
    handler: ({ ctx }) => deviceInfo(ctx.config),
  },
  'license.testKeypair': {
    public: false,
    permission: 'license.manage',
    transactional: false,
    handler: () => {
      // Test-only endpoint, disabled in production builds.
      if (process.env.NODE_ENV === 'production')
        throw new AppError(ERR.FORBIDDEN, 'এই অপশন প্রোডাকশনে নিষ্ক্রিয়।');
      return generateTestKeyPair();
    },
  },

  // ---------- authentication ----------
  'auth.login': {
    public: true,
    permission: null,
    transactional: false,
    handler: ({ ctx, payload }) => {
      const user = authenticate(ctx.db, String(payload.username ?? ''), String(payload.password ?? ''));
      const session = createSession(ctx.db, user);
      recordAudit(ctx.db, { action: 'auth.login', entity: 'user', entityId: user.id, actor: session.actor });
      return { token: session.token, actor: session.actor };
    },
  },
  'auth.logout': {
    permission: null,
    transactional: false,
    handler: ({ ctx, actor }) => {
      revokeSession(ctx.db, actor!.sessionToken);
      return { ok: true };
    },
  },
  'auth.me': { permission: null, transactional: false, handler: ({ actor }) => actor },
  'auth.changePassword': {
    permission: null,
    transactional: true,
    sensitive: true,
    handler: ({ ctx, actor, payload }) => {
      changePassword(
        ctx.db,
        actor!.userId,
        String(payload.oldPassword ?? ''),
        String(payload.newPassword ?? ''),
      );
      return { ok: true };
    },
  },

  // ---------- dashboard ----------
  'dashboard.get': {
    permission: 'dashboard.view',
    transactional: false,
    handler: ({ ctx, payload }) => getDashboard(ctx.db, f(payload)),
  },

  // ---------- products ----------
  'product.list': {
    permission: 'product.view',
    transactional: false,
    handler: ({ ctx, payload }) => catalog.listProducts(ctx.db, f(payload)),
  },
  'product.get': {
    permission: 'product.view',
    transactional: false,
    handler: ({ ctx, payload }) => catalog.getProduct(ctx.db, String(payload.id)),
  },
  'product.findByBarcode': {
    permission: 'product.view',
    transactional: false,
    handler: ({ ctx, payload }) => catalog.findByBarcode(ctx.db, String(payload.code ?? '')) ?? null,
  },
  'product.create': {
    permission: 'product.manage',
    transactional: true,
    sensitive: true,
    handler: (c) => ({ id: catalog.createProduct(c.ctx.db, c.payload as catalog.ProductInput, actorId(c)) }),
  },
  'product.update': {
    permission: 'product.manage',
    transactional: true,
    sensitive: true,
    handler: (c) => {
      catalog.updateProduct(c.ctx.db, String(c.payload.id), c.payload as catalog.ProductInput);
      return { ok: true };
    },
  },
  'product.archive': {
    permission: 'product.manage',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => {
      catalog.archiveProduct(ctx.db, String(payload.id));
      return { ok: true };
    },
  },
  'product.duplicate': {
    permission: 'product.manage',
    transactional: true,
    handler: ({ ctx, payload }) => ({ id: catalog.duplicateProduct(ctx.db, String(payload.id)) }),
  },
  'product.bulkCreate': {
    permission: 'product.import',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) =>
      catalog.bulkCreateProducts(ctx.db, (payload.rows ?? []) as catalog.ProductInput[]),
  },
  'product.import': {
    permission: 'product.import',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => {
      const rows = catalog.parseProductImportRows((payload.rows ?? []) as Record<string, string>[]);
      return catalog.bulkCreateProducts(ctx.db, rows);
    },
  },
  'product.duplicates': {
    permission: 'product.view',
    transactional: false,
    handler: ({ ctx }) => catalog.detectDuplicateProducts(ctx.db),
  },
  'product.barcodeSvg': {
    permission: 'product.view',
    transactional: false,
    handler: ({ payload }) => barcode.code128Svg(String(payload.value ?? ''), Number(payload.height ?? 60)),
  },
  'product.qrSvg': {
    permission: 'product.view',
    transactional: false,
    handler: ({ payload }) => barcode.qrSvg(String(payload.value ?? '')),
  },
  'product.registerBarcode': {
    permission: 'product.manage',
    transactional: true,
    handler: ({ ctx, payload }) => {
      ctx.db
        .prepare('INSERT INTO product_barcodes(id, product_id, barcode, created_at) VALUES (?,?,?,?)')
        .run(uid(), String(payload.productId), normalizeText(String(payload.barcode), 60), nowIso());
      return { ok: true };
    },
  },

  // ---------- categories, brands, units ----------
  'category.list': {
    permission: 'product.view',
    transactional: false,
    handler: ({ ctx }) => catalog.listCategories(ctx.db),
  },
  'category.create': {
    permission: 'product.manage',
    transactional: true,
    handler: ({ ctx, payload }) => ({ id: catalog.createCategory(ctx.db, payload) }),
  },
  'category.update': {
    permission: 'product.manage',
    transactional: true,
    handler: ({ ctx, payload }) => {
      catalog.updateCategory(ctx.db, String(payload.id), payload);
      return { ok: true };
    },
  },
  'category.archive': {
    permission: 'product.manage',
    transactional: true,
    handler: ({ ctx, payload }) => {
      catalog.archiveCategory(ctx.db, String(payload.id));
      return { ok: true };
    },
  },
  'brand.list': {
    permission: 'product.view',
    transactional: false,
    handler: ({ ctx }) => catalog.listBrands(ctx.db),
  },
  'brand.create': {
    permission: 'product.manage',
    transactional: true,
    handler: ({ ctx, payload }) => ({ id: catalog.createBrand(ctx.db, String(payload.name)) }),
  },
  'unit.list': {
    permission: 'product.view',
    transactional: false,
    handler: ({ ctx }) => catalog.listUnits(ctx.db),
  },
  'unit.create': {
    permission: 'settings.manage',
    transactional: true,
    handler: ({ ctx, payload }) => ({ id: catalog.createUnit(ctx.db, payload) }),
  },
  'unit.convert': {
    permission: 'product.view',
    transactional: false,
    handler: ({ ctx, payload }) => ({
      quantityMinor: catalog.convertQuantity(
        ctx.db,
        String(payload.fromUnitId),
        String(payload.toUnitId),
        Number(payload.quantityMinor),
      ),
    }),
  },
  'unit.conversions': {
    permission: 'product.view',
    transactional: false,
    handler: ({ ctx }) => ctx.db.prepare('SELECT * FROM unit_conversions').all(),
  },

  // ---------- inventory ----------
  'inventory.summary': {
    permission: 'inventory.view',
    transactional: false,
    handler: ({ ctx }) => inventory.inventorySummary(ctx.db),
  },
  'inventory.lowStock': {
    permission: 'inventory.view',
    transactional: false,
    handler: ({ ctx, payload }) => inventory.lowStockProducts(ctx.db, Number(payload.limit ?? 50)),
  },
  'inventory.movements': {
    permission: 'inventory.view',
    transactional: false,
    handler: ({ ctx, payload }) => inventory.listStockMovements(ctx.db, f(payload)),
  },
  'inventory.adjust': {
    permission: 'inventory.adjust',
    transactional: true,
    sensitive: true,
    handler: (c) => inventory.adjustStock(c.ctx.db, { ...c.payload, actorId: actorId(c) }),
  },

  // ---------- parties ----------
  'customer.list': {
    permission: 'party.view',
    transactional: false,
    handler: ({ ctx, payload }) => parties.listParties(ctx.db, 'customer', f(payload)),
  },
  'customer.get': {
    permission: 'party.view',
    transactional: false,
    handler: ({ ctx, payload }) => parties.partyProfile(ctx.db, 'customer', String(payload.id)),
  },
  'customer.create': {
    permission: 'party.manage',
    transactional: true,
    handler: ({ ctx, payload }) => ({ id: parties.createParty(ctx.db, 'customer', payload) }),
  },
  'customer.update': {
    permission: 'party.manage',
    transactional: true,
    handler: ({ ctx, payload }) => {
      parties.updateParty(ctx.db, 'customer', String(payload.id), payload);
      return { ok: true };
    },
  },
  'customer.archive': {
    permission: 'party.manage',
    transactional: true,
    handler: ({ ctx, payload }) => {
      parties.archiveParty(ctx.db, 'customer', String(payload.id));
      return { ok: true };
    },
  },
  'supplier.list': {
    permission: 'party.view',
    transactional: false,
    handler: ({ ctx, payload }) => parties.listParties(ctx.db, 'supplier', f(payload)),
  },
  'supplier.get': {
    permission: 'party.view',
    transactional: false,
    handler: ({ ctx, payload }) => parties.partyProfile(ctx.db, 'supplier', String(payload.id)),
  },
  'supplier.create': {
    permission: 'party.manage',
    transactional: true,
    handler: ({ ctx, payload }) => ({ id: parties.createParty(ctx.db, 'supplier', payload) }),
  },
  'supplier.update': {
    permission: 'party.manage',
    transactional: true,
    handler: ({ ctx, payload }) => {
      parties.updateParty(ctx.db, 'supplier', String(payload.id), payload);
      return { ok: true };
    },
  },
  'supplier.archive': {
    permission: 'party.manage',
    transactional: true,
    handler: ({ ctx, payload }) => {
      parties.archiveParty(ctx.db, 'supplier', String(payload.id));
      return { ok: true };
    },
  },
  'party.statement': {
    permission: 'party.view',
    transactional: false,
    handler: ({ ctx, payload }) =>
      parties.partyStatement(
        ctx.db,
        payload.type === 'supplier' ? 'supplier' : 'customer',
        String(payload.id),
        f(payload),
      ),
  },
  'party.dueTotals': {
    permission: 'party.view',
    transactional: false,
    handler: ({ ctx }) => ({
      customerDue: parties.totalDue(ctx.db, 'customer'),
      supplierDue: parties.totalDue(ctx.db, 'supplier'),
    }),
  },
  'payment.collectDue': {
    permission: 'payment.manage',
    transactional: true,
    sensitive: true,
    handler: (c) => parties.collectDue(c.ctx.db, { ...c.payload, actorId: actorId(c) }),
  },
  'payment.paySupplier': {
    permission: 'payment.manage',
    transactional: true,
    sensitive: true,
    handler: (c) => parties.paySupplier(c.ctx.db, { ...c.payload, actorId: actorId(c) }),
  },

  // ---------- purchases ----------
  'purchase.preview': {
    permission: 'purchase.view',
    transactional: false,
    handler: ({ ctx, payload }) => purchases.computePurchase(ctx.db, payload as purchases.PurchaseInput),
  },
  'purchase.create': {
    permission: 'purchase.manage',
    transactional: true,
    sensitive: true,
    handler: (c) => purchases.createPurchase(c.ctx.db, c.payload as purchases.PurchaseInput, actorId(c)),
  },
  'purchase.list': {
    permission: 'purchase.view',
    transactional: false,
    handler: ({ ctx, payload }) => purchases.listPurchases(ctx.db, f(payload)),
  },
  'purchase.get': {
    permission: 'purchase.view',
    transactional: false,
    handler: ({ ctx, payload }) => purchases.getPurchase(ctx.db, String(payload.id)),
  },
  'purchase.return': {
    permission: 'purchase.manage',
    transactional: true,
    sensitive: true,
    handler: (c) => purchases.returnPurchase(c.ctx.db, { ...c.payload, actorId: actorId(c) }),
  },

  // ---------- sales / POS ----------
  'sale.preview': {
    permission: 'sale.create',
    transactional: false,
    handler: ({ ctx, actor, payload }) =>
      sales.computeSale(ctx.db, {
        ...payload,
        allowPriceOverride: hasPermission(actor!.permissions, 'sale.discount'),
      } as sales.SaleInput),
  },
  'sale.complete': {
    permission: 'sale.create',
    transactional: true,
    sensitive: true,
    handler: (c) =>
      sales.completeSale(
        c.ctx.db,
        {
          ...c.payload,
          allowPriceOverride: hasPermission(c.actor!.permissions, 'sale.discount'),
        } as sales.SaleInput,
        actorId(c),
      ),
  },
  'sale.list': {
    permission: 'sale.view',
    transactional: false,
    handler: ({ ctx, payload }) => sales.listSales(ctx.db, f(payload)),
  },
  'sale.get': {
    permission: 'sale.view',
    transactional: false,
    handler: ({ ctx, payload }) => sales.getSale(ctx.db, String(payload.id)),
  },
  'sale.hold': {
    permission: 'sale.create',
    transactional: true,
    handler: (c) => ({
      reference: sales.holdSale(c.ctx.db, {
        cart: c.payload.cart,
        note: c.payload.note,
        actorId: actorId(c),
      }),
    }),
  },
  'sale.heldList': {
    permission: 'sale.view',
    transactional: false,
    handler: ({ ctx }) => sales.listHeldSales(ctx.db),
  },
  'sale.resume': {
    permission: 'sale.create',
    transactional: false,
    handler: ({ ctx, payload }) => sales.resumeSale(ctx.db, String(payload.reference)),
  },
  'sale.removeHeld': {
    permission: 'sale.create',
    transactional: true,
    handler: ({ ctx, payload }) => {
      sales.removeHeldSale(ctx.db, String(payload.reference));
      return { ok: true };
    },
  },
  'sale.cancel': {
    permission: 'sale.cancel',
    transactional: true,
    sensitive: true,
    handler: (c) => {
      sales.cancelSale(c.ctx.db, { ...c.payload, actorId: actorId(c) });
      return { ok: true };
    },
  },
  'sale.return': {
    permission: 'sale.return',
    transactional: true,
    sensitive: true,
    handler: (c) => sales.returnSale(c.ctx.db, { ...c.payload, actorId: actorId(c) }),
  },
  'sale.refund': {
    permission: 'sale.refund',
    transactional: true,
    sensitive: true,
    handler: (c) => sales.returnSale(c.ctx.db, { ...c.payload, mode: 'refund', actorId: actorId(c) }),
  },
  'sale.exchange': {
    permission: 'sale.return',
    transactional: true,
    sensitive: true,
    handler: (c) => sales.exchangeSale(c.ctx.db, { ...c.payload, actorId: actorId(c) }),
  },
  'invoice.get': {
    permission: 'sale.view',
    transactional: false,
    handler: ({ ctx, payload }) => sales.getInvoice(ctx.db, String(payload.saleId)),
  },
  'invoice.list': {
    permission: 'sale.view',
    transactional: false,
    handler: ({ ctx, payload }) => printing.listInvoices(ctx.db, f(payload)),
  },
  'invoice.reprint': {
    permission: 'sale.view',
    transactional: true,
    handler: ({ ctx, payload }) => ({
      printedCount: sales.incrementPrintCount(ctx.db, String(payload.saleId)),
    }),
  },
  'invoice.receiptHtml': {
    permission: 'sale.view',
    transactional: false,
    handler: ({ ctx, payload }) =>
      printing.buildReceiptHtml(
        ctx.db,
        sales.getInvoice(ctx.db, String(payload.saleId)),
        payload.options ?? {},
      ),
  },
  'invoice.escPos': {
    permission: 'sale.view',
    transactional: false,
    handler: ({ ctx, payload }) =>
      printing
        .buildEscPos(sales.getInvoice(ctx.db, String(payload.saleId)), payload.width ?? '80mm')
        .toString('base64'),
  },

  // ---------- expenses ----------
  'expense.categories': {
    permission: 'expense.view',
    transactional: false,
    handler: ({ ctx }) => expenses.listExpenseCategories(ctx.db),
  },
  'expense.categoryCreate': {
    permission: 'settings.manage',
    transactional: true,
    handler: ({ ctx, payload }) => ({
      id: expenses.createExpenseCategory(ctx.db, String(payload.name), payload.nameEn),
    }),
  },
  'expense.categoryUpdate': {
    permission: 'settings.manage',
    transactional: true,
    handler: ({ ctx, payload }) => {
      expenses.updateExpenseCategory(ctx.db, String(payload.id), String(payload.name), payload.nameEn);
      return { ok: true };
    },
  },
  'expense.categoryArchive': {
    permission: 'settings.manage',
    transactional: true,
    handler: ({ ctx, payload }) => {
      expenses.archiveExpenseCategory(ctx.db, String(payload.id));
      return { ok: true };
    },
  },
  'expense.list': {
    permission: 'expense.view',
    transactional: false,
    handler: ({ ctx, payload }) => expenses.listExpenses(ctx.db, f(payload)),
  },
  'expense.create': {
    permission: 'expense.manage',
    transactional: true,
    sensitive: true,
    handler: (c) => ({ id: expenses.createExpense(c.ctx.db, { ...c.payload, actorId: actorId(c) }) }),
  },
  'expense.void': {
    permission: 'finance.adjust',
    transactional: true,
    sensitive: true,
    handler: (c) => {
      expenses.voidExpense(c.ctx.db, { ...c.payload, actorId: actorId(c) });
      return { ok: true };
    },
  },

  // ---------- finance ----------
  'finance.accounts': {
    permission: 'finance.view',
    transactional: false,
    handler: ({ ctx }) => finance.listAccounts(ctx.db),
  },
  'finance.createAccount': {
    permission: 'finance.adjust',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => ({ id: finance.createAccount(ctx.db, payload) }),
  },
  'finance.cashInOut': {
    permission: 'finance.adjust',
    transactional: true,
    sensitive: true,
    handler: (c) => ({ id: finance.cashInOut(c.ctx.db, { ...c.payload, actorId: actorId(c) }) }),
  },
  'finance.transactions': {
    permission: 'finance.view',
    transactional: false,
    handler: ({ ctx, payload }) => finance.listFinancialTransactions(ctx.db, f(payload)),
  },
  'finance.summary': {
    permission: 'finance.view',
    transactional: false,
    handler: ({ ctx, payload }) =>
      finance.getCashSummary(ctx.db, String(payload.date ?? nowIso().slice(0, 10))),
  },
  'finance.closeCash': {
    permission: 'finance.adjust',
    transactional: true,
    sensitive: true,
    handler: (c) => {
      finance.closeCash(c.ctx.db, { ...c.payload, actorId: actorId(c) });
      return { ok: true };
    },
  },
  'finance.reconcile': {
    permission: 'finance.view',
    transactional: false,
    handler: ({ ctx }) => finance.reconcile(ctx.db),
  },
  'finance.paymentMethods': {
    permission: 'finance.view',
    transactional: false,
    handler: ({ ctx }) =>
      ctx.db.prepare('SELECT * FROM payment_methods WHERE is_active=1 ORDER BY sort_order').all(),
  },

  // ---------- reports and exports ----------
  'report.list': {
    permission: 'report.view',
    transactional: false,
    handler: () =>
      reports.REPORTS.map((r) => ({
        key: r.key,
        title: r.title,
        titleEn: r.titleEn,
        group: r.group,
        moneyColumns: r.moneyColumns ?? [],
        sortable: r.sortable,
      })),
  },
  'report.run': {
    permission: 'report.view',
    transactional: false,
    handler: ({ ctx, payload }) =>
      reports.runReport(ctx.db, String(payload.key), f(payload.filter ?? payload)),
  },
  'report.export': {
    permission: 'report.export',
    transactional: false,
    handler: async ({ ctx, payload }) => {
      const format = String(payload.format ?? 'csv') as exportsModule.ExportRequest['format'];
      if (format === 'pdf' && ctx.exportPdf) {
        const req: exportsModule.ExportRequest = {
          key: String(payload.key),
          format: 'html',
          filter: payload.filter ?? {},
        };
        const html = await exportsModule.exportReport(ctx.db, req);
        const bytes = await ctx.exportPdf(html.bytes.toString('utf8'));
        return {
          bytes: bytes.toString('base64'),
          mime: 'application/pdf',
          filename: html.filename.replace('.html', '.pdf'),
          rows: html.rows,
        };
      }
      const out = await exportsModule.exportReport(ctx.db, {
        key: String(payload.key),
        format,
        filter: payload.filter ?? {},
      });
      return { bytes: out.bytes.toString('base64'), mime: out.mime, filename: out.filename, rows: out.rows };
    },
  },
  'report.html': {
    permission: 'report.view',
    transactional: false,
    handler: async ({ ctx, payload }) => {
      const out = await exportsModule.exportReport(ctx.db, {
        key: String(payload.key),
        format: 'html',
        filter: payload.filter ?? {},
      });
      return { html: out.bytes.toString('utf8'), filename: out.filename };
    },
  },

  // ---------- printing ----------
  'printing.printers': {
    permission: 'settings.view',
    transactional: false,
    handler: async ({ ctx }) => ({
      printers: ctx.printers ? await ctx.printers() : [],
      canPrint: Boolean(ctx.printReceipt),
    }),
  },
  'printing.profiles': {
    permission: 'settings.view',
    transactional: false,
    handler: ({ ctx }) => printing.listPrinterProfiles(ctx.db),
  },
  'printing.saveProfile': {
    permission: 'settings.manage',
    transactional: true,
    handler: ({ ctx, payload }) => ({ id: printing.savePrinterProfile(ctx.db, payload) }),
  },
  'printing.print': {
    permission: 'sale.view',
    transactional: false,
    handler: async ({ ctx, payload }) => {
      if (!ctx.printReceipt)
        return { ok: false, message: 'এই পরিবেশে প্রিন্টার উপলব্ধ নয়। ইনভয়েস সংরক্ষিত আছে।' };
      const html = printing.buildReceiptHtml(
        ctx.db,
        sales.getInvoice(ctx.db, String(payload.saleId)),
        payload.options ?? {},
      );
      const result = await ctx.printReceipt(html, payload.options ?? {});
      if (result.ok) sales.incrementPrintCount(ctx.db, String(payload.saleId));
      return result;
    },
  },

  // ---------- backup ----------
  'backup.list': {
    permission: 'backup.manage',
    transactional: false,
    handler: ({ ctx }) => backup.listBackups(ctx.db),
  },
  'backup.create': {
    permission: 'backup.manage',
    transactional: false,
    sensitive: true,
    handler: ({ ctx, payload }) => backup.createBackup(ctx.db, ctx.config, payload),
  },
  'backup.verify': {
    permission: 'backup.manage',
    transactional: false,
    handler: ({ payload }) => backup.verifyBackup(String(payload.filePath), String(payload.passphrase ?? '')),
  },
  'backup.restore': {
    permission: 'backup.manage',
    transactional: false,
    sensitive: true,
    handler: ({ ctx, payload }) =>
      backup.restoreBackup(ctx, {
        filePath: String(payload.filePath),
        passphrase: payload.passphrase ? String(payload.passphrase) : undefined,
      }),
  },
  'backup.retention': {
    permission: 'backup.manage',
    transactional: false,
    handler: ({ ctx, payload }) => ({
      removed: backup.applyRetention(ctx.db, ctx.config, Number(payload.keep ?? 10)),
    }),
  },

  // ---------- users and permissions ----------
  'user.list': {
    permission: 'user.view',
    transactional: false,
    handler: ({ ctx }) =>
      ctx.db
        .prepare(
          `SELECT u.id, u.username, u.full_name, u.status, u.phone, u.last_login_at, u.created_at,
      r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.archived_at IS NULL ORDER BY u.created_at`,
        )
        .all(),
  },
  'user.create': {
    permission: 'user.manage',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => createUser(ctx.db, payload),
  },
  'user.setStatus': {
    permission: 'user.manage',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => {
      if (!['active', 'disabled', 'locked'].includes(String(payload.status)))
        throw new AppError(ERR.VALIDATION, 'অবৈধ স্ট্যাটাস।');
      ctx.db
        .prepare('UPDATE users SET status=?, updated_at=? WHERE id=?')
        .run(String(payload.status), nowIso(), String(payload.id));
      return { ok: true };
    },
  },
  'user.setRole': {
    permission: 'user.manage',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => {
      ctx.db
        .prepare('UPDATE users SET role_id=?, updated_at=? WHERE id=?')
        .run(String(payload.roleId), nowIso(), String(payload.id));
      return { ok: true };
    },
  },
  'user.roles': {
    permission: 'user.view',
    transactional: false,
    handler: ({ ctx }) => ctx.db.prepare('SELECT * FROM roles ORDER BY is_system DESC, name').all(),
  },
  'user.permissions': { permission: 'user.view', transactional: false, handler: () => PERMISSIONS },
  'user.rolePermissions': {
    permission: 'user.view',
    transactional: false,
    handler: ({ ctx }) => ctx.db.prepare('SELECT * FROM role_permissions').all(),
  },
  'user.setRolePermission': {
    permission: 'user.manage',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => {
      if (payload.enabled)
        ctx.db
          .prepare('INSERT OR IGNORE INTO role_permissions(role_id, permission_id) VALUES (?,?)')
          .run(String(payload.roleId), String(payload.permissionId));
      else
        ctx.db
          .prepare('DELETE FROM role_permissions WHERE role_id=? AND permission_id=?')
          .run(String(payload.roleId), String(payload.permissionId));
      return { ok: true };
    },
  },
  'user.createRole': {
    permission: 'user.manage',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => {
      const id = uid();
      ctx.db
        .prepare(
          'INSERT INTO roles(id, name, name_en, description, is_system, created_at) VALUES (?,?,?,?,0,?)',
        )
        .run(
          id,
          normalizeText(String(payload.name), 100),
          normalizeText(payload.nameEn ?? '', 100),
          normalizeText(payload.description ?? '', 300),
          nowIso(),
        );
      return { id };
    },
  },

  // ---------- notifications ----------
  'notification.list': {
    permission: 'dashboard.view',
    transactional: false,
    handler: ({ ctx, payload }) => notifications.listNotifications(ctx.db, f(payload)),
  },
  'notification.unread': {
    permission: 'dashboard.view',
    transactional: false,
    handler: ({ ctx }) => ({ count: notifications.unreadCount(ctx.db) }),
  },
  'notification.markRead': {
    permission: 'dashboard.view',
    transactional: true,
    handler: ({ ctx, payload }) => ({
      updated: notifications.markRead(ctx.db, payload.all ? 'all' : ((payload.ids ?? []) as string[])),
    }),
  },
  'notification.refresh': {
    permission: 'dashboard.view',
    transactional: true,
    handler: ({ ctx }) => ({ created: notifications.refreshSystemNotifications(ctx.db) }),
  },
  'notification.create': {
    permission: 'settings.manage',
    transactional: true,
    handler: ({ ctx, payload }) => ({ id: notifications.createNotification(ctx.db, payload) }),
  },

  // ---------- settings ----------
  'settings.all': {
    permission: 'settings.view',
    transactional: false,
    handler: ({ ctx }) => ({
      values: getAllSettings(ctx.db),
      business: getBusinessProfile(ctx.db),
      currency: getSetting(ctx.db, 'currency'),
    }),
  },
  'settings.get': {
    permission: 'settings.view',
    transactional: false,
    handler: ({ ctx, payload }) => ({
      key: String(payload.key),
      value: getSetting(ctx.db, String(payload.key)),
    }),
  },
  'settings.set': {
    permission: 'settings.manage',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => {
      setSetting(ctx.db, String(payload.key), payload.value);
      return { ok: true };
    },
  },
  'settings.business': {
    permission: 'settings.manage',
    transactional: true,
    sensitive: true,
    handler: ({ ctx, payload }) => updateBusinessProfile(ctx.db, payload),
  },
  'shortcuts.list': {
    permission: 'settings.view',
    transactional: false,
    handler: ({ ctx }) => shortcuts.listShortcuts(ctx.db),
  },
  'shortcuts.map': {
    permission: 'settings.view',
    transactional: false,
    handler: ({ ctx }) => shortcuts.shortcutMap(ctx.db),
  },
  'shortcuts.update': {
    permission: 'settings.manage',
    transactional: true,
    handler: ({ ctx, payload }) => {
      shortcuts.updateShortcut(ctx.db, String(payload.actionKey), String(payload.shortcut));
      return { ok: true };
    },
  },
  'audit.list': {
    permission: 'audit.view',
    transactional: false,
    handler: ({ ctx, payload }) => listAudit(ctx.db, f(payload)),
  },
  'about.get': {
    permission: null,
    transactional: false,
    handler: ({ ctx }) => ({
      productName: PRODUCT.name,
      company: PRODUCT.company,
      founder: PRODUCT.founder,
      contactEmail: PRODUCT.email,
      version: PRODUCT.version,
      buildNumber: 'dev-local',
      licenseType: 'আজীবন লাইসেন্স',
      activation: getActivation(ctx.db, ctx.config),
      business: getBusinessProfile(ctx.db),
      platform: process.platform,
      logo: 'assets/icons/merqo.png',
    }),
  },
  // ---------- development-only diagnostics ----------
  // Kept for preview/test tooling only; the real UI uses `finance.reconcile`.
  'debug.reconcile': {
    permission: 'finance.view',
    transactional: false,
    handler: ({ ctx }) => {
      if (process.env.NODE_ENV === 'production')
        throw new AppError(ERR.FORBIDDEN, 'এই অপশন প্রোডাকশনে নিষ্ক্রিয়।');
      return finance.reconcile(ctx.db);
    },
  },
};

export const ACTION_PERMISSIONS: Record<string, string | null> = Object.fromEntries(
  Object.entries(ACTIONS).map(([k, v]) => [k, v.permission]),
);
export const SYSTEM_ROLE_DEFS = SYSTEM_ROLES;

export async function dispatch(
  ctx: AppContext,
  action: string,
  payload: unknown,
  token?: string,
): Promise<Result> {
  const def = ACTIONS[action];
  if (!def) return { ok: false, error: { code: ERR.NOT_FOUND, message: `অজানা অ্যাকশন: ${action}` } };
  try {
    const actor = def.public ? null : resolveSession(ctx.db, token);
    if (!def.public && actor && !hasPermission(actor.permissions, def.permission)) {
      throw new AppError(ERR.FORBIDDEN, 'এই কাজের অনুমতি আপনার নেই।');
    }
    const call: CallContext = { ctx, actor, payload: (payload ?? {}) as any };
    const data =
      def.transactional === false
        ? await def.handler(call)
        : ctx.db.transaction(() => def.handler(call) as unknown)();
    if (def.sensitive) {
      // Outside the transaction so an audit failure never rolls back business data.
      try {
        recordAudit(ctx.db, {
          action,
          entity: String((call.payload as any)?.entity ?? action.split('.')[0] ?? ''),
          entityId: String((call.payload as any)?.id ?? ''),
          after: call.payload,
          actor,
        });
      } catch (e) {
        ctx.logger.warn('AUDIT_WRITE_FAILED', 'Audit record could not be written', {
          action,
          error: String(e),
        });
      }
    }
    return { ok: true, data };
  } catch (e) {
    const safe = toSafeError(e, ctx.config.isDevelopment);
    if (safe.code === ERR.INTERNAL) ctx.logger.error('DISPATCH_FAILED', safe.message, { action });
    return { ok: false, error: safe };
  }
}
