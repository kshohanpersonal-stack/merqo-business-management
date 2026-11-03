import { describe, it, expect, afterEach } from 'vitest';
import { makeHarness, type TestHarness } from '../helpers';
import { listProducts } from '../../src/core/catalog';
import { getDashboard } from '../../src/core/analytics';
import { uid, nowIso } from '../../src/core/util';

let h: TestHarness;
afterEach(() => {
  h?.cleanup();
});

describe('TC-008 large-dataset performance', () => {
  it('indexes 10,000 products and keeps search and dashboard queries fast', () => {
    h = makeHarness();
    const insert = h.ctx.db.prepare(`INSERT INTO products(id, name, name_en, code, sku, barcode,
      unit_id, selling_price_minor, purchase_price_minor, current_stock_minor, min_stock_minor,
      created_at, updated_at) VALUES (?,?,?,?,?,?,'u-piece',?,?,?,?,?,?)`);
    const stamp = nowIso();
    h.ctx.db.transaction(() => {
      for (let i = 0; i < 10_000; i++) {
        insert.run(
          uid(),
          `প্রোডাক্ট ${i}`,
          `Product ${i}`,
          `P${i}`,
          `S${i}`,
          `890${String(i).padStart(10, '0')}`,
          1000 + i,
          700 + i,
          10_000,
          2_000,
          stamp,
          stamp,
        );
      }
    })();
    h.ctx.db.exec('ANALYZE');
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const t = performance.now();
      const page = listProducts(h.ctx.db, { search: `প্রোডাক্ট ${(i * 137) % 10000}`, pageSize: 25 });
      times.push(performance.now() - t);
      expect(page.rows.length).toBeGreaterThan(0);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)]!;
    const tDash = performance.now();
    const dash = getDashboard(h.ctx.db, {});
    const dashMs = performance.now() - tDash;
    expect((dash.kpis as Record<string, number>).totalProducts).toBe(10_000);
    // Generous CI-safe bounds: this checks for pathological full-scan regressions.
    expect(p95).toBeLessThan(250);
    expect(dashMs).toBeLessThan(1500);
    console.log(
      `[performance] 10k products: search p95=${p95.toFixed(1)}ms, dashboard=${dashMs.toFixed(1)}ms`,
    );
  });
});
