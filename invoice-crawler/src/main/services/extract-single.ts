import { extname } from 'path';
import { basename } from 'path';
import type { FirmProfile, InvoiceResult } from '@shared/types';
import { SUPPORTED_PDF_EXTENSIONS } from '@shared/constants';
import { encodeImageFile } from './image-encoder';
import { convertPdfToImages } from './pdf-converter';
import { createAiProvider } from './ai-provider';
import type { EncodedImage } from './image-encoder';

export async function extractInvoice(
  filePath: string,
  profile: FirmProfile,
  apiKey: string,
  signal?: AbortSignal,
): Promise<InvoiceResult> {
  const fileName = basename(filePath);
  const baseResult: InvoiceResult = {
    fileName,
    filePath,
    status: 'processing',
    data: {},
  };

  try {
    const images = await loadImages(filePath);
    const provider = createAiProvider(profile.aiProvider, apiKey, profile.aiModel);
    const data = await provider.extractInvoiceData(images, profile.fields, { signal });
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
