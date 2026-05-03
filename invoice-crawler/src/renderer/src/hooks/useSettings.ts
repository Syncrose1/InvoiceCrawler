import { useCallback, useEffect, useState } from 'react';
import type { AppSettings } from '@shared/types';
import { ipcInvoke } from './useIpc';

export interface SettingsState {
  settings: AppSettings | null;
  hasApiKey: boolean;
  loading: boolean;
}

export function useSettings() {
  const [state, setState] = useState<SettingsState>({
    settings: null,
    hasApiKey: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    const [settings, hasApiKey] = await Promise.all([
      ipcInvoke('settings:get'),
      ipcInvoke('settings:has-api-key'),
    ]);
    setState({ settings, hasApiKey, loading: false });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await ipcInvoke('settings:set', patch);
      setState((s) => ({ ...s, settings: next }));
    },
    [],
  );

  const setApiKey = useCallback(
    async (apiKey: string) => {
      const next = await ipcInvoke('settings:set-api-key', apiKey);
      setState((s) => ({ ...s, settings: next, hasApiKey: apiKey.length > 0 }));
    },
    [],
  );

  return { ...state, refresh, update, setApiKey };
}
