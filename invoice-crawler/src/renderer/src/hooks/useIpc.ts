import { useEffect } from 'react';
import type { IpcEventMap, IpcInvokeMap } from '@shared/types';

export function ipcInvoke<C extends keyof IpcInvokeMap>(
  channel: C,
  ...args: IpcInvokeMap[C]['args']
): Promise<IpcInvokeMap[C]['return']> {
  return window.api.invoke(channel, ...args);
}

export function useIpcEvent<C extends keyof IpcEventMap>(
  channel: C,
  listener: (payload: IpcEventMap[C]) => void,
): void {
  useEffect(() => {
    const off = window.api.on(channel, listener);
    return off;
  }, [channel, listener]);
}
