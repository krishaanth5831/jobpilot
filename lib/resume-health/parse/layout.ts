// Layout detection from pdfjs text-run geometry.
//
// Everything here is PURE: it takes plain geometry structures and returns
// booleans. All pdfjs plumbing lives in pdf.ts, which is what makes these
// detectors unit-testable against synthetic fixtures with no PDF involved.
//
// PDF user space has its origin at the BOTTOM-left, so a larger `y` is higher
// up the page. Every threshold below is expressed as a fraction of page size
// rather than in points, so A4 and US Letter behave identically.

export interface TextRun {
  text: string;
  /** Left edge in PDF user space. */
  x: number;
  /** Baseline, measured from the bottom of the page. */
  y: number;
  width: number;
  height: number;
  fontName: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageGeometry {
  pageNumber: number;
  width: number;
  height: number;
  runs: TextRun[];
  /** Filled rectangles / drawn paths from the operator list, used to spot text
   *  living inside a shape or table cell. */
  rects: Rect[];
}

export interface FontDescriptor {
  name: string;
  embedded: boolean;
}

/* -------------------------------------------------------------------------
 * Multi-column detection
 * ---------------------------------------------------------------------- */

/** Two left edges closer together than this (as a fraction of page width) are
 *  the same column. Roughly a two-character indent on A4. */
export const COLUMN_CLUSTER_TOLERANCE = 0.06;

/** Real columns are separated by a gutter. Anything closer than a quarter of
 *  the page is an indent — a bullet list, a hanging date — not a column. This
 *  single threshold is what stops indented bullets reading as two columns. */
export const COLUMN_MIN_SEPARATION = 0.25;

/** A column has to actually run down the page. A cluster spanning less than
 *  40% of page height is a heading block or a sidebar label, not a column. */
export const COLUMN_MIN_HEIGHT_SPAN = 0.4;

/** A cluster with fewer runs than this is noise. */
export const COLUMN_MIN_RUNS = 4;

interface Cluster {
  center: number;
  runs: TextRun[];
  minY: number;
  maxY: number;
}

/** One-dimensional clustering of run left edges. */
export function clusterLeftEdges(page: PageGeometry): Cluster[] {
  const runs = page.runs.filter((r) => r.text.trim() !== "");
  if (runs.length === 0) return [];

  const tolerance = page.width * COLUMN_CLUSTER_TOLERANCE;
  const sorted = [...runs].sort((a, b) => a.x - b.x);

  const clusters: Cluster[] = [];
  let current: TextRun[] = [];

  for (const run of sorted) {
    const first = current[0];
    if (first === undefined || run.x - first.x <= tolerance) {
      current.push(run);
      continue;
    }
    clusters.push(toCluster(current));
    current = [run];
  }
  if (current.length > 0) clusters.push(toCluster(current));
  return clusters;
}

function toCluster(runs: TextRun[]): Cluster {
  const xs = runs.map((r) => r.x);
  const ys = runs.map((r) => r.y);
  return {
    center: xs.reduce((a, b) => a + b, 0) / xs.length,
    runs,
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * True when the page is laid out in two or more columns — the single most
 * damaging thing a resume can do to an ATS, because a naive top-to-bottom
 * extraction interleaves the columns into nonsense.
 */
export function detectMultiColumn(page: PageGeometry): boolean {
  const substantial = clusterLeftEdges(page).filter(
    (c) =>
      c.runs.length >= COLUMN_MIN_RUNS &&
      c.maxY - c.minY >= page.height * COLUMN_MIN_HEIGHT_SPAN,
  );
  if (substantial.length < 2) return false;

  // At least one PAIR must be separated by a true gutter.
  const gutter = page.width * COLUMN_MIN_SEPARATION;
  for (let i = 0; i < substantial.length; i++) {
    for (let j = i + 1; j < substantial.length; j++) {
      const a = substantial[i];
      const b = substantial[j];
      if (a === undefined || b === undefined) continue;
      if (Math.abs(a.center - b.center) >= gutter) return true;
    }
  }
  return false;
}

/* -------------------------------------------------------------------------
 * Header / footer detection
 * ---------------------------------------------------------------------- */

/** Top and bottom band, as a fraction of page height. Text placed in a real
 *  PDF header or footer object is frequently dropped entirely by ATS parsers,
 *  so contact details up there can vanish without trace. */
export const HEADER_FOOTER_BAND = 0.08;

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /(linkedin\.com|github\.com|https?:\/\/|www\.)/i;

/** Runs sitting in the top or bottom band of the page. */
export function runsInHeaderFooter(page: PageGeometry): TextRun[] {
  const top = page.height * (1 - HEADER_FOOTER_BAND);
  const bottom = page.height * HEADER_FOOTER_BAND;
  return page.runs.filter((r) => r.text.trim() !== "" && (r.y >= top || r.y <= bottom));
}

/** True when an email, phone number or profile URL is in the header/footer band. */
export function detectHeaderFooter(page: PageGeometry): boolean {
  return runsInHeaderFooter(page).some(
    (r) => EMAIL_RE.test(r.text) || PHONE_RE.test(r.text) || URL_RE.test(r.text),
  );
}

/* -------------------------------------------------------------------------
 * Tables
 * ---------------------------------------------------------------------- */

/** Runs whose baselines differ by less than this fraction of page height are
 *  on the same visual row. */
export const ROW_TOLERANCE = 0.01;

/** A table needs at least this many rows... */
export const TABLE_MIN_ROWS = 3;
/** ...each with at least this many horizontally separated cells. */
export const TABLE_MIN_COLUMNS = 2;

/** Group runs into visual rows by baseline. */
export function groupIntoRows(page: PageGeometry): TextRun[][] {
  const runs = page.runs.filter((r) => r.text.trim() !== "");
  const tolerance = page.height * ROW_TOLERANCE;
  const sorted = [...runs].sort((a, b) => b.y - a.y);

  const rows: TextRun[][] = [];
  let current: TextRun[] = [];
  for (const run of sorted) {
    const first = current[0];
    if (first === undefined || Math.abs(first.y - run.y) <= tolerance) {
      current.push(run);
      continue;
    }
    rows.push(current);
    current = [run];
  }
  if (current.length > 0) rows.push(current);
  return rows.map((row) => [...row].sort((a, b) => a.x - b.x));
}

/**
 * True when text appears to be laid out in a grid. Detected structurally —
 * several consecutive rows sharing the same column starts — because a PDF
 * table drawn with lines and one drawn with tab stops break ATS parsers
 * identically.
 */
export function detectTables(page: PageGeometry): boolean {
  const rows = groupIntoRows(page).filter((row) => row.length >= TABLE_MIN_COLUMNS);
  if (rows.length < TABLE_MIN_ROWS) return false;

  const tolerance = page.width * COLUMN_CLUSTER_TOLERANCE;
  let aligned = 0;

  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1];
    const current = rows[i];
    if (previous === undefined || current === undefined) continue;

    // Count how many of this row's cells start at the same x as a cell above.
    const shared = current.filter((cell) =>
      previous.some((other) => Math.abs(other.x - cell.x) <= tolerance),
    ).length;

    if (shared >= TABLE_MIN_COLUMNS) {
      aligned++;
      if (aligned >= TABLE_MIN_ROWS - 1) return true;
    } else {
      aligned = 0;
    }
  }
  return false;
}

/* -------------------------------------------------------------------------
 * Shapes
 * ---------------------------------------------------------------------- */

/** A rectangle smaller than this fraction of the page is decoration (a rule,
 *  a bullet glyph), not a container worth reporting. */
export const SHAPE_MIN_AREA = 0.01;

function contains(rect: Rect, run: TextRun): boolean {
  return (
    run.x >= rect.x &&
    run.x + run.width <= rect.x + rect.width &&
    run.y >= rect.y &&
    run.y <= rect.y + rect.height
  );
}

/** True when meaningful text sits inside a drawn shape or text box. */
export function detectShapes(page: PageGeometry): boolean {
  const pageArea = page.width * page.height;
  const containers = page.rects.filter(
    (r) => (r.width * r.height) / pageArea >= SHAPE_MIN_AREA,
  );
  if (containers.length === 0) return false;

  return containers.some((rect) => {
    const inside = page.runs.filter((run) => run.text.trim() !== "" && contains(rect, run));
    return inside.length >= COLUMN_MIN_RUNS;
  });
}

/* -------------------------------------------------------------------------
 * Fonts
 * ---------------------------------------------------------------------- */

/** True when any font used on the page is not embedded in the file. A
 *  non-embedded font forces the reader to substitute, and substitution is
 *  where ligatures and spacing turn into run-together words. */
export function detectFontEmbedding(fonts: readonly FontDescriptor[]): boolean {
  return fonts.some((f) => !f.embedded);
}

/* -------------------------------------------------------------------------
 * Text integrity
 * ---------------------------------------------------------------------- */

/** Below this, extracted text is considered damaged enough to deduct for. */
export const TEXT_INTEGRITY_FLOOR = 0.9;

const MOJIBAKE_RE = /[� --]/g;
/** Four or more capitals mid-word, or a lowercase butting straight into a
 *  capital repeatedly, is the signature of collapsed inter-word spacing. */
const RUN_TOGETHER_RE = /[a-z]{2}[A-Z][a-z]{2}/g;

/**
 * 0-1 estimate of how intact the extracted text is. Counts the two failure
 * modes that actually show up: replacement characters from a broken encoding,
 * and words run together where spacing was lost.
 */
export function measureTextIntegrity(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;

  const words = trimmed.split(/\s+/).length;
  const mojibake = (trimmed.match(MOJIBAKE_RE) ?? []).length;
  const runTogether = (trimmed.match(RUN_TOGETHER_RE) ?? []).length;

  // Mojibake is weighted more heavily: a replacement character is certain
  // damage, whereas a run-together match can be a legitimate camelCase token.
  const damage = (mojibake * 3 + runTogether) / Math.max(words, 1);
  return Math.max(0, Math.min(1, 1 - damage));
}
