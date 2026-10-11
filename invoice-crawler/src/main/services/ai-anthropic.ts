import Anthropic from '@anthropic-ai/sdk';
import type { ExtractionField } from '@shared/types';
import type { AiProvider } from './ai-provider';
import {
  SDK_MAX_RETRIES,
  buildJsonSchema,
  buildSystemPrompt,
  normaliseExtractedData,
} from './ai-provider';
import type { EncodedImage } from './image-encoder';

export class AnthropicProvider implements AiProvider {
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: SDK_MAX_RETRIES });
  }

  async extractInvoiceData(
    images: EncodedImage[],
    fields: ExtractionField[],
    options?: { signal?: AbortSignal },
  ): Promise<Record<string, string>> {
    const systemPrompt = buildSystemPrompt(fields);
    const schema = buildJsonSchema(fields);

    const imageBlocks = images.map((img) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: img.mimeType,
        data: img.base64,
      },
    }));

    const response = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        output_config: {
          format: { type: 'json_schema', schema: schema as { [key: string]: unknown } },
        },
        messages: [
          {
            role: 'user',
            content: [
              ...imageBlocks,
              { type: 'text', text: 'Extract the requested fields from this invoice.' },
            ],
          },
        ],
      },
      { signal: options?.signal },
    );

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Anthropic response contained no text block');
    }

    const parsed = JSON.parse(textBlock.text) as Record<string, unknown>;
    return normaliseExtractedData(parsed, fields);
  }
}
