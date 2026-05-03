import { basename, extname } from 'path';
import type { AiProviderName, FieldTemplate, InvoiceResult } from '@shared/types';
import { SUPPORTED_PDF_EXTENSIONS } from '@shared/constants';
import { encodeImageFile } from './image-encoder';
import { convertPdfToImages } from './pdf-converter';
import { createAiProvider } from './ai-provider';
import { cropToContent } from './image-cropper';
import type { EncodedImage } from './image-encoder';

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
