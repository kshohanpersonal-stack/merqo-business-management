/** Verified, optionally encrypted local backups and safe restore. */
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  statSync,
  readdirSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import Database from 'better-sqlite3';
import type { AppContext } from './context';
import type { DB } from './db';
import { openDatabase } from './db';
import type { AppConfig } from './types';
import { AppError, ERR } from './errors';
import { uid, nowIso } from './util';
import { assertWithin } from './validation';

const MAGIC = Buffer.from('MERQOBAK', 'utf8');
const FORMAT_VERSION = 1;
interface BackupHeader {
  version: number;
  productId: string;
  createdAt: string;
  schemaVersion: number;
  sizeBytes: number;
  sha256: string;
  encrypted: boolean;
  salt?: string;
  iv?: string;
  tag?: string;
  note?: string;
}
export interface BackupInfo extends BackupHeader {
  fileName: string;
  filePath: string;
  fileSize: number;
  valid: boolean;
  reasons: string[];
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
function encrypt(
  bytes: Buffer,
  passphrase: string,
): { payload: Buffer; salt: string; iv: string; tag: string } {
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    payload: encrypted,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}
function decrypt(payload: Buffer, h: BackupHeader, passphrase: string): Buffer {
  if (!h.salt || !h.iv || !h.tag) throw new AppError(ERR.VALIDATION, 'এনক্রিপশন তথ্য নেই।');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(passphrase, Buffer.from(h.salt, 'base64')),
    Buffer.from(h.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(h.tag, 'base64'));
  return Buffer.concat([decipher.update(payload), decipher.final()]);
}
function encode(header: BackupHeader, payload: Buffer): Buffer {
  const h = Buffer.from(JSON.stringify(header), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(h.length);
  return Buffer.concat([MAGIC, len, h, payload]);
}
function decode(file: Buffer): { header: BackupHeader; payload: Buffer } {
  if (file.length < MAGIC.length + 4 || !file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new AppError(ERR.VALIDATION, 'এটি বৈধ MERQO ব্যাকআপ ফাইল নয়।');
  }
  const len = file.readUInt32BE(MAGIC.length);
  if (len > 64 * 1024 || file.length < MAGIC.length + 4 + len)
    throw new AppError(ERR.VALIDATION, 'ব্যাকআপ হেডার অবৈধ।');
  const header = JSON.parse(
    file.subarray(MAGIC.length + 4, MAGIC.length + 4 + len).toString('utf8'),
  ) as BackupHeader;
  if (header.version !== FORMAT_VERSION)
    throw new AppError(ERR.VALIDATION, `ব্যাকআপ সংস্করণ ${header.version} সমর্থিত নয়।`);
  return { header, payload: file.subarray(MAGIC.length + 4 + len) };
}
function safeBackupPath(config: AppConfig, name: string): string {
  return assertWithin(config.backupDir, join(config.backupDir, basename(name)));
}
export function createBackup(
  db: DB,
  config: AppConfig,
  input: {
    destinationDir?: string;
    passphrase?: string;
    trigger?: 'manual' | 'automatic' | 'safety' | 'pre_migration';
    note?: string;
  } = {},
): BackupInfo {
  mkdirSync(config.backupDir, { recursive: true });
  const tmp = join(config.backupDir, `.tmp-${uid()}.sqlite`);
  try {
    db.prepare('VACUUM INTO ?').run(tmp);
    const bytes = readFileSync(tmp);
    const schemaVersion = Number(
      (db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get() as { value: string }).value,
    );
    const sha = createHash('sha256').update(bytes).digest('hex');
    let payload = bytes;
    let enc: { salt?: string; iv?: string; tag?: string } = {};
    if (input.passphrase) {
      const e = encrypt(bytes, input.passphrase);
      payload = Buffer.from(e.payload);
      enc = { salt: e.salt, iv: e.iv, tag: e.tag };
    }
    const header: BackupHeader = {
      version: FORMAT_VERSION,
      productId: config.productId,
      createdAt: nowIso(),
      schemaVersion,
      sizeBytes: bytes.length,
      sha256: sha,
      encrypted: Boolean(input.passphrase),
      ...enc,
      note: input.note ?? '',
    };
    const fileName = `MERQO-Backup-${header.createdAt.replace(/[:.]/g, '-')}-${uid().slice(0, 6)}.merqobak`;
    const dir = input.destinationDir
      ? assertWithin(input.destinationDir, input.destinationDir)
      : config.backupDir;
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, basename(fileName));
    writeFileSync(filePath, encode(header, payload));
    const id = uid();
    db.prepare(
      `INSERT INTO backup_history(id, file_path, file_name, size_bytes, sha256, schema_version,
      encrypted, trigger, status, note, created_at) VALUES (?,?,?,?,?,?,?,?,'created',?,?)`,
    ).run(
      id,
      filePath,
      fileName,
      statSync(filePath).size,
      sha,
      schemaVersion,
      header.encrypted ? 1 : 0,
      input.trigger ?? 'manual',
      input.note ?? '',
      header.createdAt,
    );
    const info = verifyBackup(filePath, input.passphrase ?? '');
    if (info.valid) db.prepare("UPDATE backup_history SET status='verified' WHERE id=?").run(id);
    return info;
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}
export function verifyBackup(filePath: string, passphrase = ''): BackupInfo {
  const reasons: string[] = [];
  let header: BackupHeader | undefined;
  try {
    const { header: h, payload } = decode(readFileSync(filePath));
    header = h;
    if (h.productId !== 'MERQO-POS') reasons.push('পণ্যের পরিচয় মিলছে না।');
    let dbBytes = payload;
    if (h.encrypted) {
      if (!passphrase) reasons.push('এই ব্যাকআপটি এনক্রিপ্টেড: পাসফ্রেজ দিন।');
      else {
        try {
          dbBytes = decrypt(payload, h, passphrase);
        } catch {
          reasons.push('পাসফ্রেজ সঠিক নয় অথবা ফাইল পরিবর্তন করা হয়েছে।');
        }
      }
    }
    if (dbBytes.length !== h.sizeBytes) reasons.push('ফাইলের আকার অমিল।');
    const digest = createHash('sha256').update(dbBytes).digest('hex');
    if (digest !== h.sha256) reasons.push('চেকসাম অমিল: ব্যাকআপ ক্ষতিগ্রস্ত।');
    if (reasons.length === 0) {
      const tmp = join(process.cwd(), `.verify-${uid()}.sqlite`);
      try {
        writeFileSync(tmp, dbBytes);
        const check = new Database(tmp, { readonly: true });
        const integrity = check.pragma('integrity_check', { simple: true });
        const version = (
          check.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get() as
            | { value: string }
            | undefined
        )?.value;
        check.close();
        if (integrity !== 'ok') reasons.push('SQLite অখণ্ডতা যাচাই ব্যর্থ।');
        if (!version) reasons.push('ডাটাবেজ স্কিমা পাওয়া যায়নি।');
        else if (Number(version) > Number(h.schemaVersion)) reasons.push('স্কিমা সংস্করণ অমিল।');
      } finally {
        if (existsSync(tmp)) unlinkSync(tmp);
      }
    }
  } catch (e) {
    reasons.push(e instanceof AppError ? e.message : 'ব্যাকআপ ফাইল পড়া যায়নি।');
  }
  const fallback: BackupHeader = {
    version: FORMAT_VERSION,
    productId: '',
    createdAt: '',
    schemaVersion: 0,
    sizeBytes: 0,
    sha256: '',
    encrypted: false,
  };
  return {
    ...(header ?? fallback),
    fileName: basename(filePath),
    filePath,
    fileSize: existsSync(filePath) ? statSync(filePath).size : 0,
    valid: reasons.length === 0,
    reasons,
  };
}
export function listBackups(db: DB): Record<string, unknown>[] {
  return db.prepare('SELECT * FROM backup_history ORDER BY created_at DESC').all() as Record<
    string,
    unknown
  >[];
}
export function restoreBackup(ctx: AppContext, input: { filePath: string; passphrase?: string }): BackupInfo {
  const info = verifyBackup(input.filePath, input.passphrase ?? '');
  if (!info.valid) throw new AppError(ERR.VALIDATION, `ব্যাকআপ গ্রহণযোগ্য নয়: ${info.reasons.join(' ')}`);
  // 1. Mandatory safety backup of the current database before any replacement.
  const safety = createBackup(ctx.db, ctx.config, {
    trigger: 'safety',
    note: 'রিস্টোরের আগে নিরাপত্তা ব্যাকআপ',
  });
  if (!safety.valid) throw new AppError(ERR.IO, 'নিরাপত্তা ব্যাকআপ ব্যর্থ: রিস্টোর বাতিল করা হয়েছে।');
  const { payload } = decode(readFileSync(input.filePath));
  const dbBytes = info.encrypted ? decrypt(payload, info, input.passphrase!) : payload;
  const target = ctx.config.dbPath;
  const temp = join(ctx.config.dataDir, 'data', `.restore-${uid()}.sqlite`);
  try {
    writeFileSync(temp, dbBytes);
    // 2. Verify the restored database before replacing anything.
    const check = new Database(temp, { readonly: true });
    if (check.pragma('integrity_check', { simple: true }) !== 'ok') {
      check.close();
      throw new AppError(ERR.IO, 'রিস্টোর করা ডাটাবেজ অখণ্ডতা যাচাইয়ে ব্যর্থ।');
    }
    check.close();
    ctx.db.close();
    for (const suffix of ['-wal', '-shm', '-journal']) {
      const f = target + suffix;
      if (existsSync(f)) unlinkSync(f);
    }
    renameSync(temp, target);
    // 3. Reopen and verify.
    ctx.db = openDatabase(target);
    if (ctx.db.pragma('integrity_check', { simple: true }) !== 'ok') {
      throw new AppError(ERR.IO, 'রিস্টোরের পর ডাটাবেজ যাচাই ব্যর্থ। নিরাপত্তা ব্যাকআপ ব্যবহার করুন।');
    }
    ctx.db
      .prepare(
        `INSERT OR REPLACE INTO backup_history(id, file_path, file_name, size_bytes, sha256,
      schema_version, encrypted, trigger, status, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        uid(),
        safety.filePath,
        safety.fileName,
        safety.fileSize,
        safety.sha256,
        safety.schemaVersion,
        safety.encrypted ? 1 : 0,
        'safety',
        'verified',
        'রিস্টোরের আগে নিরাপত্তা ব্যাকআপ',
        safety.createdAt,
      );
    ctx.db
      .prepare("UPDATE backup_history SET status='restored', note=? WHERE file_path=?")
      .run('সফল রিস্টোর: ' + nowIso(), input.filePath);
    return { ...info, valid: true, reasons: [] };
  } catch (e) {
    if (existsSync(temp)) unlinkSync(temp);
    // Recover the connection even if the replacement failed.
    try {
      ctx.db = openDatabase(target);
    } catch {
      /* caller must restart; documented */
    }
    throw e instanceof AppError ? e : new AppError(ERR.IO, 'রিস্টোর ব্যর্থ হয়েছে।');
  }
}
export function applyRetention(db: DB, config: AppConfig, keep = 10): number {
  const rows = db
    .prepare(
      `SELECT id, file_path FROM backup_history WHERE trigger <> 'safety'
    ORDER BY created_at DESC`,
    )
    .all() as { id: string; file_path: string }[];
  let removed = 0;
  for (const row of rows.slice(keep)) {
    try {
      if (existsSync(row.file_path)) unlinkSync(row.file_path);
    } catch {
      /* keep record */
    }
    db.prepare('DELETE FROM backup_history WHERE id=?').run(row.id);
    removed++;
  }
  return removed;
}
export function backupDirFiles(config: AppConfig): string[] {
  if (!existsSync(config.backupDir)) return [];
  return readdirSync(config.backupDir).filter((f) => f.endsWith('.merqobak'));
}
export { safeBackupPath, copyFileSync, timingSafeEqual };
