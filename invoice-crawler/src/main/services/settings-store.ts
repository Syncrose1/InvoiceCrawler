import { app } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';

const SETTINGS_FILENAME = 'app-settings.json';

export interface AppSettings {
  activeProfileId: string | null;
  lastFolderPath: string | null;
}

const DEFAULTS: AppSettings = {
  activeProfileId: null,
  lastFolderPath: null,
};

function settingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILENAME);
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf-8');
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULTS };
    throw error;
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadSettings();
  const merged: AppSettings = { ...current, ...patch };
  await fs.writeFile(settingsPath(), JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
