import { useCallback, useEffect, useState } from 'react';
import type { FieldTemplate } from '@shared/types';
import { ipcInvoke } from './useIpc';

export interface TemplatesState {
  templates: FieldTemplate[];
  loading: boolean;
}

export function useTemplates() {
  const [state, setState] = useState<TemplatesState>({
    templates: [],
    loading: true,
  });

  const refresh = useCallback(async () => {
    const templates = await ipcInvoke('templates:list');
    setState({ templates, loading: false });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (template: FieldTemplate) => {
      const saved = await ipcInvoke('templates:save', template);
      await refresh();
      return saved;
    },
    [refresh],
  );

  const remove = useCallback(
    async (templateId: string) => {
      await ipcInvoke('templates:delete', templateId);
      await refresh();
    },
    [refresh],
  );

  const createDefault = useCallback(async () => {
    const template = await ipcInvoke('templates:create-default');
    await refresh();
    return template;
  }, [refresh]);

  return { ...state, refresh, save, remove, createDefault };
}
