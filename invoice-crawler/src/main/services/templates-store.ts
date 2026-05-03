import { app } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { FieldTemplate } from '@shared/types';
import { DEFAULT_FIELDS } from '@shared/constants';

const TEMPLATES_DIR = 'templates';

function dir(): string {
  return join(app.getPath('userData'), TEMPLATES_DIR);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(dir(), { recursive: true });
}

export async function listTemplates(): Promise<FieldTemplate[]> {
  await ensureDir();
  const entries = await fs.readdir(dir());
  const templates: FieldTemplate[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(join(dir(), entry), 'utf-8');
      templates.push(JSON.parse(raw) as FieldTemplate);
    } catch {
      // Skip corrupt files rather than crashing the Templates page.
    }
  }
  templates.sort((a, b) => a.name.localeCompare(b.name));
  return templates;
}

export async function getTemplate(templateId: string): Promise<FieldTemplate | null> {
  const all = await listTemplates();
  return all.find((t) => t.id === templateId) ?? null;
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
  const filePath = join(dir(), `${final.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(final, null, 2), 'utf-8');
  return final;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const filePath = join(dir(), `${templateId}.json`);
  try {
    await fs.unlink(filePath);
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
