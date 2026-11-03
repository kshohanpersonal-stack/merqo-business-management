import React, { useEffect, useMemo, useState } from 'react';
import { setLanguage, type Language } from '../i18n';
import {
  FileText,
  Download,
  ShieldCheck,
  Plus,
  RefreshCw,
  Upload,
  HardDriveDownload,
  Trash2,
  Printer,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { api, call, exportFile, isElectron } from '../api';
import logo from '../../../assets/icons/merqo.png';
import {
  Button,
  Card,
  DataTable,
  Modal,
  ConfirmDialog,
  Badge,
  Field,
  Input,
  Select,
  TextArea,
  useToast,
  useAction,
  useApiQuery,
  money,
  dateBn,
} from '../components';

function Head({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
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
/* Reports (28)                                                        */
/* ------------------------------------------------------------------ */
export function Reports() {
  const toast = useToast();
  const [selected, setSelected] = useState('daily-sales');
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [html, setHtml] = useState<string | null>(null);
  const { data: list } = useApiQuery<any[]>('report.list', {}, []);
  const filter = useMemo(
    () => ({ from, to, search, status, page, pageSize: 25, sortBy, sortDir }),
    [from, to, search, status, page, sortBy, sortDir],
  );
  const { data, loading, reload } = useApiQuery<any>('report.run', { key: selected, filter }, [
    selected,
    JSON.stringify(filter),
  ]);
  const rows: any[] = data?.rows ?? [];
  const moneyCols: string[] = data?.report?.moneyColumns ?? [];
  const columns = useMemo(() => {
    const keys = Object.keys(rows[0] ?? {}).slice(0, 14);
    return keys.map((key) => ({
      key,
      label: key.replace(/_minor$/, '').replace(/_/g, ' '),
      align: (moneyCols.includes(key) || key.endsWith('_minor') ? 'right' : undefined) as 'right' | undefined,
      render:
        moneyCols.includes(key) || key.endsWith('_minor')
          ? (r: any) => money(r[key])
          : key.includes('date') || key.includes('_at')
            ? (r: any) => dateBn(r[key])
            : undefined,
    }));
  }, [rows, moneyCols]);
  const groups = useMemo(() => {
    const out: Record<string, any[]> = {};
    for (const r of (list ?? []) as any[]) (out[r.group] ??= []).push(r);
    return out;
  }, [list]);
  return (
    <div>
      <Head title="রিপোর্ট ও রপ্তানি" sub="২৮টি রিপোর্ট · বাস্তব ডাটাবেজ তথ্য · CSV / XLSX / PDF / HTML">
        <Button icon={RefreshCw} onClick={reload}>
          রিফ্রেশ
        </Button>
      </Head>
      <div className="report-layout">
        <div className="card report-side">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="nav-group">{group}</div>
              {items.map((r: any) => (
                <button
                  key={r.key}
                  className={`report-item ${selected === r.key ? 'active' : ''}`}
                  onClick={() => {
                    setSelected(r.key);
                    setPage(1);
                  }}
                >
                  {r.title}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div>
          <Card
            title={(list as any[])?.find((r: any) => r.key === selected)?.title ?? selected}
            hint={`${data?.total ?? 0} টি সারি`}
          >
            <div className="toolbar">
              <input
                type="date"
                className="input"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                aria-label="শুরু"
              />
              <input
                type="date"
                className="input"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                aria-label="শেষ"
              />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="খুঁজুন…"
                style={{ width: 170 }}
              />
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                style={{ width: 140 }}
              >
                <option value="">সব অবস্থা</option>
                <option value="completed">সম্পন্ন</option>
                <option value="cancelled">বাতিল</option>
                <option value="active">সক্রিয়</option>
                <option value="void">বাতিল</option>
              </Select>
              <span style={{ flex: 1 }} />
              <Button
                size="sm"
                icon={Download}
                onClick={() =>
                  void exportFile(selected, 'csv', filter).catch((e: Error) => toast(e.message, 'error'))
                }
              >
                CSV
              </Button>
              <Button
                size="sm"
                icon={Download}
                onClick={() =>
                  void exportFile(selected, 'xlsx', filter).catch((e: Error) => toast(e.message, 'error'))
                }
              >
                XLSX
              </Button>
              <Button
                size="sm"
                icon={Download}
                onClick={() =>
                  void exportFile(selected, 'pdf', filter).catch((e: Error) => toast(e.message, 'error'))
                }
              >
                PDF
              </Button>
              <Button
                size="sm"
                icon={FileText}
                onClick={() =>
                  void call<any>('report.html', { key: selected, filter })
                    .then((d) => setHtml(d.html))
                    .catch((e: Error) => toast(e.message, 'error'))
                }
              >
                প্রিভিউ
              </Button>
            </div>
            <DataTable
              columns={columns}
              rows={rows}
              total={data?.total ?? 0}
              page={page}
              pageSize={25}
              onPage={setPage}
              loading={loading}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={(k) => {
                setSortDir((d) => (sortBy === k && d === 'desc' ? 'asc' : 'desc'));
                setSortBy(k);
                setPage(1);
              }}
            />
            {Object.keys(data?.totals ?? {}).length ? (
              <div className="row" style={{ marginTop: 14 }}>
                {Object.entries(data.totals as Record<string, number>).map(([k, v]) => (
                  <Badge key={k} tone="info">
                    {k.replace(/_minor$/, '').replace(/_/g, ' ')}: {money(v)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Card>
        </div>
      </div>
      <Modal open={html !== null} title="রিপোর্ট প্রিভিউ" wide onClose={() => setHtml(null)}>
        {html !== null ? (
          <iframe
            title="রিপোর্ট"
            srcDoc={html}
            style={{ width: '100%', height: '65vh', border: '1px solid var(--border)' }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Backup & restore                                                    */
/* ------------------------------------------------------------------ */
export function Backup() {
  const toast = useToast();
  const run = useAction();
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreRow, setRestoreRow] = useState<any>(null);
  const [passphrase, setPassphrase] = useState('');
  const [note, setNote] = useState('');
  const [dest, setDest] = useState('');
  const [verify, setVerify] = useState<any>(null);
  const [keep, setKeep] = useState('10');
  const { data: list, loading, reload } = useApiQuery<any[]>('backup.list', {}, []);
  const { data: settings } = useApiQuery<any>('settings.get', { key: 'backup' }, []);
  const chooseDestination = async () => {
    const out = await api.selectDirectory();
    if (out.ok && out.path) setDest(out.path);
  };
  const chooseFile = async () => {
    const out = await api.selectFile('ব্যাকআপ ফাইল বেছে নিন', [
      { name: 'MERQO ব্যাকআপ', extensions: ['merqobak'] },
    ]);
    if (out.ok && out.path) setRestoreRow({ file_path: out.path, file_name: out.path.split(/[\\/]/).pop() });
  };
  const doVerify = async (row: any) => {
    try {
      setVerify(await call<any>('backup.verify', { filePath: row.file_path, passphrase }));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div>
      <Head
        title="ব্যাকআপ ও রিস্টোর"
        sub="স্থানীয় ব্যাকআপ, SHA-256 যাচাই, ঐচ্ছিক AES-256-GCM এনক্রিপশন, রিস্টোরের আগে নিরাপত্তা ব্যাকআপ"
      >
        {isElectron ? (
          <Button icon={Upload} onClick={() => void chooseFile()}>
            বাহিরের ফাইল বেছে নিন
          </Button>
        ) : (
          <Button icon={Upload} onClick={() => void chooseFile()}>
            ব্যাকআপ আপলোড
          </Button>
        )}
        <Button variant="primary" icon={HardDriveDownload} onClick={() => setCreateOpen(true)}>
          এখনই ব্যাকআপ নিন
        </Button>
      </Head>
      <div className="two-col section">
        <Card title="ব্যাকআপ ইতিহাস">
          <DataTable
            loading={loading}
            rows={(list ?? []) as any[]}
            columns={[
              { key: 'file_name', label: 'ফাইল' },
              { key: 'created_at', label: 'তৈরি', render: (r) => dateBn(r.created_at) },
              {
                key: 'size_bytes',
                label: 'আকার',
                align: 'right',
                render: (r) => `${(Number(r.size_bytes) / 1024).toFixed(0)} KB`,
              },
              { key: 'trigger', label: 'ধরন' },
              {
                key: 'encrypted',
                label: 'এনক্রিপ্ট',
                render: (r) => (r.encrypted ? <Badge tone="info">হ্যাঁ</Badge> : 'না'),
              },
              {
                key: 'status',
                label: 'অবস্থা',
                render: (r) => (
                  <Badge
                    tone={r.status === 'verified' ? 'success' : r.status === 'restored' ? 'info' : 'default'}
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
                    <Button size="sm" icon={ShieldCheck} onClick={() => void doVerify(r)}>
                      যাচাই
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={RefreshCw}
                      onClick={() => {
                        setRestoreRow(r);
                        setPassphrase('');
                      }}
                    >
                      রিস্টোর
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
        <Card title="স্বয়ংক্রিয় ব্যাকআপ সেটিংস">
          <p className="small muted">
            বর্তমান: স্বয়ংক্রিয় {settings?.value?.automatic ? 'চালু' : 'বন্ধ'} · প্রতি{' '}
            {String(settings?.value?.frequencyHours ?? 24)} ঘণ্টা · সংরক্ষণ{' '}
            {String(settings?.value?.retention ?? 10)} টি
          </p>
          <Field label="সংরক্ষণ সংখ্যা">
            <Input type="number" value={keep} onChange={(e) => setKeep(e.target.value)} />
          </Field>
          <div className="row" style={{ marginTop: 12 }}>
            <Button
              onClick={() =>
                void run(
                  'settings.set',
                  {
                    key: 'backup',
                    value: { ...(settings?.value ?? {}), automatic: true, retention: Number(keep) },
                  },
                  'স্বয়ংক্রিয় ব্যাকআপ চালু হয়েছে।',
                )
                  .then(reload)
                  .catch(() => {})
              }
            >
              স্বয়ংক্রিয় চালু
            </Button>
            <Button
              onClick={() =>
                void run(
                  'settings.set',
                  { key: 'backup', value: { ...(settings?.value ?? {}), automatic: false } },
                  'স্বয়ংক্রিয় ব্যাকআপ বন্ধ হয়েছে।',
                )
                  .then(reload)
                  .catch(() => {})
              }
            >
              বন্ধ করুন
            </Button>
            <Button
              icon={Trash2}
              onClick={() =>
                void run('backup.retention', { keep: Number(keep) }, 'পুরনো ব্যাকআপ সরানো হয়েছে।')
                  .then(reload)
                  .catch(() => {})
              }
            >
              রিটেনশন প্রয়োগ
            </Button>
          </div>
          <p className="small muted" style={{ marginTop: 12, lineHeight: 1.8 }}>
            রিস্টোরের আগে বর্তমান ডাটাবেজের একটি যাচাইকৃত নিরাপত্তা ব্যাকআপ স্বয়ংক্রিয়ভাবে তৈরি হয়। কোনো তথ্য
            নীরবে ওভাররাইট করা হয় না।
          </p>
        </Card>
      </div>
      {verify ? (
        <Card title="ব্যাকআপ যাচাইয়ের ফলাফল" className="section">
          <div className="row">
            {verify.valid ? <CheckCircle2 color="#15803D" /> : <XCircle color="#B91C1C" />}
            <strong>{verify.valid ? 'ফাইলটি বৈধ ও অখণ্ড' : 'ফাইলটি গ্রহণযোগ্য নয়'}</strong>
            <span className="small muted">{verify.reasons?.join(' · ')}</span>
          </div>
          <div className="kv" style={{ marginTop: 12 }}>
            <span className="k">স্কিমা সংস্করণ</span>
            <span>{String(verify.schemaVersion ?? '—')}</span>
            <span className="k">SHA-256</span>
            <span className="small">{String(verify.sha256 ?? '—').slice(0, 32)}…</span>
            <span className="k">এনক্রিপ্টেড</span>
            <span>{verify.encrypted ? 'হ্যাঁ' : 'না'}</span>
          </div>
        </Card>
      ) : null}
      <Modal
        open={createOpen}
        title="নতুন ব্যাকআপ"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>বাতিল</Button>
            <Button
              variant="primary"
              onClick={() => {
                void run(
                  'backup.create',
                  {
                    destinationDir: dest || undefined,
                    passphrase: passphrase || undefined,
                    trigger: 'manual',
                    note,
                  },
                  'ব্যাকআপ তৈরি ও যাচাই সম্পন্ন হয়েছে।',
                )
                  .then(() => {
                    setCreateOpen(false);
                    reload();
                  })
                  .catch(() => {});
              }}
            >
              ব্যাকআপ তৈরি করুন
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="এনক্রিপশন পাসফ্রেজ (ঐচ্ছিক)" full>
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="খালি রাখলে এনক্রিপশন হবে না"
            />
          </Field>
          <Field label="নোট" full>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Field label="গন্তব্য ফোল্ডার" full>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <Input
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                placeholder="ডিফল্ট: ব্যবহারকারীর ডাটা ফোল্ডার"
              />
              <Button onClick={() => void chooseDestination()}>বেছে নিন</Button>
            </div>
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(restoreRow)}
        title="রিস্টোর নিশ্চিত করুন"
        confirmLabel="হ্যাঁ, রিস্টোর করুন"
        message={`${restoreRow?.file_name ?? ''} থেকে ডাটাবেজ ফিরিয়ে আনা হবে। আগে বর্তমান তথ্যের নিরাপত্তা ব্যাকআপ নেওয়া হবে এবং নতুন ডাটাবেজ অখণ্ডতা যাচাইয়ের পরেই বদলানো হবে।`}
        onClose={() => setRestoreRow(null)}
        onConfirm={() => {
          const filePath = restoreRow?.file_path;
          void run(
            'backup.restore',
            { filePath, passphrase: passphrase || undefined },
            'রিস্টোর সফল হয়েছে; অ্যাপটি পুনরায় লোড হবে।',
          )
            .then(() => setTimeout(() => window.location.reload(), 700))
            .catch(() => {});
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Users, roles and permission matrix                                  */
/* ------------------------------------------------------------------ */
export function UsersPage({ initialTab = 0 }: { initialTab?: number }) {
  const run = useAction();
  const [tab, setTab] = useState(initialTab);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [form, setForm] = useState({ username: '', fullName: '', password: '', roleId: '', phone: '' });
  const [roleName, setRoleName] = useState('');
  const { data: users, reload } = useApiQuery<any[]>('user.list', {}, []);
  const { data: roles, reload: reloadRoles } = useApiQuery<any[]>('user.roles', {}, []);
  const { data: permissions } = useApiQuery<any[]>('user.permissions', {}, []);
  const { data: rolePerms, reload: reloadPerms } = useApiQuery<any[]>('user.rolePermissions', {}, []);
  const [selectedRole, setSelectedRole] = useState('');
  useEffect(() => {
    if (!selectedRole && roles?.[0]) setSelectedRole(roles[0].id);
  }, [roles, selectedRole]);
  const enabled = new Set(
    (rolePerms ?? []).filter((r: any) => r.role_id === selectedRole).map((r: any) => r.permission_id),
  );
  return (
    <div>
      <Head
        title="ব্যবহারকারী ও অনুমতি"
        sub="RBAC · কাস্টম ভূমিকা · সম্পাদনাযোগ্য অনুমতি ম্যাট্রিক্স · সার্ভার-সাইড প্রয়োগ"
      >
        <Button icon={Plus} onClick={() => setRoleOpen(true)}>
          নতুন ভূমিকা
        </Button>
        <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
          নতুন ব্যবহারকারী
        </Button>
      </Head>
      <div className="tabs">
        {['ব্যবহারকারী', 'অনুমতি ম্যাট্রিক্স', 'অডিট লগ'].map((t, i) => (
          <button key={t} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 0 ? (
        <DataTable
          rows={(users ?? []) as any[]}
          columns={[
            { key: 'username', label: 'ইউজারনেম' },
            { key: 'full_name', label: 'নাম' },
            { key: 'role_name', label: 'ভূমিকা' },
            {
              key: 'status',
              label: 'অবস্থা',
              render: (r) => <Badge tone={r.status === 'active' ? 'success' : 'danger'}>{r.status}</Badge>,
            },
            { key: 'last_login_at', label: 'শেষ লগইন', render: (r) => dateBn(r.last_login_at) },
            {
              key: '_a',
              label: 'কাজ',
              align: 'right',
              render: (r) => (
                <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                  <Select
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        void run(
                          'user.setRole',
                          { id: r.id, roleId: e.target.value },
                          'ভূমিকা পরিবর্তিত হয়েছে।',
                        )
                          .then(reload)
                          .catch(() => {});
                    }}
                    style={{ width: 130 }}
                  >
                    <option value="">ভূমিকা বদলান</option>
                    {(roles ?? []).map((x: any) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    onClick={() =>
                      void run(
                        'user.setStatus',
                        { id: r.id, status: r.status === 'active' ? 'disabled' : 'active' },
                        'অবস্থা আপডেট হয়েছে।',
                      )
                        .then(reload)
                        .catch(() => {})
                    }
                  >
                    {r.status === 'active' ? 'নিষ্ক্রিয়' : 'সক্রিয়'}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      ) : null}
      {tab === 1 ? (
        <Card title="অনুমতি ম্যাট্রিক্স" hint="পরিবর্তন সঙ্গে সঙ্গে ডাটাবেজে সংরক্ষিত হয়">
          <div className="toolbar">
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{ width: 220 }}
            >
              {(roles ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.is_system ? ' (সিস্টেম)' : ''}
                </option>
              ))}
            </Select>
            <span className="small muted">
              মোট {String((permissions ?? []).length)} টি অনুমতি · {enabled.size} টি সক্রিয়
            </span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
            {(permissions ?? []).map((p: any) => (
              <label key={p.id} className="card card-pad row" style={{ gap: 9, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enabled.has(p.id)}
                  onChange={(e) =>
                    void run(
                      'user.setRolePermission',
                      { roleId: selectedRole, permissionId: p.id, enabled: e.target.checked },
                      'অনুমতি আপডেট হয়েছে।',
                    )
                      .then(reloadPerms)
                      .catch(() => {})
                  }
                />
                <span>
                  <span className="bold small">{String(p.label ?? p.id)}</span>
                  <span className="small muted" style={{ display: 'block' }}>
                    {String(p.id)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Card>
      ) : null}
      {tab === 2 ? <AuditLog /> : null}
      <Modal
        open={createOpen}
        title="নতুন ব্যবহারকারী"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>বাতিল</Button>
            <Button
              variant="primary"
              onClick={() => {
                void run('user.create', form, 'ব্যবহারকারী তৈরি হয়েছে।')
                  .then(() => {
                    setCreateOpen(false);
                    reload();
                  })
                  .catch(() => {});
              }}
            >
              তৈরি করুন
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="ইউজারনেম *">
            <Input
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
            />
          </Field>
          <Field label="পুরো নাম *">
            <Input
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
            />
          </Field>
          <Field label="পাসওয়ার্ড *">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </Field>
          <Field label="ভূমিকা *">
            <Select value={form.roleId} onChange={(e) => setForm((p) => ({ ...p, roleId: e.target.value }))}>
              <option value="">বেছে নিন</option>
              {(roles ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ফোন" full>
            <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={roleOpen}
        title="নতুন কাস্টম ভূমিকা"
        onClose={() => setRoleOpen(false)}
        footer={
          <>
            <Button onClick={() => setRoleOpen(false)}>বাতিল</Button>
            <Button
              variant="primary"
              onClick={() => {
                void run('user.createRole', { name: roleName }, 'ভূমিকা তৈরি হয়েছে।')
                  .then(() => {
                    setRoleOpen(false);
                    reloadRoles();
                  })
                  .catch(() => {});
              }}
            >
              তৈরি করুন
            </Button>
          </>
        }
      >
        <Field label="ভূমিকার নাম *">
          <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
function AuditLog() {
  const { data, loading } = useApiQuery<any>('audit.list', { pageSize: 40 }, []);
  return (
    <Card title="অডিট লগ" hint="কে, কী, কখন, কোন রেকর্ড">
      <DataTable
        loading={loading}
        rows={(data?.rows ?? []) as any[]}
        columns={[
          { key: 'created_at', label: 'সময়', render: (r) => dateBn(r.created_at) },
          { key: 'actor_name', label: 'ব্যবহারকারী' },
          { key: 'action', label: 'কাজ' },
          { key: 'entity', label: 'রেকর্ড' },
          { key: 'entity_id', label: 'আইডি' },
        ]}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */
export function Notifications() {
  const run = useAction();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', severity: 'info' });
  const { data, loading, reload } = useApiQuery<any>('notification.list', { pageSize: 50 }, []);
  return (
    <div>
      <Head title="নোটিফিকেশন সেন্টার" sub="কম স্টক, মেয়াদ, ব্যাকআপ ও সিস্টেম সতর্কতা — সব স্থানীয়">
        <Button
          icon={RefreshCw}
          onClick={() =>
            void run('notification.refresh', {}, 'সতর্কতা পুনরায় গণনা হয়েছে।')
              .then(reload)
              .catch(() => {})
          }
        >
          সতর্কতা রিফ্রেশ
        </Button>
        <Button
          onClick={() =>
            void run('notification.markRead', { all: true }, 'সব পড়া হয়েছে বলে চিহ্নিত।')
              .then(reload)
              .catch(() => {})
          }
        >
          সব পড়া হয়েছে
        </Button>
        <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
          নতুন বিজ্ঞপ্তি
        </Button>
      </Head>
      <Card>
        <DataTable
          loading={loading}
          rows={(data?.rows ?? []) as any[]}
          total={data?.total ?? 0}
          columns={[
            { key: 'title', label: 'শিরোনাম' },
            { key: 'message', label: 'বার্তা' },
            {
              key: 'severity',
              label: 'ধরন',
              render: (r) => (
                <Badge
                  tone={r.severity === 'error' ? 'danger' : r.severity === 'warning' ? 'warning' : 'info'}
                >
                  {r.severity}
                </Badge>
              ),
            },
            { key: 'created_at', label: 'সময়', render: (r) => dateBn(r.created_at) },
            {
              key: 'read_at',
              label: 'অবস্থা',
              render: (r) =>
                r.read_at ? <Badge tone="success">পড়া হয়েছে</Badge> : <Badge tone="warning">অপঠিত</Badge>,
            },
            {
              key: '_a',
              label: 'কাজ',
              align: 'right',
              render: (r) =>
                !r.read_at ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      void run('notification.markRead', { ids: [r.id] }, 'চিহ্নিত হয়েছে।')
                        .then(reload)
                        .catch(() => {})
                    }
                  >
                    পড়া হয়েছে
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>
      <Modal
        open={createOpen}
        title="নতুন বিজ্ঞপ্তি"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>বাতিল</Button>
            <Button
              variant="primary"
              onClick={() => {
                void run('notification.create', form, 'বিজ্ঞপ্তি যোগ হয়েছে।')
                  .then(() => {
                    setCreateOpen(false);
                    reload();
                  })
                  .catch(() => {});
              }}
            >
              যোগ করুন
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="শিরোনাম *" full>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </Field>
          <Field label="বার্তা" full>
            <TextArea
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
            />
          </Field>
          <Field label="ধরন">
            <Select
              value={form.severity}
              onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
            >
              <option value="info">তথ্য</option>
              <option value="warning">সতর্কতা</option>
              <option value="error">জরুরি</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */
export function SettingsPage() {
  const run = useAction();
  const [tab, setTab] = useState(0);
  const [business, setBusiness] = useState<any>({});
  const { data, reload } = useApiQuery<any>('settings.all', {}, []);
  const { data: shortcuts, reload: reloadShortcuts } = useApiQuery<any[]>('shortcuts.list', {}, []);
  const { data: profiles } = useApiQuery<any[]>('printing.profiles', {}, []);
  const { data: printers } = useApiQuery<any>('printing.printers', {}, []);
  useEffect(() => {
    if (data?.business) setBusiness(data.business);
  }, [data]);
  const values = data?.values ?? {};
  const set = (key: string, value: unknown, message = 'সেটিংস সংরক্ষিত হয়েছে।') => {
    if (key === 'language') {
      void setLanguage(value === 'en' ? 'en' : ('bn' as Language));
      return;
    }
    void run('settings.set', { key, value }, message)
      .then(reload)
      .catch(() => {});
  };
  const patch = (key: string, extra: Record<string, unknown>) =>
    set(key, { ...(values[key] ?? {}), ...extra });
  return (
    <div>
      <Head
        title="সেটিংস"
        sub="ব্যবসার তথ্য, মুদ্রা, বাংলা সংখ্যা, ভ্যাট, রিসিট, ব্যাকআপ, প্রিন্টার ও শর্টকাট"
      />
      <div className="tabs">
        {['ব্যবসা', 'মুদ্রা ও সংখ্যা', 'ভ্যাট / কর', 'রিসিট ও প্রিন্টার', 'শর্টকাট'].map((t, i) => (
          <button key={t} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 0 ? (
        <Card title="ব্যবসার প্রোফাইল" hint="রিসিট ও রিপোর্টে ব্যবহৃত হয়">
          <div className="form-grid">
            {[
              ['business_name', 'ব্যবসার নাম'],
              ['business_name_en', 'English নাম'],
              ['phone', 'ফোন'],
              ['email', 'ইমেইল'],
              ['tax_registration', 'ভ্যাট / ট্রেড লাইসেন্স নম্বর'],
              ['invoice_footer', 'রিসিট ফুটার'],
            ].map((pair) => {
              const k = String(pair[0]);
              const label = String(pair[1]);
              return (
                <Field key={k} label={label}>
                  <Input
                    value={String(business[k] ?? '')}
                    onChange={(e) => setBusiness((p: any) => ({ ...p, [k]: e.target.value }))}
                  />
                </Field>
              );
            })}
            <Field label="ঠিকানা" full>
              <TextArea
                value={String(business.address ?? '')}
                onChange={(e) => setBusiness((p: any) => ({ ...p, address: e.target.value }))}
              />
            </Field>
          </div>
          <Button
            variant="primary"
            style={{ marginTop: 14 }}
            onClick={() =>
              void run('settings.business', business, 'ব্যবসার তথ্য সংরক্ষিত হয়েছে।')
                .then(reload)
                .catch(() => {})
            }
          >
            সংরক্ষণ করুন
          </Button>
        </Card>
      ) : null}
      {tab === 1 ? (
        <div className="two-col">
          <Card title="মুদ্রা">
            <div className="form-grid">
              <Field label="কোড">
                <Input
                  value={String(values.currency?.code ?? 'BDT')}
                  onChange={(e) => patch('currency', { code: e.target.value })}
                />
              </Field>
              <Field label="প্রতীক">
                <Input
                  value={String(values.currency?.symbol ?? '৳')}
                  onChange={(e) => patch('currency', { symbol: e.target.value })}
                />
              </Field>
              <Field label="অবস্থান">
                <Select
                  value={String(values.currency?.position ?? 'before')}
                  onChange={(e) => patch('currency', { position: e.target.value })}
                >
                  <option value="before">টাকার আগে (৳ ১০০)</option>
                  <option value="after">টাকার পরে (১০০ ৳)</option>
                </Select>
              </Field>
            </div>
          </Card>
          <Card title="সংখ্যা ও তারিখ">
            <div className="form-grid">
              <Field label="তারিখের ফরম্যাট">
                <Input
                  value={String(values.dateFormat ?? 'dd/MM/yyyy')}
                  onChange={(e) => set('dateFormat', e.target.value)}
                />
              </Field>
              <Field label="ভাষা">
                <Select
                  value={String(values.language ?? 'bn')}
                  onChange={(e) => set('language', e.target.value)}
                >
                  <option value="bn">বাংলা</option>
                  <option value="en">English</option>
                </Select>
              </Field>
              <Field label="বাংলা সংখ্যা">
                <Select
                  value={String(Boolean(values.numberFormat?.banglaDigits))}
                  onChange={(e) => patch('numberFormat', { banglaDigits: e.target.value === 'true' })}
                >
                  <option value="false">০১২… না (ল্যাটিন)</option>
                  <option value="true">০১২… হ্যাঁ (বাংলা)</option>
                </Select>
              </Field>
            </div>
          </Card>
        </div>
      ) : null}
      {tab === 2 ? (
        <Card title="ভ্যাট / কর">
          <div className="form-grid">
            <Field label="ভ্যাট চালু">
              <Select
                value={String(Boolean(values.tax?.enabled))}
                onChange={(e) => patch('tax', { enabled: e.target.value === 'true' })}
              >
                <option value="false">বন্ধ</option>
                <option value="true">চালু</option>
              </Select>
            </Field>
            <Field label="হার (%)">
              <Input
                type="number"
                step="0.01"
                value={String(Number(values.tax?.rateBps ?? 0) / 100)}
                onChange={(e) => patch('tax', { rateBps: Math.round(Number(e.target.value) * 100) })}
              />
            </Field>
            <Field label="লেবেল">
              <Input
                value={String(values.tax?.label ?? 'ভ্যাট')}
                onChange={(e) => patch('tax', { label: e.target.value })}
              />
            </Field>
            <Field label="মোড">
              <Select
                value={String(values.tax?.mode ?? 'exclusive')}
                onChange={(e) => patch('tax', { mode: e.target.value })}
              >
                <option value="exclusive">মূল্যের সাথে যোগ</option>
                <option value="inclusive">মূল্যের ভিতরে</option>
              </Select>
            </Field>
          </div>
        </Card>
      ) : null}
      {tab === 3 ? (
        <div className="two-col">
          <Card title="তাপীয় রিসিট">
            <div className="form-grid">
              <Field label="কাগজের প্রস্থ">
                <Select
                  value={String(values.receipt?.width ?? '80mm')}
                  onChange={(e) => patch('receipt', { width: e.target.value })}
                >
                  <option value="58mm">৫৮ মিমি</option>
                  <option value="80mm">৮০ মিমি</option>
                </Select>
              </Field>
              <Field label="ফন্ট সাইজ">
                <Input
                  type="number"
                  value={String(values.receipt?.font ?? 12)}
                  onChange={(e) => patch('receipt', { font: Number(e.target.value) })}
                />
              </Field>
              <Field label="ফুটার">
                <Input
                  value={String(values.receipt?.footer ?? '')}
                  onChange={(e) => patch('receipt', { footer: e.target.value })}
                />
              </Field>
              <Field label="অ্যালাইনমেন্ট">
                <Select
                  value={String(values.receipt?.alignment ?? 'left')}
                  onChange={(e) => patch('receipt', { alignment: e.target.value })}
                >
                  <option value="left">বাম</option>
                  <option value="center">মাঝে</option>
                </Select>
              </Field>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              শুধুমাত্র তাপীয় রিসিট; A4/A5 ইনভয়েস প্রিন্টিং নেই।
            </p>
          </Card>
          <Card
            title="প্রিন্টার"
            hint={
              printers?.canPrint ? 'সিস্টেম প্রিন্টার উপলব্ধ' : 'প্রিন্টার পাওয়া যায়নি (হার্ডওয়্যার নির্ভর)'
            }
          >
            <div className="list">
              {(printers?.printers ?? []).map((p: string) => (
                <div className="list-item" key={p}>
                  <Printer size={16} />
                  <div className="grow">
                    <div className="title">{p}</div>
                  </div>
                </div>
              ))}
              {!(printers?.printers ?? []).length ? (
                <div className="small muted">কোনো প্রিন্টার শনাক্ত হয়নি। ইনভয়েস সংরক্ষিত থাকবে।</div>
              ) : null}
            </div>
            <div className="card-title" style={{ marginTop: 14 }}>
              সংরক্ষিত প্রোফাইল
            </div>
            <DataTable
              columns={[
                { key: 'name', label: 'নাম' },
                { key: 'width', label: 'প্রস্থ' },
                { key: 'device_name', label: 'ডিভাইস' },
              ]}
              rows={(profiles ?? []) as any[]}
            />
            <Button
              style={{ marginTop: 12 }}
              onClick={() =>
                void run(
                  'printing.saveProfile',
                  {
                    name: 'ডিফল্ট তাপীয়',
                    width: String(values.receipt?.width ?? '80mm'),
                    deviceName: (printers?.printers ?? [])[0] ?? '',
                  },
                  'প্রিন্টার প্রোফাইল সংরক্ষিত হয়েছে।',
                ).catch(() => {})
              }
            >
              প্রোফাইল সংরক্ষণ
            </Button>
          </Card>
        </div>
      ) : null}
      {tab === 4 ? (
        <Card title="কীবোর্ড শর্টকাট" hint="সংঘর্ষ এড়াতে পরিবর্তন স্বয়ংক্রিয়ভাবে যাচাই হয়">
          <DataTable
            columns={[
              { key: 'label', label: 'কাজ' },
              { key: 'action_key', label: 'অ্যাকশন' },
              {
                key: 'shortcut',
                label: 'শর্টকাট',
                render: (r) => (
                  <Input
                    defaultValue={String(r.shortcut)}
                    onBlur={(e) => {
                      if (e.target.value !== r.shortcut)
                        void run(
                          'shortcuts.update',
                          { actionKey: r.action_key, shortcut: e.target.value },
                          'শর্টকাট আপডেট হয়েছে।',
                        )
                          .then(reloadShortcuts)
                          .catch(() => {});
                    }}
                    style={{ width: 150 }}
                  />
                ),
              },
            ]}
            rows={(shortcuts ?? []) as any[]}
          />
          <p className="small muted" style={{ marginTop: 12 }}>
            POS-এ F2 খোঁজা, F4 সেল, F6 হোল্ড, F8 ক্লিয়ার — এই শর্টকাটগুলোর সাথে সংঘর্ষ নেই।
          </p>
        </Card>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* About                                                               */
/* ------------------------------------------------------------------ */
export function About() {
  const { data } = useApiQuery<any>('about.get', {}, []);
  const { data: activation } = useApiQuery<any>('license.status', {}, []);
  return (
    <div>
      <Head title="MERQO সম্পর্কে" sub="পণ্য, সংস্করণ, লাইসেন্স ও লাইসেন্সকৃত ব্যবসার তথ্য" />
      <Card>
        <div className="about-hero">
          <img src={logo} alt="MERQO পণ্য লোগো" />
          <div>
            <h2 style={{ fontSize: 26, letterSpacing: '.08em' }}>MERQO</h2>
            <div className="muted">সম্পূর্ণ অফলাইন ব্যবসা ব্যবস্থাপনা ও সুপার শপ POS</div>
            <div className="row" style={{ marginTop: 10 }}>
              <Badge tone="info">সংস্করণ {String(data?.version ?? '0.1.0')}</Badge>
              <Badge tone="success">{String(data?.licenseType ?? 'আজীবন লাইসেন্স')}</Badge>
              <Badge tone={activation?.active ? 'success' : 'warning'}>
                {activation?.active ? 'সক্রিয়' : 'অ্যাক্টিভেশন প্রয়োজন'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
      <Card title="বিস্তারিত তথ্য" className="section" style={{ marginTop: 16 }}>
        <div className="kv">
          <span className="k">পণ্য / কোম্পানি</span>
          <span>MERQO</span>
          <span className="k">প্রতিষ্ঠাতা</span>
          <span>{String(data?.founder ?? 'Shohan Khan')}</span>
          <span className="k">যোগাযোগ</span>
          <span>{String(data?.contactEmail ?? 'merqoonline@gmail.com')}</span>
          <span className="k">সংস্করণ / বিল্ড</span>
          <span>
            {String(data?.version ?? '0.1.0')} / {String(data?.buildNumber ?? 'dev-local')}
          </span>
          <span className="k">লাইসেন্সের ধরন</span>
          <span>{String(data?.licenseType ?? 'আজীবন লাইসেন্স')} · কোনো মেয়াদ বা নবায়ন নেই</span>
          <span className="k">লাইসেন্সকৃত ব্যবসা</span>
          <span>
            {String(data?.business?.business_name ?? activation?.businessName ?? 'সেটআপ সম্পন্ন হয়নি')}
          </span>
          <span className="k">অ্যাক্টিভেশন অবস্থা</span>
          <span>{activation?.active ? 'সক্রিয় ও যাচাইকৃত' : 'অ্যাক্টিভেশন প্রয়োজন'}</span>
          <span className="k">প্ল্যাটফর্ম</span>
          <span>{String(data?.platform ?? 'win32')} · স্থানীয় SQLite · কোনো ক্লাউড সংযোগ নেই</span>
          <span className="k">ফন্ট</span>
          <span>Noto Sans Bengali (SIL Open Font License 1.1)</span>
          <span className="k">পণ্য তথ্য</span>
          <span>
            বাংলা ও English ইনপুট, ইন্টিজার পয়সা, WAL ডাটাবেজ, Ed25519 লাইসেন্স, ২৮ রিপোর্ট, তাপীয় রিসিট।
          </span>
        </div>
      </Card>
      <Card title="গোপনীয়তা ও অফলাইন নিশ্চয়তা" className="section" style={{ marginTop: 16 }}>
        <p className="small" style={{ lineHeight: 1.9 }}>
          সমস্ত ব্যবসায়িক তথ্য এই কম্পিউটারের ব্যবহারকারী-ডাটা ফোল্ডারে সংরক্ষিত হয়। MERQO কোনো ক্লাউড
          ডাটাবেজ, অনলাইন অ্যাক্টিভেশন সার্ভার, টেলিমেট্রি, ট্র্যাকিং বা গোপন নেটওয়ার্ক যোগাযোগ ব্যবহার করে
          না। ইনস্টল ও একবার অ্যাক্টিভেশনের পর অ্যাপটি সম্পূর্ণ ইন্টারনেট-মুক্তভাবে চলে।
        </p>
      </Card>
    </div>
  );
}
