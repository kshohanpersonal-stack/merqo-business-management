import { BrowserWindow } from 'electron';
import type { BrowserWindow as BW } from 'electron';

async function hiddenWindow(html: string): Promise<BW> {
  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 1000,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, offscreen: true },
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return win;
}
export async function printReceiptHtml(
  html: string,
  options: Record<string, unknown>,
): Promise<{ ok: boolean; message?: string }> {
  let win: BW | undefined;
  try {
    win = await hiddenWindow(html);
    const width = options.width === '58mm' ? 58_000 : 80_000;
    const height = Number(options.height ?? 300_000);
    const deviceName = options.deviceName ? String(options.deviceName) : undefined;
    await new Promise<void>((resolve, reject) => {
      win!.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName,
          pageSize: { width, height },
          margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 },
        },
        (success: boolean, reason: string) =>
          success ? resolve() : reject(new Error(reason || 'Print failed')),
      );
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: `প্রিন্টারে পাঠানো যায়নি: ${(e as Error).message}. ইনভয়েস সংরক্ষিত আছে।` };
  } finally {
    win?.destroy();
  }
}
export async function htmlToPdf(html: string): Promise<Buffer> {
  const win = await hiddenWindow(html);
  try {
    return await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  } finally {
    win.destroy();
  }
}
export async function listPrinters(): Promise<string[]> {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return [];
  try {
    return (await win.webContents.getPrintersAsync()).map((p) => p.name);
  } catch {
    return [];
  }
}
