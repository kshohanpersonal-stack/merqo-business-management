import { describe, it, expect, afterEach } from 'vitest';
import {
  makeHarness,
  seedProduct,
  seedCustomer,
  seedSupplier,
  seedMobileAccount,
  type TestHarness,
} from '../helpers';
import { reconcile } from '../../src/core/finance';

let h: TestHarness;
afterEach(() => {
  h?.cleanup();
});

function accounts(harness: TestHarness) {
  return { cash: 'acc-cash', mobile: seedMobileAccount(harness) };
}
describe('TC-002/TC-003/TC-004 purchase → sale → payment integration', () => {
  it('updates stock, weighted-average cost, COGS, accounts and ledgers atomically', async () => {
    h = makeHarness();
    const a = accounts(h);
    const productId = seedProduct(h);
    const supplierId = seedSupplier(h);
    const customerId = seedCustomer(h);

    const purchase = (await h.call('purchase.create', {
      supplierId,
      lines: [{ productId, quantity: '10', unitPrice: '12.00' }],
      extraCost: '5.00',
      payments: [{ paymentMethodId: 'pm-cash', accountId: a.cash, amount: '125.00' }],
      idempotencyKey: 'test-purchase-1',
    })) as { totalMinor: number };
    expect(purchase.totalMinor).toBe(12500);
    let product = (await h.call('product.get', { id: productId })) as Record<string, number>;
    expect(product.current_stock_minor).toBe(20000);
    expect(product.average_cost_minor).toBe(1125); // (10×1000 + 10×1200 + 500)/20

    const payments = [
      { paymentMethodId: 'pm-cash', accountId: a.cash, amount: '20.00' },
      { paymentMethodId: 'pm-bkash', accountId: a.mobile, amount: '10.00' },
    ];
    const preview = (await h.call('sale.preview', {
      customerId,
      lines: [{ productId, quantity: '2' }],
      payments,
    })) as { totalMinor: number; cogsMinor: number; grossProfitMinor: number };
    expect(preview.totalMinor).toBe(3000);
    expect(preview.cogsMinor).toBe(2250);
    expect(preview.grossProfitMinor).toBe(750);

    const sale = (await h.call('sale.complete', {
      customerId,
      lines: [{ productId, quantity: '2' }],
      payments,
      idempotencyKey: 'test-sale-1',
    })) as { id: string; invoiceNo: string };
    expect(sale.invoiceNo).toMatch(/^INV-/);
    product = (await h.call('product.get', { id: productId })) as Record<string, number>;
    expect(product.current_stock_minor).toBe(18000);
    const saleRow = (await h.call('sale.get', { id: sale.id })) as Record<string, unknown>;
    expect(saleRow.paid_minor).toBe(3000);
    expect(saleRow.due_minor).toBe(0);
    expect((saleRow.payments as unknown[]).length).toBe(2);
    expect((saleRow.invoice as { payload_json: string }).payload_json).toContain('invoiceNo');
    const rec = reconcile(h.ctx.db);
    expect(rec.ok, JSON.stringify(rec.checks.filter((c) => !c.ok))).toBe(true);
  });

  it('rolls back the entire sale when a payment account is invalid', async () => {
    h = makeHarness();
    const productId = seedProduct(h);
    const before = (await h.call('product.get', { id: productId })) as Record<string, number>;
    const salesBefore = (h.ctx.db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }).n;
    let failed = false;
    try {
      await h.call('sale.complete', {
        lines: [{ productId, quantity: '1' }],
        payments: [{ paymentMethodId: 'pm-cash', accountId: 'DOES-NOT-EXIST', amount: '15.00' }],
      });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    const after = (await h.call('product.get', { id: productId })) as Record<string, number>;
    expect(after.current_stock_minor).toBe(before.current_stock_minor);
    expect((h.ctx.db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }).n).toBe(salesBefore);
    expect(reconcile(h.ctx.db).ok).toBe(true);
  });

  it('rejects duplicate idempotency keys', async () => {
    h = makeHarness();
    const productId = seedProduct(h);
    const a = accounts(h);
    const payload = {
      lines: [{ productId, quantity: '1' }],
      payments: [{ paymentMethodId: 'pm-cash', accountId: a.cash, amount: '15.00' }],
      idempotencyKey: 'duplicate-key-test',
    };
    await h.call('sale.complete', payload);
    await expect(h.call('sale.complete', payload)).rejects.toThrow(/আগেই/);
    expect((h.ctx.db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }).n).toBe(1);
  });

  it('handles due sale, due collection, hold/resume and cancellation reversals', async () => {
    h = makeHarness();
    const a = accounts(h);
    const productId = seedProduct(h);
    const customerId = seedCustomer(h);
    const dueSale = (await h.call('sale.complete', {
      customerId,
      lines: [{ productId, quantity: '3' }],
      payments: [{ paymentMethodId: 'pm-cash', accountId: a.cash, amount: '5.00' }],
    })) as { id: string };
    expect(((await h.call('sale.get', { id: dueSale.id })) as Record<string, number>).due_minor).toBe(4000);
    expect(((await h.call('customer.get', { id: customerId })) as Record<string, number>).balance_minor).toBe(
      4000,
    );
    await h.call('payment.collectDue', {
      customerId,
      amount: '15.00',
      accountId: a.cash,
      paymentMethodId: 'pm-cash',
    });
    expect(((await h.call('customer.get', { id: customerId })) as Record<string, number>).balance_minor).toBe(
      2500,
    );

    const hold = (await h.call('sale.hold', {
      cart: { lines: [{ productId, quantity: '1' }] },
      note: 'টেস্ট',
    })) as { reference: string };
    expect(await h.call('sale.resume', { reference: hold.reference })).toHaveProperty('lines');
    await h.call('sale.removeHeld', { reference: hold.reference });

    const beforeStock = ((await h.call('product.get', { id: productId })) as { current_stock_minor: number })
      .current_stock_minor;
    await h.call('sale.cancel', { saleId: dueSale.id, reason: 'ভুল ইনভয়েস' });
    const afterStock = ((await h.call('product.get', { id: productId })) as { current_stock_minor: number })
      .current_stock_minor;
    expect(afterStock - beforeStock).toBe(3000);
    expect(((await h.call('sale.get', { id: dueSale.id })) as Record<string, string>).status).toBe(
      'cancelled',
    );
    expect(reconcile(h.ctx.db).ok).toBe(true);
  });

  it('applies product-level percentage and fixed discounts unless a line overrides them', async () => {
    h = makeHarness();
    const percentProduct = seedProduct(h, {
      name: 'ছাড়যুক্ত চাল',
      code: 'DSCNT-1',
      barcode: 'DSCNT1',
      discountType: 'percent',
      discountValue: '10',
    });
    const fixedProduct = seedProduct(h, {
      name: 'নির্দিষ্ট ছাড়',
      code: 'DSCNT-2',
      barcode: 'DSCNT2',
      discountType: 'fixed',
      discountValue: '2.00',
    });
    const preview = (await h.call('sale.preview', {
      lines: [
        { productId: percentProduct, quantity: '1' },
        { productId: fixedProduct, quantity: '1' },
      ],
    })) as { itemDiscountMinor: number; totalMinor: number };
    expect(preview.itemDiscountMinor).toBe(350); // 10% of 15.00 = 1.50 plus fixed 2.00
    expect(preview.totalMinor).toBe(2650);
    const overridden = (await h.call('sale.preview', {
      lines: [{ productId: percentProduct, quantity: '1', discountType: 'percent', discountValue: '20' }],
    })) as { itemDiscountMinor: number };
    expect(overridden.itemDiscountMinor).toBe(300);
  });
});
