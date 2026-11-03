import { describe, it, expect, afterEach } from 'vitest';
import { makeHarness, seedProduct, seedCustomer, seedSupplier, type TestHarness } from '../helpers';
import { REPORTS } from '../../src/core/reports';

let h: TestHarness;
afterEach(() => {
  h?.cleanup();
});

async function seedBusiness() {
  const productId = seedProduct(h);
  const customerId = seedCustomer(h, 'বাংলা কাস্টমার');
  const supplierId = seedSupplier(h, 'বাংলা সাপ্লায়ার');
  await h.call('purchase.create', {
    supplierId,
    lines: [{ productId, quantity: '5', unitPrice: '12.00' }],
    payments: [{ paymentMethodId: 'pm-cash', accountId: 'acc-cash', amount: '30.00' }],
  });
  await h.call('sale.complete', {
    customerId,
    lines: [{ productId, quantity: '2' }],
    payments: [{ paymentMethodId: 'pm-cash', accountId: 'acc-cash', amount: '20.00' }],
    note: 'বাংলা নোট',
  });
  await h.call('expense.create', {
    categoryId: 'ec-rent',
    amount: '100.00',
    paymentMethodId: 'pm-cash',
    accountId: 'acc-cash',
    description: 'দোকান ভাড়া',
  });
  await h.call('inventory.adjust', { productId, direction: 'out', quantity: '1', reason: 'নষ্ট' });
  return { productId, customerId, supplierId };
}

describe('reporting and export system', () => {
  it('registers exactly 28 report families and runs every one against real data', async () => {
    h = makeHarness();
    await seedBusiness();
    expect(REPORTS.length).toBe(28);
    for (const def of REPORTS) {
      const result = (await h.call('report.run', { key: def.key, filter: {} })) as {
        rows: unknown[];
        total: number;
      };
      expect(result, def.key).toHaveProperty('rows');
      expect(Array.isArray(result.rows), def.key).toBe(true);
    }
    const daily = (await h.call('report.run', { key: 'daily-sales', filter: {} })) as {
      totals: Record<string, number>;
    };
    expect(daily.totals.total_minor).toBe(3000);
    const pl = (await h.call('report.run', { key: 'profit-loss', filter: {} })) as {
      rows: Record<string, number>[];
    };
    expect(pl.rows[0]?.net_profit_minor).toBe((daily.totals.gross_profit_minor ?? 0) - 10000); // gross profit - expense
  });

  it('exports CSV, XLSX, PDF and HTML with Bangla content and correct totals', async () => {
    h = makeHarness();
    await seedBusiness();
    const csv = (await h.call('report.export', { key: 'custom-sales', format: 'csv', filter: {} })) as {
      bytes: string;
      mime: string;
    };
    const csvBuf = Buffer.from(csv.bytes, 'base64');
    expect(csvBuf.subarray(0, 3).toString('hex')).toBe('efbbbf'); // UTF-8 BOM
    const csvText = csvBuf.toString('utf8');
    expect(csvText).toContain('ইনভয়েস নং');
    expect(csvText).toContain('30.00');
    expect(csv.mime).toContain('text/csv');

    const xlsx = (await h.call('report.export', { key: 'custom-sales', format: 'xlsx', filter: {} })) as {
      bytes: string;
    };
    const xlsxBuf = Buffer.from(xlsx.bytes, 'base64');
    expect(xlsxBuf.subarray(0, 2).toString()).toBe('PK');
    expect(xlsxBuf.length).toBeGreaterThan(3000);

    const pdf = (await h.call('report.export', { key: 'custom-sales', format: 'pdf', filter: {} })) as {
      bytes: string;
    };
    const pdfBuf = Buffer.from(pdf.bytes, 'base64');
    expect(pdfBuf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfBuf.length).toBeGreaterThan(1000);

    const html = (await h.call('report.html', { key: 'daily-sales', filter: {} })) as { html: string };
    expect(html.html).toContain('@font-face');
    expect(html.html).toContain('দৈনিক সেল রিপোর্ট');
    expect(html.html).toContain('<table>');
  });

  it('applies date, search, sort and pagination filters', async () => {
    h = makeHarness();
    await seedBusiness();
    const today = new Date().toISOString().slice(0, 10);
    const inRange = (await h.call('report.run', {
      key: 'custom-sales',
      filter: { from: today, to: today, search: 'INV', sortBy: 'total_minor', sortDir: 'desc', pageSize: 1 },
    })) as { rows: unknown[]; total: number; pageSize: number };
    expect(inRange.pageSize).toBe(1);
    expect(inRange.total).toBeGreaterThan(0);
    const future = (await h.call('report.run', {
      key: 'custom-sales',
      filter: { from: '2099-01-01', to: '2099-12-31' },
    })) as { rows: unknown[] };
    expect(future.rows.length).toBe(0);
  });
});
