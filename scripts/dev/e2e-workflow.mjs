/**
 * Full 18-step owner workflow against the real /api dispatcher and a real SQLite file.
 * Starts an isolated preview, activates with the ignored development licence, performs
 * setup, master data, purchase, POS checkout, receipt, due collection, return, expense,
 * reports, backup/restore, then restarts the server and verifies persistence.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const OUT = 'docs/e2e-workflow.json';
const results = [];
const errors = [];
let token = '';
let base = '';
let server = null;
let dataDir = '';

function freePort() {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address()?.port ?? 0;
      srv.close(() => resolvePort(port));
    });
  });
}

async function waitForHealth(url, timeoutMs = 40_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Preview did not become healthy at ${url}`);
}

function startServer(port) {
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, MERQO_DATA_DIR: dataDir, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});
  return child;
}

function stopServer(child) {
  if (!child) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

async function call(action, payload = {}, publicCall = false) {
  const res = await fetch(`${base}/api`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, payload, token: publicCall ? '' : token }),
  });
  const out = await res.json();
  if (!out.ok) throw new Error(`${action}: ${out.error?.code} ${out.error?.message}`);
  return out.data;
}

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail: String(detail) });
  if (!ok) errors.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  execFileSync(process.execPath, ['scripts/dev/ensure-dev-license.mjs'], { stdio: 'inherit' });
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  dataDir = join(tmpdir(), `merqo-e2e-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  server = startServer(port);
  await waitForHealth(base);

  try {
    // 1. First launch
    const fresh = await call('bootstrap.status', {}, true);
    check('01 first launch reports activation required', fresh.needsActivation === true && fresh.integrity === true,
      `needsActivation=${fresh.needsActivation} integrity=${fresh.integrity}`);

    // 2. Offline activation
    const licenceRes = await fetch(`${base}/api/dev-license`);
    const licence = (await licenceRes.json()).text;
    const activation = await call('license.activate', { text: licence }, true);
    check('02 Ed25519 offline activation', activation.activated === true, activation.licenseId);

    // 3. Initial setup + owner login
    const setup = await call('bootstrap.setup', {
      business: {
        business_name: 'MERQO ইন্টিগ্রেশন ব্যবসা',
        business_name_en: 'MERQO Integration Business',
        address: 'টাঙ্গাইল, বাংলাদেশ',
        phone: '01700000000',
        email: 'owner@merqo.local',
        invoice_footer: 'ধন্যবাদ! আবার আসুন।',
      },
      fullName: 'মালিক অ্যাডমিন',
      username: 'owner',
      password: 'OwnerTest123!',
      settings: { currency: { code: 'BDT', symbol: '৳', position: 'before', decimals: 2 }, language: 'bn' },
    }, true);
    token = setup.token;
    check('03 setup creates owner session and permissions', Boolean(token) && setup.actor?.permissions?.length > 0,
      `permissions=${setup.actor?.permissions?.length ?? 0}`);

    // 4. Authenticated session
    const me = await call('auth.me');
    check('04 owner login / session resolves actor', me.username === 'owner', me.username);

    // 5. Product creation
    const product = await call('product.create', {
      name: 'ইন্টিগ্রেশন চাল', nameEn: 'Integration Rice', code: 'E2E-RICE', sku: 'E2E-RICE',
      barcode: '8901234567890', purchasePrice: '70.00', sellingPrice: '100.00',
      wholesalePrice: '90.00', openingStock: '50', minStock: '5', unitId: 'u-piece',
    });
    check('05 product created with SKU/barcode', Boolean(product.id), product.id);

    // 6. Customer creation
    const customer = await call('customer.create', {
      name: 'ইন্টিগ্রেশন গ্রাহক', nameEn: 'Integration Customer', phone: '01800000000',
      address: 'ঢাকা', openingBalance: '0',
    });
    check('06 customer created', Boolean(customer.id), customer.id);

    // 7. Supplier creation
    const supplier = await call('supplier.create', {
      name: 'ইন্টিগ্রেশন সরবরাহকারী', nameEn: 'Integration Supplier', phone: '01900000000',
      address: 'চট্টগ্রাম', openingBalance: '0',
    });
    check('07 supplier created', Boolean(supplier.id), supplier.id);

    const accounts = await call('finance.accounts');
    const accountId = accounts[0]?.id ?? 'acc-cash';
    const beforeProduct = await call('product.get', { id: product.id });

    // 8. Purchase creation updates stock and supplier ledger
    const purchase = await call('purchase.create', {
      supplierId: supplier.id,
      lines: [{ productId: product.id, quantity: '10', unitPrice: '70.00' }],
      extraCost: '5.00',
      payments: [{ paymentMethodId: 'pm-cash', accountId, amount: '300.00' }],
      idempotencyKey: `e2e-purchase-${Date.now()}`,
    });
    const afterPurchase = await call('product.get', { id: product.id });
    const supplierAfterPurchase = await call('supplier.get', { id: supplier.id });
    check('08 purchase increases stock and supplier payable',
      purchase.totalMinor > 0 && afterPurchase.current_stock_minor > beforeProduct.current_stock_minor &&
        supplierAfterPurchase.balance_minor > 0,
      `total=${purchase.totalMinor} stock=${beforeProduct.current_stock_minor}→${afterPurchase.current_stock_minor} payable=${supplierAfterPurchase.balance_minor}`);

    // 9. Stock verification / inventory summary
    const inv = await call('inventory.summary');
    check('09 inventory summary reflects real stock',
      inv && Number(inv.totalProducts ?? inv.products ?? 0) >= 1,
      JSON.stringify(inv).slice(0, 160));

    // 10. POS checkout with partial payment and duplicate-checkout guard
    const salePayload = {
      customerId: customer.id,
      lines: [{ productId: product.id, quantity: '2' }],
      payments: [{ paymentMethodId: 'pm-cash', accountId, amount: '50.00' }],
      idempotencyKey: `e2e-sale-${Date.now()}`,
    };
    const preview = await call('sale.preview', salePayload);
    const sale = await call('sale.complete', salePayload);
    const saleRow = await call('sale.get', { id: sale.id });
    let duplicateRejected = false;
    try {
      await call('sale.complete', salePayload);
    } catch {
      duplicateRejected = true;
    }
    check('10 POS checkout persists sale, due and rejects duplicate checkout',
      preview.totalMinor > 0 && Boolean(sale.invoiceNo) && saleRow.due_minor > 0 && duplicateRejected,
      `invoice=${sale.invoiceNo} total=${preview.totalMinor} due=${saleRow.due_minor} duplicateRejected=${duplicateRejected}`);

    // 11. Receipt generation / ESC-POS / reprint
    const html = await call('invoice.receiptHtml', { saleId: sale.id, options: { width: '80mm' } });
    const escPos = await call('invoice.escPos', { saleId: sale.id, width: '58mm' });
    const reprint = await call('invoice.reprint', { saleId: sale.id });
    check('11 receipt HTML, 58mm ESC/POS and reprint generated',
      typeof html === 'string' && html.includes(sale.invoiceNo) && typeof escPos === 'string' && escPos.length > 0 &&
        reprint.printedCount >= 1,
      `html=${html.length} escPos=${escPos.length} printed=${reprint.printedCount}`);

    // 12. Due collection
    await call('payment.collectDue', {
      customerId: customer.id, amount: String(saleRow.due_minor / 100),
      accountId, paymentMethodId: 'pm-cash', note: 'ইন্টিগ্রেশন বাকি আদায়',
    });
    const customerAfterPayment = await call('customer.get', { id: customer.id });
    check('12 partial payment / due collection clears customer balance',
      customerAfterPayment.balance_minor === 0,
      `balance=${customerAfterPayment.balance_minor}`);

    // 13. Sales return restores stock
    const itemId = saleRow.items?.[0]?.id;
    const stockBeforeReturn = (await call('product.get', { id: product.id })).current_stock_minor;
    const returned = await call('sale.return', {
      saleId: sale.id, lines: [{ itemId, quantity: '1' }], mode: 'refund',
      refundAccountId: accountId, reason: 'ইন্টিগ্রেশন রিটার্ন',
    });
    const stockAfterReturn = (await call('product.get', { id: product.id })).current_stock_minor;
    check('13 sales return restores stock and records refund',
      returned.totalMinor > 0 && stockAfterReturn > stockBeforeReturn,
      `refund=${returned.totalMinor} stock=${stockBeforeReturn}→${stockAfterReturn}`);

    // 14. Expense creation
    const expense = await call('expense.create', {
      categoryId: 'ec-rent', amount: '100.00', paymentMethodId: 'pm-cash', accountId,
      description: 'ইন্টিগ্রেশন দোকান ভাড়া', expenseDate: new Date().toISOString().slice(0, 10),
    });
    check('14 expense created', Boolean(expense.id ?? expense.expenseId), JSON.stringify(expense).slice(0, 100));

    // 15. Reports and exports use real data
    const reportList = await call('report.list');
    const daily = await call('report.run', { key: 'daily-sales', filter: {} });
    const pl = await call('report.run', { key: 'profit-loss', filter: {} });
    const csv = await call('report.export', { key: 'daily-sales', format: 'csv', filter: {} });
    check('15 28 reports, daily-sales rows, P&L and CSV export',
      (reportList.length ?? reportList.rows?.length ?? 0) === 28 && daily.rows?.length > 0 &&
        pl && typeof csv.bytes === 'string' && csv.bytes.length > 0 && String(csv.filename).endsWith('.csv'),
      `reports=${reportList.length ?? reportList.rows?.length} rows=${daily.rows?.length} csv=${csv.filename}`);

    // 16. Backup, verify, mutation, restore
    const backup = await call('backup.create', { trigger: 'manual', note: 'e2e workflow' });
    const verified = await call('backup.verify', { filePath: backup.filePath });
    await call('product.create', {
      name: 'অস্থায়ী পণ্য', nameEn: 'Temporary Product', code: 'E2E-TEMP', sku: 'E2E-TEMP',
      barcode: '8901234567891', sellingPrice: '10.00', purchasePrice: '5.00', openingStock: '1', unitId: 'u-piece',
    });
    const restored = await call('backup.restore', { filePath: backup.filePath });
    const productsAfterRestore = await call('product.list', { pageSize: 100 });
    check('16 backup verified, restore recovers pre-mutation data',
      backup.valid === true && verified.valid === true && restored.valid === true &&
        (productsAfterRestore.rows?.length ?? 0) === 1,
      `backup=${backup.filePath.split('/').pop()} products=${productsAfterRestore.rows?.length}`);

    // 17. Restart and data verification
    stopServer(server);
    server = null;
    await new Promise((r) => setTimeout(r, 600));
    server = startServer(port);
    await waitForHealth(base);
    const afterRestart = await call('bootstrap.status', {}, true);
    const meAfterRestart = await call('auth.me');
    const productsAfterRestart = await call('product.list', { pageSize: 100 });
    const salesAfterRestart = await call('sale.list', { pageSize: 100 });
    const dashboardAfterRestart = await call('dashboard.get', {});
    check('17 restart preserves activation, session, products, sales and dashboard',
      afterRestart.needsActivation === false && afterRestart.needsSetup === false &&
        meAfterRestart.username === 'owner' && (productsAfterRestart.rows?.length ?? 0) === 1 &&
        (salesAfterRestart.rows?.length ?? 0) >= 1 && dashboardAfterRestart.kpis?.todaySales > 0,
      `products=${productsAfterRestart.rows?.length} sales=${salesAfterRestart.rows?.length} todaySales=${dashboardAfterRestart.kpis?.todaySales}`);

    // 18. Final reconciliation and audit trail
    const reconcile = await call('finance.reconcile');
    const audit = await call('audit.list', { pageSize: 100 });
    check('18 finance reconciliation and audit trail pass after restore/restart',
      reconcile.ok === true && (audit.rows?.length ?? 0) > 0,
      `checks=${reconcile.checks?.length ?? '?'} audit=${audit.rows?.length ?? 0}`);
  } catch (err) {
    errors.push(`EXCEPTION ${err?.stack ?? err}`);
  } finally {
    stopServer(server);
  }

  const passed = results.filter((r) => r.ok).length;
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    base,
    dataDir,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
    errors,
  }, null, 2));
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  console.log(`${passed}/${results.length} end-to-end workflow checks passed.`);
  if (errors.length) {
    for (const e of errors) console.error(`[e2e] ${e}`);
    process.exitCode = 1;
  }
}

await main();
