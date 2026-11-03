/** Thermal receipt rendering (58mm / 80mm) and ESC/POS fallback. */
import { escapeHtml } from './exports';
import { fontDataUri } from './paths';
import { uid, nowIso } from './util';
import { getBusinessProfile, getSetting } from './settings';
import type { DB } from './db';
import type { FilterPayload } from './types';
import { pagedQuery } from './util';

export interface ReceiptOptions {
  width?: '58mm' | '80mm';
  fontSize?: number;
  alignment?: 'left' | 'center' | 'right';
  duplicate?: boolean;
  cut?: boolean;
}
export function buildReceiptHtml(
  db: DB,
  invoice: Record<string, unknown>,
  opts: ReceiptOptions = {},
): string {
  const settings = getSetting<{
    width?: '58mm' | '80mm';
    font?: number;
    alignment?: string;
    footer?: string;
    duplicate?: boolean;
    cut?: boolean;
  }>(db, 'receipt');
  const width = opts.width ?? settings.width ?? '80mm';
  const fontSize = opts.fontSize ?? settings.font ?? 12;
  const align = opts.alignment ?? settings.alignment ?? 'left';
  const profile = getBusinessProfile(db);
  const business = (invoice.business as Record<string, unknown> | undefined) ?? {};
  const lines = (invoice.lines as Record<string, unknown>[]) ?? [];
  const fontUrl = fontDataUri('fonts/noto-sans-bengali-bengali-400-normal.woff2');
  const mm = width === '58mm' ? 58 : 80;
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><style>
    @font-face{font-family:'NotoBn';src:url('${fontUrl}') format('woff2')}
    @page{margin:0} body{margin:0;padding:${width === '58mm' ? '3mm 2mm' : '4mm 5mm'};width:${mm}mm;
      font-family:'NotoBn',Segoe UI,sans-serif;font-size:${fontSize}px;color:#12233B;text-align:${align}}
    .logo{width:26mm;height:26mm;object-fit:contain;display:block;margin:0 auto 2mm}
    h1{font-size:${fontSize + 3}px;margin:0 0 2mm} .muted{font-size:${fontSize - 2}px;color:#475569}
    hr{border:0;border-top:1px dashed #94A3B8;margin:2mm 0}
    table{width:100%;border-collapse:collapse;font-size:${fontSize - 1}px}
    td{padding:1mm 0;vertical-align:top} .right{text-align:right} .center{text-align:center}
    .total{font-weight:bold;font-size:${fontSize + 1}px} .footer{margin-top:3mm;text-align:center;font-size:${fontSize - 1}px}
  </style></head><body>
  ${profile.logo_path || business.logoPath ? `<img class="logo" src="${escapeHtml(profile.logo_path || business.logoPath)}">` : ''}
  <h1>${escapeHtml(business.name ?? profile.business_name)}</h1>
  <div class="muted">${escapeHtml(business.address ?? profile.address)}</div>
  <div class="muted">${escapeHtml(business.phone ?? profile.phone)}</div>
  ${business.taxRegistration ? `<div class="muted">${escapeHtml(business.taxRegistration)}</div>` : ''}
  <hr>
  <div>ইনভয়েস: <b>${escapeHtml(invoice.invoiceNo)}</b></div>
  <div>তারিখ: ${escapeHtml(invoice.date)} ${escapeHtml(invoice.time ?? '')}</div>
  <div>কাস্টমার: ${escapeHtml((invoice.customer as Record<string, unknown> | undefined)?.name ?? 'ওয়াক-ইন কাস্টমার')}</div>
  <hr>
  <table><tbody>
  ${lines.map((l) => `<tr><td>${escapeHtml(l.name)}<br><span class="muted">${escapeHtml(l.quantity)} ${escapeHtml(l.unit)} × ${escapeHtml(l.unitPrice)}</span></td><td class="right">${escapeHtml(l.lineTotal)}</td></tr>`).join('')}
  </tbody></table>
  <hr>
  <table><tbody>
    <tr><td>সাবটোটাল</td><td class="right">${escapeHtml(invoice.subtotal)}</td></tr>
    <tr><td>ডিসকাউন্ট</td><td class="right">${escapeHtml((Number(invoice.itemDiscount) || 0) + (Number(invoice.cartDiscount) || 0))}</td></tr>
    <tr><td>ভ্যাট/ট্যাক্স</td><td class="right">${escapeHtml(invoice.tax ?? 0)}</td></tr>
    <tr><td class="total">মোট</td><td class="right total">${escapeHtml(invoice.total)}</td></tr>
    <tr><td>পরিশোধ</td><td class="right">${escapeHtml(invoice.paid)}</td></tr>
    <tr><td>বাকি</td><td class="right">${escapeHtml(invoice.due)}</td></tr>
  </tbody></table>
  <hr>
  <div class="footer">${escapeHtml(invoice.footer ?? settings.footer ?? profile.invoice_footer)}<br>${escapeHtml(invoice.thankYou ?? 'ধন্যবাদ!')}</div>
  ${(opts.duplicate ?? settings.duplicate) ? '<div class="center muted">— ডুপ্লিকেট কপি —</div>' : ''}
  </body></html>`;
}
export function buildEscPos(invoice: Record<string, unknown>, width: '58mm' | '80mm' = '80mm'): Buffer {
  // ASCII-only fast path for printers with a built-in code page; Bangla output uses the
  // Chromium-rendered HTML receipt above (thermal printers rarely shape Indic text).
  const chars = width === '58mm' ? 32 : 48;
  const line = '-'.repeat(chars);
  const chunks: Buffer[] = [];
  const push = (s: string) => chunks.push(Buffer.from(s, 'utf8'));
  chunks.push(Buffer.from([0x1b, 0x40])); // init
  chunks.push(Buffer.from([0x1b, 0x61, 0x01])); // center
  const business = (invoice.business as Record<string, unknown> | undefined) ?? {};
  push(`${business.name ?? 'MERQO'}\n${business.address ?? ''}\n${business.phone ?? ''}\n`);
  chunks.push(Buffer.from([0x1b, 0x61, 0x00])); // left
  push(`${line}\nInvoice: ${invoice.invoiceNo ?? ''}\nDate: ${invoice.date ?? ''}\n${line}\n`);
  for (const l of (invoice.lines as Record<string, unknown>[]) ?? [])
    push(`${l.name ?? ''}  ${l.quantity ?? ''} x ${l.unitPrice ?? ''}  ${l.lineTotal ?? ''}\n`);
  push(
    `${line}\nTOTAL: ${invoice.total ?? ''}\nPAID: ${invoice.paid ?? ''}\nDUE: ${invoice.due ?? ''}\n${line}\n`,
  );
  chunks.push(Buffer.from([0x1b, 0x61, 0x01]));
  push(`${invoice.footer ?? ''}\n${invoice.thankYou ?? ''}\n\n\n`);
  chunks.push(Buffer.from([0x1d, 0x56, 0x42, 0x00])); // partial cut
  return Buffer.concat(chunks);
}
export function listPrinterProfiles(db: DB): Record<string, unknown>[] {
  return db.prepare('SELECT * FROM printer_profiles ORDER BY is_default DESC, name').all() as Record<
    string,
    unknown
  >[];
}
export function savePrinterProfile(db: DB, input: Record<string, unknown>): string {
  const id = String(input.id ?? uid());
  db.prepare(
    `INSERT INTO printer_profiles(id, name, device_name, paper_width, font_size, alignment,
    characters_per_line, cut_paper, print_duplicate, is_default, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, device_name=excluded.device_name,
    paper_width=excluded.paper_width, font_size=excluded.font_size, alignment=excluded.alignment,
    characters_per_line=excluded.characters_per_line, cut_paper=excluded.cut_paper,
    print_duplicate=excluded.print_duplicate, is_default=excluded.is_default`,
  ).run(
    id,
    String(input.name ?? 'থার্মাল প্রিন্টার'),
    String(input.deviceName ?? ''),
    String(input.paperWidth ?? '80mm'),
    Number(input.fontSize ?? 12),
    String(input.alignment ?? 'left'),
    Number(input.charactersPerLine ?? 32),
    input.cut === false ? 0 : 1,
    input.duplicate ? 1 : 0,
    input.isDefault ? 1 : 0,
    nowIso(),
  );
  return id;
}
export function listInvoices(db: DB, filter: FilterPayload) {
  return pagedQuery(
    db,
    `SELECT i.*, s.total_minor, s.status FROM invoices i JOIN sales s ON s.id=i.sale_id WHERE 1=1`,
    [],
    filter,
    ['i.created_at', 'i.invoice_no'],
    'i.created_at',
  );
}
