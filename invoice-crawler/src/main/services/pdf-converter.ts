import { pdfToPng } from 'pdf-to-png-converter';
import type { EncodedImage } from './image-encoder';

/**
 * Convert each page of a PDF into a PNG buffer.
 *
 * Uses pdf-to-png-converter, which depends on @napi-rs/canvas — a Rust
 * implementation that ships prebuilt binaries for every platform we
 * target (no node-gyp, no Cairo/Pango/GTK install dance, no Python).
 * We previously used pdf-to-img, which pulled in node-canvas and broke
 * Windows packaging because node-canvas needs the GTK runtime + Cairo
 * headers that aren't on GHA's windows-latest runner.
 */
export async function convertPdfToImages(pdfPath: string): Promise<EncodedImage[]> {
  const pages = await pdfToPng(pdfPath, {
    viewportScale: 2.0,
    // We don't want disk writes — we feed the buffers straight to the AI
    // provider and the cropper.
    returnPageContent: true,
  });
  return pages
    .filter((p): p is typeof p & { content: Buffer } => p.content != null)
    .map((p) => ({
      base64: p.content.toString('base64'),
      mimeType: 'image/png',
    }));
}
