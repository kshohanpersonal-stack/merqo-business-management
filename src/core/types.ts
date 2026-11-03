export type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: SafeError };
export interface SafeError {
  code: string;
  message: string;
  details?: Record<string, string>;
}
export interface Actor {
  userId: string;
  username: string;
  fullName: string;
  roleId: string;
  permissions: string[];
  sessionToken: string;
}
export interface BusinessProfile {
  business_name: string;
  business_name_en: string;
  address: string;
  phone: string;
  email: string;
  logo_path: string;
  invoice_footer: string;
  tax_registration: string;
}
export interface AppConfig {
  productId: string;
  productName: string;
  company: string;
  founder: string;
  contactEmail: string;
  version: string;
  dataDir: string;
  dbPath: string;
  backupDir: string;
  logDir: string;
  isDevelopment: boolean;
  publicKeyPem: string;
  deviceFingerprint: string;
}
export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface DateRange {
  from?: string;
  to?: string;
}
export interface FilterPayload extends DateRange {
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}
