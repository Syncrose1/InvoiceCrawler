import type { AiProviderName, ExtractionField } from './types';

export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const;
export const SUPPORTED_PDF_EXTENSIONS = ['.pdf'] as const;
export const SUPPORTED_FILE_EXTENSIONS = [
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ...SUPPORTED_PDF_EXTENSIONS,
] as const;

export const BATCH_CONCURRENCY = 3;

export const DEFAULT_FIELDS: ExtractionField[] = [
  {
    id: 'field-date',
    name: 'Invoice Date',
    key: 'date',
    synonyms: ['date received', 'billing date', 'issue date'],
    hint: 'Format as DD/MM/YYYY',
  },
  {
    id: 'field-invoice-number',
    name: 'Invoice Number',
    key: 'invoice_number',
    synonyms: ['invoice no', 'invoice #', 'reference'],
  },
  {
    id: 'field-company-name',
    name: 'Company Name',
    key: 'company_name',
    synonyms: ['organisation', 'firm name', 'supplier', 'vendor'],
  },
  {
    id: 'field-total',
    name: 'Total',
    key: 'total',
    synonyms: ['gross total', 'gross amount', 'amount due', 'total amount'],
    hint: 'Numeric value only, no currency symbol',
  },
  {
    id: 'field-vat',
    name: 'VAT',
    key: 'vat',
    synonyms: ['tax', 'tax amount', 'gst'],
    hint: 'Numeric value only, no currency symbol',
  },
];

export const PROVIDER_MODELS: Record<AiProviderName, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (cost-efficient)' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (higher accuracy)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini (cost-efficient)' },
    { id: 'gpt-4o', label: 'GPT-4o (higher accuracy)' },
  ],
};

export const PROVIDER_LABELS: Record<AiProviderName, string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI',
};

export const MISSING_VALUE = '-';
