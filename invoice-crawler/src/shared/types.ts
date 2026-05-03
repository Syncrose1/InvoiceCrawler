export type AiProviderName = 'anthropic' | 'openai';

export interface ExtractionField {
  id: string;
  name: string;
  key: string;
  synonyms: string[];
  hint?: string;
}

/**
 * A named, switchable set of extraction fields. Many of these can exist —
 * one per shape of invoice you regularly process (Amazon, UK supplier,
 * international vendor, etc). The user picks an active default, and can
 * override per batch if needed.
 */
export interface FieldTemplate {
  id: string;
  name: string;
  fields: ExtractionField[];
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'pending' | 'processing' | 'success' | 'error';

export interface InvoiceResult {
  fileName: string;
  filePath: string;
  status: InvoiceStatus;
  data: Record<string, string>;
  error?: string;
}

export interface BatchProgress {
  total: number;
  completed: number;
  currentFile: string;
  results: InvoiceResult[];
}

export interface FolderScanResult {
  folderPath: string;
  files: string[];
}

/**
 * Machine-wide configuration. The AI provider, model, and API key are
 * shared across every extraction this machine ever runs — credentials
 * don't change just because you're processing a different shape of
 * invoice. Set once in Settings.
 */
export interface AppSettings {
  aiProvider: AiProviderName;
  aiModel: string;
  apiKeyEncrypted: string;
  /**
   * Auto-crop negative space around invoice content before sending to the
   * vision API. Improves accuracy on scans/PDFs where the invoice is small
   * relative to the page. Defaults to true; disable only if you see
   * unexpected clipping.
   */
  autoCrop: boolean;
  /** Default field template applied when no per-batch override is given. */
  defaultTemplateId: string | null;
  /** Last folder picked, used to pre-fill the picker on startup. */
  lastFolderPath: string | null;
}

/**
 * A persisted record of a single batch run. The template (name + fields)
 * and the AI provider/model are snapshotted inline so historical runs
 * survive both the live template being edited or deleted and the user
 * switching providers later. Never includes the API key.
 */
export interface RunRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  folderPath: string;
  template: {
    id: string;
    name: string;
    fields: ExtractionField[];
  };
  aiProvider: AiProviderName;
  aiModel: string;
  results: InvoiceResult[];
  /** 'cancelled' if the user stopped mid-batch; 'complete' otherwise. */
  completion: 'complete' | 'cancelled';
}

export interface RunSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  folderPath: string;
  templateName: string;
  fileCount: number;
  successCount: number;
  errorCount: number;
  completion: 'complete' | 'cancelled';
}

export type UpdateStatus =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; percent: number }
  | { phase: 'ready'; version: string }
  | { phase: 'error'; message: string };

export interface IpcInvokeMap {
  'dialog:select-folder': { args: []; return: string | null };
  'dialog:select-save-path': { args: [defaultName: string]; return: string | null };
  'fs:scan-folder': { args: [folderPath: string]; return: FolderScanResult };

  'templates:list': { args: []; return: FieldTemplate[] };
  'templates:save': { args: [template: FieldTemplate]; return: FieldTemplate };
  'templates:delete': { args: [templateId: string]; return: void };
  'templates:create-default': { args: []; return: FieldTemplate };

  'settings:get': { args: []; return: AppSettings };
  'settings:set': { args: [patch: Partial<AppSettings>]; return: AppSettings };
  'settings:set-api-key': { args: [apiKey: string]; return: AppSettings };
  /** True if the API key is set and decryptable, without exposing it. */
  'settings:has-api-key': { args: []; return: boolean };

  'update:download': { args: []; return: void };
  'update:install': { args: []; return: void };

  'history:list': { args: []; return: RunSummary[] };
  'history:get': { args: [runId: string]; return: RunRecord | null };
  'history:save': { args: [run: RunRecord]; return: RunRecord };
  'history:delete': { args: [runId: string]; return: void };

  'batch:start': { args: [filePaths: string[], templateId: string]; return: void };
  'batch:cancel': { args: []; return: void };

  'export:csv': {
    args: [results: InvoiceResult[], fields: ExtractionField[], outputPath: string];
    return: void;
  };
  'reprocess:single': {
    args: [filePath: string, templateId: string];
    return: InvoiceResult;
  };
}

export type IpcEventMap = {
  'batch:progress': BatchProgress;
  'batch:complete': InvoiceResult[];
  'batch:error': string;
  'update:status': UpdateStatus;
};

export type IpcChannel = keyof IpcInvokeMap;
export type IpcEventChannel = keyof IpcEventMap;
