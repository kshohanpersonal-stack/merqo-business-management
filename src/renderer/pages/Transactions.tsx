import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Eye,
  Printer,
  RotateCcw,
  Ban,
  ArrowLeftRight,
  Receipt,
  Wallet,
  Coins,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { call, exportFile } from '../api';
import { CrudPage } from './Business';
import {
  Button,
  Card,
  DataTable,
  Modal,
  Badge,
  Field,
  Input,
  Select,
  TextArea,
  useToast,
  useAction,
  useApiQuery,
  money,
  qty,
  dateBn,
} from '../components';

function PageHead({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Purchases                                                           */
/* ------------------------------------------------------------------ */
interface PurchaseLine {
  productId: string;
  quantity: string;
  unitPrice: string;
  discountType: string;
  discountValue: string;
  batchNo: string;
}
export function Purchases() {
  const toast = useToast();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [returnRow, setReturnRow] = useState<any>(null);
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [form, setForm] = useState({
    supplierId: '',
    supplierInvoiceNo: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    extraCost: '0',
    discountType: 'none',
    discountValue: '0',
    note: '',
  });
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [payments, setPayments] = useState<{ accountId: string; paymentMethodId: string; amount: string }[]>(
    [],
  );
  const { data: suppliers } = useApiQuery<any>('supplier.list', { pageSize: 200 }, []);
  const { data: products } = useApiQuery<any>('product.list', { pageSize: 300 }, []);
  const { data: accounts } = useApiQuery<any[]>('finance.accounts', {}, []);
  const { data: methods } = useApiQuery<any[]>('finance.paymentMethods', {}, []);
  const { data: list, loading, reload } = useApiQuery<any>('purchase.list', { pageSize: 30 }, []);

  const payload = {
    supplierId: form.supplierId || null,
    supplierInvoiceNo: form.supplierInvoiceNo,
    purchaseDate: form.purchaseDate,
    lines: lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountType: l.discountType,
      discountValue: l.discountValue,
      batchNo: l.batchNo,
    })),
    extraCost: form.extraCost,
    discountType: form.discountType,
    discountValue: form.discountValue,
    payments: payments.filter((p) => Number(p.amount) > 0),
    note: form.note,
  };
  useEffect(() => {
    if (!open || !lines.length || lines.some((l) => !l.productId)) {
      setPreview(null);
      return;
    }
    let alive = true;
    const t = setTimeout(
      () =>
        void call<any>('purchase.preview', payload)
          .then((p) => {
            if (alive) setPreview(p);
          })
          .catch(() => {}),
      260,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, JSON.stringify(lines), form.extraCost, form.discountType, form.discountValue]);
  const addLine = () =>
    setLines((l) => [
      ...l,
      { productId: '', quantity: '1', unitPrice: '0', discountType: 'none', discountValue: '0', batchNo: '' },
    ]);
  const setLine = (i: number, patch: Partial<PurchaseLine>) =>
    setLines((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const onProduct = (i: number, id: string) => {
    const p = (products?.rows ?? []).find((x: any) => x.id === id);
    setLine(i, { productId: id, unitPrice: p ? String(Number(p.purchase_price_minor) / 100) : '0' });
  };
  const submit = async () => {
    if (!lines.length || lines.some((l) => !l.productId)) {
      toast('কমপক্ষে একটি বৈধ পণ্য দিন।', 'warning');
      return;
    }
    setBusy(true);
    try {
      await run(
        'purchase.create',
        { ...payload, idempotencyKey: `pui-${Date.now()}` },
        'ক্রয় সফলভাবে সংরক্ষিত হয়েছে।',
      );
      setOpen(false);
      setLines([]);
      setPayments([]);
      reload();
    } catch {
      /* handled */
    } finally {
      setBusy(false);
    }
  };
  const showDetail = async (id: string) => {
    try {
      setDetail(await call<any>('purchase.get', { id }));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const showReturn = async (id: string) => {
    try {
      const d = await call<any>('purchase.get', { id });
      setReturnRow(d);
      setReturnQty({});
      setReturnReason('');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div>
      <PageHead title="ক্রয় / পারচেজ" sub="সরবরাহকারী, ক্রয় ইনভয়েস, ওয়েটেড-অ্যাভারেজ কস্ট ও স্টক প্রবেশ">
        <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
          নতুন ক্রয়
        </Button>
        <Button
          icon={Printer}
          onClick={() =>
            void exportFile('purchase', 'csv', {}).catch((e: Error) => toast(e.message, 'error'))
          }
        >
          CSV
        </Button>
      </PageHead>
      <DataTable
        loading={loading}
        rows={(list?.rows ?? []) as any[]}
        total={list?.total ?? 0}
        columns={[
          { key: 'invoice_no', label: 'ইনভয়েস' },
          { key: 'purchase_date', label: 'তারিখ', render: (r) => dateBn(r.purchase_date) },
          { key: 'supplier_name', label: 'সরবরাহকারী' },
          { key: 'total_minor', label: 'মোট', align: 'right', render: (r) => money(r.total_minor) },
          { key: 'due_minor', label: 'বাকি', align: 'right', render: (r) => money(r.due_minor) },
          {
            key: 'status',
            label: 'অবস্থা',
            render: (r) => <Badge tone={r.status === 'void' ? 'danger' : 'success'}>{r.status}</Badge>,
          },
          {
            key: '_a',
            label: 'কাজ',
            align: 'right',
            render: (r) => (
              <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                <Button size="sm" icon={Eye} onClick={() => void showDetail(r.id)}>
                  বিস্তারিত
                </Button>
                <Button size="sm" icon={RotateCcw} onClick={() => void showReturn(r.id)}>
                  রিটার্ন
                </Button>
              </div>
            ),
          },
        ]}
      />
      <Modal
        open={open}
        title="নতুন ক্রয়"
        wide
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>বাতিল</Button>
            <Button variant="primary" disabled={busy} onClick={submit}>
              {busy ? 'সংরক্ষণ হচ্ছে…' : 'ক্রয় সংরক্ষণ'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="সরবরাহকারী">
            <Select
              value={form.supplierId}
              onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
            >
              <option value="">বেছে নিন</option>
              {(suppliers?.rows ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="সরবরাহকারীর ইনভয়েস নম্বর">
            <Input
              value={form.supplierInvoiceNo}
              onChange={(e) => setForm((p) => ({ ...p, supplierInvoiceNo: e.target.value }))}
            />
          </Field>
          <Field label="তারিখ">
            <Input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))}
            />
          </Field>
          <Field label="অতিরিক্ত খরচ (পরিবহন ইত্যাদি)">
            <Input
              type="number"
              step="0.01"
              value={form.extraCost}
              onChange={(e) => setForm((p) => ({ ...p, extraCost: e.target.value }))}
            />
          </Field>
          <Field label="সামগ্রিক ছাড়">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <Select
                value={form.discountType}
                onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value }))}
              >
                <option value="none">নেই</option>
                <option value="percent">%</option>
                <option value="fixed">টাকা</option>
              </Select>
              <Input
                value={form.discountValue}
                onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                style={{ width: 90 }}
              />
            </div>
          </Field>
          <Field label="নোট">
            <Input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
          </Field>
        </div>
        <div className="card-title" style={{ marginTop: 18 }}>
          পণ্য <span className="hint">ক্রয়মূল্য স্বয়ংক্রিয়ভাবে পূরণ হয়</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>পণ্য</th>
                <th>পরিমাণ</th>
                <th>ক্রয়মূল্য</th>
                <th>ছাড়</th>
                <th>ব্যাচ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <Select
                      value={l.productId}
                      onChange={(e) => onProduct(i, e.target.value)}
                      style={{ minWidth: 170 }}
                    >
                      <option value="">বেছে নিন</option>
                      {(products?.rows ?? []).map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.code}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <Input
                      type="number"
                      step="0.001"
                      value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                      style={{ width: 90 }}
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                      style={{ width: 100 }}
                    />
                  </td>
                  <td>
                    <Select
                      value={l.discountType}
                      onChange={(e) => setLine(i, { discountType: e.target.value })}
                      style={{ width: 80 }}
                    >
                      <option value="none">নেই</option>
                      <option value="percent">%</option>
                      <option value="fixed">টাকা</option>
                    </Select>
                  </td>
                  <td>
                    <Input
                      value={l.batchNo}
                      onChange={(e) => setLine(i, { batchNo: e.target.value })}
                      style={{ width: 100 }}
                    />
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => setLines((p) => p.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button size="sm" icon={Plus} style={{ marginTop: 10 }} onClick={addLine}>
          পণ্য যোগ
        </Button>
        <div className="card-title" style={{ marginTop: 18 }}>
          পেমেন্ট <span className="hint">না দিলে পুরোটা সরবরাহকারীর বাকি হবে</span>
        </div>
        {payments.map((p, i) => (
          <div className="payment-row" key={i}>
            <Select
              value={p.accountId}
              onChange={(e) =>
                setPayments((prev) => prev.map((x, j) => (j === i ? { ...x, accountId: e.target.value } : x)))
              }
            >
              {(accounts ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Input
              value={p.amount}
              onChange={(e) =>
                setPayments((prev) => prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
              }
              placeholder="টাকা"
            />
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              onClick={() => setPayments((prev) => prev.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <Button
            size="sm"
            icon={Plus}
            onClick={() =>
              setPayments((p) => [
                ...p,
                {
                  accountId: accounts?.[0]?.id ?? 'acc-cash',
                  paymentMethodId: methods?.[0]?.id ?? 'pm-cash',
                  amount: '',
                },
              ])
            }
          >
            পেমেন্ট যোগ
          </Button>
          <Button
            size="sm"
            onClick={() =>
              setPayments([
                {
                  accountId: accounts?.[0]?.id ?? 'acc-cash',
                  paymentMethodId: methods?.[0]?.id ?? 'pm-cash',
                  amount: String((preview?.totalMinor ?? 0) / 100),
                },
              ])
            }
          >
            সম্পূর্ণ পরিশোধ
          </Button>
        </div>
        {preview ? (
          <div className="card card-pad small" style={{ marginTop: 14 }}>
            উপমোট {money(preview.subtotalMinor)} · ছাড় {money(preview.discountMinor)} · কর{' '}
            {money(preview.taxMinor)} · অতিরিক্ত খরচ {money(preview.extraCostMinor)} ·{' '}
            <strong>সর্বমোট {money(preview.totalMinor)}</strong>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(detail)}
        title={`ক্রয় বিস্তারিত · ${detail?.invoice_no ?? ''}`}
        onClose={() => setDetail(null)}
        wide
      >
        {detail ? (
          <>
            <div className="kv">
              <span className="k">সরবরাহকারী</span>
              <span>{detail.supplier_id}</span>
              <span className="k">তারিখ</span>
              <span>{dateBn(detail.purchase_date)}</span>
              <span className="k">মোট / পরিশোধ / বাকি</span>
              <span>
                {money(detail.total_minor)} / {money(detail.paid_minor)} / {money(detail.due_minor)}
              </span>
            </div>
            <div className="card-title" style={{ marginTop: 16 }}>
              পণ্যসমূহ
            </div>
            <DataTable
              columns={[
                { key: 'product_name', label: 'পণ্য' },
                {
                  key: 'quantity_minor',
                  label: 'পরিমাণ',
                  align: 'right',
                  render: (r) => qty(r.quantity_minor),
                },
                {
                  key: 'unit_price_minor',
                  label: 'একক মূল্য',
                  align: 'right',
                  render: (r) => money(r.unit_price_minor),
                },
                {
                  key: 'line_total_minor',
                  label: 'মোট',
                  align: 'right',
                  render: (r) => money(r.line_total_minor),
                },
              ]}
              rows={detail.items ?? []}
            />
          </>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(returnRow)}
        title="ক্রয় রিটার্ন"
        onClose={() => setReturnRow(null)}
        footer={
          <>
            <Button onClick={() => setReturnRow(null)}>বাতিল</Button>
            <Button
              variant="danger"
              onClick={() => {
                const lines = Object.entries(returnQty)
                  .filter(([, v]) => Number(v) > 0)
                  .map(([itemId, quantity]) => ({ itemId, quantity }));
                if (!lines.length) {
                  toast('রিটার্নের পরিমাণ দিন।', 'warning');
                  return;
                }
                const id = returnRow.id;
                void run(
                  'purchase.return',
                  { purchaseId: id, lines, reason: returnReason },
                  'ক্রয় রিটার্ন সম্পন্ন হয়েছে।',
                )
                  .then(() => {
                    setReturnRow(null);
                    reload();
                  })
                  .catch(() => {});
              }}
            >
              রিটার্ন নিশ্চিত
            </Button>
          </>
        }
      >
        <p className="small muted">
          রিটার্নকৃত পণ্য মূল ক্রয়মূল্যে স্টক থেকে বাদ হবে এবং সরবরাহকারীর বাকি/অ্যাকাউন্ট সংশোধিত হবে।
        </p>
        <DataTable
          columns={[
            { key: 'product_name', label: 'পণ্য' },
            { key: 'quantity_minor', label: 'ক্রয়', align: 'right', render: (r) => qty(r.quantity_minor) },
            {
              key: '_q',
              label: 'রিটার্ন পরিমাণ',
              render: (r) => (
                <Input
                  type="number"
                  step="0.001"
                  value={returnQty[r.id] ?? ''}
                  onChange={(e) => setReturnQty((p) => ({ ...p, [r.id]: e.target.value }))}
                  style={{ width: 110 }}
                />
              ),
            },
          ]}
          rows={returnRow?.items ?? []}
        />
        <Field label="কারণ" full>
          <Input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sales history, invoices, returns, refunds, exchanges                 */
/* ------------------------------------------------------------------ */
export function SalesHistory() {
  const toast = useToast();
  const run = useAction();
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [receipt, setReceipt] = useState<{ html: string; saleId: string } | null>(null);
  const [action, setAction] = useState<{
    kind: 'cancel' | 'return' | 'refund' | 'exchange';
    sale: any;
    data: any;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [refundAccount, setRefundAccount] = useState('');
  const [replacement, setReplacement] = useState<any[]>([]);
  const { data: accounts } = useApiQuery<any[]>('finance.accounts', {}, []);
  const { data: products } = useApiQuery<any>('product.list', { pageSize: 300 }, []);
  const {
    data: list,
    loading,
    reload,
  } = useApiQuery<any>('sale.list', { from, to, status, pageSize: 30 }, [from, to, status]);

  const showDetail = async (row: any) => {
    try {
      setDetail(await call<any>('sale.get', { id: row.id }));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const showReceipt = async (saleId: string) => {
    try {
      const html = await call<any>('invoice.receiptHtml', { saleId, options: { width: '80mm' } });
      setReceipt({ html: html.html, saleId });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const start = async (kind: 'cancel' | 'return' | 'refund' | 'exchange', sale: any) => {
    try {
      const data = await call<any>('sale.get', { id: sale.id });
      setAction({ kind, sale, data });
      setReason('');
      setReturnQty({});
      setReplacement([]);
      setRefundAccount(accounts?.[0]?.id ?? 'acc-cash');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const lines = action
    ? Object.entries(returnQty)
        .filter(([, v]) => Number(v) > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }))
    : [];
  const confirmAction = () => {
    if (!action) return;
    if (action.kind === 'cancel') {
      if (!reason.trim()) {
        toast('বাতিলের কারণ দিন।', 'warning');
        return;
      }
      void run(
        'sale.cancel',
        { saleId: action.sale.id, reason },
        'সেল বাতিল ও স্টক/অ্যাকাউন্ট রিভার্স হয়েছে।',
      )
        .then(() => {
          setAction(null);
          reload();
        })
        .catch(() => {});
      return;
    }
    if (!lines.length) {
      toast('রিটার্নের পরিমাণ দিন।', 'warning');
      return;
    }
    if (action.kind === 'exchange') {
      const replacementLines = replacement
        .filter((r) => r.productId)
        .map((r) => ({ productId: r.productId, quantity: r.quantity }));
      if (!replacementLines.length) {
        toast('বদলে দেওয়ার পণ্য দিন।', 'warning');
        return;
      }
      void run(
        'sale.exchange',
        { saleId: action.sale.id, returnLines: lines, replacementLines, reason },
        'পণ্য বদল সম্পন্ন হয়েছে।',
      )
        .then(() => {
          setAction(null);
          reload();
        })
        .catch(() => {});
      return;
    }
    void run(
      action.kind === 'refund' ? 'sale.refund' : 'sale.return',
      {
        saleId: action.sale.id,
        lines,
        reason,
        mode: action.kind === 'refund' ? 'refund' : 'adjust_due',
        refundAccountId: action.kind === 'refund' ? refundAccount : undefined,
      },
      'রিটার্ন সম্পন্ন হয়েছে।',
    )
      .then(() => {
        setAction(null);
        reload();
      })
      .catch(() => {});
  };
  return (
    <div>
      <PageHead
        title="বিক্রয় / ইনভয়েস"
        sub="সম্পন্ন সেল, রিসিট পুনঃমুদ্রণ, বাতিল, রিটার্ন, রিফান্ড ও পণ্য বদল"
      >
        <input
          type="date"
          className="input"
          style={{ width: 150 }}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          className="input"
          style={{ width: 150 }}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150 }}>
          <option value="">সব অবস্থা</option>
          <option value="completed">সম্পন্ন</option>
          <option value="partial_return">আংশিক রিটার্ন</option>
          <option value="cancelled">বাতিল</option>
        </Select>
        <Button icon={RefreshCw} onClick={reload}>
          রিফ্রেশ
        </Button>
      </PageHead>
      <DataTable
        loading={loading}
        rows={(list?.rows ?? []) as any[]}
        total={list?.total ?? 0}
        columns={[
          { key: 'invoice_no', label: 'ইনভয়েস' },
          { key: 'sale_date', label: 'তারিখ', render: (r) => dateBn(r.sale_date) },
          { key: 'customer_name', label: 'গ্রাহক' },
          { key: 'total_minor', label: 'মোট', align: 'right', render: (r) => money(r.total_minor) },
          { key: 'paid_minor', label: 'পরিশোধ', align: 'right', render: (r) => money(r.paid_minor) },
          { key: 'due_minor', label: 'বাকি', align: 'right', render: (r) => money(r.due_minor) },
          {
            key: 'gross_profit_minor',
            label: 'মুনাফা',
            align: 'right',
            render: (r) => money(r.gross_profit_minor),
          },
          {
            key: 'status',
            label: 'অবস্থা',
            render: (r) => (
              <Badge
                tone={r.status === 'completed' ? 'success' : r.status === 'cancelled' ? 'danger' : 'warning'}
              >
                {r.status}
              </Badge>
            ),
          },
          {
            key: '_a',
            label: 'কাজ',
            align: 'right',
            render: (r) => (
              <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                <Button size="sm" icon={Eye} onClick={() => void showDetail(r)}>
                  বিস্তারিত
                </Button>
                <Button size="sm" icon={Receipt} onClick={() => void showReceipt(r.id)}>
                  রিসিট
                </Button>
              </div>
            ),
          },
        ]}
      />
      <Modal
        open={Boolean(detail)}
        title={`সেল বিস্তারিত · ${detail?.invoice_no ?? ''}`}
        onClose={() => setDetail(null)}
        wide
      >
        {detail ? (
          <>
            <div className="kv">
              <span className="k">গ্রাহক</span>
              <span>{detail.customer_name ?? 'ওয়াক-ইন'}</span>
              <span className="k">তারিখ</span>
              <span>{dateBn(detail.sale_date)}</span>
              <span className="k">মোট / পরিশোধ / বাকি</span>
              <span>
                {money(detail.total_minor)} / {money(detail.paid_minor)} / {money(detail.due_minor)}
              </span>
              <span className="k">মোট মুনাফা / COGS</span>
              <span>
                {money(detail.gross_profit_minor)} / {money(detail.cogs_minor)}
              </span>
            </div>
            <div className="card-title" style={{ marginTop: 16 }}>
              পণ্য ও পেমেন্ট
            </div>
            <div className="two-col">
              <DataTable
                columns={[
                  { key: 'product_name', label: 'পণ্য' },
                  {
                    key: 'quantity_minor',
                    label: 'পরিমাণ',
                    align: 'right',
                    render: (r) => qty(r.quantity_minor),
                  },
                  {
                    key: 'line_total_minor',
                    label: 'মোট',
                    align: 'right',
                    render: (r) => money(r.line_total_minor),
                  },
                ]}
                rows={detail.items ?? []}
              />
              <DataTable
                columns={[
                  { key: 'payment_method_name', label: 'মাধ্যম' },
                  {
                    key: 'amount_minor',
                    label: 'টাকা',
                    align: 'right',
                    render: (r) => money(r.amount_minor),
                  },
                ]}
                rows={detail.payments ?? []}
              />
            </div>
            {detail.status !== 'cancelled' ? (
              <div className="row" style={{ marginTop: 16 }}>
                <Button variant="danger" icon={Ban} onClick={() => void start('cancel', detail)}>
                  সেল বাতিল
                </Button>
                <Button icon={RotateCcw} onClick={() => void start('return', detail)}>
                  বাকি সমন্বয়ে রিটার্ন
                </Button>
                <Button icon={Coins} onClick={() => void start('refund', detail)}>
                  নগদ রিফান্ড
                </Button>
                <Button icon={ArrowLeftRight} onClick={() => void start('exchange', detail)}>
                  পণ্য বদল
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(receipt)}
        title="তাপীয় রিসিট"
        onClose={() => setReceipt(null)}
        footer={
          <>
            <Button onClick={() => setReceipt(null)}>বন্ধ</Button>
            <Button
              icon={Printer}
              variant="primary"
              onClick={() => {
                if (!receipt) return;
                void call<any>('printing.print', { saleId: receipt.saleId, options: { width: '80mm' } })
                  .then((r) =>
                    toast(
                      r.ok ? 'প্রিন্টারে পাঠানো হয়েছে।' : (r.message ?? 'প্রিন্টার পাওয়া যায়নি।'),
                      r.ok ? 'success' : 'warning',
                    ),
                  )
                  .catch((e: Error) => toast(e.message, 'error'));
              }}
            >
              প্রিন্ট করুন
            </Button>
          </>
        }
      >
        {receipt ? (
          <div className="receipt-frame" dangerouslySetInnerHTML={{ __html: receipt.html }} />
        ) : null}
      </Modal>
      <Modal
        open={Boolean(action)}
        title={
          action?.kind === 'cancel'
            ? 'সেল বাতিল'
            : action?.kind === 'exchange'
              ? 'পণ্য বদল'
              : action?.kind === 'refund'
                ? 'নগদ রিফান্ড'
                : 'রিটার্ন (বাকি সমন্বয়)'
        }
        onClose={() => setAction(null)}
        wide
        footer={
          <>
            <Button onClick={() => setAction(null)}>বাতিল</Button>
            <Button variant="danger" onClick={confirmAction}>
              নিশ্চিত করুন
            </Button>
          </>
        }
      >
        {action ? (
          <>
            <p className="small muted">
              এই কাজটি সংবেদনশীল: স্টক, অ্যাকাউন্ট, বাকি, COGS, মুনাফা ও অডিট একই ট্রানজাকশনে আপডেট হবে। মূল
              ইতিহাস মুছবে না।
            </p>
            {action.kind !== 'cancel' ? (
              <>
                <div className="card-title">রিটার্নের পণ্য</div>
                <DataTable
                  columns={[
                    { key: 'product_name', label: 'পণ্য' },
                    {
                      key: 'quantity_minor',
                      label: 'বিক্রীত',
                      align: 'right',
                      render: (r) => qty(r.quantity_minor),
                    },
                    {
                      key: 'returned_qty_minor',
                      label: 'ইতিমধ্যে ফেরত',
                      align: 'right',
                      render: (r) => qty(r.returned_qty_minor),
                    },
                    {
                      key: '_q',
                      label: 'এবার ফেরত',
                      render: (r) => (
                        <Input
                          type="number"
                          step="0.001"
                          value={returnQty[r.id] ?? ''}
                          onChange={(e) => setReturnQty((p) => ({ ...p, [r.id]: e.target.value }))}
                          style={{ width: 110 }}
                        />
                      ),
                    },
                  ]}
                  rows={action.data.items ?? []}
                />
              </>
            ) : null}
            {action.kind === 'refund' ? (
              <Field label="রিফান্ড অ্যাকাউন্ট">
                <Select value={refundAccount} onChange={(e) => setRefundAccount(e.target.value)}>
                  {(accounts ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {action.kind === 'exchange' ? (
              <>
                <div className="card-title" style={{ marginTop: 14 }}>
                  বদলে দেওয়া পণ্য
                </div>
                {replacement.map((r, i) => (
                  <div className="payment-row" key={i}>
                    <Select
                      value={r.productId}
                      onChange={(e) =>
                        setReplacement((p) =>
                          p.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)),
                        )
                      }
                    >
                      <option value="">বেছে নিন</option>
                      {(products?.rows ?? []).map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {money(p.selling_price_minor)}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      step="0.001"
                      value={r.quantity}
                      onChange={(e) =>
                        setReplacement((p) =>
                          p.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)),
                        )
                      }
                      placeholder="পরিমাণ"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => setReplacement((p) => p.filter((_, j) => j !== i))}
                    />
                  </div>
                ))}
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={() => setReplacement((p) => [...p, { productId: '', quantity: '1' }])}
                >
                  পণ্য যোগ
                </Button>
              </>
            ) : null}
            <Field label="কারণ / নোট *" full>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </>
        ) : null}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Customers & suppliers                                               */
/* ------------------------------------------------------------------ */
export function Parties({ initialTab = 'customer' }: { initialTab?: 'customer' | 'supplier' }) {
  const toast = useToast();
  const run = useAction();
  const [tab, setTab] = useState<'customer' | 'supplier'>(initialTab);
  const [payment, setPayment] = useState<{ type: 'customer' | 'supplier'; row: any } | null>(null);
  const [statement, setStatement] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const { data: accounts } = useApiQuery<any[]>('finance.accounts', {}, []);
  const [accountId, setAccountId] = useState('');
  useEffect(() => {
    if (!accountId && accounts?.[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);
  const isCustomer = tab === 'customer';
  const showStatement = async (row: any) => {
    try {
      const d = await call<any>('party.statement', { type: tab, id: row.id, pageSize: 50 });
      setStatement({ ...d, row });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div>
      <PageHead title="গ্রাহক ও সরবরাহকারী" sub="লেজার, ওপেনিং ব্যালেন্স, বাকি আদায়/পরিশোধ ও স্টেটমেন্ট" />
      <div className="tabs">
        {[
          ['customer', 'গ্রাহক'],
          ['supplier', 'সরবরাহকারী'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key as 'customer' | 'supplier')}
          >
            {label}
          </button>
        ))}
      </div>
      <CrudPage
        key={tab}
        title={isCustomer ? 'গ্রাহক' : 'সরবরাহকারী'}
        subtitle="যোগাযোগ, ক্রেডিট লিমিট, ওপেনিং ব্যালেন্স ও লেজার"
        listAction={`${tab}.list`}
        createAction={`${tab}.create`}
        updateAction={`${tab}.update`}
        archiveAction={`${tab}.archive`}
        fields={[
          { name: 'name', label: 'নাম', required: true },
          { name: 'nameEn', label: 'English নাম' },
          { name: 'company', label: 'কোম্পানি' },
          { name: 'phone', label: 'ফোন' },
          { name: 'email', label: 'ইমেইল' },
          {
            name: 'openingBalance',
            label: 'ওপেনিং ব্যালেন্স (৳)',
            type: 'number',
            step: '0.01',
            default: '0',
            hideOnEdit: true,
          },
          ...(isCustomer
            ? [
                {
                  name: 'creditLimit',
                  label: 'ক্রেডিট লিমিট (৳)',
                  type: 'number' as const,
                  step: '0.01',
                  default: '0',
                },
              ]
            : []),
          { name: 'address', label: 'ঠিকানা', type: 'textarea' },
          { name: 'notes', label: 'নোট', type: 'textarea' },
        ]}
        columns={[
          { key: 'name', label: 'নাম' },
          { key: 'phone', label: 'ফোন' },
          {
            key: 'opening_balance_minor',
            label: 'ওপেনিং',
            align: 'right',
            render: (r) => money(r.opening_balance_minor),
          },
          {
            key: 'balance_minor',
            label: 'বর্তমান বাকি',
            align: 'right',
            render: (r) => <strong>{money(r.balance_minor)}</strong>,
          },
          {
            key: 'status',
            label: 'অবস্থা',
            render: (r) => <Badge tone={r.status === 'active' ? 'success' : 'default'}>{r.status}</Badge>,
          },
        ]}
        transform={(r) => ({
          name: String(r.name),
          nameEn: String(r.name_en ?? ''),
          company: String(r.company ?? ''),
          phone: String(r.phone ?? ''),
          email: String(r.email ?? ''),
          address: String(r.address ?? ''),
          notes: String(r.notes ?? ''),
          creditLimit: String(Number(r.credit_limit_minor ?? 0) / 100),
        })}
        toPayload={(f) => ({
          name: f.name,
          nameEn: f.nameEn,
          company: f.company,
          phone: f.phone,
          email: f.email,
          address: f.address,
          notes: f.notes,
          openingBalance: f.openingBalance || 0,
          creditLimit: f.creditLimit || 0,
        })}
        extra={(row, _reload) => (
          <>
            <Button size="sm" icon={Receipt} onClick={() => void showStatement(row)}>
              স্টেটমেন্ট
            </Button>
            {Number(row.balance_minor) > 0 ? (
              <Button
                size="sm"
                variant="primary"
                icon={Wallet}
                onClick={() => {
                  setPayment({ type: tab, row });
                  setAmount(String(Number(row.balance_minor) / 100));
                  setNote('');
                }}
              >
                {isCustomer ? 'বাকি আদায়' : 'পরিশোধ'}
              </Button>
            ) : null}
          </>
        )}
      />
      <Modal
        open={Boolean(payment)}
        title={payment?.type === 'customer' ? 'গ্রাহকের বাকি আদায়' : 'সরবরাহকারীকে পরিশোধ'}
        onClose={() => setPayment(null)}
        footer={
          <>
            <Button onClick={() => setPayment(null)}>বাতিল</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!payment) return;
                const payload = {
                  [payment.type === 'customer' ? 'customerId' : 'supplierId']: payment.row.id,
                  amount,
                  accountId,
                  note,
                  paymentMethodId: 'pm-cash',
                  idempotencyKey: `party-pay-${Date.now()}`,
                } as Record<string, unknown>;
                void run(
                  payment.type === 'customer' ? 'payment.collectDue' : 'payment.paySupplier',
                  payload,
                  'লেনদেন সফলভাবে সংরক্ষিত হয়েছে।',
                )
                  .then(() => setPayment(null))
                  .catch(() => {});
              }}
            >
              সংরক্ষণ
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="পার্টি">
            <Input value={payment?.row?.name ?? ''} readOnly />
          </Field>
          <Field label="বর্তমান বাকি">
            <Input value={money(payment?.row?.balance_minor ?? 0)} readOnly />
          </Field>
          <Field label="পরিমাণ (৳) *">
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="অ্যাকাউন্ট *">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {(accounts ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {money(a.balance_minor)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="নোট" full>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={Boolean(statement)}
        title={`লেজার স্টেটমেন্ট · ${statement?.row?.name ?? ''}`}
        onClose={() => setStatement(null)}
        wide
      >
        <DataTable
          columns={[
            { key: 'txn_date', label: 'তারিখ', render: (r) => dateBn(r.txn_date) },
            { key: 'kind', label: 'ধরন' },
            { key: 'note', label: 'বিবরণ' },
            { key: 'debit_minor', label: 'ডেবিট', align: 'right', render: (r) => money(r.debit_minor) },
            { key: 'credit_minor', label: 'ক্রেডিট', align: 'right', render: (r) => money(r.credit_minor) },
            {
              key: 'balance_after_minor',
              label: 'ব্যালেন্স',
              align: 'right',
              render: (r) => money(r.balance_after_minor),
            },
          ]}
          rows={statement?.rows ?? []}
          total={statement?.total ?? 0}
        />
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Finance: accounts, cash in/out, closing, reconciliation              */
/* ------------------------------------------------------------------ */
export function Finance() {
  const toast = useToast();
  const run = useAction();
  const [tab, setTab] = useState(0);
  const [cashOpen, setCashOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [cash, setCash] = useState({ direction: 'in', accountId: '', amount: '', note: '', kind: '' });
  const [closing, setClosing] = useState({
    date: new Date().toISOString().slice(0, 10),
    counted: '',
    note: '',
  });
  const [reconcile, setReconcile] = useState<any>(null);
  const { data: accounts, reload: reloadAccounts } = useApiQuery<any[]>('finance.accounts', {}, []);
  const {
    data: transactions,
    loading,
    reload,
  } = useApiQuery<any>('finance.transactions', { pageSize: 40 }, []);
  const { data: summary } = useApiQuery<any>(
    'finance.summary',
    { date: new Date().toISOString().slice(0, 10) },
    [],
  );
  useEffect(() => {
    if (!cash.accountId && accounts?.[0]) setCash((c) => ({ ...c, accountId: accounts[0].id }));
  }, [accounts, cash.accountId]);
  return (
    <div>
      <PageHead
        title="ক্যাশ ও আর্থিক ব্যবস্থাপনা"
        sub="নগদ / ব্যাংক / bKash / Nagad / Rocket / কাস্টম অ্যাকাউন্ট, ক্যাশ ইন-আউট ও দৈনিক ক্লোজিং"
      >
        <Button
          icon={RefreshCw}
          onClick={() =>
            void call<any>('finance.reconcile')
              .then(setReconcile)
              .catch((e: Error) => toast(e.message, 'error'))
          }
        >
          সমন্বয় যাচাই
        </Button>
        <Button icon={CheckCircle2} onClick={() => setCloseOpen(true)}>
          দিনের ক্যাশ বন্ধ
        </Button>
        <Button variant="primary" icon={Coins} onClick={() => setCashOpen(true)}>
          ক্যাশ ইন / আউট
        </Button>
      </PageHead>
      <div className="kpi-grid section">
        {[
          ['আজকের নেট প্রবাহ', money(summary?.net_minor ?? 0)],
          ['আজকের প্রবেশ', money(summary?.in_minor ?? 0)],
          ['আজকের প্রস্থান', money(summary?.out_minor ?? 0)],
          ['মোট অ্যাকাউন্ট', String((accounts ?? []).length)],
        ].map(([l, v]) => (
          <div className="card kpi" key={String(l)}>
            <div className="label">{l}</div>
            <div className="value">{v}</div>
          </div>
        ))}
      </div>
      <div className="tabs">
        {['অ্যাকাউন্টসমূহ', 'লেনদেন'].map((t, i) => (
          <button key={t} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 0 ? (
        <CrudPage
          key="accounts"
          title="অ্যাকাউন্ট"
          subtitle="নগদ, ব্যাংক, মোবাইল ফাইন্যান্সিয়াল সার্ভিস ও কাস্টম অ্যাকাউন্ট"
          listAction="finance.accounts"
          createAction="finance.createAccount"
          fields={[
            { name: 'name', label: 'অ্যাকাউন্টের নাম', required: true },
            {
              name: 'type',
              label: 'ধরন',
              type: 'select',
              options: [
                { value: 'cash', label: 'নগদ' },
                { value: 'bank', label: 'ব্যাংক' },
                { value: 'mobile', label: 'MFS (bKash/Nagad/Rocket)' },
                { value: 'custom', label: 'কাস্টম' },
                { value: 'other', label: 'অন্যান্য' },
              ],
              required: true,
            },
            {
              name: 'paymentMethodId',
              label: 'পেমেন্ট মাধ্যম',
              type: 'select',
              source: { action: 'finance.paymentMethods' },
              default: 'pm-cash',
            },
            {
              name: 'openingBalance',
              label: 'ওপেনিং ব্যালেন্স (৳)',
              type: 'number',
              step: '0.01',
              default: '0',
              hideOnEdit: true,
            },
          ]}
          columns={[
            { key: 'name', label: 'নাম' },
            { key: 'type', label: 'ধরন' },
            {
              key: 'opening_balance_minor',
              label: 'ওপেনিং',
              align: 'right',
              render: (r) => money(r.opening_balance_minor),
            },
            {
              key: 'balance_minor',
              label: 'ব্যালেন্স',
              align: 'right',
              render: (r) => <strong>{money(r.balance_minor)}</strong>,
            },
            {
              key: 'is_default',
              label: 'ডিফল্ট',
              render: (r) => (r.is_default ? <Badge tone="info">হ্যাঁ</Badge> : '—'),
            },
          ]}
          toPayload={(f) => ({
            name: f.name,
            type: f.type,
            paymentMethodId: f.paymentMethodId || 'pm-cash',
            openingBalance: f.openingBalance || 0,
          })}
        />
      ) : null}
      {tab === 1 ? (
        <Card title="আর্থিক লেনদেন">
          <DataTable
            loading={loading}
            columns={[
              { key: 'txn_date', label: 'তারিখ', render: (r) => dateBn(r.txn_date) },
              { key: 'account_name', label: 'অ্যাকাউন্ট' },
              { key: 'kind', label: 'ধরন' },
              {
                key: 'direction',
                label: 'প্রবাহ',
                render: (r) => (
                  <Badge tone={r.direction === 'in' ? 'success' : 'warning'}>
                    {r.direction === 'in' ? 'প্রবেশ' : 'প্রস্থান'}
                  </Badge>
                ),
              },
              { key: 'amount_minor', label: 'পরিমাণ', align: 'right', render: (r) => money(r.amount_minor) },
              {
                key: 'balance_after_minor',
                label: 'পরবর্তী ব্যালেন্স',
                align: 'right',
                render: (r) => money(r.balance_after_minor),
              },
              { key: 'note', label: 'নোট' },
            ]}
            rows={(transactions?.rows ?? []) as any[]}
            total={transactions?.total ?? 0}
          />
        </Card>
      ) : null}
      {reconcile ? (
        <Card title="আর্থিক সমন্বয় যাচাই" className="section" style={{ marginTop: 16 }}>
          <div className="list">
            {reconcile.checks.map((c: any) => (
              <div className="list-item" key={c.name}>
                {c.ok ? <CheckCircle2 size={17} color="#15803D" /> : <XCircle size={17} color="#B91C1C" />}
                <div className="grow">
                  <div className="title">{c.name}</div>
                  <div className="desc">{c.detail}</div>
                </div>
                <Badge tone={c.ok ? 'success' : 'danger'}>{c.ok ? 'ঠিক আছে' : 'অমিল'}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <Modal
        open={cashOpen}
        title="ক্যাশ ইন / ক্যাশ আউট"
        onClose={() => setCashOpen(false)}
        footer={
          <>
            <Button onClick={() => setCashOpen(false)}>বাতিল</Button>
            <Button
              variant="primary"
              onClick={() => {
                void run(
                  'finance.cashInOut',
                  { ...cash, idempotencyKey: `cash-${Date.now()}` },
                  'লেনদেন সংরক্ষিত হয়েছে।',
                )
                  .then(() => {
                    setCashOpen(false);
                    reload();
                    reloadAccounts();
                  })
                  .catch(() => {});
              }}
            >
              সংরক্ষণ
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="ধরন">
            <Select
              value={cash.direction}
              onChange={(e) => setCash((c) => ({ ...c, direction: e.target.value }))}
            >
              <option value="in">প্রবেশ (আয়)</option>
              <option value="out">প্রস্থান (খরচ/উত্তোলন)</option>
            </Select>
          </Field>
          <Field label="অ্যাকাউন্ট">
            <Select
              value={cash.accountId}
              onChange={(e) => setCash((c) => ({ ...c, accountId: e.target.value }))}
            >
              {(accounts ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="পরিমাণ (৳) *">
            <Input
              type="number"
              step="0.01"
              value={cash.amount}
              onChange={(e) => setCash((c) => ({ ...c, amount: e.target.value }))}
            />
          </Field>
          <Field label="বিভাগ">
            <Select value={cash.kind} onChange={(e) => setCash((c) => ({ ...c, kind: e.target.value }))}>
              <option value="">স্বয়ংক্রিয়</option>
              <option value="other_income">অন্যান্য আয়</option>
              <option value="cash_out">নগদ উত্তোলন</option>
              <option value="other_expense">অন্যান্য খরচ</option>
            </Select>
          </Field>
          <Field label="নোট" full>
            <TextArea value={cash.note} onChange={(e) => setCash((c) => ({ ...c, note: e.target.value }))} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={closeOpen}
        title="দৈনিক ক্যাশ ক্লোজিং"
        onClose={() => setCloseOpen(false)}
        footer={
          <>
            <Button onClick={() => setCloseOpen(false)}>বাতিল</Button>
            <Button
              variant="primary"
              onClick={() => {
                void run('finance.closeCash', closing, 'ক্যাশ ক্লোজিং সংরক্ষিত হয়েছে।')
                  .then(() => setCloseOpen(false))
                  .catch(() => {});
              }}
            >
              সংরক্ষণ
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="তারিখ">
            <Input
              type="date"
              value={closing.date}
              onChange={(e) => setClosing((c) => ({ ...c, date: e.target.value }))}
            />
          </Field>
          <Field label="গণনা করা নগদ (৳) *">
            <Input
              type="number"
              step="0.01"
              value={closing.counted}
              onChange={(e) => setClosing((c) => ({ ...c, counted: e.target.value }))}
            />
          </Field>
          <Field label="নোট" full>
            <TextArea
              value={closing.note}
              onChange={(e) => setClosing((c) => ({ ...c, note: e.target.value }))}
            />
          </Field>
        </div>
        <p className="small muted">প্রত্যাশিত ও গণনাকৃত নগদের পার্থক্য সংরক্ষিত হবে; কোনো লেনদেন মুছবে না।</p>
      </Modal>
    </div>
  );
}
