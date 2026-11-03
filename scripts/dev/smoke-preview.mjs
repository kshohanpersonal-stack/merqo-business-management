/**
 * End-to-end smoke test of the live preview /api bridge.
 * Requires `npm run dev` to be running. Uses the ignored development licence only.
 * Writes business data ONLY to the preview's local development data directory.
 */
import { readFileSync } from 'node:fs';

const base = process.env.MERQO_PREVIEW_URL ?? 'http://localhost:5173';
let token = '';
const results = [];
async function call(action, payload = {}, publicCall = false) {
  const res = await fetch(`${base}/api`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, payload, token: publicCall ? '' : token }),
  });
  const out = await res.json();
  if (!out.ok) throw new Error(`${action}: ${out.error?.code} ${out.error?.message}`);
  return out.data;
}
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) process.exitCode = 1;
}
let licence;
try {
  const res = await fetch(`${base}/api/dev-license`);
  licence = res.ok ? (await res.json()).text : readFileSync('private/dev-license.merqolic', 'utf8');
} catch { licence = readFileSync('private/dev-license.merqolic', 'utf8'); }

const before = await call('bootstrap.status', {}, true);
check('fresh database reports activation required', before.needsActivation === true, `integrity=${before.integrity}`);
const activation = await call('license.activate', { text: licence }, true);
check('Ed25519 offline activation', activation.activated === true, activation.licenseId);
const setup = await call('bootstrap.setup', {
  business: { business_name: 'MERQO প্রিভিউ যাচাই', phone: '০১৭০০০০০০০০', invoice_footer: 'ধন্যবাদ!' },
  fullName: 'পরীক্ষা অ্যাডমিন', username: 'smokeadmin', password: 'SmokeTest123!',
  settings: { currency: { code: 'BDT', symbol: '৳', position: 'before', decimals: 2 } },
}, true);
token = setup.token;
check('first-run setup creates session', Boolean(token) && setup.actor?.permissions?.length > 0);
const me = await call('auth.me');
check('session resolves actor', me.username === 'smokeadmin');
const product = await call('product.create', { name: 'পরীক্ষা পণ্য', sellingPrice: '100.00', purchasePrice: '70.00',
  openingStock: '50', unitId: 'u-piece', minStock: '5', discountType: 'percent', discountValue: '10' });
check('product created with Bangla name', Boolean(product.id));
const products = await call('product.list', { search: 'পরীক্ষা' });
check('Bangla product search', products.rows?.[0]?.name === 'পরীক্ষা পণ্য');
const accounts = await call('finance.accounts');
check('default cash account present', Array.isArray(accounts) && accounts.length > 0);
const sale = await call('sale.complete', {
  lines: [{ productId: product.id, quantity: '2' }],
  payments: [{ paymentMethodId: 'pm-cash', accountId: accounts[0].id, amount: '180.00' }],
  idempotencyKey: `smoke-sale-${Date.now()}`,
});
check('completed sale applies product discount', sale.preview?.totalMinor === 18000, `total=${sale.preview?.totalMinor}`);
const dashboard = await call('dashboard.get', {});
check('dashboard reads real database figures', dashboard.kpis?.todaySales === 18000, `sales=${dashboard.kpis?.todaySales}`);
const report = await call('report.run', { key: 'daily-sales', filter: {} });
check('sales report returns real rows', (report.rows?.length ?? 0) > 0);
const backup = await call('backup.create', { trigger: 'manual', note: 'smoke test' });
check('backup created and verified', backup.valid === true);
const reconcile = await call('finance.reconcile');
check('financial reconciliation passes', reconcile.ok === true);

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} preview API smoke checks passed.`);
