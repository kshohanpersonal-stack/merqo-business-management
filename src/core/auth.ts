import { scryptSync, randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import type { DB } from './db';
import { AppError, ERR } from './errors';
import { normalizeText } from './money';
import { permissionsForUser } from './permissions';

const SCRYPT = { N: 131072, r: 8, p: 1, keylen: 64, maxmem: 256 * 1024 * 1024 };
export const SCRYPT_PARAMS = JSON.stringify({ algorithm: 'scrypt', ...SCRYPT });

export function hashPassword(password: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex ?? randomBytes(16).toString('hex');
  const hash = scryptSync(password, Buffer.from(salt, 'hex'), SCRYPT.keylen, SCRYPT).toString('hex');
  return { hash, salt };
}
export function verifyPassword(password: string, hashHex: string, saltHex: string): boolean {
  try {
    const candidate = scryptSync(password, Buffer.from(saltHex, 'hex'), SCRYPT.keylen, SCRYPT);
    const expected = Buffer.from(hashHex, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}
export function validatePasswordStrength(password: string): void {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new AppError(ERR.VALIDATION, 'পাসওয়ার্ড ৮ থেকে ১২৮ অক্ষরের হতে হবে।');
  }
}
export interface UserRow {
  id: string;
  username: string;
  full_name: string;
  role_id: string;
  status: string;
  password_hash: string;
  password_salt: string;
  failed_attempts: number;
  locked_until: string | null;
  archived_at: string | null;
}
export function createUser(
  db: DB,
  input: {
    username: string;
    fullName: string;
    password: string;
    roleId: string;
    phone?: string;
  },
): { id: string; username: string } {
  const username = normalizeText(input.username, 64).toLowerCase();
  const fullName = normalizeText(input.fullName, 120);
  if (!/^[a-z0-9._-]{3,64}$/.test(username))
    throw new AppError(ERR.VALIDATION, 'ইউজারনেম শুধু ইংরেজি অক্ষর, সংখ্যা, ডট বা আন্ডারস্কোর হতে পারে।');
  if (!fullName) throw new AppError(ERR.VALIDATION, 'পুরো নাম দিন।');
  validatePasswordStrength(input.password);
  const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(input.roleId);
  if (!role) throw new AppError(ERR.VALIDATION, 'ভূমিকা পাওয়া যায়নি।');
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    throw new AppError(ERR.CONFLICT, 'এই ইউজারনেম আগে থেকেই আছে।');
  }
  const { hash, salt } = hashPassword(input.password);
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users(id, username, full_name, full_name_en, password_hash, password_salt,
    scrypt_params, role_id, status, phone, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'active',?,?,?)`,
  ).run(
    id,
    username,
    fullName,
    normalizeText(input.fullName, 120),
    hash,
    salt,
    SCRYPT_PARAMS,
    input.roleId,
    normalizeText(input.phone ?? '', 30),
    now,
    now,
  );
  return { id, username };
}
export function authenticate(db: DB, username: string, password: string): UserRow {
  const uname = normalizeText(username, 64).toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND archived_at IS NULL').get(uname) as
    | UserRow
    | undefined;
  // Always perform a hash so timing does not reveal whether the user exists.
  const dummy = hashPassword('timing-guard', '00'.repeat(16));
  if (!user) {
    verifyPassword(password, dummy.hash, dummy.salt);
    throw new AppError(ERR.UNAUTHENTICATED, 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।');
  }
  if (user.status !== 'active') throw new AppError(ERR.FORBIDDEN, 'এই অ্যাকাউন্টটি নিষ্ক্রিয় বা লক করা আছে।');
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AppError(ERR.FORBIDDEN, 'অনেকবার ভুল হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।');
  }
  if (!verifyPassword(password, user.password_hash, user.password_salt)) {
    const attempts = user.failed_attempts + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?').run(
      attempts,
      lockedUntil,
      new Date().toISOString(),
      user.id,
    );
    throw new AppError(
      ERR.UNAUTHENTICATED,
      `ইউজারনেম বা পাসওয়ার্ড সঠিক নয়। বাকি প্রচেষ্টা: ${Math.max(0, 5 - attempts)}`,
    );
  }
  db.prepare(
    'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?',
  ).run(new Date().toISOString(), new Date().toISOString(), user.id);
  return user;
}
export function changePassword(db: DB, userId: string, oldPassword: string, newPassword: string): void {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!user || !verifyPassword(oldPassword, user.password_hash, user.password_salt)) {
    throw new AppError(ERR.UNAUTHENTICATED, 'পুরনো পাসওয়ার্ড সঠিক নয়।');
  }
  validatePasswordStrength(newPassword);
  const { hash, salt } = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?').run(
    hash,
    salt,
    new Date().toISOString(),
    userId,
  );
}
export function actorFromUser(db: DB, user: UserRow, token: string) {
  return {
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    roleId: user.role_id,
    permissions: permissionsForUser(db, user.id),
    sessionToken: token,
  };
}
