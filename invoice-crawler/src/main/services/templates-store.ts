import { app } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { FieldTemplate } from '@shared/types';
import { DEFAULT_FIELDS } from '@shared/constants';
import { readJson, writeJsonAtomic } from './json-file';

const TEMPLATES_DIR = 'templates';

function dir(): string {
  return join(app.getPath('userData'), TEMPLATES_DIR);
}

function pathFor(id: string): string {
  return join(dir(), `${id}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(dir(), { recursive: true });
}

export async function listTemplates(): Promise<FieldTemplate[]> {
  await ensureDir();
  const entries = await fs.readdir(dir());
  const jsonFiles = entries.filter((e) => e.endsWith('.json'));
  const loaded = await Promise.all(jsonFiles.map((e) => readJson<FieldTemplate>(join(dir(), e))));
  const templates = loaded.filter((t): t is FieldTemplate => t !== null);
  templates.sort((a, b) => a.name.localeCompare(b.name));
  return templates;
}

export async function getTemplate(templateId: string): Promise<FieldTemplate | null> {
  return readJson<FieldTemplate>(pathFor(templateId));
}

export async function saveTemplate(template: FieldTemplate): Promise<FieldTemplate> {
  await ensureDir();
  const now = new Date().toISOString();
  const final: FieldTemplate = {
    ...template,
    id: template.id || `tmpl-${randomUUID()}`,
    createdAt: template.createdAt || now,
    updatedAt: now,
  };
  await writeJsonAtomic(pathFor(final.id), final);
  return final;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  try {
    await fs.unlink(pathFor(templateId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export function buildDefaultTemplate(name = 'Default'): FieldTemplate {
  const now = new Date().toISOString();
  return {
    id: `tmpl-${randomUUID()}`,
    name,
    fields: DEFAULT_FIELDS,
    createdAt: now,
    updatedAt: now,
  };
}
