import { basename } from 'path';
import { setMaxListeners } from 'events';
import type { BatchProgress, FirmProfile, InvoiceResult } from '@shared/types';
import { BATCH_CONCURRENCY } from '@shared/constants';
import { extractInvoice } from './extract-single';

interface BatchOptions {
  filePaths: string[];
  profile: FirmProfile;
  apiKey: string;
  onProgress: (progress: BatchProgress) => void;
}

export class BatchProcessor {
  private abortController: AbortController | null = null;
  private running = false;

  isRunning(): boolean {
    return this.running;
  }

  cancel(): void {
    this.abortController?.abort();
  }

  async run(options: BatchOptions): Promise<InvoiceResult[]> {
    if (this.running) throw new Error('A batch is already running');
    this.running = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    // Node defaults to 10 listeners per EventTarget. Each in-flight worker
    // adds at least 2 (one inside the AI SDK's fetch, one in our retry
    // sleep), so concurrency=3 already grazes the limit and triggers a
    // MaxListenersExceededWarning. Raise the cap explicitly with comfortable
    // headroom for SDK internals and any future bump in concurrency.
    setMaxListeners(BATCH_CONCURRENCY * 4 + 10, signal);

    const { filePaths, profile, apiKey, onProgress } = options;
    const total = filePaths.length;

    // Seed all results as pending so the renderer can render the full list immediately.
    const results: InvoiceResult[] = filePaths.map((filePath) => ({
      fileName: basename(filePath),
      filePath,
      status: 'pending',
      data: {},
    }));

    let completed = 0;
    let cursor = 0;
    const concurrency = Math.max(1, Math.min(BATCH_CONCURRENCY, total));

    const emit = (currentFile: string) => {
      onProgress({
        total,
        completed,
        currentFile,
        // Snapshot the array so renderer holds an immutable copy.
        results: results.map((r) => ({ ...r })),
      });
    };

    const worker = async (): Promise<void> => {
      while (!signal.aborted) {
        const index = cursor++;
        if (index >= total) return;

        results[index] = { ...results[index], status: 'processing' };
        emit(results[index].fileName);

        const result = await extractInvoice(filePaths[index], profile, apiKey, signal);
        results[index] = result;

        completed += 1;
        emit(result.fileName);
      }
    };

    try {
      const workers = Array.from({ length: concurrency }, () => worker());
      await Promise.all(workers);
    } finally {
      this.running = false;
      this.abortController = null;
    }

    return results;
  }
}
