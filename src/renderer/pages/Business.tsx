import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Archive,
  Search,
  Barcode,
  Copy,
  AlertTriangle,
  PackagePlus,
  FileUp,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { call, exportFile } from '../api';
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
  qty,
  dateBn,
  type Column,
} from '../components';

/* ------------------------------------------------------------------ */
/* Generic CRUD page used by catalogue, parties, expenses and accounts.  */
/* ------------------------------------------------------------------ */
interface OptionSource {
  action: string;
  labelKey?: string;
  valueKey?: string;
}
interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  source?: OptionSource;
  required?: boolean;
  full?: boolean;
  default?: string;
  hideOnEdit?: boolean;
  step?: string;
}
interface FilterDef {
  name: string;
  label: string;
  options?: { value: string; label: string }[];
  source?: OptionSource;
}
interface CrudConfig {
  title: string;
  subtitle: string;
  listAction: string;
  createAction: string;
  updateAction?: string;
  archiveAction?: string;
  columns: Column[];
  fields: FieldDef[];
  filters?: FilterDef[];
  transform?: (row: any) => Record<string, string>;
  toPayload?: (form: Record<string, string>, editing: any) => Record<string, unknown>;
  extra?: (row: any, reload: () => void) => React.ReactNode;
  headerExtra?: (reload: () => void) => React.ReactNode;
  pageSize?: number;
}
export function CrudPage(config: CrudConfig) {
  const toast = useToast();
  const run = useAction();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [archiveRow, setArchiveRow] = useState<any>(null);
  const [options, setOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const [busy, setBusy] = useState(false);

  const sources = useMemo(() => {
    const out: Record<string, OptionSource> = {};
    for (const f of config.fields) if (f.source) out[f.source.action] = f.source;
    for (const f of config.filters ?? []) if (f.source) out[f.source.action] = f.source;
    return out;
  }, [config]);
  useEffect(() => {
    for (const [action, src] of Object.entries(sources)) {
      void call<any>(action, {})
        .then((d) => {
          const rows: any[] = Array.isArray(d) ? d : (d.rows ?? []);
          setOptions((o) => ({
            ...o,
            [action]: rows.map((r) => ({
              value: String(r[src.valueKey ?? 'id']),
              label: String(r[src.labelKey ?? 'name']),
            })),
          }));
        })
        .catch(() => {});
    }
  }, [sources]);
  const query = useMemo(
    () => ({ page, pageSize: config.pageSize ?? 25, search, sortBy, sortDir, ...filters }),
    [page, search, sortBy, sortDir, filters, config.pageSize],
  );
  const { data, loading, reload } = useApiQuery(config.listAction, query);
  const rows: any[] = Array.isArray(data) ? data : (data?.rows ?? []);
  const total = Array.isArray(data) ? data.length : (data?.total ?? 0);

  const blank = () => Object.fromEntries(config.fields.map((f) => [f.name, f.default ?? '']));
  const openCreate = () => {
    setEditing(null);
    setForm(blank());
    setOpen(true);
  };
  const openEdit = (row: any) => {
    setEditing(row);
    const base = config.transform
      ? config.transform(row)
      : Object.fromEntries(
          config.fields.map((f) => [
            f.name,
            row[f.name] === null || row[f.name] === undefined ? '' : String(row[f.name]),
          ]),
        );
    setForm({ ...blank(), ...base });
    setOpen(true);
  };
  const save = async () => {
    for (const f of config.fields)
      if (f.required && !String(form[f.name] ?? '').trim()) {
        toast(`${f.label} দিন।`, 'warning');
        return;
      }
    setBusy(true);
    try {
      const payload = config.toPayload ? config.toPayload(form, editing) : { ...form };
      if (editing)
        await run(
          config.updateAction ?? config.createAction,
          { id: editing.id, ...payload },
          'আপডেট সফল হয়েছে।',
        );
      else await run(config.createAction, payload, 'সংরক্ষণ সফল হয়েছে।');
      setOpen(false);
      reload();
    } catch {
      /* toast handled */
    } finally {
      setBusy(false);
    }
  };
  const columns: Column[] = [
    ...config.columns,
    {
      key: '_actions',
      label: 'কাজ',
      align: 'right',
      render: (row: any) => (
        <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          {config.extra ? config.extra(row, reload) : null}
          {config.updateAction ? (
            <Button size="sm" icon={Pencil} onClick={() => openEdit(row)}>
              সম্পাদনা
            </Button>
          ) : null}
          {config.archiveAction ? (
            <Button size="sm" icon={Archive} onClick={() => setArchiveRow(row)}>
              আর্কাইভ
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{config.title}</h1>
          <div className="sub">{config.subtitle}</div>
        </div>
        <div className="page-actions">
          {config.headerExtra ? config.headerExtra(reload) : null}
          {config.createAction ? (
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              নতুন যোগ করুন
            </Button>
          ) : null}
        </div>
      </div>
      <div className="toolbar card card-pad" style={{ padding: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="খুঁজুন…"
            style={{ paddingLeft: 32, width: 230 }}
          />
        </div>
        {(config.filters ?? []).map((f) => (
          <Select
            key={f.name}
            value={filters[f.name] ?? ''}
            onChange={(e) => {
              setFilters((p) => ({ ...p, [f.name]: e.target.value }));
              setPage(1);
            }}
          >
            <option value="">{f.label}: সব</option>
            {(f.options ?? options[f.source?.action ?? ''] ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        <span style={{ flex: 1 }} />
        <Button icon={RefreshCw} onClick={reload}>
          রিফ্রেশ
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={config.pageSize ?? 25}
        onPage={setPage}
        loading={loading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={(key) => {
          setSortDir((d) => (sortBy === key && d === 'desc' ? 'asc' : 'desc'));
          setSortBy(key);
        }}
      />
      <Modal
        open={open}
        title={editing ? `${config.title} সম্পাদনা` : `${config.title} যোগ করুন`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>বাতিল</Button>
            <Button variant="primary" disabled={busy} onClick={save}>
              {busy ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          {config.fields
            .filter((f) => !(editing && f.hideOnEdit))
            .map((f) => (
              <Field key={f.name} label={f.label + (f.required ? ' *' : '')} full={f.full}>
                {f.type === 'select' ? (
                  <Select
                    value={form[f.name] ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                  >
                    <option value="">বেছে নিন</option>
                    {(f.options ?? options[f.source?.action ?? ''] ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : f.type === 'textarea' ? (
                  <TextArea
                    value={form[f.name] ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                  />
                ) : (
                  <Input
                    type={f.type === 'checkbox' ? 'checkbox' : (f.type ?? 'text')}
                    step={f.step}
                    checked={f.type === 'checkbox' ? form[f.name] === 'true' : undefined}
                    value={f.type === 'checkbox' ? undefined : (form[f.name] ?? '')}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        [f.name]: f.type === 'checkbox' ? String(e.target.checked) : e.target.value,
                      }))
                    }
                  />
                )}
              </Field>
            ))}
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(archiveRow)}
        title="আর্কাইভ নিশ্চিত করুন"
        message="এই রেকর্ডটি আর্কাইভ করা হবে। আর্থিক ইতিহাস ও অডিট ট্রেইল সংরক্ষিত থাকবে।"
        confirmLabel="আর্কাইভ করুন"
        onClose={() => setArchiveRow(null)}
        onConfirm={() => {
          const row = archiveRow;
          void run(config.archiveAction!, { id: row.id }, 'আর্কাইভ করা হয়েছে।')
            .then(reload)
            .catch(() => {});
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */
export function Products() {
  const toast = useToast();
  const run = useAction();
  const [barcode, setBarcode] = useState<{ svg: string; qr: string; name: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [duplicates, setDuplicates] = useState<any[] | null>(null);
  const showBarcode = async (row: any) => {
    try {
      const [svg, qr] = await Promise.all([
        call<string>('product.barcodeSvg', { value: row.barcode }),
        call<string>('product.qrSvg', { value: row.qr_payload ?? row.barcode }),
      ]);
      setBarcode({ svg, qr, name: row.name });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0]!.split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(',').map((c) => c.trim());
      return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
    });
  };
  return (
    <>
      <CrudPage
        title="পণ্য / প্রোডাক্ট"
        subtitle="ক্যাটালগ, দাম, স্টক, বারকোড ও কিউআর — সব তথ্য স্থানীয় ডাটাবেজে"
        listAction="product.list"
        createAction="product.create"
        updateAction="product.update"
        archiveAction="product.archive"
        filters={[
          { name: 'categoryId', label: 'ক্যাটাগরি', source: { action: 'category.list' } },
          { name: 'brandId', label: 'ব্র্যান্ড', source: { action: 'brand.list' } },
          {
            name: 'stockStatus',
            label: 'স্টক',
            options: [
              { value: 'low', label: 'কম স্টক' },
              { value: 'out', label: 'স্টকআউট' },
              { value: 'in', label: 'স্টকে আছে' },
            ],
          },
        ]}
        fields={[
          { name: 'name', label: 'পণ্যের নাম (বাংলা/English)', required: true },
          { name: 'nameEn', label: 'নাম (English)' },
          { name: 'code', label: 'পণ্য কোড' },
          { name: 'sku', label: 'SKU' },
          { name: 'barcode', label: 'বারকোড' },
          { name: 'categoryId', label: 'ক্যাটাগরি', type: 'select', source: { action: 'category.list' } },
          { name: 'brandId', label: 'ব্র্যান্ড', type: 'select', source: { action: 'brand.list' } },
          { name: 'unitId', label: 'একক', type: 'select', source: { action: 'unit.list' } },
          { name: 'supplierId', label: 'সরবরাহকারী', type: 'select', source: { action: 'supplier.list' } },
          {
            name: 'discountType',
            label: 'পণ্যের ছাড়',
            type: 'select',
            options: [
              { value: 'none', label: 'নেই' },
              { value: 'percent', label: 'শতাংশ (%)' },
              { value: 'fixed', label: 'নির্দিষ্ট টাকা' },
            ],
            default: 'none',
          },
          { name: 'discountValue', label: 'ছাড়ের মান (% বা ৳)', type: 'number', step: '0.01', default: '0' },
          { name: 'purchasePrice', label: 'ক্রয়মূল্য (৳)', type: 'number', step: '0.01', default: '0' },
          {
            name: 'sellingPrice',
            label: 'বিক্রয়মূল্য (৳)',
            type: 'number',
            step: '0.01',
            default: '0',
            required: true,
          },
          { name: 'wholesalePrice', label: 'পাইকারি মূল্য (৳)', type: 'number', step: '0.01' },
          {
            name: 'openingStock',
            label: 'ওপেনিং স্টক',
            type: 'number',
            step: '0.001',
            default: '0',
            hideOnEdit: true,
          },
          { name: 'minStock', label: 'ন্যূনতম স্টক', type: 'number', step: '0.001', default: '0' },
          { name: 'expiryDate', label: 'মেয়াদ (ঐচ্ছিক)', type: 'date' },
          { name: 'batchNo', label: 'ব্যাচ নম্বর' },
          { name: 'description', label: 'বিবরণ', type: 'textarea', full: true },
        ]}
        columns={[
          { key: 'code', label: 'কোড' },
          { key: 'name', label: 'পণ্য' },
          { key: 'category_name', label: 'ক্যাটাগরি' },
          {
            key: 'selling_price_minor',
            label: 'বিক্রয়মূল্য',
            align: 'right',
            render: (r) => money(r.selling_price_minor),
          },
          {
            key: 'current_stock_minor',
            label: 'স্টক',
            align: 'right',
            render: (r) => qty(r.current_stock_minor),
          },
          {
            key: 'status',
            label: 'অবস্থা',
            render: (r) => (
              <Badge tone={r.status === 'active' ? 'success' : 'default'}>
                {r.status === 'active' ? 'সক্রিয়' : r.status}
              </Badge>
            ),
          },
        ]}
        transform={(r) => ({
          ...Object.fromEntries(
            [
              'name',
              'nameEn',
              'code',
              'sku',
              'barcode',
              'categoryId',
              'brandId',
              'unitId',
              'supplierId',
              'batchNo',
              'description',
            ].map((k) => [
              k,
              String(
                r[
                  k === 'categoryId'
                    ? 'category_id'
                    : k === 'brandId'
                      ? 'brand_id'
                      : k === 'unitId'
                        ? 'unit_id'
                        : k === 'supplierId'
                          ? 'supplier_id'
                          : k === 'nameEn'
                            ? 'name_en'
                            : k
                ] ?? '',
              ),
            ]),
          ),
          purchasePrice: String(Number(r.purchase_price_minor ?? 0) / 100),
          sellingPrice: String(Number(r.selling_price_minor ?? 0) / 100),
          wholesalePrice: String(Number(r.wholesale_price_minor ?? 0) / 100),
          minStock: String(Number(r.min_stock_minor ?? 0) / 1000),
          expiryDate: String(r.expiry_date ?? ''),
          discountType: String(r.discount_type ?? 'none'),
          discountValue: String(
            r.discount_type === 'percent'
              ? Number(r.discount_value ?? 0) / 100
              : Number(r.discount_value ?? 0) / 100,
          ),
        })}
        toPayload={(f) => ({
          name: f.name,
          nameEn: f.nameEn,
          code: f.code,
          sku: f.sku,
          barcode: f.barcode,
          categoryId: f.categoryId || null,
          brandId: f.brandId || null,
          unitId: f.unitId || 'u-piece',
          supplierId: f.supplierId || null,
          discountType: f.discountType || 'none',
          discountValue: f.discountValue || 0,
          purchasePrice: f.purchasePrice,
          sellingPrice: f.sellingPrice,
          wholesalePrice: f.wholesalePrice || undefined,
          description: f.description,
          minStock: f.minStock,
          openingStock: f.openingStock || 0,
          batchNo: f.batchNo || null,
          expiryDate: f.expiryDate || null,
        })}
        extra={(row, reload) => (
          <>
            <Button size="sm" icon={Barcode} onClick={() => void showBarcode(row)}>
              বারকোড
            </Button>
            <Button
              size="sm"
              icon={Copy}
              onClick={() =>
                void run('product.duplicate', { id: row.id }, 'পণ্যের কপি তৈরি হয়েছে।')
                  .then(reload)
                  .catch(() => {})
              }
            >
              কপি
            </Button>
          </>
        )}
        headerExtra={(_reload) => (
          <>
            <Button icon={FileUp} onClick={() => setImportOpen(true)}>
              CSV ইমপোর্ট
            </Button>
            <Button
              icon={AlertTriangle}
              onClick={() =>
                void call<any[]>('product.duplicates')
                  .then(setDuplicates)
                  .catch((e: Error) => toast(e.message, 'error'))
              }
            >
              সম্ভাব্য ডুপ্লিকেট
            </Button>
            <Button
              icon={Printer}
              onClick={() =>
                void exportFile('stock', 'csv', {}).catch((e: Error) => toast(e.message, 'error'))
              }
            >
              CSV রপ্তানি
            </Button>
          </>
        )}
      />
      <Modal
        open={Boolean(barcode)}
        title={`বারকোড ও কিউআর · ${barcode?.name ?? ''}`}
        onClose={() => setBarcode(null)}
      >
        {barcode ? (
          <div className="center">
            <div dangerouslySetInnerHTML={{ __html: barcode.svg }} />
            <div style={{ marginTop: 14 }} dangerouslySetInnerHTML={{ __html: barcode.qr }} />
            <p className="small muted">থার্মাল লেবেল/স্টিকারের জন্য SVG ব্যবহার করুন।</p>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={importOpen}
        title="CSV থেকে পণ্য ইমপোর্ট"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <Button onClick={() => setImportOpen(false)}>বাতিল</Button>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  const rows = parseCsv(csv);
                  if (!rows.length) {
                    toast('CSV-তে কোনো সারি নেই।', 'warning');
                    return;
                  }
                  const out = await run('product.import', { rows });
                  setImportOpen(false);
                  toast(
                    `ইমপোর্ট সম্পন্ন: ${String((out as any)?.created ?? 0)} টি পণ্য যোগ হয়েছে; ${String((out as any)?.errors?.length ?? 0)} টি বাদ পড়েছে।`,
                    'success',
                  );
                } catch {
                  /* handled */
                }
              }}
            >
              ইমপোর্ট করুন
            </Button>
          </>
        }
      >
        <p className="small muted">
          কলাম: name, nameEn, code, sku, barcode, categoryId, brandId, unitId, purchasePrice, sellingPrice,
          openingStock, minStock, description
        </p>
        <TextArea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          style={{ minHeight: 180, fontFamily: 'monospace', fontSize: 11 }}
          placeholder="name,sellingPrice,openingStock&#10;চাল,120,50"
        />
      </Modal>
      <Modal open={duplicates !== null} title="সম্ভাব্য ডুপ্লিকেট পণ্য" onClose={() => setDuplicates(null)}>
        {duplicates?.length ? (
          <DataTable
            columns={[
              { key: 'name', label: 'নাম' },
              { key: 'code', label: 'কোড' },
              { key: 'reason', label: 'কারণ' },
            ]}
            rows={duplicates}
          />
        ) : (
          <div className="empty">কোনো ডুপ্লিকেট পাওয়া যায়নি।</div>
        )}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Catalogue: categories, brands, units, conversions                    */
/* ------------------------------------------------------------------ */
export function Catalogue() {
  const [tab, setTab] = useState(0);
  const { data: conversions } = useApiQuery<any[]>('unit.conversions', {}, []);
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>ক্যাটালগ ব্যবস্থাপনা</h1>
          <div className="sub">ক্যাটাগরি, সাবক্যাটাগরি, ব্র্যান্ড, একক ও রূপান্তর</div>
        </div>
      </div>
      <div className="tabs">
        {['ক্যাটাগরি', 'ব্র্যান্ড', 'একক ও রূপান্তর'].map((t, i) => (
          <button key={t} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 0 ? (
        <CrudPage
          key="cat"
          title="ক্যাটাগরি"
          subtitle="ক্যাটাগরি ও সাবক্যাটাগরি (প্যারেন্ট নির্বাচন করুন)"
          listAction="category.list"
          createAction="category.create"
          updateAction="category.update"
          archiveAction="category.archive"
          fields={[
            { name: 'name', label: 'নাম', required: true },
            { name: 'nameEn', label: 'English নাম' },
            {
              name: 'parentId',
              label: 'প্যারেন্ট ক্যাটাগরি',
              type: 'select',
              source: { action: 'category.list' },
            },
            { name: 'description', label: 'বিবরণ', type: 'textarea', full: true },
          ]}
          columns={[
            { key: 'name', label: 'নাম' },
            { key: 'name_en', label: 'English' },
            { key: 'product_count', label: 'পণ্য সংখ্যা', align: 'right' },
          ]}
          transform={(r) => ({
            name: String(r.name),
            nameEn: String(r.name_en ?? ''),
            parentId: String(r.parent_id ?? ''),
            description: String(r.description ?? ''),
          })}
        />
      ) : null}
      {tab === 1 ? (
        <CrudPage
          key="brand"
          title="ব্র্যান্ড"
          subtitle="পণ্যের ব্র্যান্ড তালিকা"
          listAction="brand.list"
          createAction="brand.create"
          fields={[{ name: 'name', label: 'ব্র্যান্ডের নাম', required: true }]}
          columns={[
            { key: 'name', label: 'নাম' },
            { key: 'name_en', label: 'English' },
          ]}
        />
      ) : null}
      {tab === 2 ? (
        <CrudPage
          key="unit"
          title="একক"
          subtitle="পণ্যের একক ও ভিত্তি এককে রূপান্তর"
          listAction="unit.list"
          createAction="unit.create"
          fields={[
            { name: 'name', label: 'এককের নাম', required: true },
            { name: 'symbol', label: 'প্রতীক (যেমন পিস, কেজি)', required: true },
            { name: 'baseUnit', label: 'ভিত্তি একক', required: true, default: 'পিস' },
            { name: 'factor', label: 'রূপান্তর গুণক', type: 'number', step: '0.001', default: '1' },
            { name: 'decimals', label: 'দশমিক', type: 'number', default: '3' },
          ]}
          columns={[
            { key: 'name', label: 'নাম' },
            { key: 'symbol', label: 'প্রতীক' },
            { key: 'base_unit', label: 'ভিত্তি একক' },
            { key: 'factor', label: 'গুণক' },
          ]}
          transform={(r) => ({
            name: String(r.name),
            symbol: String(r.symbol),
            baseUnit: String(r.base_unit),
            factor: String(r.factor),
            decimals: String(r.decimals ?? 3),
          })}
        />
      ) : null}
      <Card
        title="একক রূপান্তর তালিকা"
        hint="সংরক্ষিত রূপান্তর"
        className="section"
        style={{ marginTop: 16 }}
      >
        <DataTable
          columns={[
            { key: 'from_unit_id', label: 'থেকে' },
            { key: 'to_unit_id', label: 'তে' },
            { key: 'factor', label: 'গুণক' },
          ]}
          rows={(conversions ?? []) as any[]}
          emptyText="কোনো রূপান্তর নেই।"
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */
export function Inventory() {
  const toast = useToast();
  const run = useAction();
  const { data: summary, reload: reloadSummary } = useApiQuery<any>('inventory.summary', {}, []);
  const { data: low } = useApiQuery<any[]>('inventory.lowStock', { limit: 50 }, []);
  const { data: movements, loading, reload } = useApiQuery<any>('inventory.movements', { pageSize: 30 }, []);
  const { data: products } = useApiQuery<any>('product.list', { pageSize: 200 }, []);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    direction: 'in',
    quantity: '1',
    reason: 'স্টক গণনা সংশোধন',
    note: '',
  });
  const [confirm, setConfirm] = useState(false);
  const submit = () => {
    if (!form.productId || !form.reason.trim()) {
      toast('পণ্য ও কারণ দিন।', 'warning');
      return;
    }
    setConfirm(true);
  };
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>ইনভেন্টরি / স্টক</h1>
          <div className="sub">ওয়েটেড-অ্যাভারেজ কস্ট, স্টক মুভমেন্ট ও সতর্কতা</div>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={PackagePlus} onClick={() => setAdjustOpen(true)}>
            স্টক অ্যাডজাস্ট
          </Button>
        </div>
      </div>
      <div className="kpi-grid section">
        {[
          ['মোট পণ্য', summary?.products ?? 0],
          ['স্টকে আছে', summary?.in_stock ?? 0],
          ['কম স্টক', summary?.low_stock ?? 0],
          ['স্টক মূল্য', money(summary?.stock_value_minor ?? 0)],
        ].map(([label, value]) => (
          <div className="card kpi" key={String(label)}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>
      <div className="two-col section">
        <Card title="সাম্প্রতিক স্টক মুভমেন্ট">
          <DataTable
            loading={loading}
            columns={[
              { key: 'created_at', label: 'সময়', render: (r) => dateBn(r.created_at) },
              { key: 'product_name', label: 'পণ্য' },
              {
                key: 'direction',
                label: 'ধরন',
                render: (r) => (
                  <Badge tone={r.direction === 'in' ? 'success' : 'warning'}>
                    {r.direction === 'in' ? 'প্রবেশ' : 'প্রস্থান'}
                  </Badge>
                ),
              },
              {
                key: 'quantity_minor',
                label: 'পরিমাণ',
                align: 'right',
                render: (r) => qty(r.quantity_minor),
              },
              { key: 'reason', label: 'কারণ' },
            ]}
            rows={(movements?.rows ?? []) as any[]}
          />
        </Card>
        <Card title="কম স্টকের পণ্য">
          <DataTable
            columns={[
              { key: 'name', label: 'পণ্য' },
              {
                key: 'current_stock_minor',
                label: 'বর্তমান',
                align: 'right',
                render: (r) => qty(r.current_stock_minor),
              },
              {
                key: 'min_stock_minor',
                label: 'সীমা',
                align: 'right',
                render: (r) => qty(r.min_stock_minor),
              },
            ]}
            rows={(low ?? []) as any[]}
            emptyText="কোনো কম স্টক নেই।"
          />
        </Card>
      </div>
      <Modal
        open={adjustOpen}
        title="স্টক অ্যাডজাস্টমেন্ট"
        onClose={() => setAdjustOpen(false)}
        footer={
          <>
            <Button onClick={() => setAdjustOpen(false)}>বাতিল</Button>
            <Button variant="primary" onClick={submit}>
              পর্যালোচনা
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="পণ্য *" full>
            <Select
              value={form.productId}
              onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}
            >
              <option value="">বেছে নিন</option>
              {(products?.rows ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} (স্টক {qty(p.current_stock_minor)})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ধরন">
            <Select
              value={form.direction}
              onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value }))}
            >
              <option value="in">স্টক প্রবেশ (+)</option>
              <option value="out">স্টক প্রস্থান (−)</option>
            </Select>
          </Field>
          <Field label="পরিমাণ *">
            <Input
              type="number"
              step="0.001"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
            />
          </Field>
          <Field label="কারণ *" full>
            <Input value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
          </Field>
          <Field label="নোট" full>
            <TextArea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
          </Field>
        </div>
        <p className="small muted">
          অ্যাডজাস্টমেন্ট অডিট লগে ও স্টক মুভমেন্টে স্থায়ীভাবে সংরক্ষিত হবে; আর্থিক ইতিহাস মুছবে না।
        </p>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="স্টক পরিবর্তন নিশ্চিত করুন"
        confirmLabel="হ্যাঁ, অ্যাডজাস্ট করুন"
        message={`${form.direction === 'in' ? 'প্রবেশ' : 'প্রস্থান'} ${form.quantity} পরিমাণ — এই সংবেদনশীল পরিবর্তনটি অডিটসহ সংরক্ষিত হবে।`}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          void run('inventory.adjust', form, 'স্টক আপডেট হয়েছে।')
            .then(() => {
              setAdjustOpen(false);
              reload();
              reloadSummary();
            })
            .catch(() => {});
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */
export function Expenses() {
  const toast = useToast();
  const run = useAction();
  const [voidRow, setVoidRow] = useState<any>(null);
  const [reason, setReason] = useState('');
  return (
    <>
      <CrudPage
        title="খরচ / এক্সপেন্স"
        subtitle="অপারেটিং খরচ, খরচের ক্যাটাগরি, ভ্যাট ও অ্যাকাউন্ট লেনদেন"
        listAction="expense.list"
        createAction="expense.create"
        filters={[{ name: 'categoryId', label: 'ক্যাটাগরি', source: { action: 'expense.categories' } }]}
        fields={[
          {
            name: 'expenseDate',
            label: 'তারিখ',
            type: 'date',
            default: new Date().toISOString().slice(0, 10),
          },
          {
            name: 'categoryId',
            label: 'ক্যাটাগরি *',
            type: 'select',
            source: { action: 'expense.categories' },
            required: true,
          },
          { name: 'amount', label: 'পরিমাণ (৳) *', type: 'number', step: '0.01', required: true },
          {
            name: 'accountId',
            label: 'অ্যাকাউন্ট *',
            type: 'select',
            source: { action: 'finance.accounts' },
            required: true,
          },
          {
            name: 'paymentMethodId',
            label: 'পেমেন্ট মাধ্যম',
            type: 'select',
            source: { action: 'finance.paymentMethods' },
            default: 'pm-cash',
          },
          { name: 'description', label: 'বিবরণ', type: 'textarea', full: true },
        ]}
        columns={[
          { key: 'expense_date', label: 'তারিখ', render: (r) => dateBn(r.expense_date) },
          { key: 'category_name', label: 'ক্যাটাগরি' },
          { key: 'description', label: 'বিবরণ' },
          { key: 'amount_minor', label: 'পরিমাণ', align: 'right', render: (r) => money(r.amount_minor) },
          {
            key: 'voided_at',
            label: 'অবস্থা',
            render: (r) =>
              r.voided_at ? <Badge tone="danger">বাতিল</Badge> : <Badge tone="success">সক্রিয়</Badge>,
          },
        ]}
        toPayload={(f) => ({
          expenseDate: f.expenseDate,
          categoryId: f.categoryId,
          amount: f.amount,
          accountId: f.accountId,
          paymentMethodId: f.paymentMethodId || 'pm-cash',
          description: f.description,
        })}
        extra={(row, _reload) =>
          !row.voided_at ? (
            <Button
              size="sm"
              onClick={() => {
                setVoidRow(row);
                setReason('');
              }}
            >
              বাতিল / রিভার্স
            </Button>
          ) : null
        }
        headerExtra={(reload) => (
          <Button
            icon={RefreshCw}
            onClick={() =>
              void call<any[]>('expense.categories')
                .then(() => reload())
                .catch((e: Error) => toast(e.message, 'error'))
            }
          >
            ক্যাটাগরি রিফ্রেশ
          </Button>
        )}
      />
      <Modal
        open={Boolean(voidRow)}
        title="খরচ বাতিল (রিভার্স)"
        onClose={() => setVoidRow(null)}
        footer={
          <>
            <Button onClick={() => setVoidRow(null)}>ফিরে যান</Button>
            <Button
              variant="danger"
              onClick={() => {
                const id = voidRow?.id;
                void run(
                  'expense.void',
                  { id, reason },
                  'খরচটি রিভার্স করা হয়েছে; অ্যাকাউন্ট লেনদেন সংশোধিত হয়েছে।',
                )
                  .then(() => setVoidRow(null))
                  .catch(() => {});
              }}
            >
              রিভার্স নিশ্চিত
            </Button>
          </>
        }
      >
        <p className="small muted">
          মূল রেকর্ড মুছে ফেলা হবে না; একটি রিভার্স লেনদেন ও অডিট এন্ট্রি তৈরি হবে।
        </p>
        <Field label="বাতিলের কারণ *">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
