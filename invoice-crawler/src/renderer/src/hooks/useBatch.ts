import { useEffect, useState } from 'react';
import type { BatchProgress, FirmProfile, InvoiceResult, RunRecord } from '@shared/types';
import { ipcInvoke } from './useIpc';

type BatchPhase = 'idle' | 'running' | 'complete' | 'error' | 'cancelled';

export interface BatchState {
  phase: BatchPhase;
  progress: BatchProgress | null;
  results: InvoiceResult[] | null;
  error: string | null;
  runId: string | null;
}

interface RunContext {
  runId: string;
  createdAt: string;
  folderPath: string;
  profileSnapshot: RunRecord['profile'];
}

const initialState: BatchState = {
  phase: 'idle',
  progress: null,
  results: null,
  error: null,
  runId: null,
};

// Module-scope state so progress survives page navigation between
// HomePage → ProcessingPage → ResultsPage. Subscribers re-render via the hook.
let state: BatchState = initialState;
let context: RunContext | null = null;
const subscribers = new Set<(s: BatchState) => void>();

function set(next: BatchState): void {
  state = next;
  for (const sub of subscribers) sub(state);
}

function buildRecord(
  ctx: RunContext,
  results: InvoiceResult[],
  completion: 'complete' | 'cancelled',
): RunRecord {
  return {
    id: ctx.runId,
    createdAt: ctx.createdAt,
    updatedAt: new Date().toISOString(),
    folderPath: ctx.folderPath,
    profile: ctx.profileSnapshot,
    results,
    completion,
  };
}

async function persistRun(
  results: InvoiceResult[],
  completion: 'complete' | 'cancelled',
): Promise<void> {
  if (!context) return;
  try {
    await ipcInvoke('history:save', buildRecord(context, results, completion));
  } catch (error) {
    // Don't surface to the user — they still have the live results in
    // front of them and a failed save shouldn't block the UI flow.
    console.error('Failed to save run to history:', error);
  }
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
      runId: context?.runId ?? null,
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
      runId: context?.runId ?? null,
    });
    void persistRun(results, 'complete');
  });
  window.api.on('batch:error', (error) => {
    set({
      ...state,
      phase: state.phase === 'running' ? 'error' : state.phase,
      error,
    });
  });
}

export async function startBatch(
  filePaths: string[],
  profile: FirmProfile,
  folderPath: string,
): Promise<void> {
  context = {
    runId: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    folderPath,
    profileSnapshot: {
      id: profile.id,
      name: profile.name,
      aiProvider: profile.aiProvider,
      aiModel: profile.aiModel,
      fields: profile.fields,
    },
  };

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
    runId: context.runId,
  });
  await ipcInvoke('batch:start', filePaths, profile.id);
}

export async function cancelBatch(): Promise<void> {
  await ipcInvoke('batch:cancel');
  const results = state.progress?.results ?? null;
  set({
    ...state,
    phase: 'cancelled',
    results,
  });
  // Persist the partial results so the user can find them later.
  if (results && results.some((r) => r.status === 'success' || r.status === 'error')) {
    void persistRun(results, 'cancelled');
  }
}

export function resetBatch(): void {
  context = null;
  set(initialState);
}

export function updateResult(filePath: string, patch: Partial<InvoiceResult>): void {
  if (!state.results && !state.progress) return;
  const apply = (results: InvoiceResult[]): InvoiceResult[] =>
    results.map((r) => (r.filePath === filePath ? { ...r, ...patch } : r));
  const nextResults = state.results ? apply(state.results) : null;
  const nextProgress = state.progress
    ? { ...state.progress, results: apply(state.progress.results) }
    : null;
  set({ ...state, results: nextResults, progress: nextProgress });

  // Persist post-hoc edits so they survive in history. Skip transient
  // states (mid-reprocess) so we don't write a snapshot with a row in
  // 'processing' and then immediately overwrite it.
  if (context && nextResults && (state.phase === 'complete' || state.phase === 'cancelled')) {
    const anyTransient = nextResults.some(
      (r) => r.status === 'processing' || r.status === 'pending',
    );
    if (!anyTransient) {
      void persistRun(nextResults, state.phase);
    }
  }
}

export async function reprocessSingle(filePath: string, profileId: string): Promise<InvoiceResult> {
  updateResult(filePath, { status: 'processing', error: undefined });
  const result = await ipcInvoke('reprocess:single', filePath, profileId);
  updateResult(filePath, result);
  return result;
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
