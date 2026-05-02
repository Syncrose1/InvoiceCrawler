import { pdf } from 'pdf-to-img';
import type { EncodedImage } from './image-encoder';

export async function convertPdfToImages(pdfPath: string): Promise<EncodedImage[]> {
  const document = await pdf(pdfPath, { scale: 2.0 });
  const images: EncodedImage[] = [];
  for await (const page of document) {
    images.push({ base64: page.toString('base64'), mimeType: 'image/png' });
  }
  return images;
}
