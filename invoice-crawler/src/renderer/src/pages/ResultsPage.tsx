import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Download,
  RefreshCw,
  Check,
  X,
  Loader2,
  FileSpreadsheet,
  Sparkles,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';
import type { ExtractionField, InvoiceResult } from '@shared/types';
import { DEFAULT_OUTPUT_FILENAME } from '@shared/constants';
import { ipcInvoke } from '../hooks/useIpc';
import { reprocessSingle, updateResult as updateLiveResult, useBatch } from '../hooks/useBatch';
import { useHistoryRun } from '../hooks/useHistory';
import { formatFullDate } from '../utils/date';

interface ResultsSourceTemplate {
  id: string;
  name: string;
  fields: ExtractionField[];
}

interface ResultsSource {
  results: InvoiceResult[];
  template: ResultsSourceTemplate;
  /** Live = the in-flight or just-finished batch; History = a saved past run. */
  mode: 'live' | 'history';
  /** Editing strategy differs by mode (live mutates state, history saves to disk). */
  onEdit: (filePath: string, patch: Partial<InvoiceResult>) => void | Promise<void>;
  /** Reprocess is only available in live mode (history runs are immutable to the AI). */
  canReprocess: boolean;
  /** Header subtitle line — different copy for live vs historical runs. */
  contextLine?: string;
}

export default function ResultsPage() {
  const params = useParams<{ runId?: string }>();
  const runId = params.runId;
  const isHistoryMode = !!runId;

  if (isHistoryMode) {
    return <HistoryResults runId={runId} />;
  }
  return <LiveResults />;
}

function LiveResults() {
  const batch = useBatch();
  const navigate = useNavigate();

  const results = batch.results ?? batch.progress?.results ?? [];

  // No batch in flight or completed — send the user back to start a fresh one.
  useEffect(() => {
    if (batch.phase === 'idle') navigate('/', { replace: true });
  }, [batch.phase, navigate]);

  // The run's template snapshot travels with the batch state, so results
  // render even if saving the run to history failed.
  const template = batch.template;

  if (results.length === 0 || !template) {
    return <EmptyState />;
  }

  const source: ResultsSource = {
    results,
    template,
    mode: 'live',
    onEdit: (filePath, patch) => updateLiveResult(filePath, patch),
    canReprocess: true,
  };

  return <ResultsView source={source} />;
}

function HistoryResults({ runId }: { runId: string }) {
  const { record, loading, notFound, updateResult } = useHistoryRun(runId);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-ice-text-dim animate-spin" />
      </div>
    );
  }

  if (notFound || !record) {
    return (
      <div className="h-full flex items-center justify-center px-12">
        <div className="ice-card frost-overlay p-10 text-center max-w-md">
          <FileSpreadsheet className="w-10 h-10 text-ice-text-dim mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-1">That run's not here.</h2>
          <p className="text-sm text-ice-text-muted mb-6">
            It may have been deleted, or the link's gone stale.
          </p>
          <button onClick={() => navigate('/history')} className="ice-button-primary">
            Back to history
          </button>
        </div>
      </div>
    );
  }

  const source: ResultsSource = {
    results: record.results,
    template: {
      id: record.template.id,
      name: record.template.name,
      fields: record.template.fields,
    },
    mode: 'history',
    onEdit: updateResult,
    canReprocess: false,
    contextLine: `${formatFullDate(record.createdAt)} · ${record.template.name}`,
  };

  return <ResultsView source={source} />;
}

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="h-full flex items-center justify-center px-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="ice-card frost-overlay p-10 text-center max-w-md"
      >
        <FileSpreadsheet className="w-10 h-10 text-ice-text-dim mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-1">Nothing here yet</h2>
        <p className="text-sm text-ice-text-muted mb-6">
          Pop back home and run a batch — we'll have your data ready in a tick.
        </p>
        <button onClick={() => navigate('/')} className="ice-button-primary">
          Back to home
        </button>
      </motion.div>
    </div>
  );
}

function ResultsView({ source }: { source: ResultsSource }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportedFlash, setExportedFlash] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { results, template, mode, onEdit, canReprocess, contextLine } = source;
  const fields = template.fields;

  const counts = useMemo(() => countByStatus(results), [results]);
  const successful = counts.success;
  const failed = counts.error;

  async function handleExport() {
    setExportError(null);
    setExporting(true);
    try {
      const path = await ipcInvoke('dialog:select-save-path', DEFAULT_OUTPUT_FILENAME);
      if (!path) return;
      await ipcInvoke('export:csv', results, fields, path);
      setExportedFlash(path.split(/[\\/]/).pop() ?? path);
      setTimeout(() => setExportedFlash(null), 4000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  async function handleRetry(filePath: string) {
    if (!canReprocess) return;
    try {
      await reprocessSingle(filePath, template.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateLiveResult(filePath, { status: 'error', error: message });
    }
  }

  function handleCellEdit(filePath: string, key: string, value: string) {
    const target = results.find((r) => r.filePath === filePath);
    if (!target) return;
    void onEdit(filePath, { data: { ...target.data, [key]: value } });
  }

  const subtitle =
    contextLine ??
    "Have a read through, fix anything that needs a tweak, then pop it into a CSV. Any edits you make here will land in the export.";

  return (
    <div className="h-full flex flex-col px-12 py-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mb-6"
      >
        <div className="flex items-end justify-between gap-6 mb-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              {mode === 'history' ? (
                <Clock className="w-5 h-5 text-ice-accent" />
              ) : (
                <Sparkles className="w-5 h-5 text-ice-accent" />
              )}
              <span>{mode === 'history' ? 'Past run' : 'Results'}</span>
            </h1>
            <p className="text-sm text-ice-text-muted mt-1 flex items-center gap-2">
              <span className="truncate">{subtitle}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(mode === 'history' ? '/history' : '/')}
              className="ice-button"
            >
              {mode === 'history' ? 'Back to history' : 'New batch'}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="ice-button-primary flex items-center gap-2 px-5"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting…' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Stat label="Total" value={results.length} />
          <Stat label="Success" value={successful} className="text-ice-success" />
          {failed > 0 && <Stat label="Failed" value={failed} className="text-ice-danger" />}
        </div>
        {exportedFlash && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 inline-flex items-center gap-2 text-sm text-ice-success bg-ice-success/10 border border-ice-success/30 rounded-lg px-3 py-2"
          >
            <Check className="w-4 h-4" />
            <span>
              Exported to <span className="font-medium">{exportedFlash}</span> — all yours.
            </span>
          </motion.div>
        )}
        {exportError && (
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-ice-danger bg-ice-danger/10 border border-ice-danger/30 rounded-lg px-3 py-2">
            <X className="w-4 h-4" />
            <span>{exportError}</span>
          </div>
        )}
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="ice-card frost-overlay flex-1 min-h-0 overflow-hidden flex flex-col"
      >
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-ice-surface/95 backdrop-blur-ice">
              <tr>
                <Th className="w-10">{''}</Th>
                <Th className="min-w-[200px]">File</Th>
                {fields.map((f) => (
                  <Th key={f.key} className="min-w-[140px]">
                    {f.name}
                  </Th>
                ))}
                <Th className="w-20 text-right">{''}</Th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, i) => (
                <ResultRow
                  key={result.filePath}
                  result={result}
                  fields={fields}
                  zebra={i % 2 === 1}
                  canRetry={canReprocess}
                  onCellEdit={handleCellEdit}
                  onRetry={() => handleRetry(result.filePath)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function ResultRow({
  result,
  fields,
  zebra,
  canRetry,
  onCellEdit,
  onRetry,
}: {
  result: InvoiceResult;
  fields: ExtractionField[];
  zebra: boolean;
  canRetry: boolean;
  onCellEdit: (filePath: string, key: string, value: string) => void;
  onRetry: () => void;
}) {
  return (
    <motion.tr
      layout
      className={clsx(
        'group transition-colors hover:bg-ice-accent-soft/40',
        zebra ? 'bg-ice-surface/30' : 'bg-transparent',
        result.status === 'error' && 'bg-ice-danger/5',
      )}
    >
      <Td className="text-center">
        <StatusIcon result={result} />
      </Td>
      <Td className="text-ice-text-muted truncate max-w-[260px]" title={result.filePath}>
        {result.fileName}
      </Td>
      {fields.map((f) => (
        <EditableCell
          key={f.key}
          value={result.data[f.key] ?? ''}
          onChange={(v) => onCellEdit(result.filePath, f.key, v)}
          disabled={result.status === 'processing'}
        />
      ))}
      <Td className="text-right">
        {canRetry && (result.status === 'error' || result.status === 'success') && (
          <button
            onClick={onRetry}
            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-ice-text-muted hover:text-ice-accent hover:bg-ice-accent-soft border border-transparent hover:border-ice-accent/30"
            title="Re-run extraction for this file"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
      </Td>
    </motion.tr>
  );
}

function EditableCell({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  return (
    <Td className="p-0">
      <input
        type="text"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (draft !== value) onChange(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={clsx(
          'w-full px-3 py-2 bg-transparent text-sm text-ice-text outline-none',
          'border border-transparent rounded',
          'focus:border-ice-accent focus:bg-ice-bg/60 focus:shadow-glow-sm',
          'disabled:opacity-50',
        )}
      />
    </Td>
  );
}

function StatusIcon({ result }: { result: InvoiceResult }) {
  switch (result.status) {
    case 'success':
      return <Check className="w-4 h-4 text-ice-success inline-block" />;
    case 'error':
      return (
        <span title={result.error}>
          <X className="w-4 h-4 text-ice-danger inline-block" />
        </span>
      );
    case 'processing':
      return <Loader2 className="w-4 h-4 text-ice-accent animate-spin inline-block" />;
    case 'pending':
    default:
      return <div className="w-3 h-3 rounded-full border border-ice-border inline-block" />;
  }
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={clsx('font-medium tabular-nums', className)}>{value}</span>
      <span className="text-ice-text-dim">{label}</span>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={clsx(
        'text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-ice-text-dim',
        'border-b border-ice-border font-medium',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td
      className={clsx('border-b border-ice-border/30 px-3 py-1.5 align-middle', className)}
      title={title}
    >
      {children}
    </td>
  );
}

function countByStatus(results: InvoiceResult[]): {
  success: number;
  error: number;
  pending: number;
  processing: number;
} {
  const acc = { success: 0, error: 0, pending: 0, processing: 0 };
  for (const r of results) acc[r.status] += 1;
  return acc;
}

