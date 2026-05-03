import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Play, FileText, Building2, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ipcInvoke } from '../hooks/useIpc';
import { useProfiles } from '../hooks/useProfiles';
import { startBatch } from '../hooks/useBatch';

export default function HomePage() {
  const { activeProfile, profiles, setActive, loading } = useProfiles();
  const navigate = useNavigate();
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Hydrate from settings on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await ipcInvoke('settings:get');
      if (cancelled || !settings.lastFolderPath) return;
      try {
        const result = await ipcInvoke('fs:scan-folder', settings.lastFolderPath);
        if (cancelled) return;
        setFolderPath(result.folderPath);
        setFileCount(result.files.length);
      } catch {
        // Folder may have been deleted/moved — silently drop the stale path.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function pickFolder() {
    const path = await ipcInvoke('dialog:select-folder');
    if (!path) return;
    setScanError(null);
    try {
      const result = await ipcInvoke('fs:scan-folder', path);
      setFolderPath(result.folderPath);
      setFileCount(result.files.length);
      await ipcInvoke('settings:set', { lastFolderPath: result.folderPath });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    }
  }

  const hasApiKey = (activeProfile?.apiKeyEncrypted.length ?? 0) > 0;
  const canStart = !!activeProfile && hasApiKey && fileCount > 0 && !starting;

  async function handleStart() {
    if (!activeProfile || !folderPath) return;
    setStarting(true);
    try {
      const scan = await ipcInvoke('fs:scan-folder', folderPath);
      if (scan.files.length === 0) {
        setScanError('No supported files found in this folder.');
        return;
      }
      await startBatch(scan.files, activeProfile, folderPath);
      navigate('/processing');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="px-12 py-10 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Welcome back <span className="text-ice-accent">·</span>
        </h1>
        <p className="text-ice-text-muted text-sm mb-10">
          Point us at a folder of invoices and we'll extract the bits you care about.
          PDFs, scans, photos — whatever you've got.
        </p>
      </motion.div>

      {/* Active profile section */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="ice-card frost-overlay p-5 mb-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-ice-bg border border-ice-border flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-ice-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-ice-text-dim mb-0.5">
                Active profile
              </div>
              {loading ? (
                <div className="text-sm text-ice-text-dim">Loading…</div>
              ) : activeProfile ? (
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium truncate">{activeProfile.name}</div>
                  {!hasApiKey && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-ice-danger">
                      <AlertCircle className="w-3 h-3" />
                      missing API key
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-ice-text-muted">No active profile</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {profiles.length > 1 && (
              <select
                value={activeProfile?.id ?? ''}
                onChange={(e) => setActive(e.target.value || null)}
                className="ice-input text-sm py-1.5"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <Link to="/settings" className="ice-button text-sm flex items-center gap-2">
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>{profiles.length === 0 ? 'Create profile' : 'Manage'}</span>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Folder picker */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.12 }}
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

        <AnimatePresence>
          {folderPath && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-5 pt-5 border-t border-ice-border flex items-center gap-2 text-sm text-ice-text-muted"
            >
              <FileText className="w-4 h-4" />
              <span>
                {fileCount} {fileCount === 1 ? 'file' : 'files'} ready to process
              </span>
            </motion.div>
          )}
          {scanError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 text-sm text-ice-danger flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              <span>{scanError}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.16 }}
        className="flex items-center justify-between"
      >
        <div className="text-xs text-ice-text-dim">
          {!activeProfile && 'Pop over to Settings to create your first profile.'}
          {activeProfile && !hasApiKey && 'Almost there — just need an API key in Settings.'}
          {activeProfile && hasApiKey && fileCount === 0 && 'Pick a folder containing invoices.'}
          {canStart &&
            `${fileCount} ${fileCount === 1 ? 'invoice' : 'invoices'} ready when you are.`}
        </div>
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={clsx(
            'ice-button-primary flex items-center gap-2 px-6 py-3',
            canStart && 'animate-pulse-glow',
          )}
        >
          <Play className="w-4 h-4" />
          <span>{starting ? 'Starting…' : 'Start processing'}</span>
        </button>
      </motion.div>
    </div>
  );
}
