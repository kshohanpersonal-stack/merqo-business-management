/** Unified platform bridge: Electron IPC in production, relative /api in the preview. */
export interface SafeError {
  code: string;
  message: string;
}
export interface Result<T = any> {
  ok: boolean;
  data?: T;
  error?: SafeError;
}
export interface MerqoBridge {
  call(action: string, payload?: unknown, token?: string): Promise<Result>;
  saveBytes(base64: string, suggestedName: string): Promise<{ ok: boolean; path?: string }>;
  openTextFile(
    title: string,
    filters?: { name: string; extensions: string[] }[],
  ): Promise<{ ok: boolean; text?: string; path?: string }>;
  selectFile(
    title: string,
    filters?: { name: string; extensions: string[] }[],
  ): Promise<{ ok: boolean; path?: string }>;
  selectDirectory(): Promise<{ ok: boolean; path?: string }>;
  platform(): Promise<{ platform: string; version: string; packaged: boolean }>;
}
declare global {
  interface Window {
    merqo?: MerqoBridge;
  }
}

const electron = typeof window !== 'undefined' ? window.merqo : undefined;
export const isElectron = Boolean(electron);

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
const browserBridge: MerqoBridge = {
  async call(action, payload = {}, token = '') {
    const res = await fetch('/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, payload, token }),
    });
    return (await res.json()) as Result;
  },
  async saveBytes(base64, suggestedName) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { ok: true };
  },
  async openTextFile(title, _filters) {
    void title;
    const file = await pickFile('.merqolic,.json,.txt');
    if (!file) return { ok: false };
    return { ok: true, text: await file.text(), path: file.name };
  },
  async selectFile() {
    const file = await pickFile('.merqobak');
    if (!file) return { ok: false };
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    const res = await fetch('/api/upload-backup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ base64: btoa(binary), fileName: file.name }),
    });
    const out = (await res.json()) as { ok: boolean; path?: string };
    return { ok: out.ok, path: out.path };
  },
  async selectDirectory() {
    return { ok: false };
  },
  async platform() {
    return { platform: 'preview', version: '0.1.0', packaged: false };
  },
};
export const api: MerqoBridge = electron ?? browserBridge;

export async function devLicense(): Promise<string | null> {
  if (isElectron) return null;
  const res = await fetch('/api/dev-license');
  if (!res.ok) return null;
  const out = (await res.json()) as { ok: boolean; text?: string };
  return out.text ?? null;
}
export function getToken(): string {
  return localStorage.getItem('merqo-token') ?? '';
}
export function setToken(token: string): void {
  localStorage.setItem('merqo-token', token);
}
export function clearToken(): void {
  localStorage.removeItem('merqo-token');
}
export async function call<T = any>(action: string, payload: unknown = {}): Promise<T> {
  const res = await api.call(action, payload, getToken());
  if (!res.ok) throw new Error(res.error?.message ?? 'কাজটি সম্পন্ন করা যায়নি।');
  return res.data as T;
}
export async function exportFile(
  key: string,
  format: 'csv' | 'xlsx' | 'pdf',
  filter: unknown,
): Promise<void> {
  const out = await call<{ bytes: string; filename: string }>('report.export', { key, format, filter });
  await api.saveBytes(out.bytes, out.filename);
}
