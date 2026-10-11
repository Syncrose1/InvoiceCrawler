import { existsSync, promises as fs } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import type { EncodedImage } from './image-encoder';

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDocument = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>;

/** Render scale handed to pdfjs. 2.0 keeps small print legible for the vision models. */
const PDF_RENDER_SCALE = 2.0;

/**
 * Cap on canvas area, in pixels. At 4 bytes per pixel this is ~400MB of raw
 * bitmap, so an oversized page (architectural drawings, plotter output) fails
 * with a clear message instead of OOM-ing the main process.
 */
const MAX_CANVAS_PIXELS = 100_000_000;

/**
 * Most pages we'll render for one file. The vision APIs cap images per
 * request (Anthropic: 100), and anything this long is a statement or a merged
 * scan rather than one invoice — fail fast before rendering it all.
 */
const MAX_PDF_PAGES = 50;

/** pdfjs `VerbosityLevel.ERRORS` — keep its chatter out of our logs. */
const VERBOSITY_ERRORS = 0;

// pdfjs is a large ESM bundle and plenty of sessions never open a PDF, so pull
// it in on first use and cache it.
let pdfjsPromise: Promise<PdfjsModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

/**
 * Format a directory as a pdfjs "factory url" (`cMapUrl` / `standardFontDataUrl`).
 *
 * pdfjs validates these with a literal `endsWith('/')` check (`getFactoryUrlProp`
 * in pdf.mjs) but then passes the string straight to `fs.readFile`, so the value
 * has to stay a native filesystem path — a `file://` URL would ENOENT.
 *
 * On Windows `path.join` yields backslashes and a `\` terminator, which fails
 * that check and throws `Invalid factory url: "C:\...\cmaps\"` from inside
 * `getDocument()` — before a single page is parsed, for every PDF. That was the
 * v2.0.2 bug where every extraction failed instantly on Windows while Linux was
 * fine, since POSIX `sep` is already `/`. Node's fs accepts forward slashes on
 * Windows, so normalising the whole path satisfies both sides.
 */
function toFactoryUrl(dir: string): string {
  return `${dir.replaceAll('\\', '/').replace(/\/+$/, '')}/`;
}

/**
 * Locate pdfjs's on-disk asset directories.
 *
 * In dev these live in node_modules. In the packaged app electron-builder copies
 * them to `resources/pdfjs/` via `extraResources` (see electron-builder.yml),
 * because pdfjs reads them with a plain `fs.readFile` that can't see inside
 * app.asar. Ordering matters: check resources first, since `require.resolve`
 * would happily return an asar-internal path that doesn't work.
 */
function resolveAssetDir(name: 'cmaps' | 'standard_fonts'): string {
  const candidates: string[] = [];
  // Always set under Electron; guarded so this module still works under plain
  // node (tests, one-off scripts).
  if (process.resourcesPath) candidates.push(join(process.resourcesPath, 'pdfjs', name));
  try {
    const require = createRequire(import.meta.url);
    candidates.push(join(dirname(require.resolve('pdfjs-dist/package.json')), name));
  } catch {
    // pdfjs-dist isn't resolvable from the bundled main process — that's
    // expected in a packaged build, where the resources path above applies.
  }

  for (const dir of candidates) {
    if (existsSync(dir)) return toFactoryUrl(dir);
  }
  throw new Error(
    `Could not locate pdfjs ${name}/ (looked in: ${candidates.join(', ')}). ` +
      'The packaged app should ship it under resources/pdfjs/.',
  );
}

const assetDirs = { cmaps: '', standard_fonts: '' };

function assetDir(name: 'cmaps' | 'standard_fonts'): string {
  assetDirs[name] ||= resolveAssetDir(name);
  return assetDirs[name];
}

/**
 * Convert each page of a PDF into a PNG buffer.
 *
 * Drives pdfjs-dist directly rather than going through pdf-to-png-converter.
 * That wrapper built its asset paths with `path.sep` (broken on Windows, see
 * `toFactoryUrl`) and resolved them against `process.cwd()` — which in a
 * packaged app is wherever the shortcut launched from, not the app directory.
 * Neither was overridable through its options, so we own the ~40 lines instead.
 *
 * Rendering goes through pdfjs's built-in `NodeCanvasFactory`, which uses
 * @napi-rs/canvas — prebuilt binaries for every platform we target, so no
 * node-gyp and no Cairo/Pango/GTK install dance.
 */
export async function convertPdfToImages(pdfPath: string): Promise<EncodedImage[]> {
  const { getDocument } = await loadPdfjs();
  const data = new Uint8Array(await fs.readFile(pdfPath));

  const pdfDocument = await getDocument({
    data,
    cMapUrl: assetDir('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: assetDir('standard_fonts'),
    // These four mirror pdf-to-png-converter's defaults so rendering output is
    // byte-for-byte what v2.0.2 produced on Linux.
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: true,
    verbosity: VERBOSITY_ERRORS,
  }).promise;

  try {
    if (pdfDocument.numPages > MAX_PDF_PAGES) {
      throw new Error(
        `PDF has ${pdfDocument.numPages} pages; the limit is ${MAX_PDF_PAGES}. ` +
          'Split it into individual invoices and try again.',
      );
    }
    const images: EncodedImage[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      images.push(await renderPage(pdfDocument, pageNumber));
    }
    return images;
  } finally {
    // destroy() tears down the pdfjs worker too. The old wrapper only called
    // cleanup(), which leaked a worker per file across a batch.
    await pdfDocument.destroy();
  }
}

async function renderPage(pdfDocument: PdfDocument, pageNumber: number): Promise<EncodedImage> {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

  if (viewport.width * viewport.height > MAX_CANVAS_PIXELS) {
    page.cleanup();
    throw new Error(
      `Page ${pageNumber} renders to ${Math.round(viewport.width)}×${Math.round(viewport.height)}px, ` +
        `over the ${MAX_CANVAS_PIXELS.toLocaleString()} pixel limit.`,
    );
  }

  const canvasFactory = pdfDocument.canvasFactory as {
    create: (width: number, height: number) => { canvas: unknown; context: unknown };
    destroy: (entry: { canvas: unknown; context: unknown }) => void;
  };
  const entry = canvasFactory.create(viewport.width, viewport.height);

  try {
    // pdfjs types the canvas and context as their DOM counterparts, but the
    // node factory hands back @napi-rs/canvas objects and the main process
    // tsconfig has no DOM lib. Cast once, at the boundary.
    await page.render({
      canvasContext: entry.context,
      viewport,
      canvas: entry.canvas,
    } as unknown as Parameters<typeof page.render>[0]).promise;

    // @napi-rs/canvas, not the DOM canvas pdfjs's types describe.
    const canvas = entry.canvas as { toBuffer: (mime: 'image/png') => Buffer };
    return {
      base64: canvas.toBuffer('image/png').toString('base64'),
      mimeType: 'image/png',
    };
  } finally {
    page.cleanup();
    canvasFactory.destroy(entry);
  }
}
