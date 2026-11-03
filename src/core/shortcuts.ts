import type { DB } from './db';
import { AppError, ERR } from './errors';
import { normalizeText } from './money';

export function listShortcuts(db: DB): Record<string, unknown>[] {
  return db.prepare('SELECT action_key, shortcut, label FROM shortcuts ORDER BY action_key').all() as Record<
    string,
    unknown
  >[];
}
export function updateShortcut(db: DB, actionKey: string, shortcut: string): void {
  const s = normalizeText(shortcut, 30);
  if (!s) throw new AppError(ERR.VALIDATION, 'শর্টকাট দিন।');
  const conflict = db
    .prepare('SELECT action_key FROM shortcuts WHERE shortcut = ? AND action_key <> ?')
    .get(s, actionKey);
  if (conflict)
    throw new AppError(
      ERR.CONFLICT,
      `এই শর্টকাটটি ${String((conflict as { action_key: string }).action_key)}-এ ব্যবহৃত হচ্ছে।`,
    );
  const r = db.prepare('UPDATE shortcuts SET shortcut = ? WHERE action_key = ?').run(s, actionKey);
  if (!r.changes) throw new AppError(ERR.NOT_FOUND, 'শর্টকাট পাওয়া যায়নি।');
}
export function shortcutMap(db: DB): Record<string, string> {
  return Object.fromEntries(listShortcuts(db).map((r) => [String(r.action_key), String(r.shortcut)]));
}
