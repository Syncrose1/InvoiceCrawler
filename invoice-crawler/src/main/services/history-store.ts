import { app } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { AiProviderName, ExtractionField, RunRecord, RunSummary } from '@shared/types';
import { readJson, writeJsonAtomic } from './json-file';

const HISTORY_DIR = 'history';

function dir(): string {
  return join(app.getPath('userData'), HISTORY_DIR);
}

function pathFor(id: string): string {
  return join(dir(), `${id}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(dir(), { recursive: true });
}

/**
 * The on-disk schema for run records changed when we split FirmProfile
 * into AppSettings + FieldTemplate. Old records had a `profile` field
 * with provider/model/fields all bundled; new records have a `template`
 * field plus separate `aiProvider`/`aiModel`. Normalise old records on
 * read so historical runs still display correctly.
 */
interface LegacyRunRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  folderPath: string;
  profile?: {
    id: string;
    name: string;
    aiProvider: AiProviderName;
    aiModel: string;
    fields: ExtractionField[];
  };
  template?: RunRecord['template'];
  aiProvider?: AiProviderName;
  aiModel?: string;
  results: RunRecord['results'];
  completion: RunRecord['completion'];
}

function normaliseRecord(raw: LegacyRunRecord): RunRecord {
  if (raw.template && raw.aiProvider && raw.aiModel) {
    return raw as RunRecord;
  }
  // Migrate from the old shape: profile bundled provider/model/fields.
  if (raw.profile) {
    return {
      id: raw.id,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      folderPath: raw.folderPath,
      template: {
        id: raw.profile.id,
        name: raw.profile.name,
        fields: raw.profile.fields,
      },
      aiProvider: raw.profile.aiProvider,
      aiModel: raw.profile.aiModel,
      results: raw.results,
      completion: raw.completion,
    };
  }
  // Last-resort fallback; should never hit unless a record was hand-edited.
  throw new Error(`Run record ${raw.id} is missing both 'template' and 'profile' fields`);
}

function summarise(record: RunRecord): RunSummary {
  let successCount = 0;
  let errorCount = 0;
  for (const r of record.results) {
    if (r.status === 'success') successCount += 1;
    else if (r.status === 'error') errorCount += 1;
  }
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    folderPath: record.folderPath,
    templateName: record.template.name,
    fileCount: record.results.length,
    successCount,
    errorCount,
    completion: record.completion,
  };
}

export async function listRuns(): Promise<RunSummary[]> {
  await ensureDir();
  const entries = await fs.readdir(dir());
  const jsonFiles = entries.filter((e) => e.endsWith('.json'));
  const loaded = await Promise.all(
    jsonFiles.map((e) => readJson<LegacyRunRecord>(join(dir(), e))),
  );
  const summaries: RunSummary[] = [];
  for (const record of loaded) {
    if (!record) continue;
    try {
      summaries.push(summarise(normaliseRecord(record)));
    } catch {
      // Records that fail normalisation (missing both `template` and
      // `profile`) are skipped rather than crashing the History page.
    }
  }
  summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return summaries;
}

export async function getRun(runId: string): Promise<RunRecord | null> {
  const raw = await readJson<LegacyRunRecord>(pathFor(runId));
  return raw ? normaliseRecord(raw) : null;
}

export async function saveRun(record: RunRecord): Promise<RunRecord> {
  await ensureDir();
  const finalRecord: RunRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(pathFor(finalRecord.id), finalRecord);
  return finalRecord;
}

export async function deleteRun(runId: string): Promise<void> {
  try {
    await fs.unlink(pathFor(runId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
