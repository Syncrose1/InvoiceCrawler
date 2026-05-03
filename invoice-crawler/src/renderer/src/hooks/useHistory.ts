import { useCallback, useEffect, useState } from 'react';
import type { InvoiceResult, RunRecord, RunSummary } from '@shared/types';
import { ipcInvoke } from './useIpc';

export function useHistoryList(): {
  runs: RunSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
  remove: (runId: string) => Promise<void>;
} {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ipcInvoke('history:list');
      setRuns(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(
    async (runId: string) => {
      await ipcInvoke('history:delete', runId);
      await refresh();
    },
    [refresh],
  );

  return { runs, loading, refresh, remove };
}

export function useHistoryRun(runId: string | undefined): {
  record: RunRecord | null;
  loading: boolean;
  notFound: boolean;
  updateResult: (filePath: string, patch: Partial<InvoiceResult>) => Promise<void>;
} {
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!runId) {
      setRecord(null);
      setLoading(false);
      setNotFound(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const loaded = await ipcInvoke('history:get', runId);
        if (cancelled) return;
        if (!loaded) {
          setNotFound(true);
          setRecord(null);
        } else {
          setRecord(loaded);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const updateResult = useCallback(
    async (filePath: string, patch: Partial<InvoiceResult>) => {
      if (!record) return;
      if (!record.results.some((r) => r.filePath === filePath)) return;
      const nextResults = record.results.map((r) =>
        r.filePath === filePath ? { ...r, ...patch } : r,
      );
      const nextRecord: RunRecord = { ...record, results: nextResults };
      // Optimistic update for snappy UI; the IPC save is the source of truth.
      setRecord(nextRecord);
      await ipcInvoke('history:save', nextRecord);
    },
    [record],
  );

  return { record, loading, notFound, updateResult };
}
