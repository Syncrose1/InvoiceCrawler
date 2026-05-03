import { app, shell, BrowserWindow, nativeImage } from 'electron';
import { join } from 'path';
import { registerIpcHandlers } from './ipc';
import { initAutoUpdater } from './services/updater';
import { migrateProfilesToTemplates } from './services/settings-store';

let mainWindow: BrowserWindow | null = null;

// Resolve the icon both in dev (project root) and in the packaged app
// (bundled under resources/build/icon.png by electron-builder).
function resolveIcon(): Electron.NativeImage {
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(process.resourcesPath, 'build/icon.png'),
  ];
  for (const path of candidates) {
    const image = nativeImage.createFromPath(path);
    if (!image.isEmpty()) return image;
  }
  return nativeImage.createEmpty();
}

function createWindow(): void {
  const icon = resolveIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  // One-shot migration from the old FirmProfile model. Idempotent —
  // does nothing if there's no legacy profiles/ directory.
  try {
    await migrateProfilesToTemplates();
  } catch (error) {
    console.error('Profile migration failed (non-fatal):', error);
  }

  registerIpcHandlers(() => mainWindow);
  createWindow();
  initAutoUpdater(() => mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
