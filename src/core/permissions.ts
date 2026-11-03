import type { DB } from './db';

export interface PermissionDef {
  id: string;
  name: string;
  nameEn: string;
  module: string;
}
export const PERMISSIONS: PermissionDef[] = [
  { id: 'dashboard.view', name: 'ড্যাশবোর্ড দেখা', nameEn: 'View dashboard', module: 'dashboard' },
  { id: 'product.view', name: 'প্রোডাক্ট দেখা', nameEn: 'View products', module: 'products' },
  { id: 'product.manage', name: 'প্রোডাক্ট পরিচালনা', nameEn: 'Manage products', module: 'products' },
  { id: 'product.import', name: 'প্রোডাক্ট ইমপোর্ট', nameEn: 'Import products', module: 'products' },
  { id: 'inventory.view', name: 'স্টক দেখা', nameEn: 'View inventory', module: 'inventory' },
  { id: 'inventory.adjust', name: 'স্টক অ্যাডজাস্ট', nameEn: 'Adjust stock', module: 'inventory' },
  { id: 'sale.create', name: 'সেল করা', nameEn: 'Create sale', module: 'sales' },
  { id: 'sale.view', name: 'সেল দেখা', nameEn: 'View sales', module: 'sales' },
  { id: 'sale.discount', name: 'দাম/ডিসকাউন্ট পরিবর্তন', nameEn: 'Override price/discount', module: 'sales' },
  { id: 'sale.cancel', name: 'সেল বাতিল', nameEn: 'Cancel sale', module: 'sales' },
  { id: 'sale.return', name: 'সেল রিটার্ন', nameEn: 'Process sales return', module: 'sales' },
  { id: 'sale.refund', name: 'রিফান্ড', nameEn: 'Refund', module: 'sales' },
  { id: 'purchase.view', name: 'ক্রয় দেখা', nameEn: 'View purchases', module: 'purchases' },
  { id: 'purchase.manage', name: 'ক্রয় পরিচালনা', nameEn: 'Manage purchases', module: 'purchases' },
  { id: 'party.view', name: 'কাস্টমার/সাপ্লায়ার দেখা', nameEn: 'View parties', module: 'parties' },
  { id: 'party.manage', name: 'কাস্টমার/সাপ্লায়ার পরিচালনা', nameEn: 'Manage parties', module: 'parties' },
  { id: 'payment.manage', name: 'পেমেন্ট/বাকি আদায়', nameEn: 'Manage payments', module: 'finance' },
  { id: 'expense.view', name: 'খরচ দেখা', nameEn: 'View expenses', module: 'expenses' },
  { id: 'expense.manage', name: 'খরচ পরিচালনা', nameEn: 'Manage expenses', module: 'expenses' },
  { id: 'finance.view', name: 'ক্যাশ/অ্যাকাউন্ট দেখা', nameEn: 'View finance', module: 'finance' },
  { id: 'finance.adjust', name: 'আর্থিক অ্যাডজাস্টমেন্ট', nameEn: 'Financial adjustment', module: 'finance' },
  { id: 'report.view', name: 'রিপোর্ট দেখা', nameEn: 'View reports', module: 'reports' },
  { id: 'report.export', name: 'রিপোর্ট এক্সপোর্ট', nameEn: 'Export reports', module: 'reports' },
  { id: 'backup.manage', name: 'ব্যাকআপ/রিস্টোর', nameEn: 'Backup and restore', module: 'backup' },
  { id: 'user.view', name: 'ইউজার দেখা', nameEn: 'View users', module: 'users' },
  {
    id: 'user.manage',
    name: 'ইউজার/অনুমতি পরিচালনা',
    nameEn: 'Manage users and permissions',
    module: 'users',
  },
  { id: 'settings.view', name: 'সেটিংস দেখা', nameEn: 'View settings', module: 'settings' },
  { id: 'settings.manage', name: 'সেটিংস পরিচালনা', nameEn: 'Manage settings', module: 'settings' },
  { id: 'license.manage', name: 'লাইসেন্স অ্যাক্টিভেশন', nameEn: 'Manage activation', module: 'licensing' },
  { id: 'audit.view', name: 'অডিট লগ দেখা', nameEn: 'View audit log', module: 'reports' },
];
export const ALL_PERMISSION_IDS = PERMISSIONS.map((p) => p.id);

export const SYSTEM_ROLES = [
  { id: 'role-admin', name: 'অ্যাডমিন', nameEn: 'Administrator', permissions: ALL_PERMISSION_IDS },
  {
    id: 'role-manager',
    name: 'ম্যানেজার',
    nameEn: 'Manager',
    permissions: ALL_PERMISSION_IDS.filter((p) => !p.startsWith('user.') && p !== 'license.manage'),
  },
  {
    id: 'role-cashier',
    name: 'ক্যাশিয়ার',
    nameEn: 'Cashier',
    permissions: [
      'dashboard.view',
      'product.view',
      'inventory.view',
      'sale.create',
      'sale.view',
      'party.view',
      'payment.manage',
    ],
  },
  {
    id: 'role-staff',
    name: 'স্টাফ',
    nameEn: 'Staff',
    permissions: [
      'dashboard.view',
      'product.view',
      'inventory.view',
      'sale.view',
      'party.view',
      'expense.view',
    ],
  },
];

export function seedPermissions(db: DB): void {
  const insertPerm = db.prepare(
    'INSERT OR IGNORE INTO permissions(id, name, name_en, module) VALUES (?, ?, ?, ?)',
  );
  const insertRole = db.prepare(
    'INSERT OR IGNORE INTO roles(id, name, name_en, description, is_system, created_at) VALUES (?, ?, ?, ?, 1, ?)',
  );
  const insertRP = db.prepare('INSERT OR IGNORE INTO role_permissions(role_id, permission_id) VALUES (?, ?)');
  const now = new Date().toISOString();
  for (const p of PERMISSIONS) insertPerm.run(p.id, p.name, p.nameEn, p.module);
  for (const r of SYSTEM_ROLES) {
    insertRole.run(r.id, r.name, r.nameEn, '', now);
    for (const p of r.permissions) insertRP.run(r.id, p);
  }
}
export function permissionsForUser(db: DB, userId: string): string[] {
  const rows = db
    .prepare(
      `SELECT rp.permission_id FROM role_permissions rp
    JOIN users u ON u.role_id = rp.role_id WHERE u.id = ? AND u.status = 'active' AND u.archived_at IS NULL`,
    )
    .all(userId) as { permission_id: string }[];
  return rows.map((r) => r.permission_id);
}
export function hasPermission(permissions: string[], required: string | null): boolean {
  return required === null || permissions.includes(required);
}
