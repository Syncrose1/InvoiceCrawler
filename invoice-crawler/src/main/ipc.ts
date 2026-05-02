import { ipcMain, dialog, BrowserWindow } from 'electron';
import type { IpcInvokeMap } from '@shared/types';

type GetMainWindow = () => BrowserWindow | null;

type Handler<C extends keyof IpcInvokeMap> = (
  ...args: IpcInvokeMap[C]['args']
) => Promise<IpcInvokeMap[C]['return']> | IpcInvokeMap[C]['return'];

function handle<C extends keyof IpcInvokeMap>(channel: C, fn: Handler<C>): void {
  ipcMain.handle(channel, async (_event, ...args) => fn(...(args as IpcInvokeMap[C]['args'])));
}

export function registerIpcHandlers(getMainWindow: GetMainWindow): void {
  handle('dialog:select-folder', async () => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select invoice folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  handle('dialog:select-save-path', async (defaultName) => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, {
      title: 'Export results',
      defaultPath: defaultName,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  // Stub handlers — real implementations land in later phases.
  handle('fs:scan-folder', async (folderPath) => ({ folderPath, files: [] }));
  handle('profiles:list', async () => []);
  handle('profiles:save', async (profile) => profile);
  handle('profiles:delete', async () => undefined);
  handle('batch:start', async () => undefined);
  handle('batch:cancel', async () => undefined);
  handle('export:csv', async () => undefined);
  handle('reprocess:single', async (filePath) => ({
    fileName: filePath,
    filePath,
    status: 'success',
    data: {},
  }));
}
