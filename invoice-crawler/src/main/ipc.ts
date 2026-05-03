import { ipcMain, dialog, BrowserWindow } from 'electron';
import type { IpcInvokeMap } from '@shared/types';
import { scanFolder } from './services/file-scanner';
import {
  decryptApiKey,
  encryptApiKey,
  loadSettings,
  saveSettings,
} from './services/settings-store';
import {
  buildDefaultTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  saveTemplate,
} from './services/templates-store';
import { extractInvoice } from './services/extract-single';
import { BatchProcessor } from './services/batch-processor';
import { exportCsv } from './services/csv-exporter';
import { downloadUpdate, quitAndInstall } from './services/updater';
import { deleteRun, getRun, listRuns, saveRun } from './services/history-store';

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

  handle('templates:list', async () => listTemplates());
  handle('templates:save', async (template) => saveTemplate(template));
  handle('templates:delete', async (templateId) => {
    await deleteTemplate(templateId);
    // If the user just deleted their default template, drop the dangling pointer.
    const settings = await loadSettings();
    if (settings.defaultTemplateId === templateId) {
      await saveSettings({ defaultTemplateId: null });
    }
  });
  handle('templates:create-default', async () => saveTemplate(buildDefaultTemplate()));

  handle('settings:get', async () => loadSettings());
  handle('settings:set', async (patch) => saveSettings(patch));
  handle('settings:set-api-key', async (apiKey) =>
    saveSettings({ apiKeyEncrypted: encryptApiKey(apiKey) }),
  );
  handle('settings:has-api-key', async () => {
    const settings = await loadSettings();
    if (!settings.apiKeyEncrypted) return false;
    return decryptApiKey(settings.apiKeyEncrypted).length > 0;
  });

  handle('update:download', async () => {
    await downloadUpdate();
  });
  handle('update:install', async () => {
    quitAndInstall();
  });

  handle('history:list', async () => listRuns());
  handle('history:get', async (runId) => getRun(runId));
  handle('history:save', async (run) => saveRun(run));
  handle('history:delete', async (runId) => {
    await deleteRun(runId);
  });

  handle('batch:start', async (filePaths, templateId) => {
    const template = await getTemplate(templateId);
    if (!template) {
      emit('batch:error', `Template not found: ${templateId}`);
      return;
    }
    const settings = await loadSettings();
    const apiKey = decryptApiKey(settings.apiKeyEncrypted);
    if (!apiKey) {
      emit('batch:error', 'No API key configured. Pop into Settings to add one.');
      return;
    }

    void (async () => {
      try {
        const results = await batchProcessor.run({
          filePaths,
          template,
          apiKey,
          provider: settings.aiProvider,
          model: settings.aiModel,
          autoCrop: settings.autoCrop,
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

  handle('reprocess:single', async (filePath, templateId) => {
    const template = await getTemplate(templateId);
    if (!template) {
      return {
        fileName: filePath,
        filePath,
        status: 'error',
        data: {},
        error: `Template not found: ${templateId}`,
      };
    }
    const settings = await loadSettings();
    const apiKey = decryptApiKey(settings.apiKeyEncrypted);
    if (!apiKey) {
      return {
        fileName: filePath,
        filePath,
        status: 'error',
        data: {},
        error: 'No API key configured.',
      };
    }
    return extractInvoice({
      filePath,
      template,
      apiKey,
      provider: settings.aiProvider,
      model: settings.aiModel,
      autoCrop: settings.autoCrop,
    });
  });
}
