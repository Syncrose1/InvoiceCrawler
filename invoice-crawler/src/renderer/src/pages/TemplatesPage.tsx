import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  Copy,
  Sparkles,
  Sliders,
} from 'lucide-react';
import clsx from 'clsx';
import type { ExtractionField, FieldTemplate } from '@shared/types';
import { DEFAULT_FIELDS } from '@shared/constants';
import { useTemplates } from '../hooks/useTemplates';
import { useSettings } from '../hooks/useSettings';

function newField(): ExtractionField {
  const id = `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, name: '', key: '', synonyms: [] };
}

export default function TemplatesPage() {
  const { templates, loading, save, remove, createDefault } = useTemplates();
  const { settings, update: updateSettings } = useSettings();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default selection: the active default template, otherwise the first one.
  useEffect(() => {
    if (selectedId !== null) return;
    if (templates.length === 0) return;
    setSelectedId(settings?.defaultTemplateId ?? templates[0].id);
  }, [templates, settings?.defaultTemplateId, selectedId]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  async function handleCreate() {
    const template = await createDefault();
    setSelectedId(template.id);
    if (settings && !settings.defaultTemplateId) {
      await updateSettings({ defaultTemplateId: template.id });
    }
  }

  async function handleDuplicate(source: FieldTemplate) {
    const copy: FieldTemplate = {
      ...source,
      id: '', // saveTemplate will generate a fresh id
      name: `${source.name} copy`,
      createdAt: '',
      updatedAt: '',
    };
    const saved = await save(copy);
    setSelectedId(saved.id);
  }

  async function handleDelete(template: FieldTemplate) {
    if (!confirm(`Delete the "${template.name}" template? You can't get it back.`)) return;
    await remove(template.id);
    setSelectedId(null);
  }

  async function handleMakeDefault(templateId: string) {
    await updateSettings({ defaultTemplateId: templateId });
  }

  return (
    <div className="px-12 py-10 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Templates</h1>
        <p className="text-ice-text-muted text-sm mb-10">
          Each template is a named set of extraction fields. Make as many as you like — one per
          shape of invoice you regularly process — and pick which one to use for each batch.
        </p>
      </motion.div>

      <div className="grid grid-cols-[260px_1fr] gap-6">
        <motion.aside
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-2"
        >
          {loading && <div className="ice-card p-4 text-sm text-ice-text-dim">Loading…</div>}
          {!loading && templates.length === 0 && (
            <div className="ice-card p-4 text-sm text-ice-text-muted">
              No templates yet — give it a click below to get started.
            </div>
          )}
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedId === template.id}
              isDefault={settings?.defaultTemplateId === template.id}
              onClick={() => setSelectedId(template.id)}
            />
          ))}
          <button
            onClick={handleCreate}
            className="w-full ice-button flex items-center justify-center gap-2 py-3"
          >
            <Plus className="w-4 h-4" />
            <span>New template</span>
          </button>
        </motion.aside>

        <AnimatePresence mode="wait">
          {selected ? (
            <TemplateEditor
              key={selected.id}
              template={selected}
              isDefault={settings?.defaultTemplateId === selected.id}
              onSave={save}
              onDuplicate={() => handleDuplicate(selected)}
              onDelete={() => handleDelete(selected)}
              onMakeDefault={() => handleMakeDefault(selected.id)}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ice-card frost-overlay p-10 text-sm text-ice-text-muted text-center"
            >
              Pick a template on the left to edit, or spin up a new one.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  isDefault,
  onClick,
}: {
  template: FieldTemplate;
  isSelected: boolean;
  isDefault: boolean;
  onClick: () => void;
}) {
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
            <Sliders className="w-3.5 h-3.5 text-ice-text-dim shrink-0" />
            <div className="text-sm font-medium truncate">{template.name}</div>
          </div>
          <div className="text-[11px] text-ice-text-dim">
            {template.fields.length} {template.fields.length === 1 ? 'field' : 'fields'}
          </div>
        </div>
        {isDefault && (
          <span
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-ice-accent/20 text-ice-accent border border-ice-accent/40 shrink-0"
            title="This template is used by default for new batches"
          >
            <Sparkles className="w-2.5 h-2.5" />
            Default
          </span>
        )}
      </div>
    </button>
  );
}

function TemplateEditor({
  template,
  isDefault,
  onSave,
  onDuplicate,
  onDelete,
  onMakeDefault,
}: {
  template: FieldTemplate;
  isDefault: boolean;
  onSave: (template: FieldTemplate) => Promise<FieldTemplate>;
  onDuplicate: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [fields, setFields] = useState<ExtractionField[]>(template.fields);
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const dragSourceIndex = useRef<number | null>(null);

  useEffect(() => {
    setName(template.name);
    setFields(template.fields);
    setDirty(false);
  }, [template.id, template.name, template.fields]);

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
    if (!confirm('Replace the fields with the defaults? Your current fields will be lost.'))
      return;
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
    await onSave({ ...template, name: name.trim() || template.name, fields: cleaned });
    setFields(cleaned);
    setDirty(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Header card with name + actions */}
      <div className="ice-card frost-overlay p-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-ice-text-dim mb-1">
              Template name
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              className="ice-input text-lg font-medium w-full"
              placeholder="e.g. Amazon, UK supplier, Receipts"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isDefault && (
              <button onClick={onMakeDefault} className="ice-button text-sm">
                Use by default
              </button>
            )}
            <button
              onClick={onDuplicate}
              className="p-2 rounded-lg border border-ice-border text-ice-text-muted hover:border-ice-border-glow hover:text-ice-text transition-colors"
              title="Duplicate this template"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg border border-ice-border text-ice-text-muted hover:border-ice-danger hover:text-ice-danger transition-colors"
              title="Delete template"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Fields list */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-ice-text-dim">
          Drag to reorder. Synonyms help the AI recognise fields with different labels on
          different invoices.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={resetToDefaults} className="ice-button text-xs py-1.5">
            Reset to defaults
          </button>
          <button
            onClick={persist}
            disabled={!dirty}
            className="ice-button-primary flex items-center gap-2 text-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savedFlash ? 'Saved ✓' : 'Save template'}</span>
          </button>
        </div>
      </div>

      {fields.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="ice-card frost-overlay p-8 text-center"
        >
          <div className="text-sm text-ice-text-muted mb-1">No fields yet.</div>
          <div className="text-xs text-ice-text-dim">
            Add one below, or hit "Reset to defaults" for the usual suspects (date, total, VAT,
            and friends).
          </div>
        </motion.div>
      )}

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
    </motion.div>
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
