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
