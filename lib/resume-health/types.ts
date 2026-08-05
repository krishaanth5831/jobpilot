// Shared types for the deterministic resume-health (ATS) engine.
//
// ARCHITECTURAL RULE: parsers and one LLM classifier produce counts and
// booleans. `computeHealth` turns those into a score with pure arithmetic.
// The classifier never emits a score, a rating, or a judgement.
//
// JOB-AGNOSTIC BY CONSTRUCTION: nothing in this directory imports `JobPosting`
// or anything else from the matching engine's job side. Resume health is about
// the document, not about any particular role. The only thing shared with
// lib/matching is the skill taxonomy and the `UserProfile` type.

import type { UserProfile } from "../matching/types";

export type Severity = "critical" | "major" | "minor";

export type ComponentId =
  | "parseability"
  | "structure"
  | "content"
  | "skillSurface"
  | "hygiene";

export type Band =
  | "ats-ready"
  | "minor-fixes"
  | "needs-work"
  | "will-be-filtered"
  | "unreadable";

/**
 * Where a photo on a resume is a normal convention and where it is a filtering
 * risk. Only the four anglophone markets penalise it; NL/DE/FR and much of
 * Europe expect one. Default is NL.
 */
export type Locale =
  | "US"
  | "UK"
  | "CA"
  | "AU"
  | "NL"
  | "DE"
  | "FR"
  | "BE"
  | "ES"
  | "IT"
  | "PT"
  | "PL"
  | "SE"
  | "OTHER";

export interface Evidence {
  page: number;
  line: number | null;
  snippet: string;
}

export interface Fix {
  id: string;
  severity: Severity;
  component: ComponentId;
  /** Exact points the calibrated score rises by if this issue is resolved.
   *  Computed by re-running `computeHealth` with the issue cleared. */
  pointsRecoverable: number;
  message: string;
  evidence: Evidence | null;
  howToFix: string;
  /** True when jobblast's own resume editor could apply the change itself. */
  autoFixable: boolean;
}

/* -------------------------------------------------------------------------
 * Parser output
 * ---------------------------------------------------------------------- */

/** One role as the parser recovered it, for the structure component. */
export interface ParsedRole {
  title: string | null;
  company: string | null;
  /** Months since year 0, for ordering and gap maths. Null when unparseable. */
  startMonth: number | null;
  endMonth: number | null;
  datesParseable: boolean;
  evidence: Evidence | null;
}

/**
 * SPEC EXTENSION, DELIBERATE. The structure and hygiene components need facts
 * that none of the five `HealthInput` fields carry — which roles were found,
 * whether a phone number exists, how many pages the document is. Rather than
 * add a sixth top-level input, those live here: they are parser output, this
 * is the parser's report, and putting them here means `HealthResult` carries
 * them to the UI for free.
 */
export interface DocumentFacts {
  pageCount: number;
  /** Presence only. The image is never decoded, described or classified —
   *  a photo's CONTENT is a protected characteristic and is never inspected. */
  photoPresent: boolean;
  contact: {
    email: boolean;
    phone: boolean;
    city: boolean;
    linkedin: boolean;
  };
  sections: {
    experience: boolean;
    education: boolean;
    skills: boolean;
    projects: boolean;
    summary: boolean;
  };
  /** Headings that exist but are not one of the ATS-standard names — "What I
   *  Bring To The Table" instead of "Experience". */
  nonStandardHeadingCount: number;
  roles: ParsedRole[];
  /** Distinct date formats seen, e.g. ["Mon YYYY", "MM/YYYY"]. */
  dateFormatsSeen: string[];
  /** Skills rendered only as rating bars or graphics, with no text backing. */
  skillsOnlyInGraphics: boolean;
}

export interface ParseReport {
  hasTextLayer: boolean;
  /** 0-1 — fraction of the rich parse's fields the naive parse also recovered. */
  fieldRecovery: number;
  /** 0-1 — how intact the extracted text is (run-together words, mojibake). */
  textIntegrity: number;
  /** 0-1 — fraction of the standard sections a dumb regex pass could find. */
  sectionDetection: number;
  multiColumnDetected: boolean;
  contactInHeaderFooter: boolean;
  textInTables: boolean;
  textInShapes: boolean;
  nonEmbeddedFonts: boolean;
  fileType: string;
  /** Field names the rich parse found and the naive parse lost. Drives the
   *  most valuable user-facing messages. */
  missingFields: string[];
  document: DocumentFacts;
}

/* -------------------------------------------------------------------------
 * Classifier output
 * ---------------------------------------------------------------------- */

/** Counts only. No score, no rating, no verdict — see classify.ts. */
export interface ContentStats {
  bulletsTotal: number;
  bulletsWithMetric: number;
  bulletsWithStrongVerb: number;
  bulletsPassiveOrDuty: number;
  bulletsOverTwoLines: number;
  clichePhraseCount: number;
  firstPersonPronounCount: number;
  tenseInconsistencies: number;
  spellingErrors: number;
  /** Canonical taxonomy ids. The model reports raw phrases; classify.ts
   *  resolves them, so an unknown id can never reach the scorer. */
  skillsEvidencedInBullets: string[];
}

/* -------------------------------------------------------------------------
 * Engine input and output
 * ---------------------------------------------------------------------- */

export interface HealthInput {
  parseReport: ParseReport;
  /** Reused verbatim from the matching engine — one resume, one profile type. */
  profile: UserProfile;
  contentStats: ContentStats;
  rawText: string;
  locale: Locale;
}

/**
 * Every individual term the five components are built from, derived once from
 * `HealthInput`.
 *
 * This indirection is what makes `Fix.pointsRecoverable` exactly true rather
 * than estimated: an issue is "resolved" by setting its own term to the ideal
 * value and re-scoring, which changes that term and nothing else. Patching the
 * raw input instead would leak — raising the skill count would also move the
 * evidenced-skills ratio, and the reported delta would be a lie.
 */
export interface Metrics {
  // -- parseability --
  /** 0, 0.20 or 0.40, from the fieldRecovery band. */
  fieldRecoveryPenalty: number;
  multiColumn: boolean;
  contactInHeaderFooter: boolean;
  textInTables: boolean;
  textInShapes: boolean;
  skillsOnlyInGraphics: boolean;
  nonStandardHeadings: number;
  nonEmbeddedFonts: boolean;
  wrongFileType: boolean;
  textIntegrity: number;

  // -- structure --
  missingContact: { email: boolean; phone: boolean; city: boolean; linkedin: boolean };
  missingSections: { experience: boolean; education: boolean; skills: boolean };
  rolesMissingIdentity: number;
  rolesUnparseableDates: number;
  notReverseChronological: boolean;
  employmentGaps: number;

  // -- content --
  bulletsTotal: number;
  quantification: number;
  actionVerbs: number;
  concision: number;
  cliches: number;

  // -- skillSurface --
  resolvedSkillCount: number;
  skillCountScore: number;
  evidenced: number;
  acronymCoverage: number;
  hardSoftRatio: number;

  // -- hygiene --
  lengthWrong: boolean;
  photoPenalised: boolean;
  pronouns: boolean;
  tenseInconsistent: boolean;
  spellingErrors: number;
  inconsistentDates: boolean;
}

export interface HealthComponent {
  id: ComponentId;
  score: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface GateFailure {
  gate: string;
  reason: string;
}

export interface HealthResult {
  /** 0-100 calibrated, user-facing. */
  score: number;
  rawScore: number;
  band: Band;
  gatesFailed: GateFailure[];
  components: HealthComponent[];
  /** Sorted descending by pointsRecoverable. */
  fixes: Fix[];
  parseReport: ParseReport;
  healthVersion: string;
  taxonomyVersion: string;
  contentHash: string;
}
