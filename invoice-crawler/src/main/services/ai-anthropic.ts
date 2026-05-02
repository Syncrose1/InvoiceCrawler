import Anthropic from '@anthropic-ai/sdk';
import type { ExtractionField } from '@shared/types';
import type { AiProvider } from './ai-provider';
import { buildJsonSchema, buildSystemPrompt, normaliseExtractedData } from './ai-provider';
import type { EncodedImage } from './image-encoder';
import { withRetry } from './retry';

const TOOL_NAME = 'record_invoice_fields';

export class AnthropicProvider implements AiProvider {
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey });
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

    const response = await withRetry(
      () =>
        this.client.messages.create(
          {
            model: this.model,
            max_tokens: 1024,
            system: systemPrompt,
            tools: [
              {
                name: TOOL_NAME,
                description: 'Record the structured invoice fields extracted from the image.',
                input_schema: schema as Anthropic.Tool.InputSchema,
              },
            ],
            tool_choice: { type: 'tool', name: TOOL_NAME },
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
        ),
      { signal: options?.signal },
    );

    const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      throw new Error('Anthropic response did not include a tool_use block');
    }

    return normaliseExtractedData(toolUseBlock.input as Record<string, unknown>, fields);
  }
}
