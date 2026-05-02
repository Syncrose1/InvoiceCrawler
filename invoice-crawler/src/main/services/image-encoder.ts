import { promises as fs } from 'fs';
import { extname } from 'path';

export type SupportedImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export interface EncodedImage {
  base64: string;
  mimeType: SupportedImageMime;
}

export async function encodeImageFile(filePath: string): Promise<EncodedImage> {
  const buffer = await fs.readFile(filePath);
  return {
    base64: buffer.toString('base64'),
    mimeType: mimeTypeForExtension(extname(filePath).toLowerCase()),
  };
}

export function encodeImageBuffer(
  buffer: Buffer,
  mimeType: SupportedImageMime = 'image/png',
): EncodedImage {
  return { base64: buffer.toString('base64'), mimeType };
}

function mimeTypeForExtension(ext: string): SupportedImageMime {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.png':
    default:
      return 'image/png';
  }
}
