import type { AiProviderName, ExtractionField } from '@shared/types';
import { MISSING_VALUE } from '@shared/constants';
import type { EncodedImage } from './image-encoder';
import { AnthropicProvider } from './ai-anthropic';
import { OpenAiProvider } from './ai-openai';

/**
 * Retries the SDKs make on 408/409/429/5xx and dropped connections. They back
 * off using the server's `retry-after` and stop as soon as the batch's abort
 * signal fires, so we don't layer a retry loop of our own on top.
 */
export const SDK_MAX_RETRIES = 4;

export interface AiProvider {
  extractInvoiceData(
    images: EncodedImage[],
    fields: ExtractionField[],
    options?: { signal?: AbortSignal },
  ): Promise<Record<string, string>>;
}

export function createAiProvider(
  providerName: AiProviderName,
  apiKey: string,
  model: string,
): AiProvider {
  switch (providerName) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'openai':
      return new OpenAiProvider(apiKey, model);
  }
}

export function buildSystemPrompt(fields: ExtractionField[]): string {
  const fieldDescriptions = fields
    .map((f) => {
      const synonyms = f.synonyms.length > 0 ? ` (also known as: ${f.synonyms.join(', ')})` : '';
      const hint = f.hint ? `. ${f.hint}` : '';
      return `- "${f.key}": ${f.name}${synonyms}${hint}`;
    })
    .join('\n');

  return [
    'You extract structured data from invoice images. Invoices may be in any language.',
    'Read the image carefully and extract the requested fields.',
    `If a field is not present or you cannot determine it confidently, use "${MISSING_VALUE}" as the value.`,
    'Return values exactly as they appear on the invoice unless a formatting hint says otherwise.',
    'For multi-page invoices, all pages are provided as separate images of the same invoice.',
    '',
    'Fields to extract:',
    fieldDescriptions,
  ].join('\n');
}

export function buildJsonSchema(fields: ExtractionField[]): Record<string, unknown> {
  const properties: Record<string, { type: string; description: string }> = {};
  for (const field of fields) {
    properties[field.key] = {
      type: 'string',
      description: field.hint ? `${field.name}. ${field.hint}` : field.name,
    };
  }
  return {
    type: 'object',
    properties,
    required: fields.map((f) => f.key),
    additionalProperties: false,
  };
}

export function normaliseExtractedData(
  data: Record<string, unknown>,
  fields: ExtractionField[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const raw = data[field.key];
    if (raw === undefined || raw === null || raw === '') {
      result[field.key] = MISSING_VALUE;
    } else {
      result[field.key] = String(raw).trim();
    }
  }
  return result;
}
