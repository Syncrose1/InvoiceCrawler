import { useCallback, useEffect, useState } from 'react';
import type { FirmProfile } from '@shared/types';
import { ipcInvoke } from './useIpc';

export interface ProfilesState {
  profiles: FirmProfile[];
  activeProfileId: string | null;
  loading: boolean;
}

export function useProfiles() {
  const [state, setState] = useState<ProfilesState>({
    profiles: [],
    activeProfileId: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    const [profiles, settings] = await Promise.all([
      ipcInvoke('profiles:list'),
      ipcInvoke('settings:get'),
    ]);
    setState({
      profiles,
      activeProfileId: settings.activeProfileId,
      loading: false,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActive = useCallback(
    async (profileId: string | null) => {
      const next = await ipcInvoke('settings:set', { activeProfileId: profileId });
      setState((s) => ({ ...s, activeProfileId: next.activeProfileId }));
    },
    [],
  );

  const save = useCallback(
    async (profile: FirmProfile) => {
      const saved = await ipcInvoke('profiles:save', profile);
      await refresh();
      return saved;
    },
    [refresh],
  );

  const remove = useCallback(
    async (profileId: string) => {
      await ipcInvoke('profiles:delete', profileId);
      if (state.activeProfileId === profileId) {
        await ipcInvoke('settings:set', { activeProfileId: null });
      }
      await refresh();
    },
    [refresh, state.activeProfileId],
  );

  const createDefault = useCallback(async () => {
    const profile = await ipcInvoke('profiles:create-default');
    await refresh();
    return profile;
  }, [refresh]);

  const setApiKey = useCallback(
    async (profileId: string, apiKey: string) => {
      await ipcInvoke('profiles:set-api-key', profileId, apiKey);
      await refresh();
    },
    [refresh],
  );

  const activeProfile =
    state.profiles.find((p) => p.id === state.activeProfileId) ?? null;

  return {
    ...state,
    activeProfile,
    refresh,
    setActive,
    save,
    remove,
    createDefault,
    setApiKey,
  };
}
