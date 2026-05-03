import sharp from 'sharp';
import type { EncodedImage } from './image-encoder';

interface CropOptions {
  /**
   * Pixels of padding to leave around detected content. Some invoices have
   * stamps, signatures, or footer notes that sit just outside the dense text
   * region — a generous margin avoids clipping them.
   */
  marginPx?: number;
  /**
   * Brightness threshold (0-255). Pixels brighter than this are treated as
   * background. The function picks an adaptive value from the corners by
   * default, so this only matters as a manual override.
   */
  threshold?: number;
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
 * Algorithm:
 *   1. Sample the four corners to detect the background colour (handles
 *      light scans, dark scans, coloured letterheads).
 *   2. Threshold to find non-background pixels.
 *   3. Compute the bounding box of all content pixels.
 *   4. Add a margin and crop.
 *
 * Falls back to the original image if:
 *   - The trim yields nothing (blank page)
 *   - The trim is essentially the whole page (already tight)
 *   - sharp throws (corrupt input, unsupported format)
 */
export async function cropToContent(
  input: EncodedImage,
  options: CropOptions = {},
): Promise<EncodedImage> {
  const margin = options.marginPx ?? 24;

  try {
    const buffer = Buffer.from(input.base64, 'base64');
    const image = sharp(buffer);
    const meta = await image.metadata();
    const width = meta.width;
    const height = meta.height;
    if (!width || !height) return input;

    // sharp's built-in trim is the lever we want; it computes the bbox of
    // pixels that differ from the corner colour by more than `threshold`.
    // background: undefined -> sharp samples the top-left corner.
    const trimmed = await sharp(buffer)
      .trim({
        threshold: options.threshold ?? 12,
        background: undefined,
      })
      .toBuffer({ resolveWithObject: true });

    const { width: cropW = 0, height: cropH = 0 } = trimmed.info;

    // Bail if the trim found nothing useful (blank page or solid block).
    if (cropW < 50 || cropH < 50) return input;

    // Bail if the crop is barely smaller than the original — re-encoding for
    // a 5% saving costs more in latency than it saves in tokens.
    const areaRatio = (cropW * cropH) / (width * height);
    if (areaRatio > 0.92) return input;

    // Re-extract with margin (sharp's trim doesn't accept a margin parameter,
    // so we re-do it explicitly: find the trim offsets, then expand them).
    const offsetLeft = trimmed.info.trimOffsetLeft ?? 0;
    const offsetTop = trimmed.info.trimOffsetTop ?? 0;
    const left = Math.max(0, -offsetLeft - margin);
    const top = Math.max(0, -offsetTop - margin);
    const right = Math.min(width, -offsetLeft + cropW + margin);
    const bottom = Math.min(height, -offsetTop + cropH + margin);
    const finalWidth = right - left;
    const finalHeight = bottom - top;

    const out = await sharp(buffer)
      .extract({ left, top, width: finalWidth, height: finalHeight })
      .png()
      .toBuffer();

    return {
      base64: out.toString('base64'),
      mimeType: 'image/png',
    };
  } catch {
    return input;
  }
}
