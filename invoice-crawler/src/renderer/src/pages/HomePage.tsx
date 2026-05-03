import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Play,
  FileText,
  AlertCircle,
  Settings as SettingsIcon,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import type { FieldTemplate } from '@shared/types';
import { ipcInvoke } from '../hooks/useIpc';
import { useSettings } from '../hooks/useSettings';
import { useTemplates } from '../hooks/useTemplates';
import { startBatch } from '../hooks/useBatch';

export default function HomePage() {
  const { settings, hasApiKey, loading: settingsLoading } = useSettings();
  const { templates, loading: templatesLoading } = useTemplates();
  const navigate = useNavigate();

  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  /** Per-batch override of the default template (cleared once the batch starts). */
  const [overrideTemplateId, setOverrideTemplateId] = useState<string | null>(null);

  // The template that will actually be used for this batch.
  const effectiveTemplate = useMemo<FieldTemplate | null>(() => {
    if (templates.length === 0) return null;
    const id = overrideTemplateId ?? settings?.defaultTemplateId;
    return templates.find((t) => t.id === id) ?? templates[0];
  }, [templates, settings?.defaultTemplateId, overrideTemplateId]);

  // Hydrate from settings on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await ipcInvoke('settings:get');
      if (cancelled || !s.lastFolderPath) return;
      try {
        const result = await ipcInvoke('fs:scan-folder', s.lastFolderPath);
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

  const noTemplates = !templatesLoading && templates.length === 0;
  const canStart =
    !!effectiveTemplate &&
    hasApiKey &&
    fileCount > 0 &&
    !starting &&
    !!settings;

  async function handleStart() {
    if (!effectiveTemplate || !folderPath || !settings) return;
    setStarting(true);
    try {
      const scan = await ipcInvoke('fs:scan-folder', folderPath);
      if (scan.files.length === 0) {
        setScanError('No supported files found in this folder.');
        return;
      }
      await startBatch({
        filePaths: scan.files,
        template: effectiveTemplate,
        folderPath,
        aiProvider: settings.aiProvider,
        aiModel: settings.aiModel,
      });
      // Clear the per-batch override after the batch starts so the next
      // batch reverts to the default unless the user changes it again.
      setOverrideTemplateId(null);
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
          Point us at a folder of invoices and we'll extract the bits you care about. PDFs,
          scans, photos — whatever you've got.
        </p>
      </motion.div>

      {/* Template picker */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="ice-card frost-overlay p-5 mb-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-ice-bg border border-ice-border flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4 text-ice-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-ice-text-dim mb-0.5">
                Field template
              </div>
              {settingsLoading || templatesLoading ? (
                <div className="text-sm text-ice-text-dim">Loading…</div>
              ) : noTemplates ? (
                <div className="text-sm text-ice-text-muted">No templates yet</div>
              ) : effectiveTemplate ? (
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium truncate">{effectiveTemplate.name}</div>
                  {overrideTemplateId && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-ice-accent/20 text-ice-accent border border-ice-accent/40">
                      One-off
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-ice-text-muted">No template selected</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {templates.length > 1 && (
              <TemplatePicker
                templates={templates}
                value={effectiveTemplate?.id ?? null}
                onChange={(id) => setOverrideTemplateId(id === settings?.defaultTemplateId ? null : id)}
              />
            )}
            <Link to="/templates" className="ice-button text-sm flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5" />
              <span>{noTemplates ? 'Create template' : 'Manage'}</span>
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
          {!hasApiKey && (
            <span>
              Add an API key in{' '}
              <Link to="/settings" className="text-ice-accent hover:underline">
                Settings
              </Link>{' '}
              to begin.
            </span>
          )}
          {hasApiKey && noTemplates && (
            <span>
              Pop over to{' '}
              <Link to="/templates" className="text-ice-accent hover:underline">
                Templates
              </Link>{' '}
              to create your first one.
            </span>
          )}
          {hasApiKey && !noTemplates && fileCount === 0 && 'Pick a folder containing invoices.'}
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

function TemplatePicker({
  templates,
  value,
  onChange,
}: {
  templates: FieldTemplate[];
  value: string | null;
  onChange: (templateId: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="ice-input text-sm py-1.5 pr-8 appearance-none cursor-pointer"
        title="Use a different template for this batch"
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-ice-text-dim absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
