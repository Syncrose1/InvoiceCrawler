import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { EncodedImage } from './image-encoder';

/**
 * Longest edge we send, in pixels. Anthropic downsamples anything past ~1568px
 * anyway and rejects images over 2000px once a request carries more than 20
 * of them; OpenAI's high-detail mode tiles at 2048px. 2000 satisfies both.
 */
const MAX_EDGE_PX = 2000;

/**
 * Per-image byte budget, before base64. Anthropic rejects images over 5MB
 * (measured on the base64 payload), and base64 inflates by 4/3, so 3.5MB of
 * raw bytes leaves comfortable headroom.
 */
const MAX_IMAGE_BYTES = 3_500_000;

/** JPEG qualities tried in order until the image fits the byte budget. */
const JPEG_QUALITIES = [85, 70, 55];

/**
 * Shrink an image to fit the vision APIs' size limits.
 *
 * Phone photos (12MP+, several MB) and auto-cropped JPEGs (re-encoded as PNG
 * by the cropper, which can balloon a 4MB photo past 20MB) were being sent
 * as-is and bounced by the API. Images already within limits pass through
 * untouched. PNG sources stay PNG when they fit, since text edges stay
 * crisper; otherwise we fall back to JPEG.
 */
export async function fitForVision(input: EncodedImage): Promise<EncodedImage> {
  const buffer = Buffer.from(input.base64, 'base64');
  const image = await loadImage(buffer);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(image.width, image.height));
  if (scale === 1 && buffer.length <= MAX_IMAGE_BYTES) return input;

  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  // JPEG has no alpha channel — paint white first so transparent regions in
  // a PNG don't come out black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  if (input.mimeType === 'image/png') {
    const png = await canvas.encode('png');
    if (png.length <= MAX_IMAGE_BYTES) return { base64: png.toString('base64'), mimeType: 'image/png' };
  }
  for (const quality of JPEG_QUALITIES) {
    const jpeg = await canvas.encode('jpeg', quality);
    if (jpeg.length <= MAX_IMAGE_BYTES) return { base64: jpeg.toString('base64'), mimeType: 'image/jpeg' };
  }
  throw new Error(
    `Image is still over ${(MAX_IMAGE_BYTES / 1_000_000).toFixed(1)}MB after resizing to ${width}×${height}px.`,
  );
}
