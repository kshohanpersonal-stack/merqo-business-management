import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join, basename } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createAppContext, type AppContext } from '../core/context';
import { dispatch } from '../core/dispatch';
import { setDeviceFingerprintProvider } from '../core/config';
import { windowsDeviceFingerprint } from './device';
import { printReceiptHtml, htmlToPdf, listPrinters } from './printing';
import { normalizeText } from '../core/money';

let ctx: AppContext | undefined;
let mainWindow: BrowserWindow | undefined;
const isDev = !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    title: 'MERQO — ব্যবসা ব্যবস্থাপনা',
    icon: join(__dirname, '..', 'assets', 'icons', 'merqo.ico'),
    backgroundColor: '#F5F7FA',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: isDev,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  if (isDev) void mainWindow.loadURL(process.env.MERQO_DEV_URL ?? 'http://localhost:5173');
  else void mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));
}

async function bootstrap(): Promise<void> {
  setDeviceFingerprintProvider(windowsDeviceFingerprint);
  ctx = createAppContext({ dataDir: join(app.getPath('userData'), 'merqo') });
  ctx.printers = listPrinters;
  ctx.printReceipt = printReceiptHtml;
  ctx.exportPdf = htmlToPdf;
  ctx.logger.info('APP_START', 'MERQO desktop started', {
    version: app.getVersion(),
    platform: process.platform,
  });
  ipcMain.handle('merqo:call', (_e, action: string, payload: unknown, token: string) =>
    dispatch(ctx!, action, payload, token),
  );
  ipcMain.handle('merqo:saveBytes', async (_e, base64: string, suggestedName: string) => {
    const name = basename(normalizeText(suggestedName, 120)).replace(/[^\w.-]/g, '_');
    const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: name, title: 'ফাইল সংরক্ষণ' });
    if (result.canceled || !result.filePath) return { ok: false };
    writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
    return { ok: true, path: result.filePath };
  });
  ipcMain.handle('merqo:openTextFile', async (_e, title: string, filters: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog(mainWindow!, { title, filters, properties: ['openFile'] });
    if (result.canceled || !result.filePaths[0]) return { ok: false };
    return { ok: true, text: readFileSync(result.filePaths[0], 'utf8'), path: result.filePaths[0] };
  });
  ipcMain.handle('merqo:selectFile', async (_e, title: string, filters: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog(mainWindow!, { title, filters, properties: ['openFile'] });
    return result.canceled ? { ok: false } : { ok: true, path: result.filePaths[0] };
  });
  ipcMain.handle('merqo:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'ব্যাকআপ ফোল্ডার',
      properties: ['openDirectory'],
    });
    return result.canceled ? { ok: false } : { ok: true, path: result.filePaths[0] };
  });
  ipcMain.handle('merqo:platform', () => ({
    platform: process.platform,
    version: app.getVersion(),
    packaged: app.isPackaged,
  }));
  createWindow();
}
void app.whenReady().then(bootstrap);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    ctx?.close();
    app.quit();
  }
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
