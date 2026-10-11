import { app, shell, BrowserWindow, nativeImage } from 'electron';
import { join } from 'path';
import { registerIpcHandlers } from './ipc';
import { initAutoUpdater } from './services/updater';
import { migrateProfilesToTemplates } from './services/settings-store';

let mainWindow: BrowserWindow | null = null;

// Resolve the icon both in dev (project root) and in the packaged app
// (copied to resources/build/icon.png via extraResources in electron-builder.yml).
// Windows takes its taskbar icon from the .exe, so this mostly matters on Linux.
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
    // Only hand web links to the OS. Anything else (file:, custom schemes)
    // could launch a local program.
    if (/^https?:\/\//i.test(details.url)) void shell.openExternal(details.url);
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
});

app.on('window-all-closed', () => {
  app.quit();
});
