import { app } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { RunRecord, RunSummary } from '@shared/types';

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
    profileName: record.profile.name,
    fileCount: record.results.length,
    successCount,
    errorCount,
    completion: record.completion,
  };
}

export async function listRuns(): Promise<RunSummary[]> {
  await ensureDir();
  const entries = await fs.readdir(dir());
  const summaries: RunSummary[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(join(dir(), entry), 'utf-8');
      summaries.push(summarise(JSON.parse(raw) as RunRecord));
    } catch {
      // Skip corrupt history files rather than crashing the History page.
    }
  }
  // Most recent first.
  summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return summaries;
}

export async function getRun(runId: string): Promise<RunRecord | null> {
  try {
    const raw = await fs.readFile(pathFor(runId), 'utf-8');
    return JSON.parse(raw) as RunRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function saveRun(record: RunRecord): Promise<RunRecord> {
  await ensureDir();
  const finalRecord: RunRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(pathFor(finalRecord.id), JSON.stringify(finalRecord, null, 2), 'utf-8');
  return finalRecord;
}

export async function deleteRun(runId: string): Promise<void> {
  try {
    await fs.unlink(pathFor(runId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
