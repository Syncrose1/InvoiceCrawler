import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  Building2,
  FolderOpen,
  Check,
  X,
  Trash2,
  ChevronRight,
  Pause,
  History,
} from 'lucide-react';
import clsx from 'clsx';
import type { RunSummary } from '@shared/types';
import { basenameOf } from '@shared/utils';
import { useHistoryList } from '../hooks/useHistory';
import { formatRelativeDate } from '../utils/date';

export default function HistoryPage() {
  const { runs, loading, remove } = useHistoryList();
  const navigate = useNavigate();

  const grouped = useMemo(() => groupByMonth(runs), [runs]);

  async function handleDelete(run: RunSummary) {
    const label = `${formatRelativeDate(run.createdAt)} (${run.templateName})`;
    if (!confirm(`Delete this run from ${label}? You can't get it back.`)) return;
    await remove(run.id);
  }

  return (
    <div className="px-12 py-10 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Run history</h1>
        <p className="text-ice-text-muted text-sm mb-10">
          Every batch you've crawled, kept tidy. Click any run to look back through the data,
          tweak a value, or pop it into a fresh CSV.
        </p>
      </motion.div>

      {loading && (
        <div className="ice-card p-6 text-sm text-ice-text-dim">Reading the books…</div>
      )}

      {!loading && runs.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="ice-card frost-overlay p-10 text-center"
        >
          <History className="w-10 h-10 text-ice-text-dim mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-1">No runs yet.</h2>
          <p className="text-sm text-ice-text-muted mb-6">
            Once you process your first batch, it'll show up here so you never lose it.
          </p>
          <button onClick={() => navigate('/')} className="ice-button-primary">
            Run your first batch
          </button>
        </motion.div>
      )}

      {!loading && runs.length > 0 && (
        <div className="space-y-8">
          <AnimatePresence initial={false}>
            {grouped.map(({ label, runs: monthRuns }) => (
              <motion.section
                key={label}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-[10px] uppercase tracking-wider text-ice-text-dim mb-3 px-1">
                  {label}
                </div>
                <div className="space-y-2">
                  {monthRuns.map((run) => (
                    <RunCard key={run.id} run={run} onDelete={() => handleDelete(run)} />
                  ))}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function RunCard({ run, onDelete }: { run: RunSummary; onDelete: () => void }) {
  const folderName = basenameOf(run.folderPath);

  return (
    <motion.div
      layout
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="group relative"
    >
      <Link
        to={`/results/${run.id}`}
        className={clsx(
          'block ice-card frost-overlay p-4 pr-14',
          'transition-all duration-200 hover:border-ice-border-glow hover:shadow-glow-sm',
        )}
      >
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-ice-bg border border-ice-border flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-ice-accent" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{formatRelativeDate(run.createdAt)}</span>
              {run.completion === 'cancelled' && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-ice-text-dim/15 text-ice-text-dim border border-ice-text-dim/30">
                  <Pause className="w-2.5 h-2.5" />
                  Cancelled
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-ice-text-muted min-w-0">
              <span className="inline-flex items-center gap-1.5 shrink-0">
                <Building2 className="w-3 h-3" />
                {run.templateName}
              </span>
              <span className="inline-flex items-center gap-1.5 truncate">
                <FolderOpen className="w-3 h-3 shrink-0" />
                <span className="truncate" title={run.folderPath}>
                  {folderName}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            <CountPill icon={<Check className="w-3 h-3" />} value={run.successCount} className="text-ice-success" />
            {run.errorCount > 0 && (
              <CountPill icon={<X className="w-3 h-3" />} value={run.errorCount} className="text-ice-danger" />
            )}
            <span className="text-ice-text-dim tabular-nums">
              {run.fileCount} {run.fileCount === 1 ? 'file' : 'files'}
            </span>
          </div>

          <ChevronRight className="w-4 h-4 text-ice-text-dim shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className={clsx(
          'absolute top-2 right-2 p-1.5 rounded-md',
          'opacity-0 group-hover:opacity-100 transition-all duration-150',
          'text-ice-text-dim hover:text-ice-danger hover:bg-ice-danger/10 border border-transparent hover:border-ice-danger/30',
        )}
        title="Delete this run"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

function CountPill({
  icon,
  value,
  className,
}: {
  icon: React.ReactNode;
  value: number;
  className?: string;
}) {
  return (
    <span className={clsx('inline-flex items-center gap-1 tabular-nums', className)}>
      {icon}
      <span>{value}</span>
    </span>
  );
}

function groupByMonth(runs: RunSummary[]): { label: string; runs: RunSummary[] }[] {
  const groups = new Map<string, RunSummary[]>();
  for (const run of runs) {
    const date = new Date(run.createdAt);
    const label = date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const existing = groups.get(label) ?? [];
    existing.push(run);
    groups.set(label, existing);
  }
  // Insertion order is the input order (newest-first), which is what we want.
  return Array.from(groups.entries()).map(([label, list]) => ({ label, runs: list }));
}

