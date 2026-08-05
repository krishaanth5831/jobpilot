// The dumb-ATS parser. Deliberately unintelligent: it reads text runs in the
// order the PDF hands them over, with no layout awareness whatsoever, then
// runs regexes over the result.
//
// This is not a shortcut — it is the point. Comparing what THIS recovers
// against what the layout-aware parser recovers is how the engine measures
// what a real applicant tracking system would lose.

import type { ParsedRole } from "../types";
import type { PageGeometry } from "./layout";

export const SECTION_PATTERNS = {
  experience: /^\s*(work\s+)?(experience|employment|work history|professional (experience|background)|career)\b/i,
  education: /^\s*(education|academic|qualifications|studies)\b/i,
  skills: /^\s*(technical\s+)?(skills|competenc(ies|es)|technologies|tech stack|expertise)\b/i,
  projects: /^\s*(projects?|portfolio|personal projects)\b/i,
  summary: /^\s*(summary|profile|objective|about( me)?|personal statement)\b/i,
} as const;

export type SectionName = keyof typeof SECTION_PATTERNS;
export const SECTION_NAMES = Object.keys(SECTION_PATTERNS) as SectionName[];

export const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
/** Deliberately loose — international formats vary wildly and a false negative
 *  here produces a wrong "missing phone number" fix. */
export const PHONE_PATTERN = /(\+?\d[\d\s().-]{7,}\d)/;
export const LINKEDIN_PATTERN = /linkedin\.com\/in\/[\w-]+/i;
/** "Amsterdam, Netherlands" / "Austin, TX" on a short line near the top. */
export const CITY_PATTERN = /^[A-Z][\p{L}.'-]+(?:\s[\p{L}.'-]+)*,\s*[A-Z][\p{L}.'-]+/u;

/** Date-range formats, each paired with the label reported in
 *  `dateFormatsSeen`. Order matters: the first match wins. */
export const DATE_FORMATS: readonly (readonly [string, RegExp])[] = [
  ["Mon YYYY", /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/i],
  ["MM/YYYY", /\b(0?[1-9]|1[0-2])\/\d{4}\b/],
  ["YYYY-MM", /\b\d{4}-(0?[1-9]|1[0-2])\b/],
  ["YYYY", /\b(19|20)\d{2}\b/],
];

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const PRESENT = /\b(present|current|now|ongoing|heden)\b/i;
/** En dash, em dash, hyphen or the word "to" between two dates. */
const RANGE_SEPARATOR = /\s*(?:[–—-]|\bto\b|\bt\/m\b)\s*/i;

export interface NaiveContact {
  email: boolean;
  phone: boolean;
  city: boolean;
  linkedin: boolean;
}

export interface NaiveParse {
  /** Text in raw document order — interleaved and wrong for multi-column. */
  text: string;
  lines: string[];
  sections: Record<SectionName, boolean>;
  contact: NaiveContact;
  /** Raw skill strings scraped from whatever follows a Skills heading. */
  skills: string[];
  roles: ParsedRole[];
  headings: string[];
  nonStandardHeadingCount: number;
  dateFormatsSeen: string[];
}

/** Convert "Mar 2023" to months-since-year-0, for ordering and gap maths. */
export function toMonthIndex(raw: string): number | null {
  const monthYear = /\b([a-z]{3})[a-z]*\.?\s+((?:19|20)\d{2})\b/i.exec(raw);
  if (monthYear?.[1] !== undefined && monthYear[2] !== undefined) {
    const month = MONTHS[monthYear[1].toLowerCase()];
    if (month !== undefined) return Number.parseInt(monthYear[2], 10) * 12 + month;
  }
  const numeric = /\b(0?[1-9]|1[0-2])\/((?:19|20)\d{2})\b/.exec(raw);
  if (numeric?.[1] !== undefined && numeric[2] !== undefined) {
    return Number.parseInt(numeric[2], 10) * 12 + Number.parseInt(numeric[1], 10);
  }
  const isoish = /\b((?:19|20)\d{2})-(0?[1-9]|1[0-2])\b/.exec(raw);
  if (isoish?.[1] !== undefined && isoish[2] !== undefined) {
    return Number.parseInt(isoish[1], 10) * 12 + Number.parseInt(isoish[2], 10);
  }
  const yearOnly = /\b((?:19|20)\d{2})\b/.exec(raw);
  if (yearOnly?.[1] !== undefined) {
    // A bare year is treated as January — good enough for ordering, and the
    // 6-month gap threshold is deliberately forgiving.
    return Number.parseInt(yearOnly[1], 10) * 12 + 1;
  }
  return null;
}

/**
 * Assemble text exactly as an unsophisticated extractor would: every run on a
 * page in the order it appears in the content stream, broken into lines only
 * when the baseline moves. No column reordering, no reading-order repair.
 */
export function naiveText(pages: readonly PageGeometry[]): { text: string; lines: string[] } {
  const lines: string[] = [];
  for (const page of pages) {
    let current: string[] = [];
    let lastY: number | null = null;
    const tolerance = page.height * 0.01;

    for (const run of page.runs) {
      if (lastY !== null && Math.abs(run.y - lastY) > tolerance) {
        lines.push(current.join("").trim());
        current = [];
      }
      current.push(run.text);
      lastY = run.y;
    }
    if (current.length > 0) lines.push(current.join("").trim());
  }
  const cleaned = lines.filter((l) => l !== "");
  return { text: cleaned.join("\n"), lines: cleaned };
}

/**
 * A heading is a short line with no sentence punctuation.
 *
 * `index` matters: the first line of a resume is the candidate's name, which
 * looks exactly like a heading and is not one. Lines carrying a comma or a
 * digit are excluded for the same reason — "Backend Engineer, Northwind
 * Systems" and "Mar 2022 - Aug 2025" are role lines, and counting them as
 * non-standard headings would penalise a perfectly conventional resume.
 */
function looksLikeHeading(line: string, index: number): boolean {
  if (index === 0) return false;
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 48) return false;
  if (/[.;,]$/.test(trimmed)) return false;
  if (/[,\d]/.test(trimmed)) return false;
  if (EMAIL_PATTERN.test(trimmed) || PHONE_PATTERN.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 5) return false;
  // ALL CAPS, Title Case, or ending in a colon are the three ways resumes
  // signal a heading.
  return (
    trimmed === trimmed.toUpperCase() ||
    /:$/.test(trimmed) ||
    words.every((w) => /^[A-Z(]/.test(w) || w.length <= 3)
  );
}

function detectDateFormats(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const line of lines) {
    for (const [label, pattern] of DATE_FORMATS) {
      if (pattern.test(line)) {
        seen.add(label);
        break;
      }
    }
  }
  // A bare year appearing alongside a fuller format is normal (graduation
  // years), so it only counts as its own format when nothing richer is used.
  if (seen.size > 1) seen.delete("YYYY");
  return [...seen];
}

/** Roles as a naive parser would find them: lines carrying a date range,
 *  inside or after the experience heading. */
function extractRoles(lines: readonly string[], page = 1): ParsedRole[] {
  const roles: ParsedRole[] = [];
  let inExperience = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (SECTION_PATTERNS.experience.test(line)) {
      inExperience = true;
      continue;
    }
    if (
      inExperience &&
      (SECTION_PATTERNS.education.test(line) ||
        SECTION_PATTERNS.skills.test(line) ||
        SECTION_PATTERNS.projects.test(line))
    ) {
      inExperience = false;
      continue;
    }
    if (!inExperience) continue;

    const hasDate = DATE_FORMATS.some(([, pattern]) => pattern.test(line));
    if (!hasDate) continue;

    // The role line usually carries "Title, Company" or "Title — Company",
    // with the date range at the end.
    const withoutDates = line
      .replace(/\(?\b[a-z]{3}[a-z]*\.?\s+\d{4}\b\)?/gi, " ")
      .replace(/\b\d{1,2}\/\d{4}\b/g, " ")
      .replace(/\b(19|20)\d{2}\b/g, " ")
      .replace(PRESENT, " ")
      .replace(RANGE_SEPARATOR, " ")
      .trim();

    // Plenty of resumes put the date range on its own line under the role.
    // When stripping the dates leaves nothing, the identity is on the line
    // above — look there rather than reporting a nameless role.
    const identitySource =
      withoutDates.replace(/[^\p{L}]/gu, "").length > 1 ? withoutDates : (lines[i - 1] ?? "");

    const parts = identitySource
      .split(/\s*[|,–—]\s*|\s+at\s+/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 1);

    const rangeParts = line.split(RANGE_SEPARATOR);
    const start = toMonthIndex(rangeParts[0] ?? "");
    const endRaw = rangeParts.slice(1).join(" ");
    const end = PRESENT.test(line) ? null : toMonthIndex(endRaw);

    roles.push({
      title: parts[0] ?? null,
      company: parts[1] ?? null,
      startMonth: start,
      endMonth: end,
      datesParseable: start !== null,
      evidence: { page, line: i + 1, snippet: line.slice(0, 160) },
    });
  }
  return roles;
}

/** Skill strings listed under a Skills heading. */
function extractSkills(lines: readonly string[]): string[] {
  const out: string[] = [];
  let inSkills = false;

  for (const line of lines) {
    if (SECTION_PATTERNS.skills.test(line)) {
      inSkills = true;
      // "Skills: Python, React" puts the payload on the heading line itself.
      const inline = line.split(":").slice(1).join(":");
      if (inline.trim() !== "") out.push(...splitSkillLine(inline));
      continue;
    }
    if (!inSkills) continue;
    if (SECTION_NAMES.some((name) => SECTION_PATTERNS[name].test(line))) {
      inSkills = false;
      continue;
    }
    out.push(...splitSkillLine(line));
  }
  return out.filter((s) => s !== "");
}

function splitSkillLine(line: string): string[] {
  return line
    .replace(/^[•·▪\-*•]\s*/, "")
    .split(/[,;|•·▪]|\s{3,}/)
    .map((s) => s.replace(/^[^\p{L}+#]+|[^\p{L}+#)]+$/gu, "").trim())
    .filter((s) => s.length > 1 && s.length < 40);
}

/**
 * Run the dumb parse over already-extracted page geometry.
 * Split from `naiveParse` so tests can drive it with synthetic pages.
 */
export function naiveParseFromPages(pages: readonly PageGeometry[]): NaiveParse {
  const { text, lines } = naiveText(pages);

  const sections = {} as Record<SectionName, boolean>;
  for (const name of SECTION_NAMES) {
    sections[name] = lines.some((line) => SECTION_PATTERNS[name].test(line));
  }

  const headings = lines.filter((line, i) => looksLikeHeading(line, i));
  const standard = headings.filter((h) =>
    SECTION_NAMES.some((name) => SECTION_PATTERNS[name].test(h)),
  ).length;

  return {
    text,
    lines,
    sections,
    contact: {
      email: EMAIL_PATTERN.test(text),
      phone: PHONE_PATTERN.test(text),
      // Only the first few lines: a city inside a job's address block is not
      // the candidate's own location.
      city: lines.slice(0, 8).some((l) => CITY_PATTERN.test(l.trim())),
      linkedin: LINKEDIN_PATTERN.test(text),
    },
    skills: extractSkills(lines),
    roles: extractRoles(lines),
    headings,
    nonStandardHeadingCount: Math.max(0, headings.length - standard),
    dateFormatsSeen: detectDateFormats(lines),
  };
}

/** Mimic a dumb ATS reading a PDF: document-order text, regexes, nothing else. */
export async function naiveParse(buffer: Buffer): Promise<NaiveParse> {
  const { loadPdfGeometry } = await import("./pdf");
  const geometry = await loadPdfGeometry(buffer);
  return naiveParseFromPages(geometry.pages);
}
