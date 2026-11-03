import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  Wallet,
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowUpRight,
} from 'lucide-react';
import { Button, Card, DataTable, Badge, Loading, money, qty, dateBn, useApiQuery } from '../components';

const KPI = ({
  label,
  value,
  icon: Icon,
  tone = '',
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ size?: number }>;
  tone?: string;
  hint?: string;
}) => (
  <div className={`card kpi ${tone}`}>
    <div className="icon">
      <Icon size={17} />
    </div>
    <div className="label">{label}</div>
    <div className="value">{value}</div>
    {hint ? <div className="meta">{hint}</div> : null}
  </div>
);

export function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const { data, loading, reload } = useApiQuery('dashboard.get', { from, to }, [from, to]);
  const k = (data?.kpis ?? {}) as Record<string, number>;
  const toTaka = (v: number) => Number(v ?? 0) / 100;
  const series = (data?.dailySalesOverview ?? []) as {
    label: string;
    sales_minor: number;
    profit_minor: number;
  }[];
  const chart = series.map((r) => ({
    label: String(r.label).slice(5),
    বিক্রয়: toTaka(r.sales_minor),
    মুনাফা: toTaka(r.profit_minor),
  }));
  const top = (data?.topSellingProducts ?? []) as {
    name: string;
    qty_minor: number;
    revenue_minor: number;
  }[];
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>ড্যাশবোর্ড</h1>
          <div className="sub">
            {(data?.greeting as string) ?? 'স্বাগতম'} আজকের ব্যবসার সারাংশ নিচে দেখুন।
          </div>
        </div>
        <div className="page-actions">
          <input
            type="date"
            className="input"
            style={{ width: 155 }}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="শুরুর তারিখ"
          />
          <input
            type="date"
            className="input"
            style={{ width: 155 }}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="শেষ তারিখ"
          />
          <Button onClick={reload}>রিফ্রেশ</Button>
        </div>
      </div>
      {loading ? (
        <Loading rows={6} />
      ) : (
        <>
          <div className="kpi-grid section">
            <KPI
              label="মোট বিক্রয়"
              value={money(k.todaySales)}
              icon={ShoppingCart}
              hint={`${k.transactionCount ?? 0} টি লেনদেন`}
            />
            <KPI label="মোট ক্রয়" value={money(k.todayPurchases)} icon={Package} />
            <KPI label="মোট মুনাফা" value={money(k.grossProfit)} icon={TrendingUp} tone="good" />
            <KPI
              label="নিট মুনাফা"
              value={money(k.netProfit)}
              icon={ArrowUpRight}
              tone={Number(k.netProfit ?? 0) < 0 ? 'danger' : 'good'}
              hint="খরচ ও অন্যান্য আয় বাদ দিয়ে"
            />
            <KPI label="গ্রাহক বাকি" value={money(k.customerDue)} icon={CreditCard} tone="warn" />
            <KPI label="সরবরাহকারী বাকি" value={money(k.supplierDue)} icon={Wallet} tone="warn" />
            <KPI
              label="নগদ / ব্যাংক / MFS"
              value={money(
                Number(k.cashBalance ?? 0) + Number(k.bankBalance ?? 0) + Number(k.mobileBalance ?? 0),
              )}
              icon={Banknote}
              hint={`নগদ ${money(k.cashBalance)} · ব্যাংক ${money(k.bankBalance)} · MFS ${money(k.mobileBalance)}`}
            />
            <KPI
              label="কম স্টক / স্টকআউট"
              value={`${k.lowStock ?? 0} / ${k.outOfStock ?? 0}`}
              icon={AlertTriangle}
              tone="warn"
              hint={`মোট ${k.totalProducts ?? 0} টি পণ্য`}
            />
          </div>
          <div className="two-col section">
            <Card title="বিক্রয় ও মুনাফার ধারা" hint="নির্বাচিত সময়কাল">
              <div style={{ height: 260 }}>
                {chart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chart}>
                      <defs>
                        <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0F766E" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#0F766E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C2410C" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#C2410C" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => money(Math.round(v * 100))} />
                      <Area
                        type="monotone"
                        dataKey="বিক্রয়"
                        stroke="#0F766E"
                        fill="url(#gSales)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="মুনাফা"
                        stroke="#C2410C"
                        fill="url(#gProfit)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty">এই সময়ে কোনো বিক্রয় নেই।</div>
                )}
              </div>
            </Card>
            <Card title="দ্রুত কাজ" hint="এক ক্লিকে শুরু করুন">
              <div style={{ display: 'grid', gap: 8 }}>
                {(['pos', 'product', 'purchase', 'due', 'report'] as const).map((p) => (
                  <Button
                    key={p}
                    onClick={() => onNavigate(p === 'due' ? 'finance' : p === 'product' ? 'products' : p)}
                  >
                    {p === 'pos'
                      ? 'নতুন সেল'
                      : p === 'product'
                        ? 'প্রোডাক্ট যোগ'
                        : p === 'purchase'
                          ? 'নতুন ক্রয়'
                          : p === 'due'
                            ? 'বাকি আদায়'
                            : 'রিপোর্ট দেখুন'}
                  </Button>
                ))}
              </div>
              <div className="card-title" style={{ marginTop: 20 }}>
                কম স্টকের সতর্কতা
              </div>
              <div className="list">
                {((data?.lowStockAlerts ?? []) as any[]).length ? (
                  ((data?.lowStockAlerts ?? []) as any[]).slice(0, 6).map((a) => (
                    <div className="list-item" key={a.id}>
                      <Badge tone="warning">কম</Badge>
                      <div className="grow">
                        <div className="title">{a.name}</div>
                        <div className="desc">সীমা {qty(a.min_stock_minor)}</div>
                      </div>
                      <strong>{qty(a.current_stock_minor)}</strong>
                    </div>
                  ))
                ) : (
                  <div className="small muted">কোনো সতর্কতা নেই।</div>
                )}
              </div>
            </Card>
          </div>
          <div className="two-col section">
            <Card title="সর্বাধিক বিক্রিত পণ্য">
              <div style={{ height: 230 }}>
                {top.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={top
                        .slice(0, 7)
                        .map((t) => ({ name: t.name.slice(0, 12), পরিমাণ: Number(t.qty_minor) / 1000 }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="পরিমাণ" fill="#0F766E" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty">এখনো বিক্রয় তথ্য নেই।</div>
                )}
              </div>
            </Card>
            <Card title="সাম্প্রতিক কার্যকলাপ">
              <div className="list">
                {((data?.recentActivities ?? []) as any[]).slice(0, 8).map((a) => (
                  <div className="list-item" key={a.id}>
                    <div className="grow">
                      <div className="title">{a.action}</div>
                      <div className="desc">
                        {a.actor_name} · {a.entity}
                      </div>
                    </div>
                    <span className="small muted">{dateBn(a.created_at)}</span>
                  </div>
                ))}
                {!((data?.recentActivities ?? []) as any[]).length ? (
                  <div className="small muted">এখনো কোনো কার্যকলাপ নেই।</div>
                ) : null}
              </div>
            </Card>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
            {[
              [
                'সাম্প্রতিক বিক্রয়',
                data?.recentSales,
                [
                  ['invoice_no', 'ইনভয়েস'],
                  ['customer_name', 'গ্রাহক'],
                  ['total_minor', 'মোট'],
                ],
              ],
              [
                'সাম্প্রতিক ক্রয়',
                data?.recentPurchases,
                [
                  ['invoice_no', 'ইনভয়েস'],
                  ['supplier_name', 'সরবরাহকারী'],
                  ['total_minor', 'মোট'],
                ],
              ],
              [
                'সাম্প্রতিক পেমেন্ট',
                data?.recentPayments,
                [
                  ['kind', 'ধরন'],
                  ['account_name', 'অ্যাকাউন্ট'],
                  ['amount_minor', 'পরিমাণ'],
                ],
              ],
            ].map(([title, rows, cols]: any) => (
              <Card key={title} title={title}>
                <DataTable
                  columns={cols.map((pair: string[]) => {
                    const key = String(pair[0]);
                    const label = String(pair[1]);
                    return {
                      key,
                      label,
                      render: key.endsWith('_minor') ? (r: any) => money(r[key]) : undefined,
                    };
                  })}
                  rows={(rows ?? []) as any[]}
                  emptyText="এখনো কোনো তথ্য নেই।"
                />
              </Card>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>
            <Smartphone size={12} style={{ verticalAlign: -2 }} /> সব সংখ্যা সরাসরি স্থানীয় ডাটাবেজ থেকে গণনা
            করা হয়েছে।
          </p>
        </>
      )}
    </div>
  );
}
