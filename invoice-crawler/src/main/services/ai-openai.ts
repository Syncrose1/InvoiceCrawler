import OpenAI from 'openai';
import type { ExtractionField } from '@shared/types';
import type { AiProvider } from './ai-provider';
import {
  SDK_MAX_RETRIES,
  buildJsonSchema,
  buildSystemPrompt,
  normaliseExtractedData,
} from './ai-provider';
import type { EncodedImage } from './image-encoder';

export class OpenAiProvider implements AiProvider {
  private client: OpenAI;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new OpenAI({ apiKey, maxRetries: SDK_MAX_RETRIES });
  }

  async extractInvoiceData(
    images: EncodedImage[],
    fields: ExtractionField[],
    options?: { signal?: AbortSignal },
  ): Promise<Record<string, string>> {
    const systemPrompt = buildSystemPrompt(fields);
    const schema = buildJsonSchema(fields);

    const imageContent = images.map((img) => ({
      type: 'image_url' as const,
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    }));

    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              ...imageContent,
              { type: 'text', text: 'Extract the requested fields from this invoice.' },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'invoice_extraction',
            strict: true,
            schema,
          },
        },
      },
      { signal: options?.signal },
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('OpenAI response contained no message content');

    const parsed = JSON.parse(text) as Record<string, unknown>;
    return normaliseExtractedData(parsed, fields);
  }
}
