// electron-updater is CommonJS — under our ESM main process the named import
// fails at runtime ("Named export 'autoUpdater' not found"). The default-import +
// destructure pattern works for both CJS and ESM consumers.
import electronUpdater from 'electron-updater';
import type { BrowserWindow } from 'electron';
import type { UpdateStatus } from '@shared/types';

const { autoUpdater } = electronUpdater;

type GetMainWindow = () => BrowserWindow | null;

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

export function initAutoUpdater(getMainWindow: GetMainWindow): void {
  // Skip in dev — electron-vite sets ELECTRON_RENDERER_URL only when running `npm run dev`.
  if (process.env['ELECTRON_RENDERER_URL']) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (status: UpdateStatus): void => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('update:status', status);
  };

  autoUpdater.on('checking-for-update', () => send({ phase: 'checking' }));
  autoUpdater.on('update-not-available', () => send({ phase: 'idle' }));
  autoUpdater.on('update-available', (info) =>
    send({ phase: 'available', version: info.version }),
  );
  autoUpdater.on('download-progress', (progress) =>
    send({ phase: 'downloading', percent: Math.round(progress.percent) }),
  );
  autoUpdater.on('update-downloaded', (info) =>
    send({ phase: 'ready', version: info.version }),
  );
  autoUpdater.on('error', (err) =>
    send({ phase: 'error', message: err instanceof Error ? err.message : String(err) }),
  );

  // Initial check 30s after launch (don't block startup).
  setTimeout(() => void autoUpdater.checkForUpdates().catch(() => {}), 30_000);
  // Then every 4 hours.
  setInterval(() => void autoUpdater.checkForUpdates().catch(() => {}), FOUR_HOURS_MS);
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate();
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall();
}
