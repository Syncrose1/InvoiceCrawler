import { promises as fs, type Dirent } from 'fs';
import { extname, join } from 'path';
import type { FolderScanResult } from '@shared/types';
import { SUPPORTED_FILE_EXTENSIONS } from '@shared/constants';

export async function scanFolder(folderPath: string): Promise<FolderScanResult> {
  // The root is read eagerly so a bad pick (deleted, no permission) still
  // surfaces as an error to the user.
  const files = await collectFiles(folderPath, await fs.readdir(folderPath, { withFileTypes: true }));
  files.sort();
  return { folderPath, files };
}

async function collectFiles(dir: string, entries: Dirent[]): Promise<string[]> {
  const found: string[] = [];
  for (const entry of entries) {
    // Skip dotfiles: macOS leaves `._invoice.pdf` AppleDouble files on shared
    // drives, USB sticks and SMB shares, and they'd each fail as a "PDF".
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip subfolders we can't read (Windows `System Volume Information`
      // when a drive root is picked, locked-down folders) instead of failing
      // the whole scan.
      const children = await fs.readdir(full, { withFileTypes: true }).catch(() => null);
      if (children) found.push(...(await collectFiles(full, children)));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if ((SUPPORTED_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
        found.push(full);
      }
    }
  }
  return found;
}
