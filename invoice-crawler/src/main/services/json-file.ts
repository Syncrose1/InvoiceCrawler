import { promises as fs } from 'fs';

/** Read and parse a JSON file, or null if it's missing or corrupt. */
export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Write JSON via a temp file + rename, so a crash or power cut mid-write
 * leaves the previous file intact instead of a truncated one.
 *
 * On Windows the rename can briefly fail with EPERM/EBUSY while antivirus or
 * the search indexer holds the target open, so retry a few times before
 * giving up.
 */
export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), 'utf-8');

  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmpPath, filePath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const transient = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
      if (!transient || attempt >= 4) {
        await fs.unlink(tmpPath).catch(() => {});
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}
