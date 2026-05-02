import { ipcMain, dialog, BrowserWindow } from 'electron';
import type { IpcInvokeMap } from '@shared/types';
import { scanFolder } from './services/file-scanner';
import {
  buildDefaultProfile,
  decryptApiKey,
  deleteProfile,
  encryptApiKey,
  getProfile,
  listProfiles,
  saveProfile,
} from './services/profile-store';
import { extractInvoice } from './services/extract-single';
import { loadSettings, saveSettings } from './services/settings-store';

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

  handle('fs:scan-folder', async (folderPath) => scanFolder(folderPath));

  handle('profiles:list', async () => listProfiles());
  handle('profiles:save', async (profile) => saveProfile(profile));
  handle('profiles:delete', async (profileId) => {
    await deleteProfile(profileId);
  });
  handle('profiles:create-default', async () => saveProfile(buildDefaultProfile()));
  handle('profiles:set-api-key', async (profileId, apiKey) => {
    const profile = await getProfile(profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    return saveProfile({ ...profile, apiKeyEncrypted: encryptApiKey(apiKey) });
  });

  handle('settings:get', async () => loadSettings());
  handle('settings:set', async (patch) => saveSettings(patch));

  // Batch processing lands in Phase 4 — stubs for now so the channels exist.
  handle('batch:start', async () => undefined);
  handle('batch:cancel', async () => undefined);

  // CSV export lands in Phase 5.
  handle('export:csv', async () => undefined);

  handle('reprocess:single', async (filePath, profileId) => {
    const profile = await getProfile(profileId);
    if (!profile) {
      return {
        fileName: filePath,
        filePath,
        status: 'error',
        data: {},
        error: `Profile not found: ${profileId}`,
      };
    }
    const apiKey = decryptApiKey(profile.apiKeyEncrypted);
    if (!apiKey) {
      return {
        fileName: filePath,
        filePath,
        status: 'error',
        data: {},
        error: 'No API key configured for this profile',
      };
    }
    return extractInvoice(filePath, profile, apiKey);
  });
}
