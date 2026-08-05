// The layout-aware parse: what the resume ACTUALLY says, as a human reading it
// would understand it. Columns are detected and read in the right order, so a
// two-column CV comes out as two coherent halves rather than interleaved rows.
//
// ON THE LLM: the "rich" profile is the structured profile Claude already
// extracted at upload (app/api/resume/route.js). It is reused rather than
// re-requested — the model has already read this document once, and asking it
// again would double the cost of every resume for no new information. The only
// model call this engine makes is the content classifier in classify.ts.

import { toUserProfile, type LegacyProfile } from "../../matching/adapt";
import type { UserProfile } from "../../matching/types";
import type { ParsedRole } from "../types";
import {
  CITY_PATTERN,
  EMAIL_PATTERN,
  LINKEDIN_PATTERN,
  PHONE_PATTERN,
  SECTION_NAMES,
  SECTION_PATTERNS,
  naiveParseFromPages,
  toMonthIndex,
  type NaiveContact,
  type SectionName,
} from "./naive";
import {
  COLUMN_CLUSTER_TOLERANCE,
  COLUMN_MIN_HEIGHT_SPAN,
  COLUMN_MIN_RUNS,
  COLUMN_MIN_SEPARATION,
  clusterLeftEdges,
  type PageGeometry,
  type TextRun,
} from "./layout";

export interface RichParse {
  /** Text in true reading order, columns resolved. */
  text: string;
  lines: string[];
  profile: UserProfile;
  contact: NaiveContact;
  sections: Record<SectionName, boolean>;
  /** Canonical taxonomy ids the profile carries. */
  skills: string[];
  roles: ParsedRole[];
  pageCount: number;
}

/** Runs grouped into reading-order columns for one page. */
export function columnsFor(page: PageGeometry): TextRun[][] {
  const clusters = clusterLeftEdges(page).filter(
    (c) =>
      c.runs.length >= COLUMN_MIN_RUNS &&
      c.maxY - c.minY >= page.height * COLUMN_MIN_HEIGHT_SPAN,
  );

  const gutter = page.width * COLUMN_MIN_SEPARATION;
  // Seed column boundaries from clusters that are genuinely far apart.
  const anchors: number[] = [];
  for (const cluster of clusters.sort((a, b) => a.center - b.center)) {
    const last = anchors[anchors.length - 1];
    if (last === undefined || cluster.center - last >= gutter) anchors.push(cluster.center);
  }
  if (anchors.length < 2) return [[...page.runs]];

  const columns: TextRun[][] = anchors.map(() => []);
  for (const run of page.runs) {
    // Assign each run to the nearest column anchor at or left of it.
    let index = 0;
    let best = Infinity;
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      if (anchor === undefined) continue;
      const distance = Math.abs(run.x - anchor);
      if (distance < best) {
        best = distance;
        index = i;
      }
    }
    columns[index]?.push(run);
  }
  return columns.filter((c) => c.length > 0);
}

/**
 * Text in true reading order. Within a column, top to bottom; columns left to
 * right. This is the half of the dual parse that gets it right.
 */
export function layoutAwareText(pages: readonly PageGeometry[]): {
  text: string;
  lines: string[];
} {
  const lines: string[] = [];

  for (const page of pages) {
    const tolerance = page.height * 0.01;
    for (const column of columnsFor(page)) {
      const sorted = [...column].sort((a, b) => b.y - a.y || a.x - b.x);
      let current: string[] = [];
      let lastY: number | null = null;

      for (const run of sorted) {
        if (lastY !== null && Math.abs(run.y - lastY) > tolerance) {
          lines.push(current.join("").trim());
          current = [];
        }
        current.push(run.text);
        lastY = run.y;
      }
      if (current.length > 0) lines.push(current.join("").trim());
    }
  }

  const cleaned = lines.filter((l) => l !== "");
  return { text: cleaned.join("\n"), lines: cleaned };
}

/**
 * Build the rich side of the comparison from page geometry plus the profile
 * the upload step already extracted.
 */
export function richParseFromPages(
  pages: readonly PageGeometry[],
  legacyProfile: LegacyProfile | null | undefined,
): RichParse {
  const { text, lines } = layoutAwareText(pages);
  const { profile } = toUserProfile(legacyProfile);

  const sections = {} as Record<SectionName, boolean>;
  for (const name of SECTION_NAMES) {
    sections[name] = lines.some((line) => SECTION_PATTERNS[name].test(line));
  }

  // Roles come from the SAME extraction rules as the naive parse, run over the
  // correctly ordered lines. Holding the rules constant isolates the
  // divergence to reading order, which is exactly what the report measures.
  //
  // Where the line rules find nothing but the LLM extraction did — the usual
  // case for a heavily designed CV with non-standard headings — the profile's
  // own roles are used. That IS the rich side of the comparison: the model read
  // the document properly, and the divergence measures what a regex loses.
  const fromLines = rolesFromLines(lines);
  const fromProfile = rolesFromLegacy(legacyProfile);
  const roles = fromLines.length >= fromProfile.length ? fromLines : fromProfile;

  return {
    text,
    lines,
    profile,
    contact: {
      email: EMAIL_PATTERN.test(text) || (legacyProfile?.email ?? "").includes("@"),
      phone: PHONE_PATTERN.test(text),
      city:
        lines.slice(0, 10).some((l) => CITY_PATTERN.test(l.trim())) ||
        profile.location.city !== null,
      linkedin: LINKEDIN_PATTERN.test(text),
    },
    sections: {
      ...sections,
      // The model finding roles or degrees is proof the section exists,
      // whatever the heading above it was called.
      experience: sections.experience || fromProfile.length > 0,
      education: sections.education || profile.education.degreeLevel > 0,
      skills: sections.skills || profile.skills.length > 0,
    },
    skills: profile.skills.map((s) => s.canonicalId),
    roles,
    pageCount: pages.length,
  };
}

/** Roles as the upload-time extraction understood them. */
function rolesFromLegacy(legacy: LegacyProfile | null | undefined): ParsedRole[] {
  return (legacy?.experience ?? [])
    .filter((e) => (e.title ?? "").trim() !== "" || (e.company ?? "").trim() !== "")
    .map((e) => {
      const duration = e.duration ?? "";
      const [startRaw = "", ...endParts] = duration.split(/\s*(?:[–—-]|\bto\b)\s*/);
      const startMonth = toMonthIndex(startRaw);
      const endMonth = /present|current|now/i.test(duration)
        ? null
        : toMonthIndex(endParts.join(" "));
      return {
        title: (e.title ?? "").trim() || null,
        company: (e.company ?? "").trim() || null,
        startMonth,
        endMonth,
        datesParseable: startMonth !== null,
        evidence: null,
      };
    });
}

/** Role extraction over already-ordered lines. */
function rolesFromLines(lines: readonly string[]): ParsedRole[] {
  return naiveParseFromPages([
    {
      pageNumber: 1,
      width: 595,
      height: 842,
      // Synthesise one run per line at a descending baseline so the naive
      // extractor sees the same lines in the corrected order.
      runs: lines.map((text, i) => ({
        text,
        x: 50,
        y: 800 - i * 12,
        width: text.length * 5,
        height: 10,
        fontName: "reordered",
      })),
      rects: [],
    },
  ]).roles;
}

/** Full rich parse from a PDF buffer. */
export async function richParse(
  buffer: Buffer,
  legacyProfile: LegacyProfile | null | undefined,
): Promise<RichParse> {
  const { loadPdfGeometry } = await import("./pdf");
  const geometry = await loadPdfGeometry(buffer);
  return richParseFromPages(geometry.pages, legacyProfile);
}

export { COLUMN_CLUSTER_TOLERANCE };
