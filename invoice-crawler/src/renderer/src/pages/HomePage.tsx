import { useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Play, FileText } from 'lucide-react';
import { ipcInvoke } from '../hooks/useIpc';

export default function HomePage() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);

  async function pickFolder() {
    const path = await ipcInvoke('dialog:select-folder');
    if (!path) return;
    setFolderPath(path);
    const result = await ipcInvoke('fs:scan-folder', path);
    setFileCount(result.files.length);
  }

  return (
    <div className="px-12 py-10 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Process invoices</h1>
        <p className="text-ice-text-muted text-sm mb-10">
          Select a folder of invoice images or PDFs to extract structured data.
        </p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="ice-card frost-overlay p-7 mb-6"
      >
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-ice-bg border border-ice-border flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5 text-ice-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-ice-text-dim mb-1">
                Invoice folder
              </div>
              <div className="text-sm font-medium truncate">
                {folderPath ?? 'No folder selected'}
              </div>
            </div>
          </div>
          <button onClick={pickFolder} className="ice-button shrink-0">
            {folderPath ? 'Change' : 'Browse'}
          </button>
        </div>

        {folderPath && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
            className="mt-5 pt-5 border-t border-ice-border flex items-center gap-2 text-sm text-ice-text-muted"
          >
            <FileText className="w-4 h-4" />
            <span>
              {fileCount} {fileCount === 1 ? 'file' : 'files'} ready to process
            </span>
          </motion.div>
        )}
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="flex justify-end"
      >
        <button
          disabled={!folderPath || fileCount === 0}
          className="ice-button-primary flex items-center gap-2 px-6 py-3"
        >
          <Play className="w-4 h-4" />
          <span>Start processing</span>
        </button>
      </motion.div>
    </div>
  );
}
