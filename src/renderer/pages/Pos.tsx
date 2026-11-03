import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  PauseCircle,
  PlayCircle,
  ScanBarcode,
  X,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { call } from '../api';
import {
  Button,
  Card,
  Modal,
  Badge,
  Field,
  Input,
  Select,
  useToast,
  money,
  qty,
  useAction,
} from '../components';

interface CartLine {
  productId: string;
  name: string;
  code: string;
  quantity: string;
  price: string;
  discountType: string;
  discountValue: string;
  stock: number;
  unit: string;
}
interface Payment {
  paymentMethodId: string;
  accountId: string;
  amount: string;
}

export function Pos() {
  const toast = useToast();
  const run = useAction();
  const searchRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLSelectElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('customer-walk-in');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cartDiscountType, setCartDiscountType] = useState('none');
  const [cartDiscountValue, setCartDiscountValue] = useState('0');
  const [note, setNote] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [preview, setPreview] = useState<any>(null);
  const [previewError, setPreviewError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ html: string; saleId: string; invoiceNo: string } | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [printer, setPrinter] = useState('');
  const [held, setHeld] = useState<any[]>([]);
  const [heldOpen, setHeldOpen] = useState(false);

  useEffect(() => {
    void Promise.all([
      call<any>('customer.list', { pageSize: 200 }).then((d) => setCustomers(d.rows ?? [])),
      call<any[]>('finance.accounts').then(setAccounts),
      call<any[]>('finance.paymentMethods').then(setMethods),
      call<any>('settings.get', { key: 'tax' })
        .then((d) => setTaxRate(Number((d.value ?? d)?.rateBps ?? 0)))
        .catch(() => {}),
      call<any>('printing.printers')
        .then((d) => setPrinters(d.printers ?? []))
        .catch(() => {}),
    ]).catch((e: Error) => toast(e.message, 'error'));
  }, [toast]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      void call<any>('product.list', { search, pageSize: 60, status: 'active' })
        .then((d) => {
          if (alive) setProducts(d.rows ?? []);
        })
        .catch(() => {});
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search]);

  const payload = useMemo(
    () => ({
      customerId,
      lines: cart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.price,
        discountType: l.discountType,
        discountValue: l.discountValue,
      })),
      cartDiscountType,
      cartDiscountValue,
      taxRateBps: taxRate,
      payments: payments
        .filter((p) => Number(p.amount) > 0)
        .map((p) => ({ paymentMethodId: p.paymentMethodId, accountId: p.accountId, amount: p.amount })),
      note,
    }),
    [cart, customerId, cartDiscountType, cartDiscountValue, taxRate, payments, note],
  );

  useEffect(() => {
    if (!cart.length) {
      setPreview(null);
      setPreviewError('');
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      void call<any>('sale.preview', payload)
        .then((p) => {
          if (alive) {
            setPreview(p);
            setPreviewError('');
          }
        })
        .catch((e: Error) => {
          if (alive) {
            setPreview(null);
            setPreviewError(e.message);
          }
        });
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [payload, cart.length]);

  const addProduct = useCallback((p: any) => {
    setCart((prev) => {
      const found = prev.find((l) => l.productId === p.id);
      if (found)
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: String(Number(l.quantity) + 1) } : l,
        );
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          code: p.code,
          quantity: '1',
          price: String(Number(p.selling_price_minor) / 100),
          discountType: 'none',
          discountValue: '0',
          stock: Number(p.current_stock_minor) / 1000,
          unit: p.unit_symbol ?? '',
        },
      ];
    });
  }, []);
  const scan = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      try {
        const p = await call<any>('product.findByBarcode', { code: value });
        if (p?.id) {
          addProduct(p);
          setSearch('');
          toast(`${p.name} কার্টে যোগ হয়েছে।`, 'success');
          return;
        }
      } catch {
        /* fall through to text search */
      }
      const out = await call<any>('product.list', { search: value, pageSize: 5 });
      const first = out.rows?.[0];
      if (first) {
        addProduct(first);
        setSearch('');
        toast(`${first.name} কার্টে যোগ হয়েছে।`, 'success');
      } else toast('কোনো পণ্য পাওয়া যায়নি।', 'warning');
    },
    [addProduct, toast],
  );
  const setLine = (id: string, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l) => (l.productId === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.productId !== id));
  const clear = () => {
    setCart([]);
    setPayments([]);
    setNote('');
    setCartDiscountType('none');
    setCartDiscountValue('0');
    setCustomerId('customer-walk-in');
    setPreview(null);
  };

  const complete = useCallback(async () => {
    if (!cart.length) {
      toast('কার্টে কমপক্ষে একটি পণ্য দিন।', 'warning');
      return;
    }
    setBusy(true);
    try {
      const out = await run(
        'sale.complete',
        { ...payload, idempotencyKey: `ui-${Date.now()}-${Math.random().toString(36).slice(2)}` },
        'সেল সফলভাবে সম্পন্ন হয়েছে।',
      );
      const inv = await call<{ html: string }>('invoice.receiptHtml', {
        saleId: out.id,
        options: { width: '80mm' },
      });
      setReceipt({ html: inv.html, saleId: out.id, invoiceNo: out.invoiceNo });
      clear();
    } catch {
      /* toast handled */
    } finally {
      setBusy(false);
    }
  }, [cart.length, payload, run, toast]);

  const hold = async () => {
    if (!cart.length) return;
    try {
      await run('sale.hold', { cart: { ...payload, cart }, note }, 'সেলটি হোল্ড করা হয়েছে।');
      clear();
    } catch {
      /* handled */
    }
  };
  const openHeld = async () => {
    try {
      setHeld(await call<any[]>('sale.heldList'));
      setHeldOpen(true);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const resume = async (reference: string) => {
    try {
      const saved = await call<any>('sale.resume', { reference });
      setCart(saved.cart ?? []);
      setCustomerId(saved.customerId ?? 'customer-walk-in');
      setCartDiscountType(saved.cartDiscountType ?? 'none');
      setCartDiscountValue(saved.cartDiscountValue ?? '0');
      setPayments(saved.payments ?? []);
      setNote(saved.note ?? '');
      await run('sale.removeHeld', { reference });
      setHeldOpen(false);
      toast('হোল্ড করা সেল ফিরিয়ে আনা হয়েছে।', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        clear();
        searchRef.current?.focus();
      }
      if (e.key === 'F2' || e.key === 'F3') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        customerRef.current?.focus();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        discountRef.current?.focus();
      }
      if (e.key === 'F6') {
        e.preventDefault();
        void hold();
      }
      if (e.key === 'F7') {
        e.preventDefault();
        void openHeld();
      }
      if (e.key === 'F8') {
        e.preventDefault();
        void complete();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (receipt) void printReceipt();
      }
      if (e.key === 'Escape') {
        setReceipt(null);
        setHeldOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [complete, receipt, printer]);

  const total =
    preview?.totalMinor ??
    cart.reduce((s, l) => s + Math.round(Number(l.quantity) * Number(l.price) * 100), 0);
  const paid =
    preview?.paidMinor ?? payments.reduce((s, p) => s + Math.round(Number(p.amount || 0) * 100), 0);
  const setCash = (amount: number) =>
    setPayments([
      {
        paymentMethodId: 'pm-cash',
        accountId: accounts[0]?.id ?? 'acc-cash',
        amount: (amount / 100).toFixed(2),
      },
    ]);
  const printReceipt = async () => {
    if (!receipt) return;
    try {
      const out = await call<any>('printing.print', {
        saleId: receipt.saleId,
        options: { width: '80mm', deviceName: printer || undefined },
      });
      toast(
        out.ok ? 'রিসিট প্রিন্টারে পাঠানো হয়েছে।' : (out.message ?? 'প্রিন্ট করা যায়নি।'),
        out.ok ? 'success' : 'warning',
      );
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>পয়েন্ট অব সেল (POS)</h1>
          <div className="sub">দ্রুত বিক্রয় · বারকোড স্ক্যান · ৫৮/৮০ মিমি তাপীয় রিসিট</div>
        </div>
        <div className="page-actions">
          <Badge tone="info">
            F1 নতুন · F2 খোঁজা · F4 গ্রাহক · F5 ছাড় · F6 হোল্ড · F7 রিজিউম · F8 সেল · F9 প্রিন্ট
          </Badge>
          <Button icon={PauseCircle} onClick={openHeld}>
            হোল্ড করা সেল
          </Button>
        </div>
      </div>
      <div className="pos-grid">
        <Card title="পণ্য খুঁজুন" hint="বারকোড স্ক্যান করুন অথবা নাম/কোড লিখে Enter দিন">
          <div className="row" style={{ marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="পণ্যের নাম, কোড বা বারকোড…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void scan(search);
                  }
                }}
                style={{ paddingLeft: 33 }}
              />
            </div>
            <Button icon={ScanBarcode} onClick={() => void scan(search)}>
              যোগ করুন
            </Button>
          </div>
          <div className="product-tiles">
            {products.map((p) => (
              <button className="product-tile" key={p.id} onClick={() => addProduct(p)}>
                <div className="name">{p.name}</div>
                <div className="meta">
                  {p.code} · {money(p.selling_price_minor)} / {p.unit_symbol}
                </div>
                <div className="meta">
                  স্টক <strong>{qty(p.current_stock_minor)}</strong>{' '}
                  {Number(p.current_stock_minor) <= Number(p.min_stock_minor) &&
                  Number(p.min_stock_minor) > 0 ? (
                    <Badge tone="warning">কম</Badge>
                  ) : null}
                </div>
              </button>
            ))}
            {!products.length ? (
              <div className="small muted" style={{ padding: 12 }}>
                কোনো পণ্য পাওয়া যায়নি। প্রথমে পণ্য যোগ করুন।
              </div>
            ) : null}
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 16 }}>
          <Card title={`কার্ট (${cart.length})`} hint={preview ? `মোট ${money(total)}` : undefined}>
            {!cart.length ? (
              <div className="empty">কার্ট খালি। বাম দিক থেকে পণ্য বেছে নিন।</div>
            ) : (
              <table className="data cart-table">
                <thead>
                  <tr>
                    <th>পণ্য</th>
                    <th>পরিমাণ</th>
                    <th className="num">দাম</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((l) => (
                    <tr key={l.productId}>
                      <td>
                        <div className="bold">{l.name}</div>
                        <div className="small muted">
                          {l.code} · স্টক {l.stock}
                        </div>
                      </td>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <button
                            className="icon-btn"
                            style={{ width: 26, height: 26 }}
                            onClick={() =>
                              setLine(l.productId, {
                                quantity: String(Math.max(0.001, Number(l.quantity) - 1)),
                              })
                            }
                          >
                            <Minus size={12} />
                          </button>
                          <Input
                            value={l.quantity}
                            onChange={(e) => setLine(l.productId, { quantity: e.target.value })}
                            style={{ width: 62, padding: '4px 6px' }}
                          />
                          <button
                            className="icon-btn"
                            style={{ width: 26, height: 26 }}
                            onClick={() => setLine(l.productId, { quantity: String(Number(l.quantity) + 1) })}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="num">
                        <Input
                          value={l.price}
                          onChange={(e) => setLine(l.productId, { price: e.target.value })}
                          style={{ width: 82, padding: '4px 6px', textAlign: 'right' }}
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => removeLine(l.productId)}
                          title="সরান"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {previewError ? (
              <div className="badge danger" style={{ marginTop: 10, whiteSpace: 'normal', display: 'block' }}>
                {previewError}
              </div>
            ) : null}
            <div
              className="cart-summary"
              style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}
            >
              <span>উপমোট</span>
              <span className="right">{money(preview?.subtotalMinor ?? 0)}</span>
              <span>ছাড়</span>
              <span className="right">
                {money((preview?.itemDiscountMinor ?? 0) + (preview?.cartDiscountMinor ?? 0))}
              </span>
              <span>ভ্যাট / কর</span>
              <span className="right">{money(preview?.taxMinor ?? 0)}</span>
              <span className="total">সর্বমোট</span>
              <span className="right total">{money(total)}</span>
              <span>পরিশোধ</span>
              <span className="right">{money(paid)}</span>
              <span>বাকি</span>
              <span className="right bold">{money(preview?.dueMinor ?? Math.max(0, total - paid))}</span>
            </div>
          </Card>

          <Card title="গ্রাহক, ছাড় ও পেমেন্ট">
            <div className="form-grid">
              <Field label="গ্রাহক">
                <Select ref={customerRef} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {Number(c.balance_minor) ? ` · বাকি ${money(c.balance_minor)}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="কার্ট ছাড়">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Select value={cartDiscountType} onChange={(e) => setCartDiscountType(e.target.value)}>
                    <option value="none">নেই</option>
                    <option value="percent">শতাংশ (%)</option>
                    <option value="fixed">নির্দিষ্ট টাকা</option>
                  </Select>
                  <Input
                    ref={discountRef}
                    value={cartDiscountValue}
                    onChange={(e) => setCartDiscountValue(e.target.value)}
                    disabled={cartDiscountType === 'none'}
                    style={{ width: 90 }}
                  />
                </div>
              </Field>
              <Field label="নোট (ঐচ্ছিক)" full>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
            <div className="card-title" style={{ marginTop: 16 }}>
              পেমেন্ট <span className="hint">একাধিক মাধ্যম ব্যবহার করা যায়</span>
            </div>
            {payments.map((p, i) => (
              <div className="payment-row" key={i}>
                <Select
                  value={p.accountId}
                  onChange={(e) =>
                    setPayments((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, accountId: e.target.value } : x)),
                    )
                  }
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
                <Input
                  value={p.amount}
                  onChange={(e) =>
                    setPayments((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)),
                    )
                  }
                  placeholder="টাকা"
                />
                <button
                  className="icon-btn"
                  onClick={() => setPayments((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <div className="row">
              <Button
                size="sm"
                icon={Plus}
                onClick={() =>
                  setPayments((prev) => [
                    ...prev,
                    {
                      paymentMethodId: methods[1]?.id ?? 'pm-cash',
                      accountId: accounts[0]?.id ?? 'acc-cash',
                      amount: '',
                    },
                  ])
                }
              >
                পেমেন্ট যোগ
              </Button>
              <Button size="sm" onClick={() => setCash(total)}>
                নগদ সম্পূর্ণ
              </Button>
            </div>
          </Card>

          <div className="row">
            <Button icon={PauseCircle} onClick={hold}>
              হোল্ড করুন
            </Button>
            <Button onClick={clear}>ক্লিয়ার</Button>
            <span style={{ flex: 1 }} />
            <Button
              variant="primary"
              icon={busy ? Loader2 : CheckCircle2}
              disabled={busy || !cart.length}
              onClick={complete}
            >
              {busy ? 'সংরক্ষণ হচ্ছে…' : 'সেল সম্পন্ন করুন'}
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(receipt)}
        title={`রিসিট · ${receipt?.invoiceNo ?? ''}`}
        onClose={() => setReceipt(null)}
        footer={
          <>
            <Select value={printer} onChange={(e) => setPrinter(e.target.value)} style={{ width: 200 }}>
              <option value="">সিস্টেমের ডিফল্ট প্রিন্টার</option>
              {printers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Button icon={Printer} onClick={printReceipt}>
              প্রিন্ট করুন
            </Button>
            <Button variant="primary" onClick={() => setReceipt(null)}>
              সম্পন্ন
            </Button>
          </>
        }
      >
        {receipt ? (
          <div className="receipt-frame" dangerouslySetInnerHTML={{ __html: receipt.html }} />
        ) : null}
        <p className="small muted center" style={{ marginTop: 12 }}>
          শুধুমাত্র ৫৮/৮০ মিমি তাপীয় রিসিট · কাস্টমার রিসিটে MERQO-র বিজ্ঞাপন থাকে না।
        </p>
      </Modal>

      <Modal open={heldOpen} title="হোল্ড করা সেল" onClose={() => setHeldOpen(false)}>
        {!held.length ? (
          <div className="empty">কোনো হোল্ড করা সেল নেই।</div>
        ) : (
          <div className="list">
            {held.map((h) => (
              <div className="list-item" key={h.reference ?? h.id}>
                <PlayCircle size={17} />
                <div className="grow">
                  <div className="title">{h.reference}</div>
                  <div className="desc">
                    {h.note || 'কোনো নোট নেই'} · {String(h.created_at ?? '').slice(0, 16)}
                  </div>
                </div>
                <Button size="sm" variant="primary" onClick={() => void resume(String(h.reference))}>
                  ফিরিয়ে আনুন
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
