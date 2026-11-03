import { randomBytes, createHash } from 'node:crypto';
import type { DB } from './db';
import type { Actor } from './types';
import { AppError, ERR } from './errors';
import { actorFromUser, type UserRow } from './auth';

const SESSION_HOURS = 12;
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function createSession(db: DB, user: UserRow): { token: string; actor: Actor } {
  const token = randomBytes(32).toString('hex');
  const now = new Date();
  db.prepare('INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    hash(token),
    user.id,
    now.toISOString(),
    new Date(now.getTime() + SESSION_HOURS * 3600_000).toISOString(),
  );
  return { token, actor: actorFromUser(db, user, token) };
}
export function resolveSession(db: DB, token: string | undefined): Actor {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) throw new AppError(ERR.UNAUTHENTICATED, 'লগইন প্রয়োজন।');
  const row = db
    .prepare(
      `SELECT s.token_hash, s.expires_at, s.revoked_at, u.*
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(hash(token)) as (UserRow & { expires_at: string; revoked_at: string | null }) | undefined;
  if (
    !row ||
    row.revoked_at ||
    new Date(row.expires_at) < new Date() ||
    row.status !== 'active' ||
    row.archived_at
  ) {
    throw new AppError(ERR.UNAUTHENTICATED, 'সেশন মেয়াদোত্তীর্ণ হয়েছে। আবার লগইন করুন।');
  }
  return actorFromUser(db, row, token);
}
export function revokeSession(db: DB, token: string): void {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?').run(
    new Date().toISOString(),
    hash(token),
  );
}
