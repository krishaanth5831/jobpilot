// Compatibility projection.
//
// The resume studio, the upgrade prompt and GET /api/resume all read the old
// review shape — `score`, `summary`, `strengths`, `checks`, `issues`. Building
// the UI is out of scope for this task, so the stored record carries the full
// `HealthResult` PLUS those derived fields. Nothing outside this engine has to
// change, and the UI can be migrated onto the real structure later.
//
// Everything here is derived. No new judgement is introduced.

import type { HealthResult, Severity } from "./types";

/** Old severities, in the vocabulary the resume studio already renders. */
export type LegacySeverity = "critical" | "important" | "polish";

const SEVERITY_MAP: Readonly<Record<Severity, LegacySeverity>> = {
  critical: "critical",
  major: "important",
  minor: "polish",
};

/** Component score at or above which it is reported as a strength. */
export const STRENGTH_THRESHOLD = 0.85;

const BAND_COPY: Readonly<Record<HealthResult["band"], string>> = {
  "ats-ready": "This resume parses cleanly and should survive automated screening.",
  "minor-fixes": "This resume is close. A few specific fixes would put it in good shape.",
  "needs-work": "This resume has real problems that will cost you responses.",
  "will-be-filtered": "This resume is likely to be filtered out before a human reads it.",
  unreadable: "This resume cannot be read by an applicant tracking system at all.",
};

const COMPONENT_LABELS: Readonly<Record<string, string>> = {
  parseability: "Machine readability",
  structure: "Sections and contact details",
  content: "Bullet quality",
  skillSurface: "Skills coverage",
  hygiene: "Polish and conventions",
};

export interface LegacyCheck {
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface LegacyIssue {
  section: string;
  severity: LegacySeverity;
  problem: string;
  fix: string;
}

export interface LegacyReview {
  score: number;
  summary: string;
  strengths: string[];
  checks: LegacyCheck[];
  issues: LegacyIssue[];
}

function statusFor(score: number): LegacyCheck["status"] {
  if (score >= 0.85) return "pass";
  if (score >= 0.5) return "warn";
  return "fail";
}

/** Derive the old review shape from a HealthResult. */
export function toLegacyReview(result: HealthResult): LegacyReview {
  const headline =
    result.gatesFailed[0]?.reason ??
    result.fixes[0]?.message ??
    "Nothing significant to fix.";

  return {
    score: result.score,
    summary: `${BAND_COPY[result.band]} ${headline}`,
    strengths: result.components
      .filter((c) => c.score >= STRENGTH_THRESHOLD)
      .map((c) => `${COMPONENT_LABELS[c.id] ?? c.id}: ${c.explanation}`),
    checks: result.components.map((c) => ({
      label: COMPONENT_LABELS[c.id] ?? c.id,
      status: statusFor(c.score),
      detail: c.explanation,
    })),
    issues: result.fixes.map((fix) => ({
      section: COMPONENT_LABELS[fix.component] ?? fix.component,
      severity: SEVERITY_MAP[fix.severity],
      problem: fix.message,
      fix: fix.howToFix,
    })),
  };
}

/** The record persisted at `data.resumeReview`: the real result plus the
 *  derived fields the existing UI reads. */
export function toStoredReview(result: HealthResult): HealthResult & LegacyReview {
  return { ...result, ...toLegacyReview(result) };
}
