export type AiProviderName = 'anthropic' | 'openai';

export interface ExtractionField {
  id: string;
  name: string;
  key: string;
  synonyms: string[];
  hint?: string;
}

export interface FirmProfile {
  id: string;
  name: string;
  fields: ExtractionField[];
  aiProvider: AiProviderName;
  aiModel: string;
  apiKeyEncrypted: string;
  /**
   * Auto-crop negative space around invoice content before sending to the
   * vision API. Improves accuracy on scans/PDFs where the invoice is small
   * relative to the page. Defaults to true; disable only if you see
   * unexpected clipping.
   */
  autoCrop?: boolean;
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

export interface AppSettings {
  activeProfileId: string | null;
  lastFolderPath: string | null;
}

/**
 * A persisted record of a single batch run. Profile and fields are
 * snapshotted (without the API key) so historical runs survive the live
 * profile being edited or deleted later.
 */
export interface RunRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  folderPath: string;
  profile: {
    id: string;
    name: string;
    aiProvider: AiProviderName;
    aiModel: string;
    fields: ExtractionField[];
  };
  results: InvoiceResult[];
  /** 'cancelled' if the user stopped mid-batch; 'complete' otherwise. */
  completion: 'complete' | 'cancelled';
}

export interface RunSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  folderPath: string;
  profileName: string;
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
  'profiles:list': { args: []; return: FirmProfile[] };
  'profiles:save': { args: [profile: FirmProfile]; return: FirmProfile };
  'profiles:delete': { args: [profileId: string]; return: void };
  'profiles:create-default': { args: []; return: FirmProfile };
  'profiles:set-api-key': { args: [profileId: string, apiKey: string]; return: FirmProfile };
  'settings:get': { args: []; return: AppSettings };
  'settings:set': { args: [patch: Partial<AppSettings>]; return: AppSettings };
  'update:download': { args: []; return: void };
  'update:install': { args: []; return: void };
  'history:list': { args: []; return: RunSummary[] };
  'history:get': { args: [runId: string]; return: RunRecord | null };
  'history:save': { args: [run: RunRecord]; return: RunRecord };
  'history:delete': { args: [runId: string]; return: void };
  'batch:start': { args: [filePaths: string[], profileId: string]; return: void };
  'batch:cancel': { args: []; return: void };
  'export:csv': {
    args: [results: InvoiceResult[], fields: ExtractionField[], outputPath: string];
    return: void;
  };
  'reprocess:single': {
    args: [filePath: string, profileId: string];
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
