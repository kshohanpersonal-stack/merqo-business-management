/** Vite middleware: exposes the same core dispatcher over a relative /api URL. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createAppContext, type AppContext } from '../core/context';
import { dispatch } from '../core/dispatch';
import { normalizeText } from '../core/money';

let ctx: AppContext | undefined;
function context(): AppContext {
  if (!ctx) {
    ctx = createAppContext({ dataDir: process.env.MERQO_DATA_DIR ?? join(process.cwd(), '.merqo-data') });
    ctx.logger.info('PREVIEW_START', 'Development preview core initialised', { dataDir: ctx.config.dataDir });
  }
  return ctx;
}
function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}
async function readBody(req: IncomingMessage): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const b = Buffer.from(chunk as Buffer);
    size += b.length;
    if (size > 8 * 1024 * 1024) throw new Error('Request too large');
    chunks.push(b);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? (JSON.parse(text) as Record<string, any>) : {};
}
export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '/').split('?')[0] ?? '/';
  try {
    if (req.method === 'GET' && (url === '/health' || url === '')) {
      send(res, 200, { ok: true, service: 'MERQO core API', version: '0.1.0', platform: 'preview' });
      return true;
    }
    if (req.method === 'GET' && url === '/dev-license') {
      const path = join(process.cwd(), 'private', 'dev-license.merqolic');
      if (!existsSync(path)) {
        send(res, 404, { ok: false, error: 'ডেভেলপমেন্ট লাইসেন্স পাওয়া যায়নি।' });
        return true;
      }
      send(res, 200, { ok: true, text: readFileSync(path, 'utf8') });
      return true;
    }
    if (req.method === 'POST' && url === '/upload-backup') {
      const body = await readBody(req);
      const c = context();
      const dir = join(c.config.backupDir, 'uploads');
      mkdirSync(dir, { recursive: true });
      const name = basename(normalizeText(String(body.fileName ?? 'backup.merqobak'), 120)).replace(
        /[^\w.-]/g,
        '_',
      );
      const path = join(dir, name);
      writeFileSync(path, Buffer.from(String(body.base64 ?? ''), 'base64'));
      send(res, 200, { ok: true, path });
      return true;
    }
    if (req.method === 'POST' && (url === '/' || url === '/call')) {
      const body = await readBody(req);
      const result = await dispatch(
        context(),
        String(body.action ?? ''),
        body.payload ?? {},
        String(body.token ?? ''),
      );
      send(res, 200, result);
      return true;
    }
    return false;
  } catch (e) {
    send(res, 500, {
      ok: false,
      error: { code: 'INTERNAL', message: 'অনুরোধটি প্রক্রিয়া করা যায়নি।' },
      detail: (e as Error).message,
    });
    return true;
  }
}
