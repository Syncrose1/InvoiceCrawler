import { contextBridge, ipcRenderer } from 'electron';
import type { IpcEventMap, IpcInvokeMap } from '@shared/types';

const api = {
  invoke: <C extends keyof IpcInvokeMap>(
    channel: C,
    ...args: IpcInvokeMap[C]['args']
  ): Promise<IpcInvokeMap[C]['return']> => {
    return ipcRenderer.invoke(channel, ...args);
  },
  on: <C extends keyof IpcEventMap>(
    channel: C,
    listener: (payload: IpcEventMap[C]) => void,
  ): (() => void) => {
    const wrapped = (_event: unknown, payload: IpcEventMap[C]) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.off(channel, wrapped);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
