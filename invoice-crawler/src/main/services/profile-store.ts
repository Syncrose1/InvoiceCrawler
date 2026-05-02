import { app, safeStorage } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { FirmProfile } from '@shared/types';
import { DEFAULT_FIELDS, DEFAULT_PROFILE_NAME, PROVIDER_MODELS } from '@shared/constants';

const PROFILES_DIR_NAME = 'profiles';

interface StoredProfile extends Omit<FirmProfile, 'apiKeyEncrypted'> {
  apiKeyEncrypted: string;
}

function profilesDir(): string {
  return join(app.getPath('userData'), PROFILES_DIR_NAME);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(profilesDir(), { recursive: true });
}

export async function listProfiles(): Promise<FirmProfile[]> {
  await ensureDir();
  const entries = await fs.readdir(profilesDir());
  const profiles: FirmProfile[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(join(profilesDir(), entry), 'utf-8');
      profiles.push(JSON.parse(raw) as StoredProfile);
    } catch {
      // Skip corrupt profile files rather than crashing the app.
    }
  }
  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveProfile(profile: FirmProfile): Promise<FirmProfile> {
  await ensureDir();
  const now = new Date().toISOString();
  const finalProfile: FirmProfile = {
    ...profile,
    id: profile.id || `profile-${randomUUID()}`,
    createdAt: profile.createdAt || now,
    updatedAt: now,
  };
  const filePath = join(profilesDir(), `${finalProfile.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(finalProfile, null, 2), 'utf-8');
  return finalProfile;
}

export async function deleteProfile(profileId: string): Promise<void> {
  const filePath = join(profilesDir(), `${profileId}.json`);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function getProfile(profileId: string): Promise<FirmProfile | null> {
  const profiles = await listProfiles();
  return profiles.find((p) => p.id === profileId) ?? null;
}

export function encryptApiKey(plain: string): string {
  if (!plain) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: store plain (the OS keychain may be unavailable in some envs).
    return plain;
  }
  return safeStorage.encryptString(plain).toString('base64');
}

export function decryptApiKey(encoded: string): string {
  if (!encoded) return '';
  if (!safeStorage.isEncryptionAvailable()) return encoded;
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  } catch {
    // If decryption fails, treat the stored value as plain text (e.g., when migrating).
    return encoded;
  }
}

export function buildDefaultProfile(): FirmProfile {
  const now = new Date().toISOString();
  return {
    id: `profile-${randomUUID()}`,
    name: DEFAULT_PROFILE_NAME,
    fields: DEFAULT_FIELDS,
    aiProvider: 'anthropic',
    aiModel: PROVIDER_MODELS.anthropic[0].id,
    apiKeyEncrypted: '',
    createdAt: now,
    updatedAt: now,
  };
}
