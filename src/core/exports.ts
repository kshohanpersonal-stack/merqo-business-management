/** CSV / XLSX / PDF export and Chromium-ready HTML report rendering. */
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { DB } from './db';
import type { FilterPayload } from './types';
import { runReport, type ReportDef } from './reports';
import { formatMoney, formatQuantity, toBanglaDigits } from './money';
import { getBusinessProfile, moneyFormat } from './settings';
import { findAsset, fontDataUri } from './paths';
import { AppError, ERR } from './errors';

export interface ExportColumn {
  key: string;
  label: string;
  money?: boolean;
  quantity?: boolean;
}
export function columnsForReport(def: ReportDef, rows: Record<string, unknown>[]): ExportColumn[] {
  const keys = rows.length ? Object.keys(rows[0]!) : ['period', 'total_minor'];
  return keys
    .filter((k) => !k.endsWith('_json'))
    .map((k) => ({
      key: k,
      label: banglaHeader(k),
      money: (def.moneyColumns ?? []).includes(k) || k.endsWith('_minor'),
      quantity: k.endsWith('qty_minor') || k === 'current_stock_minor',
    }));
}
const HEADERS: Record<string, string> = {
  period: 'সময়কাল',
  sale_date: 'তারিখ',
  purchase_date: 'ক্রয়ের তারিখ',
  expense_date: 'খরচের তারিখ',
  invoice_no: 'ইনভয়েস নং',
  name: 'নাম',
  product_name: 'প্রোডাক্ট',
  customer_name: 'কাস্টমার',
  supplier_name: 'সাপ্লায়ার',
  category_name: 'ক্যাটাগরি',
  account_name: 'অ্যাকাউন্ট',
  total_minor: 'মোট',
  paid_minor: 'পরিশোধিত',
  due_minor: 'বাকি',
  amount_minor: 'টাকা',
  quantity_minor: 'পরিমাণ',
  current_stock_minor: 'বর্তমান স্টক',
  balance_minor: 'ব্যালেন্স',
  gross_profit_minor: 'মোট লাভ',
  net_profit_minor: 'নিট লাভ',
  expenses_minor: 'খরচ',
  revenue_minor: 'আয়',
  cogs_minor: 'পণ্যের খরচ',
  profit_minor: 'লাভ',
  tax_minor: 'ভ্যাট/ট্যাক্স',
  invoice_count: 'ইনভয়েস সংখ্যা',
  kind: 'ধরন',
  action: 'কাজ',
  actor_name: 'ব্যবহারকারী',
  created_at: 'সময়',
  status: 'অবস্থা',
  reason: 'কারণ',
  code: 'কোড',
  phone: 'ফোন',
};
export function banglaHeader(key: string): string {
  return HEADERS[key] ?? key.replace(/_minor$/, '').replace(/_/g, ' ');
}
export function cellValue(
  row: Record<string, unknown>,
  col: ExportColumn,
  fmt: ReturnType<typeof moneyFormat>,
): string {
  const raw = row[col.key];
  if (raw === null || raw === undefined) return '';
  if (col.quantity && typeof raw === 'number') return formatQuantity(raw, 3, fmt.banglaDigits);
  if (col.money && typeof raw === 'number')
    return formatMoney(raw, {
      symbol: fmt.symbol,
      position: fmt.position,
      banglaDigits: fmt.banglaDigits,
      decimals: fmt.decimals,
    });
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 16).replace('T', ' ');
  return String(raw);
}
export function buildCsv(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  fmt: ReturnType<typeof moneyFormat>,
): Buffer {
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => quote(c.label)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => quote(cellValue(row, c, fmt))).join(','));
  return Buffer.from('\uFEFF' + lines.join('\r\n') + '\r\n', 'utf8');
}
export async function buildXlsx(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  def: ReportDef,
  fmt: ReturnType<typeof moneyFormat>,
  totals: Record<string, number>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MERQO';
  wb.created = new Date();
  const ws = wb.addWorksheet('রিপোর্ট', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.mergeCells(1, 1, 1, Math.max(1, columns.length));
  const title = ws.getCell(1, 1);
  title.value = def.title;
  title.font = { size: 15, bold: true, color: { argb: 'FF12233B' } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 28;
  ws.addRow(columns.map((c) => c.label));
  const header = ws.getRow(2);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Noto Sans Bengali' };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  header.height = 26;
  for (const row of rows) {
    const r = ws.addRow(columns.map((c) => cellValue(row, c, fmt)));
    r.font = { name: 'Noto Sans Bengali', size: 10 };
    r.alignment = { vertical: 'middle', wrapText: false };
    columns.forEach((c, i) => {
      if (c.money || c.quantity) r.getCell(i + 1).alignment = { horizontal: 'right' };
    });
  }
  const totalRow = ws.addRow(
    columns.map((c) =>
      totals[c.key] !== undefined
        ? formatMoney(totals[c.key]!, {
            symbol: fmt.symbol,
            position: fmt.position,
            banglaDigits: fmt.banglaDigits,
          })
        : '',
    ),
  );
  totalRow.font = { bold: true, name: 'Noto Sans Bengali' };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4F1' } };
  columns.forEach((c, i) => (ws.getColumn(i + 1).width = Math.min(38, Math.max(14, c.label.length + 8))));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
export async function buildPdf(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  def: ReportDef,
  fmt: ReturnType<typeof moneyFormat>,
  totals: Record<string, number>,
  profileName: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const fontPath = findAsset('fonts/NotoSansBengali-400Regular.ttf');
      try {
        doc.registerFont('NotoBn', fontPath);
        doc.font('NotoBn');
      } catch {
        doc.font('Helvetica');
      }
      doc
        .fontSize(16)
        .fillColor('#12233B')
        .text(profileName || 'MERQO রিপোর্ট', { align: 'center' });
      doc.moveDown(0.3).fontSize(12).text(def.title, { align: 'center' });
      doc
        .fontSize(9)
        .fillColor('#64748B')
        .text(`তৈরি: ${new Date().toLocaleString('bn-BD')} · মোট সারি: ${rows.length}`, { align: 'center' });
      doc.moveDown(0.8);
      const colWidth = Math.min(90, (doc.page.width - 72) / Math.max(1, columns.length));
      const tableTop = doc.y;
      const drawRow = (cells: string[], y: number, bold = false, fill = false) => {
        if (fill) doc.rect(36, y, colWidth * columns.length, 20).fill('#E6F4F1');
        doc.fillColor('#12233B').fontSize(8);
        cells.forEach((cell, i) =>
          doc.text(cell, 36 + i * colWidth, y + 5, {
            width: colWidth - 4,
            height: 14,
            ellipsis: true,
            align: 'left',
          }),
        );
        void bold;
      };
      drawRow(
        columns.map((c) => c.label),
        tableTop,
        true,
        true,
      );
      let y = tableTop + 20;
      for (const row of rows.slice(0, 60)) {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }
        drawRow(
          columns.map((c) => cellValue(row, c, fmt)),
          y,
        );
        y += 18;
      }
      doc
        .moveTo(36, y + 4)
        .lineTo(36 + colWidth * columns.length, y + 4)
        .strokeColor('#E2E8F0')
        .stroke();
      doc
        .fillColor('#12233B')
        .fontSize(9)
        .text('মোট', 36, y + 10);
      for (const [k, v] of Object.entries(totals)) {
        const idx = columns.findIndex((c) => c.key === k);
        if (idx >= 0)
          doc.text(
            formatMoney(v, { symbol: fmt.symbol, position: fmt.position }),
            36 + idx * colWidth,
            y + 10,
            { width: colWidth - 4 },
          );
      }
      void toBanglaDigits;
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
export function buildReportHtml(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  def: ReportDef,
  fmt: ReturnType<typeof moneyFormat>,
  totals: Record<string, number>,
  profileName: string,
): string {
  const font = `@font-face{font-family:'NotoBn';src:url('${fontDataUri('fonts/noto-sans-bengali-bengali-400-normal.woff2')}') format('woff2');}`;
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><style>
    ${font} body{font-family:'NotoBn',Segoe UI,sans-serif;color:#12233B;padding:24px;font-size:12px}
    h1{font-size:20px;margin:0} h2{font-size:14px;margin:4px 0 16px;color:#0F766E}
    .meta{color:#64748B;font-size:10px;margin-bottom:14px}
    table{width:100%;border-collapse:collapse} th{background:#0F766E;color:#fff;padding:8px;text-align:left;font-size:11px}
    td{border-bottom:1px solid #E2E8F0;padding:6px 8px} tr:nth-child(even) td{background:#F8FAFC}
    .num{text-align:right;font-variant-numeric:tabular-nums} tfoot td{font-weight:bold;background:#E6F4F1}
    footer{margin-top:18px;color:#64748B;font-size:10px}
  </style></head><body><h1>${escapeHtml(profileName)}</h1><h2>${escapeHtml(def.title)}</h2>
  <div class="meta">তৈরি: ${escapeHtml(new Date().toLocaleString('bn-BD'))} · মোট সারি: ${rows.length}</div>
  <table><thead><tr>${columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead><tbody>
  ${rows.map((r) => `<tr>${columns.map((c) => `<td class="${c.money || c.quantity ? 'num' : ''}">${escapeHtml(cellValue(r, c, fmt))}</td>`).join('')}</tr>`).join('')}
  </tbody><tfoot><tr>${columns.map((c) => `<td class="num">${totals[c.key] !== undefined ? escapeHtml(formatMoney(totals[c.key]!, { symbol: fmt.symbol, position: fmt.position })) : ''}</td>`).join('')}</tr></tfoot>
  </table><footer>এই রিপোর্টটি MERQO স্থানীয় ডাটাবেজ থেকে তৈরি করা হয়েছে।</footer></body></html>`;
}
export interface ExportRequest {
  key: string;
  format: 'csv' | 'xlsx' | 'pdf' | 'html';
  filter?: FilterPayload;
}
export async function exportReport(
  db: DB,
  req: ExportRequest,
): Promise<{ bytes: Buffer; mime: string; filename: string; rows: number }> {
  const filter = { ...(req.filter ?? {}), pageSize: 10000, page: 1 };
  const result = runReport(db, req.key, filter);
  const columns = columnsForReport(result.report, result.rows);
  const fmt = moneyFormat(db);
  const profileName =
    getBusinessProfile(db).business_name || getBusinessProfile(db).business_name_en || 'MERQO';
  let bytes: Buffer;
  let mime: string;
  let ext: string;
  if (req.format === 'csv') {
    bytes = buildCsv(result.rows, columns, fmt);
    mime = 'text/csv; charset=utf-8';
    ext = 'csv';
  } else if (req.format === 'xlsx') {
    bytes = await buildXlsx(result.rows, columns, result.report, fmt, result.totals);
    mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    ext = 'xlsx';
  } else if (req.format === 'pdf') {
    bytes = await buildPdf(result.rows, columns, result.report, fmt, result.totals, profileName);
    mime = 'application/pdf';
    ext = 'pdf';
  } else if (req.format === 'html') {
    bytes = Buffer.from(
      buildReportHtml(result.rows, columns, result.report, fmt, result.totals, profileName),
      'utf8',
    );
    mime = 'text/html; charset=utf-8';
    ext = 'html';
  } else throw new AppError(ERR.VALIDATION, 'অজানা এক্সপোর্ট ফরম্যাট।');
  return {
    bytes,
    mime,
    filename: `${result.report.key}-${new Date().toISOString().slice(0, 10)}.${ext}`,
    rows: result.rows.length,
  };
}
