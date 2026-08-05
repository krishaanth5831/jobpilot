// The deterministic resume-health engine.
//
// `computeHealth` is pure and synchronous: no network, no clock, no randomness,
// no LLM. Parsers and the classifier supply counts and booleans; everything
// below is arithmetic.
//
// JOB-AGNOSTIC: nothing here imports or references a job posting. A resume's
// health is a property of the document.
//
// FAIRNESS: name, age, gender, ethnicity, nationality, university and
// graduation year are never read. Photo PRESENCE is a formatting signal and is
// locale-gated; the image itself is never decoded or described.

import { createHash } from "node:crypto";

import { SEVERITY_CRITICAL_POINTS, SEVERITY_MAJOR_POINTS, bandFor, calibrate } from "./calibrate";
import { ISSUES } from "./fixes";
import { TAXONOMY_VERSION } from "../matching/taxonomy/data";
import { SKILL_BY_ID } from "../matching/taxonomy/data";
import type {
  Band,
  ComponentId,
  Fix,
  GateFailure,
  HealthComponent,
  HealthInput,
  HealthResult,
  Metrics,
  Severity,
} from "./types";

/** Bumped on any change that can move a score. Persisted with every result. */
export const HEALTH_VERSION = "1.0.0";

export { TAXONOMY_VERSION };

/* -------------------------------------------------------------------------
 * Weights
 * ---------------------------------------------------------------------- */

/**
 * Parseability dominates: a resume the parser cannot read is worth nothing
 * however well written it is. Hygiene is smallest because its items are real
 * but individually survivable.
 */
export const WEIGHTS: Readonly<Record<ComponentId, number>> = {
  parseability: 0.35,
  structure: 0.2,
  content: 0.25,
  skillSurface: 0.12,
  hygiene: 0.08,
};

export const WEIGHT_SUM_TOLERANCE = 1e-9;

(function assertWeightsSumToOne(): void {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
    throw new Error(`WEIGHTS must sum to 1.0, got ${sum}`);
  }
})();

export const COMPONENT_ORDER: readonly ComponentId[] = [
  "parseability",
  "structure",
  "content",
  "skillSurface",
  "hygiene",
];

/* -------------------------------------------------------------------------
 * Parseability constants
 * ---------------------------------------------------------------------- */

/** Below this share of fields recovered, the naive parse has effectively
 *  failed and the biggest single penalty applies. */
export const FIELD_RECOVERY_SEVERE_THRESHOLD = 0.5;
export const FIELD_RECOVERY_PARTIAL_THRESHOLD = 0.8;
export const FIELD_RECOVERY_SEVERE_PENALTY = 0.4;
export const FIELD_RECOVERY_PARTIAL_PENALTY = 0.2;

/** Columns interleave under naive extraction — the single most damaging layout
 *  choice a resume can make. */
export const MULTI_COLUMN_PENALTY = 0.25;
/** Real PDF headers/footers are frequently dropped wholesale by ATS parsers. */
export const CONTACT_HEADER_FOOTER_PENALTY = 0.2;
export const TABLES_PENALTY = 0.15;
export const SHAPES_PENALTY = 0.15;
/** Skills drawn as rating bars carry no text for a keyword search to find. */
export const GRAPHIC_SKILLS_PENALTY = 0.15;
export const NONSTANDARD_HEADING_PENALTY = 0.1;
export const NONSTANDARD_HEADING_CAP = 0.3;
/** Substituted fonts are where ligatures turn into run-together words. */
export const NON_EMBEDDED_FONTS_PENALTY = 0.1;
export const WRONG_FILE_TYPE_PENALTY = 0.3;
/** Below this, extracted text is damaged enough to deduct the shortfall. */
export const TEXT_INTEGRITY_THRESHOLD = 0.9;

/* -------------------------------------------------------------------------
 * Structure constants
 * ---------------------------------------------------------------------- */

export const MISSING_CONTACT_PENALTY = 0.1;
export const MISSING_SECTION_PENALTY = 0.2;
export const ROLE_IDENTITY_PENALTY = 0.1;
export const ROLE_IDENTITY_CAP = 0.3;
export const ROLE_DATES_PENALTY = 0.15;
export const ROLE_DATES_CAP = 0.3;
export const NOT_REVERSE_CHRONOLOGICAL_PENALTY = 0.1;
/** Deliberately small and tightly capped: the user base is students, and a
 *  gap is far more often study or caring than a problem worth flagging. */
export const EMPLOYMENT_GAP_PENALTY = 0.05;
export const EMPLOYMENT_GAP_CAP = 0.1;
/** Months of silence before a gap is even counted. */
export const EMPLOYMENT_GAP_MONTHS = 6;

/* -------------------------------------------------------------------------
 * Content constants
 * ---------------------------------------------------------------------- */

/** Half the bullets carrying a number is full marks — demanding every bullet
 *  be quantified produces padded, dishonest resumes. */
export const QUANTIFICATION_TARGET = 0.5;
/** Cliché count at which the term bottoms out. */
export const CLICHE_FLOOR_COUNT = 5;

export const CONTENT_SUBWEIGHTS = {
  quantification: 0.4,
  actionVerbs: 0.25,
  concision: 0.2,
  cliches: 0.15,
} as const;

/* -------------------------------------------------------------------------
 * Skill-surface constants
 * ---------------------------------------------------------------------- */

/** A resume listing 12-20 recognisable skills reads as specific without
 *  turning into a keyword dump. */
export const SKILL_COUNT_IDEAL_MIN = 12;
export const SKILL_COUNT_IDEAL_MAX = 20;
export const SKILL_COUNT_ACCEPTABLE_MIN = 8;
export const SKILL_COUNT_ACCEPTABLE_MAX = 30;
export const SKILL_COUNT_IDEAL_SCORE = 1.0;
export const SKILL_COUNT_ACCEPTABLE_SCORE = 0.7;
export const SKILL_COUNT_POOR_SCORE = 0.3;

/** Full marks once this share of listed skills are hard/technical. */
export const HARD_SKILL_TARGET = 0.7;

/** Taxonomy families that are not hard technical skills. */
export const SOFT_SKILL_FAMILIES: readonly string[] = ["family:soft"];

export const SKILL_SUBWEIGHTS = {
  count: 0.35,
  evidenced: 0.3,
  acronymCoverage: 0.2,
  hardSoftRatio: 0.15,
} as const;

/* -------------------------------------------------------------------------
 * Hygiene constants
 * ---------------------------------------------------------------------- */

export const LENGTH_PENALTY = 0.2;
/** Years of experience below which a resume should fit on one page. */
export const ONE_PAGE_YEARS = 3;
export const MAX_PAGES_EXPERIENCED = 2;

/** Only these markets treat a photo as a filtering risk. Elsewhere — NL, DE,
 *  FR and much of Europe — a photo is a normal convention and penalising it
 *  would be a bug, not a standard. */
export const PHOTO_PENALTY_LOCALES: readonly string[] = ["US", "UK", "CA", "AU"];
export const PHOTO_PENALTY = 0.25;

export const PRONOUN_PENALTY = 0.1;
export const TENSE_PENALTY = 0.1;
export const SPELLING_PENALTY = 0.05;
export const SPELLING_CAP = 0.2;
export const DATE_FORMAT_PENALTY = 0.1;

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const roundScore = (n: number): number => Math.round(n * 1e6) / 1e6;
const toDisplayInt = (n: number): number => Math.round(n);
const ratio = (numerator: number, denominator: number): number =>
  denominator <= 0 ? 0 : clamp01(numerator / denominator);

/** Content hash of the extracted text — the classifier cache key, and the
 *  thing that tells a stored score which document it belongs to. */
export function contentHashOf(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/* -------------------------------------------------------------------------
 * Metric derivation
 * ---------------------------------------------------------------------- */

function skillCountScore(count: number): number {
  if (count >= SKILL_COUNT_IDEAL_MIN && count <= SKILL_COUNT_IDEAL_MAX) {
    return SKILL_COUNT_IDEAL_SCORE;
  }
  if (count >= SKILL_COUNT_ACCEPTABLE_MIN && count <= SKILL_COUNT_ACCEPTABLE_MAX) {
    return SKILL_COUNT_ACCEPTABLE_SCORE;
  }
  return SKILL_COUNT_POOR_SCORE;
}

/**
 * Share of skills whose acronym and full expansion BOTH appear in the text.
 * Only skills that actually have an acronym form count towards the
 * denominator — "Python" has nothing to expand, so it is not applicable.
 */
export function acronymCoverage(rawText: string, canonicalIds: readonly string[]): number {
  const haystack = rawText.toLowerCase();
  let applicable = 0;
  let covered = 0;

  for (const id of canonicalIds) {
    const entry = SKILL_BY_ID.get(id);
    if (entry === undefined) continue;

    // An acronym alias is short, has no spaces, and the label is multi-word.
    const acronyms = entry.aliases.filter((a) => a.length <= 5 && !a.includes(" "));
    const expansionIsMultiWord = entry.label.includes(" ");
    if (acronyms.length === 0 || !expansionIsMultiWord) continue;

    applicable++;
    const hasExpansion = haystack.includes(entry.label.toLowerCase());
    const hasAcronym = acronyms.some((a) => haystack.includes(a.toLowerCase()));
    if (hasExpansion && hasAcronym) covered++;
  }

  // No skills at all is not full marks — there is nothing to score. Only a
  // resume that HAS skills, none of which have an acronym form, is exempt.
  if (canonicalIds.length === 0) return 0;
  return applicable === 0 ? 1 : covered / applicable;
}

/** Share of listed skills that are hard/technical rather than soft. */
export function hardSkillRatio(canonicalIds: readonly string[]): number {
  if (canonicalIds.length === 0) return 0;
  const hard = canonicalIds.filter((id) => {
    const entry = SKILL_BY_ID.get(id);
    return entry !== undefined && !SOFT_SKILL_FAMILIES.includes(entry.familyId);
  }).length;
  return hard / canonicalIds.length;
}

/** True when roles are not listed newest-first. */
export function isNotReverseChronological(
  roles: readonly { startMonth: number | null }[],
): boolean {
  const dated = roles.map((r) => r.startMonth).filter((m): m is number => m !== null);
  for (let i = 1; i < dated.length; i++) {
    const previous = dated[i - 1];
    const current = dated[i];
    if (previous === undefined || current === undefined) continue;
    if (current > previous) return true;
  }
  return false;
}

/** Count gaps longer than the threshold between consecutive roles. */
export function countEmploymentGaps(
  roles: readonly { startMonth: number | null; endMonth: number | null }[],
): number {
  const spans = roles
    .filter((r) => r.startMonth !== null)
    .map((r) => ({ start: r.startMonth as number, end: r.endMonth }))
    .sort((a, b) => b.start - a.start);

  let gaps = 0;
  for (let i = 1; i < spans.length; i++) {
    const newer = spans[i - 1];
    const older = spans[i];
    if (newer === undefined || older === undefined) continue;
    // An open-ended older role overlaps everything after it — not a gap.
    if (older.end === null) continue;
    if (newer.start - older.end > EMPLOYMENT_GAP_MONTHS) gaps++;
  }
  return gaps;
}

/** Derive every scoring term from the raw input, exactly once. */
export function deriveMetrics(input: HealthInput): Metrics {
  const { parseReport, profile, contentStats, rawText, locale } = input;
  const doc = parseReport.document;

  const fieldRecoveryPenalty =
    parseReport.fieldRecovery < FIELD_RECOVERY_SEVERE_THRESHOLD
      ? FIELD_RECOVERY_SEVERE_PENALTY
      : parseReport.fieldRecovery < FIELD_RECOVERY_PARTIAL_THRESHOLD
        ? FIELD_RECOVERY_PARTIAL_PENALTY
        : 0;

  const canonicalIds = profile.skills.map((s) => s.canonicalId);
  const bullets = contentStats.bulletsTotal;

  const years = profile.totalMonthsExperience / 12;
  const maxPages = years < ONE_PAGE_YEARS ? 1 : MAX_PAGES_EXPERIENCED;

  return {
    fieldRecoveryPenalty,
    multiColumn: parseReport.multiColumnDetected,
    contactInHeaderFooter: parseReport.contactInHeaderFooter,
    textInTables: parseReport.textInTables,
    textInShapes: parseReport.textInShapes,
    skillsOnlyInGraphics: doc.skillsOnlyInGraphics,
    nonStandardHeadings: doc.nonStandardHeadingCount,
    nonEmbeddedFonts: parseReport.nonEmbeddedFonts,
    wrongFileType: parseReport.fileType !== "application/pdf",
    textIntegrity: clamp01(parseReport.textIntegrity),

    missingContact: {
      email: !doc.contact.email,
      phone: !doc.contact.phone,
      city: !doc.contact.city,
      linkedin: !doc.contact.linkedin,
    },
    missingSections: {
      experience: !doc.sections.experience,
      education: !doc.sections.education,
      skills: !doc.sections.skills,
    },
    rolesMissingIdentity: doc.roles.filter((r) => r.title === null || r.company === null).length,
    rolesUnparseableDates: doc.roles.filter((r) => !r.datesParseable).length,
    notReverseChronological: isNotReverseChronological(doc.roles),
    employmentGaps: countEmploymentGaps(doc.roles),

    bulletsTotal: bullets,
    quantification: clamp01(ratio(contentStats.bulletsWithMetric, bullets) / QUANTIFICATION_TARGET),
    actionVerbs: ratio(contentStats.bulletsWithStrongVerb, bullets),
    concision: bullets === 0 ? 0 : 1 - ratio(contentStats.bulletsOverTwoLines, bullets),
    cliches: clamp01(1 - contentStats.clichePhraseCount / CLICHE_FLOOR_COUNT),

    resolvedSkillCount: canonicalIds.length,
    skillCountScore: skillCountScore(canonicalIds.length),
    evidenced: ratio(contentStats.skillsEvidencedInBullets.length, canonicalIds.length),
    acronymCoverage: acronymCoverage(rawText, canonicalIds),
    hardSoftRatio: clamp01(hardSkillRatio(canonicalIds) / HARD_SKILL_TARGET),

    lengthWrong: doc.pageCount > maxPages,
    photoPenalised: doc.photoPresent && PHOTO_PENALTY_LOCALES.includes(locale),
    pronouns: contentStats.firstPersonPronounCount > 0,
    tenseInconsistent: contentStats.tenseInconsistencies > 0,
    spellingErrors: Math.max(0, contentStats.spellingErrors),
    inconsistentDates: doc.dateFormatsSeen.length > 1,
  };
}

/* -------------------------------------------------------------------------
 * Components
 * ---------------------------------------------------------------------- */

export function parseabilityScore(m: Metrics): number {
  let score = 1;
  score -= m.fieldRecoveryPenalty;
  if (m.multiColumn) score -= MULTI_COLUMN_PENALTY;
  if (m.contactInHeaderFooter) score -= CONTACT_HEADER_FOOTER_PENALTY;
  if (m.textInTables) score -= TABLES_PENALTY;
  if (m.textInShapes) score -= SHAPES_PENALTY;
  if (m.skillsOnlyInGraphics) score -= GRAPHIC_SKILLS_PENALTY;
  score -= Math.min(NONSTANDARD_HEADING_CAP, m.nonStandardHeadings * NONSTANDARD_HEADING_PENALTY);
  if (m.nonEmbeddedFonts) score -= NON_EMBEDDED_FONTS_PENALTY;
  if (m.wrongFileType) score -= WRONG_FILE_TYPE_PENALTY;
  if (m.textIntegrity < TEXT_INTEGRITY_THRESHOLD) score -= 1 - m.textIntegrity;
  return clamp01(score);
}

export function structureScore(m: Metrics): number {
  let score = 1;
  for (const missing of Object.values(m.missingContact)) {
    if (missing) score -= MISSING_CONTACT_PENALTY;
  }
  for (const missing of Object.values(m.missingSections)) {
    if (missing) score -= MISSING_SECTION_PENALTY;
  }
  score -= Math.min(ROLE_IDENTITY_CAP, m.rolesMissingIdentity * ROLE_IDENTITY_PENALTY);
  score -= Math.min(ROLE_DATES_CAP, m.rolesUnparseableDates * ROLE_DATES_PENALTY);
  if (m.notReverseChronological) score -= NOT_REVERSE_CHRONOLOGICAL_PENALTY;
  score -= Math.min(EMPLOYMENT_GAP_CAP, m.employmentGaps * EMPLOYMENT_GAP_PENALTY);
  return clamp01(score);
}

export function contentScore(m: Metrics): number {
  // No bullets at all is not a low score, it is a different failure: there is
  // nothing for a recruiter to read. The matching critical fix says so.
  if (m.bulletsTotal === 0) return 0;
  return clamp01(
    CONTENT_SUBWEIGHTS.quantification * m.quantification +
      CONTENT_SUBWEIGHTS.actionVerbs * m.actionVerbs +
      CONTENT_SUBWEIGHTS.concision * m.concision +
      CONTENT_SUBWEIGHTS.cliches * m.cliches,
  );
}

export function skillSurfaceScore(m: Metrics): number {
  return clamp01(
    SKILL_SUBWEIGHTS.count * m.skillCountScore +
      SKILL_SUBWEIGHTS.evidenced * m.evidenced +
      SKILL_SUBWEIGHTS.acronymCoverage * m.acronymCoverage +
      SKILL_SUBWEIGHTS.hardSoftRatio * m.hardSoftRatio,
  );
}

export function hygieneScore(m: Metrics): number {
  let score = 1;
  if (m.lengthWrong) score -= LENGTH_PENALTY;
  if (m.photoPenalised) score -= PHOTO_PENALTY;
  if (m.pronouns) score -= PRONOUN_PENALTY;
  if (m.tenseInconsistent) score -= TENSE_PENALTY;
  score -= Math.min(SPELLING_CAP, m.spellingErrors * SPELLING_PENALTY);
  if (m.inconsistentDates) score -= DATE_FORMAT_PENALTY;
  return clamp01(score);
}

export interface ScoredMetrics {
  scores: Record<ComponentId, number>;
  rawScore: number;
  calibrated: number;
}

/** Score a metric set. The whole engine funnels through here, including every
 *  counterfactual re-run behind `pointsRecoverable`. */
export function scoreFromMetrics(m: Metrics): ScoredMetrics {
  const scores: Record<ComponentId, number> = {
    parseability: parseabilityScore(m),
    structure: structureScore(m),
    content: contentScore(m),
    skillSurface: skillSurfaceScore(m),
    hygiene: hygieneScore(m),
  };

  let rawScore = 0;
  for (const id of COMPONENT_ORDER) rawScore += WEIGHTS[id] * scores[id];
  rawScore = roundScore(Math.min(100, Math.max(0, rawScore * 100)));

  return { scores, rawScore, calibrated: calibrate(rawScore) };
}

/* -------------------------------------------------------------------------
 * Gates
 * ---------------------------------------------------------------------- */

export const GATE_IDS = {
  noTextLayer: "noTextLayer",
  noContact: "noContact",
  corrupt: "corrupt",
} as const;

/** Exactly three, and no more may be added. Everything else is a deduction. */
export function evaluateGates(input: HealthInput): GateFailure[] {
  const failures: GateFailure[] = [];
  const doc = input.parseReport.document;

  if (!input.parseReport.hasTextLayer) {
    failures.push({
      gate: GATE_IDS.noTextLayer,
      reason:
        "This file has no selectable text — it is a scan or an image. An ATS reads text, so it sees a blank page.",
    });
  }

  if (!doc.contact.email && !doc.contact.phone && !doc.contact.linkedin) {
    failures.push({
      gate: GATE_IDS.noContact,
      reason:
        "No email address, phone number or LinkedIn URL could be found. Nobody can reply to this resume.",
    });
  }

  if (input.parseReport.fileType === "" || input.parseReport.document.pageCount === 0) {
    failures.push({
      gate: GATE_IDS.corrupt,
      reason: "This file could not be opened or contains no pages.",
    });
  }

  return failures;
}

/* -------------------------------------------------------------------------
 * Explanations
 * ---------------------------------------------------------------------- */

const pct = (n: number): string => `${Math.round(n * 100)}%`;

function explain(id: ComponentId, m: Metrics, input: HealthInput): string {
  switch (id) {
    case "parseability": {
      const lost = input.parseReport.missingFields;
      return lost.length > 0
        ? `A basic parser recovered ${pct(input.parseReport.fieldRecovery)} of your details and lost: ${lost.join(", ")}.`
        : `A basic parser recovered ${pct(input.parseReport.fieldRecovery)} of your details with no layout traps detected.`;
    }
    case "structure": {
      const missing = [
        ...Object.entries(m.missingSections).filter(([, v]) => v).map(([k]) => k),
        ...Object.entries(m.missingContact).filter(([, v]) => v).map(([k]) => k),
      ];
      return missing.length > 0
        ? `Missing or unrecognised: ${missing.join(", ")}.`
        : "All standard sections and contact details were found.";
    }
    case "content":
      return m.bulletsTotal === 0
        ? "No bullet points were found at all — there is nothing for a recruiter to skim."
        : `${m.bulletsTotal} bullets: ${pct(m.quantification)} of the quantification target, ${pct(m.actionVerbs)} led by a strong verb.`;
    case "skillSurface":
      return `${m.resolvedSkillCount} recognisable skills, ${pct(m.evidenced)} of them backed up by a bullet.`;
    case "hygiene": {
      const issues = [
        m.lengthWrong ? "length" : null,
        m.photoPenalised ? "photo" : null,
        m.pronouns ? "first-person pronouns" : null,
        m.tenseInconsistent ? "tense" : null,
        m.spellingErrors > 0 ? `${m.spellingErrors} spelling errors` : null,
        m.inconsistentDates ? "date formats" : null,
      ].filter((s): s is string => s !== null);
      return issues.length > 0 ? `Polish needed: ${issues.join(", ")}.` : "No polish issues found.";
    }
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

function severityFor(points: number): Severity {
  if (points >= SEVERITY_CRITICAL_POINTS) return "critical";
  if (points >= SEVERITY_MAJOR_POINTS) return "major";
  return "minor";
}

/* -------------------------------------------------------------------------
 * Public entry point
 * ---------------------------------------------------------------------- */

/** Score a resume. Pure, synchronous, job-agnostic. */
export function computeHealth(input: HealthInput): HealthResult {
  const metrics = deriveMetrics(input);
  const scored = scoreFromMetrics(metrics);
  const gatesFailed = evaluateGates(input);
  const contentHash = contentHashOf(input.rawText);

  const components: HealthComponent[] = COMPONENT_ORDER.map((id) => {
    const score = roundScore(scored.scores[id]);
    return {
      id,
      score,
      weight: WEIGHTS[id],
      contribution: roundScore(score * WEIGHTS[id] * 100),
      explanation: explain(id, metrics, input),
    };
  });

  if (gatesFailed.length > 0) {
    return {
      score: 0,
      rawScore: 0,
      band: "unreadable" satisfies Band,
      gatesFailed,
      components,
      // A gated resume gets the gate reasons, not a fix list — there is exactly
      // one thing to do, and it is stated in the gate.
      fixes: [],
      parseReport: input.parseReport,
      healthVersion: HEALTH_VERSION,
      taxonomyVersion: TAXONOMY_VERSION,
      contentHash,
    };
  }

  const score = toDisplayInt(scored.calibrated);

  // Every fix's points come from re-scoring with that ONE metric set to its
  // ideal value. Nothing here is estimated.
  const fixes: Fix[] = ISSUES.filter((issue) => issue.detect(metrics))
    .map((issue) => {
      const resolved = scoreFromMetrics(issue.resolve(metrics));
      const pointsRecoverable = toDisplayInt(resolved.calibrated) - score;
      return {
        id: issue.id,
        severity: severityFor(pointsRecoverable),
        component: issue.component,
        pointsRecoverable,
        message: issue.message(metrics, input),
        evidence: issue.evidence(input),
        howToFix: issue.howToFix(metrics, input),
        autoFixable: issue.autoFixable,
      };
    })
    .filter((fix) => fix.pointsRecoverable > 0)
    .sort((a, b) => b.pointsRecoverable - a.pointsRecoverable || a.id.localeCompare(b.id));

  return {
    score,
    rawScore: toDisplayInt(scored.rawScore),
    band: bandFor(score),
    gatesFailed,
    components,
    fixes,
    parseReport: input.parseReport,
    healthVersion: HEALTH_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    contentHash,
  };
}
