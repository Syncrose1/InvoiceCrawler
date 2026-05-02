import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, KeyRound, Check, AlertCircle, Building2 } from 'lucide-react';
import clsx from 'clsx';
import type { AiProviderName, FirmProfile } from '@shared/types';
import { PROVIDER_LABELS, PROVIDER_MODELS } from '@shared/constants';
import { useProfiles } from '../hooks/useProfiles';

export default function SettingsPage() {
  const { profiles, activeProfileId, loading, setActive, createDefault, remove, save, setApiKey } =
    useProfiles();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId === null && profiles.length > 0) {
      setSelectedId(activeProfileId ?? profiles[0].id);
    }
  }, [profiles, activeProfileId, selectedId]);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  async function handleCreate() {
    const profile = await createDefault();
    setSelectedId(profile.id);
    if (!activeProfileId) await setActive(profile.id);
  }

  async function handleDelete(profileId: string) {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    if (!confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) return;
    await remove(profileId);
    if (selectedId === profileId) setSelectedId(null);
  }

  return (
    <div className="px-12 py-10 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Your firms</h1>
        <p className="text-ice-text-muted text-sm mb-10">
          One profile per firm. Each saves its own AI provider, model, API key, and the fields
          you want pulled from invoices.
        </p>
      </motion.div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        <motion.aside
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-2"
        >
          {loading && (
            <div className="ice-card p-4 text-sm text-ice-text-dim">Loading profiles…</div>
          )}
          {!loading && profiles.length === 0 && (
            <div className="ice-card p-4 text-sm text-ice-text-muted">
              No profiles yet — give it a click below to create your first one.
            </div>
          )}
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isSelected={selectedId === profile.id}
              isActive={activeProfileId === profile.id}
              onClick={() => setSelectedId(profile.id)}
            />
          ))}
          <button
            onClick={handleCreate}
            className="w-full ice-button flex items-center justify-center gap-2 py-3"
          >
            <Plus className="w-4 h-4" />
            <span>New profile</span>
          </button>
        </motion.aside>

        <AnimatePresence mode="wait">
          {selected ? (
            <ProfileEditor
              key={selected.id}
              profile={selected}
              isActive={activeProfileId === selected.id}
              onSave={save}
              onDelete={() => handleDelete(selected.id)}
              onMakeActive={() => setActive(selected.id)}
              onSetApiKey={(key) => setApiKey(selected.id, key)}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ice-card frost-overlay p-10 text-sm text-ice-text-muted text-center"
            >
              Pick a profile on the left to edit, or spin up a new one.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  isSelected,
  isActive,
  onClick,
}: {
  profile: FirmProfile;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const hasKey = profile.apiKeyEncrypted.length > 0;
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left p-3 rounded-lg border transition-all duration-150',
        isSelected
          ? 'bg-ice-accent-soft border-ice-accent/60 shadow-glow-sm'
          : 'bg-ice-surface/40 border-ice-border hover:border-ice-border-glow hover:bg-ice-surface',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <Building2 className="w-3.5 h-3.5 text-ice-text-dim shrink-0" />
            <div className="text-sm font-medium truncate">{profile.name}</div>
          </div>
          <div className="text-[11px] text-ice-text-dim truncate">
            {PROVIDER_LABELS[profile.aiProvider]}
          </div>
        </div>
        {isActive && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-ice-accent/20 text-ice-accent border border-ice-accent/40 shrink-0">
            Active
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px]">
        {hasKey ? (
          <>
            <Check className="w-3 h-3 text-ice-success" />
            <span className="text-ice-text-dim">API key set</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-3 h-3 text-ice-danger" />
            <span className="text-ice-danger">No API key</span>
          </>
        )}
      </div>
    </button>
  );
}

function ProfileEditor({
  profile,
  isActive,
  onSave,
  onDelete,
  onMakeActive,
  onSetApiKey,
}: {
  profile: FirmProfile;
  isActive: boolean;
  onSave: (profile: FirmProfile) => Promise<FirmProfile>;
  onDelete: () => void;
  onMakeActive: () => void;
  onSetApiKey: (key: string) => Promise<void>;
}) {
  const [name, setName] = useState(profile.name);
  const [provider, setProvider] = useState<AiProviderName>(profile.aiProvider);
  const [model, setModel] = useState(profile.aiModel);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [keySavedFlash, setKeySavedFlash] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setProvider(profile.aiProvider);
    setModel(profile.aiModel);
    setApiKeyInput('');
  }, [profile.id, profile.name, profile.aiProvider, profile.aiModel]);

  // When provider changes, snap model to first option for that provider.
  useEffect(() => {
    if (!PROVIDER_MODELS[provider].some((m) => m.id === model)) {
      setModel(PROVIDER_MODELS[provider][0].id);
    }
  }, [provider, model]);

  async function handleSave() {
    await onSave({ ...profile, name: name.trim() || profile.name, aiProvider: provider, aiModel: model });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  async function handleSaveKey() {
    if (!apiKeyInput.trim()) return;
    await onSetApiKey(apiKeyInput.trim());
    setApiKeyInput('');
    setKeySavedFlash(true);
    setTimeout(() => setKeySavedFlash(false), 1500);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="ice-card frost-overlay p-7 space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-ice-text-dim mb-1">Profile name</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ice-input text-lg font-medium w-80"
            placeholder="Smith & Co Accountants"
          />
        </div>
        <div className="flex items-center gap-2">
          {!isActive && (
            <button onClick={onMakeActive} className="ice-button text-sm">
              Make active
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-2 rounded-lg border border-ice-border text-ice-text-muted hover:border-ice-danger hover:text-ice-danger transition-colors"
            title="Delete profile"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-ice-text-dim mb-2">AI Provider</div>
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

      <div>
        <div className="text-xs uppercase tracking-wider text-ice-text-dim mb-2 flex items-center gap-2">
          <KeyRound className="w-3 h-3" />
          API key
          {profile.apiKeyEncrypted && (
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
            placeholder={profile.apiKeyEncrypted ? 'Enter a new key to replace…' : 'sk-ant-… or sk-…'}
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
          Tucked safely in your OS keychain via Electron's safeStorage. We never send it anywhere
          except the AI provider you've chosen.
        </p>
      </div>

      <div className="pt-4 border-t border-ice-border flex justify-end">
        <button onClick={handleSave} className="ice-button-primary">
          {savedFlash ? 'Saved ✓' : 'Save profile'}
        </button>
      </div>
    </motion.div>
  );
}
