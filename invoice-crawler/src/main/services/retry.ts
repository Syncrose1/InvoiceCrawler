interface RetryOptions {
  maxRetries?: number;
  signal?: AbortSignal;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 2, signal } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new Error('Aborted');

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (attempt === maxRetries) throw error;
      if (!isRetryable(error)) throw error;

      const delayMs = computeDelay(error, attempt);
      await sleep(delayMs, signal);
    }
  }

  throw lastError;
}

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: number }).status;
  if (status === undefined) return false;
  return status === 429 || (status >= 500 && status < 600);
}

function computeDelay(error: unknown, attempt: number): number {
  const headers = (error as { headers?: Record<string, string> }).headers;
  const retryAfter = headers?.['retry-after'];
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return Math.min(1000 * 2 ** attempt + Math.random() * 250, 16000);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Aborted'));
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new Error('Aborted'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort);
  });
}
