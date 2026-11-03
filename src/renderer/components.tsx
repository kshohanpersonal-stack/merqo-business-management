import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { X, Inbox, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatMoney, formatQuantity } from '@core/money';
import { call } from './api';

/* ---------------- toasts ---------------- */
type ToastKind = 'info' | 'success' | 'warning' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}
const ToastCtx = createContext<(message: string, kind?: ToastKind) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------- primitives ---------------- */
export function Button({
  children,
  variant = 'default',
  size,
  icon: Icon,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm';
  icon?: React.ComponentType<{ size?: number }>;
}) {
  return (
    <button
      {...rest}
      className={`btn ${variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : variant === 'ghost' ? 'btn-ghost' : ''} ${size === 'sm' ? 'btn-sm' : ''} ${rest.className ?? ''}`}
    >
      {Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
}
export function IconButton({
  children,
  title,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button {...rest} title={title} aria-label={title} className={`icon-btn ${rest.className ?? ''}`}>
      {children}
    </button>
  );
}
export function Card({
  title,
  hint,
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { title?: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className={`card card-pad ${className}`} {...rest}>
      {title ? (
        <div className="card-title">
          {title}
          {hint ? <span className="hint">{hint}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
export function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function EmptyState({ text = 'এখনো কোনো তথ্য নেই।' }: { text?: string }) {
  return (
    <div className="empty">
      <Inbox size={34} />
      <div style={{ marginTop: 8 }}>{text}</div>
    </div>
  );
}
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? 28 : 15 }} />
      ))}
    </div>
  );
}
export const money = (minor: unknown) => formatMoney(Number(minor ?? 0));
export const qty = (minor: unknown) => formatQuantity(Number(minor ?? 0));
export const dateBn = (value: unknown) => {
  const s = String(value ?? '');
  if (!s) return '—';
  return s.slice(0, 10) + (s.length > 10 ? ' ' + s.slice(11, 16) : '');
};

/* ---------------- forms ---------------- */
export function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return <input {...props} ref={ref} className={`input ${props.className ?? ''}`} />;
  },
);
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(props, ref) {
    return <select {...props} ref={ref} className={`select ${props.className ?? ''}`} />;
  },
);
export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea(props, ref) {
  return <textarea {...props} ref={ref} className={`textarea ${props.className ?? ''}`} />;
});

/* ---------------- modal ---------------- */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <span className="spacer" style={{ flex: 1 }} />
          <IconButton title="বন্ধ করুন" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'নিশ্চিত করুন',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>বাতিল</Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, lineHeight: 1.8 }}>{message}</p>
    </Modal>
  );
}

/* ---------------- table ---------------- */
export interface Column {
  key: string;
  label: string;
  align?: 'right' | 'center';
  render?: (row: any) => React.ReactNode;
  width?: number;
}
export function DataTable({
  columns,
  rows,
  total = 0,
  page = 1,
  pageSize = 25,
  onPage,
  sortBy,
  sortDir,
  onSort,
  loading,
  emptyText,
}: {
  columns: Column[];
  rows: any[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPage?: (p: number) => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  loading?: boolean;
  emptyText?: string;
}) {
  if (loading) return <Loading rows={6} />;
  if (!rows.length) return <EmptyState text={emptyText} />;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.align === 'right' ? 'num' : c.align === 'center' ? 'center' : ''}
                style={{ width: c.width, cursor: onSort && !c.render ? 'pointer' : undefined }}
                onClick={() => {
                  if (onSort && !c.render) onSort(c.key);
                }}
              >
                {c.label}
                {sortBy === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={c.align === 'right' ? 'num' : c.align === 'center' ? 'center' : ''}
                >
                  {c.render
                    ? c.render(row)
                    : row[c.key] === null || row[c.key] === undefined
                      ? '—'
                      : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {onPage ? (
        <div className="pagination">
          <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} icon={ChevronLeft}>
            আগে
          </Button>
          <span>
            পাতা {page} · মোট {total} টি
          </span>
          <Button size="sm" disabled={page * pageSize >= total} onClick={() => onPage(page + 1)}>
            পরে <ChevronRight size={14} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- data hook ---------------- */
export function useApiQuery<T = any>(action: string, payload: unknown = {}, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);
  const toast = useToast();
  const key = useMemo(() => JSON.stringify(payload), [payload]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    call<T>(action, JSON.parse(key))
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: Error) => {
        if (alive) {
          setError(e.message);
          toast(e.message, 'error');
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [action, key, nonce, ...deps]);
  return { data, loading, error, reload: () => setNonce((n) => n + 1), setData };
}
export function useAction() {
  const toast = useToast();
  return async (action: string, payload: unknown = {}, successMessage?: string): Promise<any> => {
    try {
      const out = await call(action, payload);
      if (successMessage) toast(successMessage, 'success');
      return out;
    } catch (e) {
      toast((e as Error).message, 'error');
      throw e;
    }
  };
}
export function Spinner() {
  return <Loader2 size={16} className="spin" />;
}
