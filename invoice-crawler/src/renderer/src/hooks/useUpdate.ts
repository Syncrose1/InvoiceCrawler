import { useEffect, useState } from 'react';
import type { UpdateStatus } from '@shared/types';
import { ipcInvoke } from './useIpc';

let status: UpdateStatus = { phase: 'idle' };
const subscribers = new Set<(s: UpdateStatus) => void>();

let listenersWired = false;
function wire(): void {
  if (listenersWired) return;
  listenersWired = true;
  window.api.on('update:status', (next) => {
    status = next;
    for (const sub of subscribers) sub(status);
  });
}

export function useUpdateStatus(): UpdateStatus {
  const [snapshot, setSnapshot] = useState<UpdateStatus>(status);
  useEffect(() => {
    wire();
    subscribers.add(setSnapshot);
    setSnapshot(status);
    return () => {
      subscribers.delete(setSnapshot);
    };
  }, []);
  return snapshot;
}

export async function downloadUpdate(): Promise<void> {
  await ipcInvoke('update:download');
}

export async function installUpdate(): Promise<void> {
  await ipcInvoke('update:install');
}
