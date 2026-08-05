// The only file that talks to pdfjs. Everything downstream works on the plain
// geometry structures in layout.ts, which is what keeps the detectors pure and
// unit-testable.
//
// pdfjs 5 is ESM-only and its default build needs browser globals (DOMMatrix),
// so this loads the `legacy` build through a dynamic import — the same reason
// lib/resume-parser.js dynamically imports pdf-parse.

import path from "node:path";

import type { FontDescriptor, PageGeometry, Rect, TextRun } from "./layout";

/** A 2x3 affine matrix, as pdfjs represents transforms: [a, b, c, d, e, f]. */
type Matrix = readonly [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyToPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Axis-aligned bounding box of the unit square under `m`. Image XObjects are
 *  always drawn into the unit square, so this gives their placed size. */
function unitSquareBounds(m: Matrix): Rect {
  const corners = [
    applyToPoint(m, 0, 0),
    applyToPoint(m, 1, 0),
    applyToPoint(m, 0, 1),
    applyToPoint(m, 1, 1),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export interface PlacedImage extends Rect {
  page: number;
}

export interface PdfGeometry {
  pages: PageGeometry[];
  fonts: FontDescriptor[];
  images: PlacedImage[];
  /** False for a scanned resume: pages render, but carry no selectable text. */
  hasTextLayer: boolean;
  pageCount: number;
}

/** Below this fraction of page area, an image is a logo, icon or rule — not a
 *  portrait. Tuned so a typical 3x4cm headshot on A4 (~4%) clears it. */
export const PHOTO_MIN_AREA_FRACTION = 0.015;

/** A portrait is taller than it is wide, or close to square. Anything much
 *  wider is a banner or a divider. */
export const PHOTO_MAX_ASPECT_RATIO = 1.4;

interface TextItemLike {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
}

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && "str" in item;
}

/** Filesystem location of pdfjs's bundled standard-14 font metrics.
 *  Built from cwd rather than `import.meta.url` so the same source compiles
 *  under both the ESM app build and the CommonJS test build. */
function standardFontsPath(): string {
  return `${path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts")}${path.sep}`;
}

async function loadPdfjs(): Promise<Record<string, unknown>> {
  const mod: unknown = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return mod as Record<string, unknown>;
}

/**
 * Extract every geometric fact the health engine needs from a PDF, in one pass.
 * Never throws for a merely awkward document — a PDF that cannot be opened at
 * all is reported by the caller as the `corrupt` gate.
 */
export async function loadPdfGeometry(buffer: Buffer): Promise<PdfGeometry> {
  const pdfjs = await loadPdfjs();
  const getDocument = pdfjs["getDocument"] as (
    src: unknown,
  ) => { promise: Promise<unknown> };
  const OPS = pdfjs["OPS"] as Record<string, number>;

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    // Lets pdfjs resolve the standard-14 font metrics instead of warning on
    // every document. Improves glyph widths, and therefore run geometry.
    standardFontDataUrl: standardFontsPath(),
    // No network, no eval, no system font probing — this runs on a server
    // against files a stranger uploaded.
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
  });

  const doc = (await loadingTask.promise) as {
    numPages: number;
    getPage: (n: number) => Promise<unknown>;
    destroy: () => Promise<void>;
  };

  const pages: PageGeometry[] = [];
  const images: PlacedImage[] = [];
  const fontNames = new Set<string>();
  const nonEmbedded = new Set<string>();

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = (await doc.getPage(pageNumber)) as {
        getViewport: (o: { scale: number }) => { width: number; height: number };
        getTextContent: () => Promise<{ items: unknown[] }>;
        getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
        commonObjs: { has: (k: string) => boolean; get: (k: string) => unknown };
      };

      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();

      const runs: TextRun[] = [];
      for (const item of textContent.items) {
        if (!isTextItem(item)) continue;
        const text = item.str ?? "";
        const transform = item.transform ?? [];
        const x = transform[4];
        const y = transform[5];
        if (typeof x !== "number" || typeof y !== "number") continue;
        const fontName = item.fontName ?? "";
        if (fontName !== "") fontNames.add(fontName);
        runs.push({
          text,
          x,
          y,
          width: item.width ?? 0,
          height: item.height ?? 0,
          fontName,
        });
      }

      const { rects, pageImages } = await collectPaths(page, OPS, pageNumber);
      images.push(...pageImages);

      // Font embedding: pdfjs only populates commonObjs once the operator list
      // has been built, which collectPaths has just done. Guarded because the
      // shape of these internals is not part of pdfjs's public contract — a
      // miss reports "embedded", never a false accusation.
      for (const name of fontNames) {
        try {
          if (!page.commonObjs.has(name)) continue;
          const font = page.commonObjs.get(name) as { data?: unknown } | null;
          if (font !== null && font !== undefined && !font.data) nonEmbedded.add(name);
        } catch {
          // Ignore — treated as embedded.
        }
      }

      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        runs,
        rects,
      });
    }
  } finally {
    await doc.destroy().catch(() => undefined);
  }

  const hasTextLayer = pages.some((p) => p.runs.some((r) => r.text.trim() !== ""));

  return {
    pages,
    fonts: [...fontNames].map((name) => ({ name, embedded: !nonEmbedded.has(name) })),
    images,
    hasTextLayer,
    pageCount: doc.numPages,
  };
}

/**
 * Walk the operator list once, tracking the current transformation matrix, to
 * recover drawn rectangles and placed images. Both need the CTM: a rectangle's
 * on-page position is meaningless without it.
 */
async function collectPaths(
  page: { getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }> },
  OPS: Record<string, number>,
  pageNumber: number,
): Promise<{ rects: Rect[]; pageImages: PlacedImage[] }> {
  const rects: Rect[] = [];
  const pageImages: PlacedImage[] = [];

  let operatorList: { fnArray: number[]; argsArray: unknown[] };
  try {
    operatorList = await page.getOperatorList();
  } catch {
    // A document whose content stream will not decode still has usable text
    // geometry; shape detection simply reports nothing.
    return { rects, pageImages };
  }

  let ctm: Matrix = IDENTITY;
  const stack: Matrix[] = [];

  const imageOps = new Set(
    [OPS["paintImageXObject"], OPS["paintJpegXObject"], OPS["paintInlineImageXObject"]].filter(
      (v): v is number => typeof v === "number",
    ),
  );

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i];
    const args = operatorList.argsArray[i];

    if (fn === OPS["save"]) {
      stack.push(ctm);
    } else if (fn === OPS["restore"]) {
      ctm = stack.pop() ?? IDENTITY;
    } else if (fn === OPS["transform"] && Array.isArray(args) && args.length >= 6) {
      const m = args.slice(0, 6) as unknown as Matrix;
      if (m.every((n) => typeof n === "number" && Number.isFinite(n))) {
        ctm = multiply(ctm, m);
      }
    } else if (imageOps.has(fn ?? -1)) {
      const bounds = unitSquareBounds(ctm);
      if (bounds.width > 0 && bounds.height > 0) {
        pageImages.push({ ...bounds, page: pageNumber });
      }
    } else if (fn === OPS["constructPath"]) {
      rects.push(...rectanglesFromPath(args, OPS, ctm));
    }
  }

  return { rects, pageImages };
}

/** Pull axis-aligned rectangles out of a constructPath operator. */
function rectanglesFromPath(args: unknown, OPS: Record<string, number>, ctm: Matrix): Rect[] {
  if (!Array.isArray(args) || args.length < 2) return [];
  const ops = args[0];
  const coords = args[1];
  if (!Array.isArray(ops) || !Array.isArray(coords)) return [];

  const out: Rect[] = [];
  let cursor = 0;
  for (const op of ops) {
    if (op === OPS["rectangle"]) {
      const x = coords[cursor];
      const y = coords[cursor + 1];
      const w = coords[cursor + 2];
      const h = coords[cursor + 3];
      cursor += 4;
      if ([x, y, w, h].every((n) => typeof n === "number" && Number.isFinite(n))) {
        const [px, py] = applyToPoint(ctm, x as number, y as number);
        const [qx, qy] = applyToPoint(ctm, (x as number) + (w as number), (y as number) + (h as number));
        out.push({
          x: Math.min(px, qx),
          y: Math.min(py, qy),
          width: Math.abs(qx - px),
          height: Math.abs(qy - py),
        });
      }
    } else if (op === OPS["moveTo"] || op === OPS["lineTo"]) {
      cursor += 2;
    } else if (op === OPS["curveTo"]) {
      cursor += 6;
    } else if (op === OPS["curveTo2"] || op === OPS["curveTo3"]) {
      cursor += 4;
    }
  }
  return out;
}

/**
 * True when the document carries an image that looks like a portrait.
 * PRESENCE ONLY — the image bytes are never decoded, described or classified.
 * A photo's content is a protected characteristic; its existence is a
 * formatting signal, and only that.
 */
export function detectPhoto(geometry: PdfGeometry): boolean {
  const firstPage = geometry.pages[0];
  if (firstPage === undefined) return false;
  const pageArea = firstPage.width * firstPage.height;
  if (pageArea <= 0) return false;

  return geometry.images.some((img) => {
    if (img.page !== 1) return false;
    const area = (img.width * img.height) / pageArea;
    if (area < PHOTO_MIN_AREA_FRACTION) return false;
    const aspect = img.height === 0 ? Infinity : img.width / img.height;
    return aspect <= PHOTO_MAX_ASPECT_RATIO;
  });
}
