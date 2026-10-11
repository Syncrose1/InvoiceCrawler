import { basename, extname } from 'path';
import type { AiProviderName, FieldTemplate, InvoiceResult } from '@shared/types';
import { SUPPORTED_PDF_EXTENSIONS } from '@shared/constants';
import { encodeImageFile } from './image-encoder';
import { convertPdfToImages } from './pdf-converter';
import { createAiProvider } from './ai-provider';
import { cropToContent } from './image-cropper';
import { fitForVision } from './image-fitter';
import type { EncodedImage } from './image-encoder';

/**
 * Ceiling on the combined base64 payload for one invoice. Anthropic caps a
 * whole request at 32MB, so stop short with a clear message instead of a
 * 413 from the API.
 */
const MAX_REQUEST_BASE64_BYTES = 24_000_000;

export interface ExtractInvoiceOptions {
  filePath: string;
  template: FieldTemplate;
  apiKey: string;
  provider: AiProviderName;
  model: string;
  autoCrop: boolean;
  signal?: AbortSignal;
}

export async function extractInvoice(opts: ExtractInvoiceOptions): Promise<InvoiceResult> {
  const { filePath, template, apiKey, provider, model, autoCrop, signal } = opts;
  const fileName = basename(filePath);
  const baseResult: InvoiceResult = {
    fileName,
    filePath,
    status: 'processing',
    data: {},
  };

  try {
    let images = await loadImages(filePath);
    if (autoCrop) {
      images = await Promise.all(images.map((img) => cropToContent(img)));
    }
    images = await Promise.all(images.map((img) => fitForVision(img)));
    const payloadBytes = images.reduce((sum, img) => sum + img.base64.length, 0);
    if (payloadBytes > MAX_REQUEST_BASE64_BYTES) {
      throw new Error(
        `This file's ${images.length} page(s) are too large to send in one request. ` +
          'Try splitting it into smaller files.',
      );
    }
    const aiProvider = createAiProvider(provider, apiKey, model);
    const data = await aiProvider.extractInvoiceData(images, template.fields, { signal });
    return { ...baseResult, status: 'success', data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...baseResult, status: 'error', error: message };
  }
}

async function loadImages(filePath: string): Promise<EncodedImage[]> {
  const ext = extname(filePath).toLowerCase();
  if ((SUPPORTED_PDF_EXTENSIONS as readonly string[]).includes(ext)) {
    return convertPdfToImages(filePath);
  }
  return [await encodeImageFile(filePath)];
}
