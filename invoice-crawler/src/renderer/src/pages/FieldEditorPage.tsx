import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, GripVertical, AlertCircle, Save } from 'lucide-react';
import clsx from 'clsx';
import type { ExtractionField, FirmProfile } from '@shared/types';
import { DEFAULT_FIELDS } from '@shared/constants';
import { useProfiles } from '../hooks/useProfiles';

function newField(): ExtractionField {
  const id = `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, name: '', key: '', synonyms: [] };
}

export default function FieldEditorPage() {
  const { activeProfile, save, loading } = useProfiles();

  if (loading) {
    return (
      <div className="px-12 py-10 max-w-5xl mx-auto">
        <div className="ice-card p-6 text-sm text-ice-text-dim">Loading…</div>
      </div>
    );
  }

  if (!activeProfile) {
    return <NoProfile />;
  }

  return <FieldEditor profile={activeProfile} onSave={save} />;
}

function NoProfile() {
  return (
    <div className="px-12 py-10 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight mb-1">Extraction fields</h1>
      <p className="text-ice-text-muted text-sm mb-10">
        Pick an active profile in Settings first, then come back to choose what to extract.
      </p>
      <div className="ice-card frost-overlay p-10 text-center">
        <AlertCircle className="w-8 h-8 text-ice-text-dim mx-auto mb-3" />
        <div className="text-sm text-ice-text-muted">No active profile selected.</div>
      </div>
    </div>
  );
}

function FieldEditor({
  profile,
  onSave,
}: {
  profile: FirmProfile;
  onSave: (profile: FirmProfile) => Promise<FirmProfile>;
}) {
  const [fields, setFields] = useState<ExtractionField[]>(profile.fields);
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const dragSourceIndex = useRef<number | null>(null);

  useEffect(() => {
    setFields(profile.fields);
    setDirty(false);
  }, [profile.id, profile.fields]);

  function update(index: number, patch: Partial<ExtractionField>) {
    setFields((current) => current.map((f, i) => (i === index ? { ...f, ...patch } : f)));
    setDirty(true);
  }

  function add() {
    setFields((current) => [...current, newField()]);
    setDirty(true);
  }

  function remove(index: number) {
    setFields((current) => current.filter((_, i) => i !== index));
    setDirty(true);
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    setFields((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDirty(true);
  }

  function resetToDefaults() {
    if (!confirm('Replace all fields with the defaults? Your current fields will be lost.')) return;
    setFields(DEFAULT_FIELDS);
    setDirty(true);
  }

  async function persist() {
    // Strip empty fields and ensure keys are slug-safe.
    const cleaned = fields
      .filter((f) => f.name.trim().length > 0)
      .map((f) => ({
        ...f,
        name: f.name.trim(),
        key: (f.key.trim() || slugify(f.name)).toLowerCase(),
        synonyms: f.synonyms.map((s) => s.trim()).filter((s) => s.length > 0),
        hint: f.hint?.trim() || undefined,
      }));
    await onSave({ ...profile, fields: cleaned });
    setFields(cleaned);
    setDirty(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <div className="px-12 py-10 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="flex items-end justify-between mb-10"
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Extraction fields</h1>
          <p className="text-ice-text-muted text-sm">
            Tell us what to look for in invoices for{' '}
            <span className="text-ice-text font-medium">{profile.name}</span>. Grab and drag to
            reorder.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={resetToDefaults} className="ice-button text-sm">
            Reset to defaults
          </button>
          <button
            onClick={persist}
            disabled={!dirty}
            className="ice-button-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{savedFlash ? 'Saved ✓' : 'Save fields'}</span>
          </button>
        </div>
      </motion.div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {fields.map((field, index) => (
            <motion.div
              key={field.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              draggable
              onDragStart={() => {
                dragSourceIndex.current = index;
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragSourceIndex.current;
                if (from === null) return;
                reorder(from, index);
                dragSourceIndex.current = null;
              }}
              className="ice-card frost-overlay p-5 hover:border-ice-border-glow transition-colors"
            >
              <FieldRow
                field={field}
                onChange={(patch) => update(index, patch)}
                onRemove={() => remove(index)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        <button
          onClick={add}
          className="w-full ice-button flex items-center justify-center gap-2 py-3"
        >
          <Plus className="w-4 h-4" />
          <span>Add field</span>
        </button>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: ExtractionField;
  onChange: (patch: Partial<ExtractionField>) => void;
  onRemove: () => void;
}) {
  const [synonymInput, setSynonymInput] = useState('');

  function addSynonym() {
    const v = synonymInput.trim();
    if (!v) return;
    if (field.synonyms.includes(v)) {
      setSynonymInput('');
      return;
    }
    onChange({ synonyms: [...field.synonyms, v] });
    setSynonymInput('');
  }

  function removeSynonym(i: number) {
    onChange({ synonyms: field.synonyms.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="flex gap-4">
      <div className="pt-2 cursor-grab text-ice-text-dim hover:text-ice-text-muted">
        <GripVertical className="w-5 h-5" />
      </div>

      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ice-text-dim mb-1">
              Field name
            </div>
            <input
              type="text"
              value={field.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Invoice Date"
              className="ice-input w-full text-sm"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ice-text-dim mb-1">
              CSV column key
            </div>
            <input
              type="text"
              value={field.key}
              onChange={(e) => onChange({ key: e.target.value })}
              placeholder="auto from name"
              className="ice-input w-full text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-ice-text-dim mb-1">
            Synonyms (alternative names the AI should look for)
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {field.synonyms.map((syn, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-ice-bg border border-ice-border text-xs"
              >
                <span>{syn}</span>
                <button
                  onClick={() => removeSynonym(i)}
                  className="text-ice-text-dim hover:text-ice-danger"
                  aria-label={`Remove synonym ${syn}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={synonymInput}
            onChange={(e) => setSynonymInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addSynonym();
              }
            }}
            onBlur={addSynonym}
            placeholder="Add a synonym (Enter to confirm)"
            className="ice-input w-full text-sm"
          />
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-ice-text-dim mb-1">
            Formatting hint (optional)
          </div>
          <input
            type="text"
            value={field.hint ?? ''}
            onChange={(e) => onChange({ hint: e.target.value })}
            placeholder="Format as DD/MM/YYYY, numeric only, etc."
            className="ice-input w-full text-sm"
          />
        </div>
      </div>

      <button
        onClick={onRemove}
        className={clsx(
          'self-start mt-1 p-2 rounded-lg border border-ice-border text-ice-text-muted',
          'hover:border-ice-danger hover:text-ice-danger transition-colors',
        )}
        title="Remove field"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
