import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, X, Loader2, Pause } from 'lucide-react';
import clsx from 'clsx';
import type { InvoiceResult, InvoiceStatus } from '@shared/types';
import { cancelBatch, useBatch } from '../hooks/useBatch';

export default function ProcessingPage() {
  const batch = useBatch();
  const navigate = useNavigate();

  // Auto-navigate to results when complete or cancelled (with results to show).
  useEffect(() => {
    if (batch.phase === 'complete') {
      const t = setTimeout(() => navigate('/results'), 700);
      return () => clearTimeout(t);
    }
    if (batch.phase === 'cancelled' && batch.progress && batch.progress.completed > 0) {
      const t = setTimeout(() => navigate('/results'), 500);
      return () => clearTimeout(t);
    }
  }, [batch.phase, batch.progress, navigate]);

  // If user lands here without a running batch, send them home.
  useEffect(() => {
    if (batch.phase === 'idle') navigate('/', { replace: true });
  }, [batch.phase, navigate]);

  const total = batch.progress?.total ?? 0;
  const completed = batch.progress?.completed ?? 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const currentFile = batch.progress?.currentFile ?? '';
  const results = batch.progress?.results ?? [];

  const counts = useMemo(() => countByStatus(results), [results]);

  return (
    <div className="h-full flex flex-col px-12 py-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mb-8"
      >
        <div className="flex items-baseline justify-between mb-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {batch.phase === 'running' && 'Processing invoices'}
            {batch.phase === 'complete' && 'Processing complete'}
            {batch.phase === 'cancelled' && 'Cancelled'}
            {batch.phase === 'error' && 'Processing failed'}
          </h1>
          <div className="text-sm text-ice-text-muted tabular-nums">
            {completed} / {total}
          </div>
        </div>
        <div className="text-xs text-ice-text-dim h-4 truncate">
          {batch.phase === 'running' && currentFile && `Reading ${currentFile}…`}
          {batch.phase === 'complete' && `${counts.success} succeeded · ${counts.error} failed`}
          {batch.phase === 'cancelled' && 'Batch was cancelled.'}
          {batch.phase === 'error' && (batch.error ?? 'Unknown error')}
        </div>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mb-6"
      >
        <div className="relative h-2 rounded-full bg-ice-surface border border-ice-border overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            className={clsx(
              'absolute inset-y-0 left-0 rounded-full',
              'bg-gradient-to-r from-ice-accent-glow via-ice-accent to-ice-accent',
              batch.phase === 'running' && 'shadow-glow-md',
            )}
          />
          {batch.phase === 'running' && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
              style={{ backgroundSize: '200% 100%' }}
            />
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-ice-text-dim">
          <div>{percent}%</div>
          <div className="flex gap-3">
            <CountBadge label="Done" value={counts.success} className="text-ice-success" />
            <CountBadge label="Failed" value={counts.error} className="text-ice-danger" />
            <CountBadge label="Pending" value={counts.pending} />
          </div>
        </div>
      </motion.div>

      {/* File list */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="ice-card frost-overlay flex-1 min-h-0 overflow-hidden flex flex-col"
      >
        <div className="px-5 py-3 border-b border-ice-border text-[10px] uppercase tracking-wider text-ice-text-dim">
          Files
        </div>
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence initial={false}>
            {results.map((r) => (
              <FileRow key={r.filePath} result={r} />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="mt-6 flex items-center justify-between"
      >
        <div className="text-xs text-ice-text-dim">
          {batch.phase === 'running' && 'Processing in the background. You can cancel anytime.'}
          {batch.phase === 'complete' && 'Heading to results…'}
          {batch.phase === 'cancelled' && 'You can review what completed before cancellation.'}
          {batch.phase === 'error' && 'Something went wrong. Check the message above.'}
        </div>
        <div className="flex gap-2">
          {batch.phase === 'running' && (
            <button
              onClick={() => cancelBatch()}
              className="ice-button flex items-center gap-2 text-ice-danger border-ice-danger/40 hover:border-ice-danger"
            >
              <Pause className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          )}
          {(batch.phase === 'complete' ||
            batch.phase === 'cancelled' ||
            batch.phase === 'error') && (
            <>
              <button onClick={() => navigate('/')} className="ice-button">
                Home
              </button>
              {(batch.phase === 'complete' ||
                (batch.phase === 'cancelled' && completed > 0)) && (
                <button onClick={() => navigate('/results')} className="ice-button-primary">
                  Open results
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function FileRow({ result }: { result: InvoiceResult }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={clsx(
        'flex items-center gap-3 px-5 py-2.5 border-b border-ice-border/40 last:border-b-0 text-sm',
        result.status === 'processing' && 'bg-ice-accent-soft/30',
      )}
    >
      <StatusIcon status={result.status} />
      <span className="flex-1 truncate text-ice-text-muted">{result.fileName}</span>
      {result.status === 'error' && (
        <span className="text-[11px] text-ice-danger truncate max-w-[280px]" title={result.error}>
          {result.error}
        </span>
      )}
    </motion.div>
  );
}

function StatusIcon({ status }: { status: InvoiceStatus }) {
  switch (status) {
    case 'success':
      return <Check className="w-4 h-4 text-ice-success shrink-0" />;
    case 'error':
      return <X className="w-4 h-4 text-ice-danger shrink-0" />;
    case 'processing':
      return <Loader2 className="w-4 h-4 text-ice-accent animate-spin shrink-0" />;
    case 'pending':
    default:
      return <div className="w-4 h-4 rounded-full border border-ice-border shrink-0" />;
  }
}

function CountBadge({
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

function countByStatus(results: InvoiceResult[]): {
  success: number;
  error: number;
  pending: number;
  processing: number;
} {
  const acc = { success: 0, error: 0, pending: 0, processing: 0 };
  for (const r of results) {
    acc[r.status] += 1;
  }
  return acc;
}
