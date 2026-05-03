import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Check } from 'lucide-react';
import clsx from 'clsx';
import type { AiProviderName } from '@shared/types';
import { PROVIDER_LABELS, PROVIDER_MODELS } from '@shared/constants';
import { useSettings } from '../hooks/useSettings';

export default function SettingsPage() {
  const { settings, hasApiKey, loading, update, setApiKey } = useSettings();

  if (loading || !settings) {
    return (
      <div className="px-12 py-10 max-w-3xl mx-auto">
        <div className="ice-card p-6 text-sm text-ice-text-dim">Just a moment…</div>
      </div>
    );
  }

  return <SettingsForm settings={settings} hasApiKey={hasApiKey} update={update} setApiKey={setApiKey} />;
}

function SettingsForm({
  settings,
  hasApiKey,
  update,
  setApiKey,
}: {
  settings: NonNullable<ReturnType<typeof useSettings>['settings']>;
  hasApiKey: boolean;
  update: ReturnType<typeof useSettings>['update'];
  setApiKey: ReturnType<typeof useSettings>['setApiKey'];
}) {
  const [provider, setProvider] = useState<AiProviderName>(settings.aiProvider);
  const [model, setModel] = useState(settings.aiModel);
  const [autoCrop, setAutoCrop] = useState(settings.autoCrop);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [keySavedFlash, setKeySavedFlash] = useState(false);

  // Snap model to first option for the chosen provider whenever it changes.
  useEffect(() => {
    if (!PROVIDER_MODELS[provider].some((m) => m.id === model)) {
      setModel(PROVIDER_MODELS[provider][0].id);
    }
  }, [provider, model]);

  async function handleSave() {
    await update({ aiProvider: provider, aiModel: model, autoCrop });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  async function handleSaveKey() {
    if (!apiKeyInput.trim()) return;
    await setApiKey(apiKeyInput.trim());
    setApiKeyInput('');
    setKeySavedFlash(true);
    setTimeout(() => setKeySavedFlash(false), 1500);
  }

  return (
    <div className="px-12 py-10 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Settings</h1>
        <p className="text-ice-text-muted text-sm mb-10">
          Your AI provider and key for this machine. Field templates live over in Templates.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="ice-card frost-overlay p-7 space-y-6"
      >
        {/* Provider + model */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-ice-text-dim mb-2">
              AI provider
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PROVIDER_LABELS) as AiProviderName[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={clsx(
                    'px-3 py-2 rounded-lg border text-sm transition-all duration-150',
                    provider === p
                      ? 'bg-ice-accent-soft border-ice-accent text-ice-text shadow-glow-sm'
                      : 'bg-ice-surface border-ice-border text-ice-text-muted hover:border-ice-border-glow',
                  )}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-ice-text-dim mb-2">Model</div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="ice-input w-full"
            >
              {PROVIDER_MODELS[provider].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* API key */}
        <div>
          <div className="text-xs uppercase tracking-wider text-ice-text-dim mb-2 flex items-center gap-2">
            <KeyRound className="w-3 h-3" />
            <span>API key</span>
            {hasApiKey && (
              <span className="text-[10px] text-ice-success ml-auto normal-case tracking-normal">
                ✓ Stored encrypted
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={hasApiKey ? 'Enter a new key to replace…' : 'sk-ant-… or sk-…'}
              className="ice-input flex-1 font-mono text-sm"
            />
            <button
              onClick={handleSaveKey}
              disabled={!apiKeyInput.trim()}
              className="ice-button-primary"
            >
              {keySavedFlash ? 'Saved ✓' : 'Save key'}
            </button>
          </div>
          <p className="text-[11px] text-ice-text-dim mt-2">
            Tucked safely in your OS keychain via Electron's safeStorage. We never send it
            anywhere except the AI provider you've chosen.
          </p>
        </div>

        {/* Auto-crop toggle */}
        <div>
          <div className="text-xs uppercase tracking-wider text-ice-text-dim mb-2">
            Image preprocessing
          </div>
          <button
            type="button"
            onClick={() => setAutoCrop((v) => !v)}
            className={clsx(
              'group w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all duration-150',
              autoCrop
                ? 'bg-ice-accent-soft/50 border-ice-accent/40'
                : 'bg-ice-surface border-ice-border hover:border-ice-border-glow',
            )}
          >
            <div
              className={clsx(
                'mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                autoCrop
                  ? 'bg-ice-accent border-ice-accent text-ice-bg'
                  : 'border-ice-border bg-ice-bg group-hover:border-ice-text-dim',
              )}
            >
              {autoCrop && (
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Trim negative space before reading</div>
              <div className="text-[11px] text-ice-text-dim mt-0.5 leading-relaxed">
                Crops dead space around the actual invoice content so the AI sees larger, more
                legible text. Recommended on. Turn off only if you spot unexpected clipping.
              </div>
            </div>
          </button>
        </div>

        <div className="pt-4 border-t border-ice-border flex justify-end items-center gap-3">
          {savedFlash && (
            <span className="text-xs text-ice-success inline-flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Settings saved</span>
            </span>
          )}
          <button onClick={handleSave} className="ice-button-primary">
            Save settings
          </button>
        </div>
      </motion.div>
    </div>
  );
}
