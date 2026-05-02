import { useEffect, useState } from 'react';
import type { BatchProgress, InvoiceResult } from '@shared/types';
import { ipcInvoke } from './useIpc';

type BatchPhase = 'idle' | 'running' | 'complete' | 'error' | 'cancelled';

export interface BatchState {
  phase: BatchPhase;
  progress: BatchProgress | null;
  results: InvoiceResult[] | null;
  error: string | null;
}

const initialState: BatchState = {
  phase: 'idle',
  progress: null,
  results: null,
  error: null,
};

// Module-scope state so progress survives page navigation between
// HomePage → ProcessingPage → ResultsPage. Subscribers re-render via the hook.
let state: BatchState = initialState;
const subscribers = new Set<(s: BatchState) => void>();

function set(next: BatchState): void {
  state = next;
  for (const sub of subscribers) sub(state);
}

let listenersWired = false;
function wireListenersOnce(): void {
  if (listenersWired) return;
  listenersWired = true;
  window.api.on('batch:progress', (progress) => {
    set({
      phase: 'running',
      progress,
      results: null,
      error: null,
    });
  });
  window.api.on('batch:complete', (results) => {
    set({
      phase: 'complete',
      progress: state.progress
        ? { ...state.progress, completed: results.length, results }
        : null,
      results,
      error: null,
    });
  });
  window.api.on('batch:error', (error) => {
    set({
      phase: state.phase === 'running' ? 'error' : state.phase,
      progress: state.progress,
      results: state.results,
      error,
    });
  });
}

export function useBatch(): BatchState {
  const [snapshot, setSnapshot] = useState<BatchState>(state);
  useEffect(() => {
    wireListenersOnce();
    subscribers.add(setSnapshot);
    setSnapshot(state);
    return () => {
      subscribers.delete(setSnapshot);
    };
  }, []);
  return snapshot;
}

export async function startBatch(filePaths: string[], profileId: string): Promise<void> {
  // Pre-seed an optimistic running state so the ProcessingPage doesn't
  // flash "no progress yet" while the first IPC event lands.
  set({
    phase: 'running',
    progress: {
      total: filePaths.length,
      completed: 0,
      currentFile: '',
      results: filePaths.map((filePath) => ({
        fileName: filePath.split(/[\\/]/).pop() ?? filePath,
        filePath,
        status: 'pending',
        data: {},
      })),
    },
    results: null,
    error: null,
  });
  await ipcInvoke('batch:start', filePaths, profileId);
}

export async function cancelBatch(): Promise<void> {
  await ipcInvoke('batch:cancel');
  set({
    phase: 'cancelled',
    progress: state.progress,
    results: state.progress?.results ?? null,
    error: null,
  });
}

export function resetBatch(): void {
  set(initialState);
}
