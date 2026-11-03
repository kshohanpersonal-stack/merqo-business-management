import { describe, it, expect, afterEach } from 'vitest';
import { makeHarness, seedProduct, seedCustomer, seedSupplier, type TestHarness } from '../helpers';
import { reconcile } from '../../src/core/finance';

let h: TestHarness;
afterEach(() => {
  h?.cleanup();
});

async function saleWithItems(quantity = '2') {
  const productId = seedProduct(h);
  const customerId = seedCustomer(h);
  const sale = (await h.call('sale.complete', {
    customerId,
    lines: [{ productId, quantity }],
    payments: [
      { paymentMethodId: 'pm-cash', accountId: 'acc-cash', amount: String(Number(quantity) * 15 + '.00') },
    ],
  })) as { id: string };
  const items = ((await h.call('sale.get', { id: sale.id })) as { items: { id: string }[] }).items;
  return { sale, productId, customerId, itemId: items[0]!.id };
}

describe('returns, refunds, exchange, adjustments and expenses', () => {
  it('sales return with refund restores stock and records a refund transaction', async () => {
    h = makeHarness();
    const { sale, productId, itemId } = await saleWithItems('2');
    const before = ((await h.call('product.get', { id: productId })) as { current_stock_minor: number })
      .current_stock_minor;
    const result = (await h.call('sale.return', {
      saleId: sale.id,
      lines: [{ itemId, quantity: '1' }],
      mode: 'refund',
      refundAccountId: 'acc-cash',
      reason: 'পণ্য খারাপ',
    })) as { totalMinor: number };
    expect(result.totalMinor).toBe(1500);
    const after = ((await h.call('product.get', { id: productId })) as { current_stock_minor: number })
      .current_stock_minor;
    expect(after - before).toBe(1000);
    expect((h.ctx.db.prepare('SELECT COUNT(*) AS n FROM refunds').get() as { n: number }).n).toBe(1);
    expect(((await h.call('sale.get', { id: sale.id })) as Record<string, string>).status).toBe(
      'partial_return',
    );
    expect(reconcile(h.ctx.db).ok).toBe(true);
  });

  it('sales return with adjust_due reduces the customer receivable', async () => {
    h = makeHarness();
    const productId = seedProduct(h);
    const customerId = seedCustomer(h);
    const sale = (await h.call('sale.complete', {
      customerId,
      lines: [{ productId, quantity: '2' }],
      payments: [],
    })) as { id: string };
    const itemId = ((await h.call('sale.get', { id: sale.id })) as { items: { id: string }[] }).items[0]!.id;
    expect(((await h.call('customer.get', { id: customerId })) as Record<string, number>).balance_minor).toBe(
      3000,
    );
    await h.call('sale.return', { saleId: sale.id, lines: [{ itemId, quantity: '1' }], mode: 'adjust_due' });
    expect(((await h.call('customer.get', { id: customerId })) as Record<string, number>).balance_minor).toBe(
      1500,
    );
    expect(reconcile(h.ctx.db).ok).toBe(true);
  });

  it('purchase return reduces stock and supplier payable', async () => {
    h = makeHarness();
    const productId = seedProduct(h);
    const supplierId = seedSupplier(h);
    const purchase = (await h.call('purchase.create', {
      supplierId,
      lines: [{ productId, quantity: '5', unitPrice: '12.00' }],
      payments: [],
    })) as { id: string };
    const itemId = ((await h.call('purchase.get', { id: purchase.id })) as { items: { id: string }[] })
      .items[0]!.id;
    expect(((await h.call('supplier.get', { id: supplierId })) as Record<string, number>).balance_minor).toBe(
      6000,
    );
    await h.call('purchase.return', {
      purchaseId: purchase.id,
      lines: [{ itemId, quantity: '2' }],
      reason: 'ক্ষতিগ্রস্ত',
    });
    expect(((await h.call('supplier.get', { id: supplierId })) as Record<string, number>).balance_minor).toBe(
      3600,
    );
    expect(
      ((await h.call('product.get', { id: productId })) as { current_stock_minor: number })
        .current_stock_minor,
    ).toBe(13000);
    expect(reconcile(h.ctx.db).ok).toBe(true);
  });

  it('exchange links the return and the replacement sale', async () => {
    h = makeHarness();
    const { sale, itemId } = await saleWithItems('2');
    const replacementId = seedProduct(h, {
      name: 'আটা',
      code: 'PRD-TEST-2',
      sku: 'PRD-TEST-2',
      barcode: '8900000000002',
    });
    const result = (await h.call('sale.exchange', {
      saleId: sale.id,
      returnLines: [{ itemId, quantity: '1' }],
      reason: 'বদল',
      replacementLines: [{ productId: replacementId, quantity: '1', unitPrice: '15.00' }],
      payments: [{ paymentMethodId: 'pm-cash', accountId: 'acc-cash', amount: '15.00' }],
    })) as { replacementSaleId: string };
    expect(result.replacementSaleId).toBeTruthy();
    expect((h.ctx.db.prepare('SELECT COUNT(*) AS n FROM exchanges').get() as { n: number }).n).toBe(1);
    expect(reconcile(h.ctx.db).ok).toBe(true);
  });

  it('stock adjustments and expenses are recorded and voidable', async () => {
    h = makeHarness();
    const productId = seedProduct(h);
    await h.call('inventory.adjust', {
      productId,
      direction: 'out',
      quantity: '1',
      reason: 'নষ্ট',
      note: 'টেস্ট',
    });
    expect(
      ((await h.call('product.get', { id: productId })) as { current_stock_minor: number })
        .current_stock_minor,
    ).toBe(9000);
    const expenseId = (
      (await h.call('expense.create', {
        categoryId: 'ec-rent',
        amount: '500.00',
        paymentMethodId: 'pm-cash',
        accountId: 'acc-cash',
        description: 'দোকান ভাড়া',
      })) as { id: string }
    ).id;
    await h.call('expense.void', { id: expenseId, reason: 'ভুল এন্ট্রি' });
    const exp = h.ctx.db.prepare('SELECT voided_at FROM expenses WHERE id=?').get(expenseId) as {
      voided_at: string;
    };
    expect(exp.voided_at).toBeTruthy();
    expect(reconcile(h.ctx.db).ok).toBe(true);
  });

  it('supports configurable VAT and discounts', async () => {
    h = makeHarness();
    const productId = seedProduct(h);
    await h.call('settings.set', {
      key: 'tax',
      value: { enabled: true, rateBps: 500, mode: 'exclusive', label: 'ভ্যাট' },
    });
    const preview = (await h.call('sale.preview', {
      lines: [{ productId, quantity: '2', discountType: 'percent', discountValue: '10' }],
      payments: [],
    })) as { subtotalMinor: number; itemDiscountMinor: number; taxMinor: number; totalMinor: number };
    expect(preview.subtotalMinor).toBe(3000);
    expect(preview.itemDiscountMinor).toBe(300);
    expect(preview.taxMinor).toBe(135);
    expect(preview.totalMinor).toBe(2835);
  });
});
