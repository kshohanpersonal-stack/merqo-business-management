import { contextBridge, ipcRenderer } from 'electron';

export interface MerqoBridge {
  call(
    action: string,
    payload?: unknown,
    token?: string,
  ): Promise<{ ok: boolean; data?: any; error?: { code: string; message: string } }>;
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
const bridge: MerqoBridge = {
  call: (action, payload = {}, token = '') => ipcRenderer.invoke('merqo:call', action, payload, token),
  saveBytes: (base64, suggestedName) => ipcRenderer.invoke('merqo:saveBytes', base64, suggestedName),
  openTextFile: (title, filters = []) => ipcRenderer.invoke('merqo:openTextFile', title, filters),
  selectFile: (title, filters = []) => ipcRenderer.invoke('merqo:selectFile', title, filters),
  selectDirectory: () => ipcRenderer.invoke('merqo:selectDirectory'),
  platform: () => ipcRenderer.invoke('merqo:platform'),
};
contextBridge.exposeInMainWorld('merqo', bridge);
