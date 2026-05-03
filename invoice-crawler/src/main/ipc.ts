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
import { BatchProcessor } from './services/batch-processor';
import { exportCsv } from './services/csv-exporter';
import { downloadUpdate, quitAndInstall } from './services/updater';

type GetMainWindow = () => BrowserWindow | null;

type Handler<C extends keyof IpcInvokeMap> = (
  ...args: IpcInvokeMap[C]['args']
) => Promise<IpcInvokeMap[C]['return']> | IpcInvokeMap[C]['return'];

function handle<C extends keyof IpcInvokeMap>(channel: C, fn: Handler<C>): void {
  ipcMain.handle(channel, async (_event, ...args) => fn(...(args as IpcInvokeMap[C]['args'])));
}

const batchProcessor = new BatchProcessor();

export function registerIpcHandlers(getMainWindow: GetMainWindow): void {
  function emit<C extends keyof import('@shared/types').IpcEventMap>(
    channel: C,
    payload: import('@shared/types').IpcEventMap[C],
  ): void {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send(channel, payload);
  }

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

  handle('update:download', async () => {
    await downloadUpdate();
  });
  handle('update:install', async () => {
    quitAndInstall();
  });

  handle('batch:start', async (filePaths, profileId) => {
    const profile = await getProfile(profileId);
    if (!profile) {
      emit('batch:error', `Profile not found: ${profileId}`);
      return;
    }
    const apiKey = decryptApiKey(profile.apiKeyEncrypted);
    if (!apiKey) {
      emit('batch:error', 'No API key configured for this profile');
      return;
    }

    // Run in the background so the IPC call returns immediately;
    // progress and completion are pushed via events.
    void (async () => {
      try {
        const results = await batchProcessor.run({
          filePaths,
          profile,
          apiKey,
          onProgress: (progress) => emit('batch:progress', progress),
        });
        emit('batch:complete', results);
      } catch (error) {
        emit('batch:error', error instanceof Error ? error.message : String(error));
      }
    })();
  });

  handle('batch:cancel', async () => {
    batchProcessor.cancel();
  });

  handle('export:csv', async (results, fields, outputPath) => {
    await exportCsv(results, fields, outputPath);
  });

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
