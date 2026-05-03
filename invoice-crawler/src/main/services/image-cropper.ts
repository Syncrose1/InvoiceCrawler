import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import type { EncodedImage, SupportedImageMime } from './image-encoder';

interface CropOptions {
  /** Pixel padding around the detected content. Avoids clipping stamps/signatures. */
  marginPx?: number;
  /**
   * Per-channel difference vs the background colour above which a pixel is
   * considered "content". Higher = stricter (less aggressive crop).
   */
  threshold?: number;
}

interface RawImage {
  width: number;
  height: number;
  data: Buffer; // RGBA, length = width * height * 4
}

/**
 * Crop the negative space surrounding an invoice's actual content.
 *
 * Vision LLMs read invoice images at full resolution but the *useful signal*
 * is often a small region in the centre of the page — a 2400x3300 PDF page
 * with a 600x900 invoice floating in white. Trimming the dead space before
 * sending the image makes the text larger relative to the model's input
 * tokens, which directly improves extraction accuracy and reduces hallucination.
 *
 * Pure-JS implementation. We previously used sharp/libvips, but on Arch the
 * statically-linked glib in sharp's prebuilt libvips clashes with the system
 * glib that Electron loads — sharp's maintainer confirmed this is structurally
 * unfixable on Arch+Electron. Pure JS is a tiny bit slower (~5-10x) but takes
 * milliseconds per page and removes the entire native-deps failure class.
 *
 * Falls back to the original image if:
 *   - Decoding fails
 *   - Trim yields nothing useful (blank page)
 *   - Trim is essentially the whole page (already tight, not worth re-encoding)
 */
export async function cropToContent(
  input: EncodedImage,
  options: CropOptions = {},
): Promise<EncodedImage> {
  const margin = options.marginPx ?? 24;
  const threshold = options.threshold ?? 16;

  try {
    const buffer = Buffer.from(input.base64, 'base64');
    const raw = decode(buffer, input.mimeType);
    if (!raw) return input;

    const bbox = findContentBoundingBox(raw, threshold);
    if (!bbox) return input;

    // Bail if the bbox is essentially the whole image — re-encoding for a
    // 5% saving costs more in latency than it saves in tokens.
    const areaRatio = ((bbox.right - bbox.left) * (bbox.bottom - bbox.top)) / (raw.width * raw.height);
    if (areaRatio > 0.92) return input;

    // Expand by margin, clamped to image bounds.
    const left = Math.max(0, bbox.left - margin);
    const top = Math.max(0, bbox.top - margin);
    const right = Math.min(raw.width, bbox.right + margin);
    const bottom = Math.min(raw.height, bbox.bottom + margin);

    const cropped = extractRegion(raw, left, top, right - left, bottom - top);
    const encoded = encodePng(cropped);

    return {
      base64: encoded.toString('base64'),
      mimeType: 'image/png',
    };
  } catch {
    return input;
  }
}

function decode(buffer: Buffer, mimeType: SupportedImageMime): RawImage | null {
  if (mimeType === 'image/png') {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  }
  if (mimeType === 'image/jpeg') {
    const decoded = jpeg.decode(buffer, { useTArray: false });
    return {
      width: decoded.width,
      height: decoded.height,
      data: Buffer.from(decoded.data),
    };
  }
  // webp etc — skip cropping; the LLM gets the original.
  return null;
}

function encodePng(image: RawImage): Buffer {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = image.data;
  return PNG.sync.write(png);
}

interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Sample the four corners to detect the background colour, then sweep the
 * image to find the tightest bounding box of pixels that differ by more
 * than `threshold` in any RGB channel.
 *
 * Returns null if no content pixels are found (blank page).
 */
function findContentBoundingBox(image: RawImage, threshold: number): BoundingBox | null {
  const { width, height, data } = image;

  // Average the four corners to be robust to scanner noise.
  const corners = [
    pixel(data, width, 0, 0),
    pixel(data, width, width - 1, 0),
    pixel(data, width, 0, height - 1),
    pixel(data, width, width - 1, height - 1),
  ];
  const bgR = Math.round(corners.reduce((s, c) => s + c[0], 0) / 4);
  const bgG = Math.round(corners.reduce((s, c) => s + c[1], 0) / 4);
  const bgB = Math.round(corners.reduce((s, c) => s + c[2], 0) / 4);

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  // Single linear sweep — O(width * height), one pass, RGBA-stride aware.
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = rowOffset + x * 4;
      const dr = Math.abs(data[i] - bgR);
      const dg = Math.abs(data[i + 1] - bgG);
      const db = Math.abs(data[i + 2] - bgB);
      // Max channel diff (Chebyshev) — sharper edges than mean.
      if (dr > threshold || dg > threshold || db > threshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (right < 0 || bottom < 0) return null;
  return { left, top, right: right + 1, bottom: bottom + 1 };
}

function pixel(data: Buffer, width: number, x: number, y: number): [number, number, number] {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}

function extractRegion(
  source: RawImage,
  left: number,
  top: number,
  width: number,
  height: number,
): RawImage {
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcStart = ((top + y) * source.width + left) * 4;
    const dstStart = y * width * 4;
    source.data.copy(out, dstStart, srcStart, srcStart + width * 4);
  }
  return { width, height, data: out };
}
