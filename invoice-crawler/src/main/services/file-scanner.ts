import { promises as fs } from 'fs';
import { extname, join } from 'path';
import type { FolderScanResult } from '@shared/types';
import { SUPPORTED_FILE_EXTENSIONS } from '@shared/constants';

export async function scanFolder(folderPath: string): Promise<FolderScanResult> {
  const files = await collectFiles(folderPath);
  files.sort();
  return { folderPath, files };
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectFiles(full)));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if ((SUPPORTED_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
        found.push(full);
      }
    }
  }
  return found;
}
