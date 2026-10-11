import { app, safeStorage } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { AppSettings, FieldTemplate } from '@shared/types';
import { PROVIDER_MODELS } from '@shared/constants';
import { saveTemplate } from './templates-store';
import { writeJsonAtomic } from './json-file';

const SETTINGS_FILENAME = 'app-settings.json';
const LEGACY_PROFILES_DIR = 'profiles';

const DEFAULTS: AppSettings = {
  aiProvider: 'anthropic',
  aiModel: PROVIDER_MODELS.anthropic[0].id,
  apiKeyEncrypted: '',
  autoCrop: true,
  defaultTemplateId: null,
  lastFolderPath: null,
};

function settingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILENAME);
}

function profilesDir(): string {
  return join(app.getPath('userData'), LEGACY_PROFILES_DIR);
}

export async function loadSettings(): Promise<AppSettings> {
  let raw: string;
  try {
    raw = await fs.readFile(settingsPath(), 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULTS };
    throw error;
  }
  try {
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch (error) {
    // A corrupt settings file would otherwise break every batch and the
    // Settings page until someone deleted it by hand. Set it aside (so it's
    // recoverable) and carry on with defaults — the user re-enters their key.
    console.error('Settings file is corrupt, falling back to defaults:', error);
    await fs.rename(settingsPath(), `${settingsPath()}.corrupt-${Date.now()}`).catch(() => {});
    return { ...DEFAULTS };
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadSettings();
  const merged: AppSettings = { ...current, ...patch };
  await writeJsonAtomic(settingsPath(), merged);
  return merged;
}

export function encryptApiKey(plain: string): string {
  if (!plain) return '';
  if (!safeStorage.isEncryptionAvailable()) return plain;
  return safeStorage.encryptString(plain).toString('base64');
}

export function decryptApiKey(encoded: string): string {
  if (!encoded) return '';
  if (!safeStorage.isEncryptionAvailable()) return encoded;
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  } catch {
    // A key saved before encryption was available is stored as plain text —
    // both providers' keys start with `sk-`. Anything else is ciphertext we
    // can no longer read (OS keyring changed or locked, common on Linux).
    // Report it as missing so the UI asks for the key again, rather than
    // sending ciphertext to the API and surfacing a baffling auth error.
    return encoded.startsWith('sk-') ? encoded : '';
  }
}

/**
 * One-shot migration from the old "FirmProfile" model to the new
 * "AppSettings + FieldTemplates" split. Runs at app start. Idempotent —
 * if there are no legacy profiles it does nothing.
 *
 * What it does:
 *   - For each legacy profile JSON, save its fields as a new FieldTemplate
 *     (keeping the profile's name and timestamps).
 *   - Lift the AI provider / model / API key from the most recently updated
 *     legacy profile into AppSettings (machine-wide config).
 *   - Set the migrated template matching that source profile as the
 *     defaultTemplateId.
 *   - Move the old profiles/ directory to profiles.migrated-<timestamp>/
 *     so the migration is undoable and won't re-run on next launch.
 *
 * Run-history records (in history/) are not touched — they were always
 * snapshots and remain readable.
 */
export async function migrateProfilesToTemplates(): Promise<void> {
  const dir = profilesDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }

  interface LegacyProfile {
    id: string;
    name: string;
    fields: FieldTemplate['fields'];
    aiProvider: AppSettings['aiProvider'];
    aiModel: string;
    apiKeyEncrypted: string;
    autoCrop?: boolean;
    createdAt: string;
    updatedAt: string;
  }

  const legacyProfiles: LegacyProfile[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(join(dir, entry), 'utf-8');
      legacyProfiles.push(JSON.parse(raw) as LegacyProfile);
    } catch {
      // Skip corrupt files; we'll preserve them under the migrated dir below.
    }
  }

  if (legacyProfiles.length === 0) {
    // Nothing to migrate. Still rename the (likely empty) directory so we
    // don't keep checking it forever.
    await fs.rename(dir, `${dir}.migrated-${Date.now()}`).catch(() => {});
    return;
  }

  // Save each profile's fields as a new template, remembering the mapping
  // from old profile id -> new template id so we can pin the default.
  const idMap = new Map<string, string>();
  for (const profile of legacyProfiles) {
    const template = await saveTemplate({
      id: '', // saveTemplate generates a fresh id
      name: profile.name || 'Migrated template',
      fields: profile.fields ?? [],
      createdAt: profile.createdAt,
      updatedAt: new Date().toISOString(),
    });
    idMap.set(profile.id, template.id);
  }

  // Lift the AI config from the most recently updated profile that actually
  // has an API key. Falls back to the most recent overall if nothing has a key.
  const sortedByUpdated = [...legacyProfiles].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const source =
    sortedByUpdated.find((p) => p.apiKeyEncrypted && p.apiKeyEncrypted.length > 0) ??
    sortedByUpdated[0];

  await saveSettings({
    aiProvider: source.aiProvider,
    aiModel: source.aiModel,
    apiKeyEncrypted: source.apiKeyEncrypted ?? '',
    autoCrop: source.autoCrop !== false,
    defaultTemplateId: idMap.get(source.id) ?? null,
  });

  // Rename instead of delete so a hand-rollback is possible if something's
  // ever wrong.
  await fs.rename(dir, `${dir}.migrated-${Date.now()}`).catch(() => {});
}
