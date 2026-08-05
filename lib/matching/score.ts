// The deterministic match-scoring engine.
//
// `computeMatch` is pure and synchronous: no network, no clock (unless one is
// injected), no randomness, no LLM. The same profile and posting always
// produce byte-identical output. Everything upstream of here — resume
// parsing, job-description reading — is where models are allowed to live;
// they extract facts, and this file does the arithmetic.
//
// FAIRNESS: name, photo, age, gender, ethnicity, university and graduation
// year are never read. `UserProfile` carries `education.graduationDate` for
// display only, and nothing below touches it. The fairness test in
// __tests__/score.test.ts perturbs those inputs and asserts the output is
// unchanged.

import { bandFor, calibrate } from "./calibrate";
import { computeConfidence, displayRangeFor } from "./confidence";
import { fieldSimilarity, skillDistance, skillLabel } from "./taxonomy/graph";
import { TAXONOMY_VERSION } from "./taxonomy/data";
import type {
  Band,
  ComponentId,
  ComponentResult,
  GateFailure,
  JobPosting,
  MatchOptions,
  MatchResult,
  SkillGap,
  SkillSource,
  SkillStrength,
  UserProfile,
  WeightedSkill,
} from "./types";

/** Bumped on any change that can move a score. Persisted with every result so
 *  a stored score always names the algorithm that produced it. */
export const SCORE_VERSION = "1.0.0";

export { TAXONOMY_VERSION };

/* -------------------------------------------------------------------------
 * Weights
 * ---------------------------------------------------------------------- */

/**
 * Component weights. Required skills dominate because a posting's must-haves
 * are what a recruiter screens on first; logistics is smallest because it is
 * usually negotiable and the genuinely disqualifying cases are gates, not
 * penalties.
 */
export const WEIGHTS: Readonly<Record<ComponentId, number>> = {
  requiredSkills: 0.35,
  preferredSkills: 0.15,
  experience: 0.2,
  domain: 0.12,
  education: 0.1,
  logistics: 0.08,
};

/** Floating-point slack for the weights-sum assertion. */
export const WEIGHT_SUM_TOLERANCE = 1e-9;

(function assertWeightsSumToOne(): void {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
    throw new Error(`WEIGHTS must sum to 1.0, got ${sum}`);
  }
})();

/** Fixed render order for `components`, so output is stable across runs. */
export const COMPONENT_ORDER: readonly ComponentId[] = [
  "requiredSkills",
  "preferredSkills",
  "experience",
  "domain",
  "education",
  "logistics",
];

/* -------------------------------------------------------------------------
 * Skill match quality
 * ---------------------------------------------------------------------- */

/**
 * Quality credited for an exact taxonomy hit, by where the evidence came from.
 * Paid work is full credit; a project is most of the way there; a bare line in
 * a "Skills:" list is the weakest claim a resume can make.
 */
export const EXACT_MATCH_QUALITY: Readonly<Record<SkillSource, number>> = {
  experience: 1.0,
  project: 0.75,
  listed: 0.6,
};

/** Quality credited for a near-miss, keyed by `skillDistance`. Distance 1 is a
 *  parent/child or same-family skill (Vue when the posting wants React);
 *  distance 2 is the same broad domain and worth only token credit. */
export const NEAR_MATCH_QUALITY: Readonly<Record<1 | 2, number>> = {
  1: 0.5,
  2: 0.25,
};

/** No evidence at all. */
export const NO_MATCH_QUALITY = 0;

/**
 * Convex exponent on the required-skills ratio. Above 1 it punishes gaps
 * super-linearly: missing a third of the must-haves should cost far more than
 * a third of the component, because postings are screened conjunctively.
 */
export const REQUIRED_SKILLS_EXPONENT = 1.5;

/**
 * Concave exponent on the preferred-skills ratio. Below 1 it gives diminishing
 * returns: the first couple of nice-to-haves matter, the eighth does not.
 */
export const PREFERRED_SKILLS_EXPONENT = 0.7;

/* -------------------------------------------------------------------------
 * Experience
 * ---------------------------------------------------------------------- */

/** Penalty slope per year BELOW the stated minimum, as a fraction of the
 *  requirement. 1.2 means falling a full requirement short zeroes the base. */
export const UNDER_EXPERIENCE_SLOPE = 1.2;

/** Penalty per year ABOVE the stated maximum. Gentle: being overqualified is
 *  a real signal to employers but a much weaker one than being underqualified. */
export const OVER_EXPERIENCE_SLOPE = 0.15;

/** Overqualification can never drag the experience component below this. Years
 *  of extra experience are still experience — the floor stops a 20-year
 *  veteran from scoring zero against a mid-level posting. */
export const OVER_EXPERIENCE_FLOOR = 0.55;

/** Penalty per level of seniority mismatch, and its cap. */
export const SENIORITY_PENALTY_PER_LEVEL = 0.15;
export const SENIORITY_PENALTY_CAP = 0.3;

/* -------------------------------------------------------------------------
 * Domain
 * ---------------------------------------------------------------------- */

/** Cosine similarity below this is treated as unrelated. Real text embeddings
 *  rarely fall under ~0.5 even for unrelated documents, so the useful signal
 *  lives above it and the raw value would otherwise compress everything. */
export const DOMAIN_COSINE_FLOOR = 0.5;

/** Cosine similarity at or above this is treated as a full domain match. */
export const DOMAIN_COSINE_CEILING = 0.95;

/* -------------------------------------------------------------------------
 * Education
 * ---------------------------------------------------------------------- */

/** Degree at or above the requirement. */
export const DEGREE_MATCH_FULL = 1.0;
/** Exactly one level short — a bachelor's against a master's ask. */
export const DEGREE_MATCH_ONE_SHORT = 0.6;
/** Two or more levels short. Non-zero because most postings treat the degree
 *  line as a preference regardless of how it is written. */
export const DEGREE_MATCH_FAR_SHORT = 0.2;

export const DEGREE_SUBWEIGHT = 0.6;
export const FIELD_SUBWEIGHT = 0.4;

/** Experience component at or above this counts as "equivalent experience". */
export const EQUIVALENT_EXPERIENCE_THRESHOLD = 0.8;
/** Floor applied to education when the posting accepts equivalent experience
 *  and the candidate has it. */
export const EQUIVALENT_EXPERIENCE_FLOOR = 0.7;

/* -------------------------------------------------------------------------
 * Logistics
 * ---------------------------------------------------------------------- */

/** Onsite role, same country, different city — a commute or a local move. */
export const LOGISTICS_ONSITE_CITY_PENALTY = 0.3;
/** Different country and the candidate is willing to move. Visas, notice
 *  periods and shipping a life across a border are real friction. */
export const LOGISTICS_RELOCATION_PENALTY = 0.5;
/** Hybrid role whose office is in a different city. */
export const LOGISTICS_HYBRID_CITY_PENALTY = 0.2;
/** Each required language the candidate does not meet the CEFR bar for. */
export const LOGISTICS_LANGUAGE_PENALTY = 0.4;

/** CEFR levels in ascending order, for comparing "B2" against "B1". */
export const CEFR_ORDER: readonly string[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Round half-up to an integer. Scores are shown as whole numbers, and
 *  `pointsLost` is a difference of two rounded scores so the arithmetic the
 *  user can do in their head always checks out. */
const roundScore = (n: number): number => Math.round(n * 1e6) / 1e6;
const toDisplayInt = (n: number): number => Math.round(n);

function cefrRank(level: string): number {
  return CEFR_ORDER.indexOf(level.trim().toUpperCase());
}

function sameCountry(a: string | null, b: string | null): boolean | null {
  if (a === null || b === null) return null;
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

function sameCity(a: string | null, b: string | null): boolean | null {
  if (a === null || b === null) return null;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function normalizeCredential(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Cosine similarity. Returns null for mismatched or degenerate vectors rather
 *  than pretending to a number. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number | null {
  if (a.length === 0 || a.length !== b.length) return null;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined) return null;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return null;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* -------------------------------------------------------------------------
 * Gates
 * ---------------------------------------------------------------------- */

/** Stable identifiers for the four hard gates. */
export const GATE_IDS = {
  workAuth: "workAuth",
  credentials: "credentials",
  relocation: "relocation",
  expired: "expired",
} as const;

/**
 * The four disqualifying conditions. Multiplicative: any failure forces the
 * final score to 0 and the band to `ineligible`. This list is closed — no
 * other condition may zero a score.
 */
export function evaluateGates(
  user: UserProfile,
  job: JobPosting,
  now: Date,
): GateFailure[] {
  const failures: GateFailure[] = [];

  // 1. Work authorisation, with no sponsorship on offer.
  if (job.workAuthRequired.length > 0 && !job.sponsorshipAvailable) {
    const userAuth = new Set(user.workAuth.map((c) => c.trim().toUpperCase()));
    const overlap = job.workAuthRequired.some((c) => userAuth.has(c.trim().toUpperCase()));
    if (!overlap) {
      failures.push({
        gate: GATE_IDS.workAuth,
        reason: `Requires work authorisation in ${job.workAuthRequired.join(" or ")} and does not sponsor. Your profile lists ${user.workAuth.length > 0 ? user.workAuth.join(", ") : "no work authorisation"}.`,
      });
    }
  }

  // 2. A required credential the candidate does not hold.
  if (job.requiredCredentials.length > 0) {
    const held = new Set(user.credentials.map(normalizeCredential));
    const missing = job.requiredCredentials.filter((c) => !held.has(normalizeCredential(c)));
    if (missing.length > 0) {
      failures.push({
        gate: GATE_IDS.credentials,
        reason: `Missing required credential${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
      });
    }
  }

  // 3. Onsite in another country, and the candidate will not relocate.
  //    Only fires when both countries are known — an unknown location is not
  //    evidence of a mismatch.
  if (job.location.remotePolicy === "onsite" && !user.location.willingRelocate) {
    const same = sameCountry(user.location.country, job.location.country);
    if (same === false) {
      failures.push({
        gate: GATE_IDS.relocation,
        reason: `Onsite in ${job.location.country ?? "another country"} and you are not open to relocating from ${user.location.country ?? "your country"}.`,
      });
    }
  }

  // 4. The posting has closed.
  if (job.expiresAt !== null) {
    const expiry = new Date(job.expiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) {
      failures.push({
        gate: GATE_IDS.expired,
        reason: `This posting closed on ${job.expiresAt}.`,
      });
    }
  }

  return failures;
}

/* -------------------------------------------------------------------------
 * Skill matching
 * ---------------------------------------------------------------------- */

interface SkillMatchDetail {
  canonicalId: string;
  weight: number;
  /** This skill's share of its list's total weight. */
  weightShare: number;
  quality: number;
}

/**
 * Best quality the candidate can claim for one required/preferred skill.
 *
 * NOTE ON `level` AND `months`: `UserSkill` carries both, and neither is read
 * here. The v1.0.0 quality table is defined purely on exact-match + evidence
 * source and near-match distance. They are extracted and stored so a later
 * scoring version can use them without a re-parse — but adding them now would
 * be a silent deviation from the specified table.
 */
export function skillMatchQuality(canonicalId: string, user: UserProfile): number {
  let best = NO_MATCH_QUALITY;
  for (const owned of user.skills) {
    let quality: number;
    if (owned.canonicalId === canonicalId) {
      quality = EXACT_MATCH_QUALITY[owned.source];
    } else {
      const distance = skillDistance(canonicalId, owned.canonicalId);
      quality = distance === 1 || distance === 2 ? NEAR_MATCH_QUALITY[distance] : NO_MATCH_QUALITY;
    }
    if (quality > best) best = quality;
  }
  return best;
}

/** Key for the counterfactual override map — kind-scoped because the same
 *  canonical id may legitimately appear in both lists. */
type SkillKind = "required" | "preferred";
const overrideKey = (kind: SkillKind, canonicalId: string): string => `${kind}:${canonicalId}`;

function detailsFor(
  skills: readonly WeightedSkill[],
  user: UserProfile,
  kind: SkillKind,
  overrides: ReadonlyMap<string, number>,
): SkillMatchDetail[] {
  const totalWeight = skills.reduce((sum, s) => sum + s.weight, 0);
  return skills.map((s) => {
    const forced = overrides.get(overrideKey(kind, s.canonicalId));
    return {
      canonicalId: s.canonicalId,
      weight: s.weight,
      weightShare: totalWeight === 0 ? 0 : s.weight / totalWeight,
      quality: forced ?? skillMatchQuality(s.canonicalId, user),
    };
  });
}

/** Weighted mean quality across a skill list. Empty list scores 1.0 — a
 *  posting that asks for nothing cannot be failed on skills. */
function weightedQuality(details: readonly SkillMatchDetail[]): number {
  if (details.length === 0) return 1;
  const totalWeight = details.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight === 0) return 1;
  const weighted = details.reduce((sum, d) => sum + d.weight * d.quality, 0);
  return clamp01(weighted / totalWeight);
}

/* -------------------------------------------------------------------------
 * Components
 * ---------------------------------------------------------------------- */

export function experienceScore(user: UserProfile, job: JobPosting): number {
  const years = user.totalMonthsExperience / 12;

  let base: number;
  if (years < job.minYears) {
    base = Math.max(
      0,
      1 - (UNDER_EXPERIENCE_SLOPE * (job.minYears - years)) / Math.max(job.minYears, 1),
    );
  } else if (years <= job.maxYears) {
    base = 1;
  } else {
    base = Math.max(OVER_EXPERIENCE_FLOOR, 1 - OVER_EXPERIENCE_SLOPE * (years - job.maxYears));
  }

  // A candidate with no parsed titles is treated as seniority 0 rather than
  // being exempted — an unstated level is not a matching level.
  const userSeniority = user.titles.reduce((max, t) => Math.max(max, t.seniority), 0);
  const seniorityDelta = Math.abs(userSeniority - job.seniority);
  const penalty = Math.min(SENIORITY_PENALTY_CAP, SENIORITY_PENALTY_PER_LEVEL * seniorityDelta);

  return clamp01(base - penalty);
}

export function domainScore(
  user: UserProfile,
  job: JobPosting,
  requiredScore: number,
  preferredScore: number,
): { score: number; fallbackUsed: boolean } {
  const userEmbedding = user.summaryEmbedding;
  const jobEmbedding = job.descriptionEmbedding;

  if (userEmbedding !== null && jobEmbedding !== null) {
    const cosine = cosineSimilarity(userEmbedding, jobEmbedding);
    if (cosine !== null) {
      const rescaled =
        (cosine - DOMAIN_COSINE_FLOOR) / (DOMAIN_COSINE_CEILING - DOMAIN_COSINE_FLOOR);
      return { score: clamp01(rescaled), fallbackUsed: false };
    }
  }

  // No usable embeddings: stand in with the skills signal, weighted by the two
  // skill components' own weights, and let `confidence` carry the uncertainty.
  const skillWeight = WEIGHTS.requiredSkills + WEIGHTS.preferredSkills;
  const blended =
    (requiredScore * WEIGHTS.requiredSkills + preferredScore * WEIGHTS.preferredSkills) /
    skillWeight;
  return { score: clamp01(blended), fallbackUsed: true };
}

export function educationScore(
  user: UserProfile,
  job: JobPosting,
  experienceComponent: number,
): number {
  const { degreeLevel, fieldId } = user.education;

  let degreeMatch: number;
  if (degreeLevel >= job.degreeRequired) degreeMatch = DEGREE_MATCH_FULL;
  else if (degreeLevel === job.degreeRequired - 1) degreeMatch = DEGREE_MATCH_ONE_SHORT;
  else degreeMatch = DEGREE_MATCH_FAR_SHORT;

  const fieldMatch =
    job.fieldPreferenceId !== null ? fieldSimilarity(fieldId, job.fieldPreferenceId) : 1;

  let score = degreeMatch * DEGREE_SUBWEIGHT + fieldMatch * FIELD_SUBWEIGHT;

  if (job.equivalentExperienceAccepted && experienceComponent >= EQUIVALENT_EXPERIENCE_THRESHOLD) {
    score = Math.max(score, EQUIVALENT_EXPERIENCE_FLOOR);
  }

  return clamp01(score);
}

export function logisticsScore(user: UserProfile, job: JobPosting): number {
  let score = 1;

  const countriesMatch = sameCountry(user.location.country, job.location.country);
  const citiesMatch = sameCity(user.location.city, job.location.city);

  // Onsite, same country, different city: a move or a long commute.
  if (job.location.remotePolicy === "onsite" && countriesMatch === true && citiesMatch === false) {
    score -= LOGISTICS_ONSITE_CITY_PENALTY;
  }

  // Cross-border, and the candidate is open to moving. (When they are not and
  // the role is onsite, the relocation gate has already fired.)
  if (countriesMatch === false && user.location.willingRelocate) {
    score -= LOGISTICS_RELOCATION_PENALTY;
  }

  // Hybrid still needs someone within reach of the office.
  if (job.location.remotePolicy === "hybrid" && citiesMatch === false) {
    score -= LOGISTICS_HYBRID_CITY_PENALTY;
  }

  // Every language bar the candidate does not clear.
  for (const requirement of job.languagesRequired) {
    const required = cefrRank(requirement.minCefr);
    const spoken = user.languages.find(
      (l) => l.lang.trim().toLowerCase() === requirement.lang.trim().toLowerCase(),
    );
    const held = spoken === undefined ? -1 : cefrRank(spoken.cefr);
    if (required >= 0 && held < required) {
      score -= LOGISTICS_LANGUAGE_PENALTY;
    }
  }

  return clamp01(score);
}

/* -------------------------------------------------------------------------
 * Core scoring pass
 * ---------------------------------------------------------------------- */

interface CoreScores {
  scores: Record<ComponentId, number>;
  rawScore: number;
  calibrated: number;
  requiredDetails: SkillMatchDetail[];
  preferredDetails: SkillMatchDetail[];
  embeddingFallbackUsed: boolean;
}

const NO_OVERRIDES: ReadonlyMap<string, number> = new Map();

/**
 * One full scoring pass, optionally with certain skills' quality forced to a
 * fixed value. The override map is how `topGaps` and `topStrengths` are made
 * true rather than estimated: re-run this with a skill pinned to 1.0 (or 0)
 * and diff the calibrated result.
 *
 * Gates are deliberately NOT applied here — they are handled once, in
 * `computeMatch`, so a counterfactual can never accidentally clear a gate.
 */
function scoreCore(
  user: UserProfile,
  job: JobPosting,
  overrides: ReadonlyMap<string, number> = NO_OVERRIDES,
): CoreScores {
  const requiredDetails = detailsFor(job.requiredSkills, user, "required", overrides);
  const preferredDetails = detailsFor(job.preferredSkills, user, "preferred", overrides);

  const requiredRaw = weightedQuality(requiredDetails);
  const preferredRaw = weightedQuality(preferredDetails);

  const required =
    job.requiredSkills.length === 0 ? 1 : clamp01(requiredRaw ** REQUIRED_SKILLS_EXPONENT);
  const preferred =
    job.preferredSkills.length === 0 ? 1 : clamp01(preferredRaw ** PREFERRED_SKILLS_EXPONENT);

  const experience = experienceScore(user, job);
  const domain = domainScore(user, job, required, preferred);
  const education = educationScore(user, job, experience);
  const logistics = logisticsScore(user, job);

  const scores: Record<ComponentId, number> = {
    requiredSkills: required,
    preferredSkills: preferred,
    experience,
    domain: domain.score,
    education,
    logistics,
  };

  let rawScore = 0;
  for (const id of COMPONENT_ORDER) {
    rawScore += WEIGHTS[id] * scores[id];
  }
  rawScore = roundScore(Math.min(100, Math.max(0, rawScore * 100)));

  return {
    scores,
    rawScore,
    calibrated: calibrate(rawScore),
    requiredDetails,
    preferredDetails,
    embeddingFallbackUsed: domain.fallbackUsed,
  };
}

/* -------------------------------------------------------------------------
 * Explanations
 * ---------------------------------------------------------------------- */

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function explain(
  id: ComponentId,
  core: CoreScores,
  user: UserProfile,
  job: JobPosting,
): string {
  const value = core.scores[id];
  switch (id) {
    case "requiredSkills": {
      if (job.requiredSkills.length === 0) return "The posting lists no hard requirements.";
      const met = core.requiredDetails.filter((d) => d.quality >= 1).length;
      const partial = core.requiredDetails.filter((d) => d.quality > 0 && d.quality < 1).length;
      return `${met} of ${core.requiredDetails.length} required skills fully evidenced, ${partial} partially. Weighted quality ${pct(value)} after the convex penalty for gaps.`;
    }
    case "preferredSkills": {
      if (job.preferredSkills.length === 0) return "The posting lists no nice-to-haves.";
      const met = core.preferredDetails.filter((d) => d.quality > 0).length;
      return `${met} of ${core.preferredDetails.length} preferred skills show some evidence (diminishing returns applied).`;
    }
    case "experience": {
      const years = (user.totalMonthsExperience / 12).toFixed(1);
      return `${years} years against the posting's ${job.minYears}-${job.maxYears}, adjusted for a seniority gap of ${Math.abs(user.titles.reduce((m, t) => Math.max(m, t.seniority), 0) - job.seniority)} level(s).`;
    }
    case "domain":
      return core.embeddingFallbackUsed
        ? "No embeddings available — substituted the skills signal and lowered confidence."
        : `Cosine similarity between your profile and this description, rescaled from the ${DOMAIN_COSINE_FLOOR}-${DOMAIN_COSINE_CEILING} useful range.`;
    case "education": {
      const need = job.degreeRequired;
      return `Degree level ${user.education.degreeLevel} against required ${need}${job.fieldPreferenceId !== null ? ", weighed with field of study" : ""}${job.equivalentExperienceAccepted ? ". Equivalent experience is accepted" : ""}.`;
    }
    case "logistics": {
      if (value >= 1) return "No location or language friction.";
      return `Location and language friction reduced this to ${pct(value)}.`;
    }
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

/* -------------------------------------------------------------------------
 * Gaps and strengths
 * ---------------------------------------------------------------------- */

/**
 * Heuristic ranking key from the spec: how many points this skill could
 * plausibly be worth. Used only to break ties between skills whose true
 * counterfactual deltas are equal, so the ordering is stable and explainable.
 */
function rankingKey(detail: SkillMatchDetail, kind: SkillKind): number {
  const componentWeight = kind === "required" ? WEIGHTS.requiredSkills : WEIGHTS.preferredSkills;
  return componentWeight * detail.weightShare * (1 - detail.quality) * 100;
}

export const TOP_GAPS_LIMIT = 3;
export const TOP_STRENGTHS_LIMIT = 3;

interface Candidate {
  detail: SkillMatchDetail;
  kind: SkillKind;
}

function candidates(core: CoreScores): Candidate[] {
  return [
    ...core.requiredDetails.map((detail) => ({ detail, kind: "required" as const })),
    ...core.preferredDetails.map((detail) => ({ detail, kind: "preferred" as const })),
  ];
}

/**
 * Re-score with a single skill's quality pinned to `quality`, returning the
 * calibrated integer score.
 *
 * Exists so the test suite can verify that `topGaps[].pointsLost` is a real
 * score delta rather than a linear estimate — the spec's ranking formula
 * ignores the convex/concave exponents and therefore cannot equal the true
 * delta. Not used on the request path beyond gap/strength computation.
 */
export function scoreWithSkillQuality(
  user: UserProfile,
  job: JobPosting,
  kind: SkillKind,
  canonicalId: string,
  quality: number,
): number {
  const overrides = new Map([[overrideKey(kind, canonicalId), quality]]);
  return toDisplayInt(scoreCore(user, job, overrides).calibrated);
}

/* -------------------------------------------------------------------------
 * Public entry point
 * ---------------------------------------------------------------------- */

/**
 * Score a candidate against a posting.
 *
 * Pure and synchronous. `opts.now` exists only so tests can pin the clock for
 * the expiry gate; production omits it.
 */
export function computeMatch(
  user: UserProfile,
  job: JobPosting,
  opts?: MatchOptions,
): MatchResult {
  const now = opts?.now ?? new Date();
  const taxonomyHitRate = opts?.taxonomyHitRate ?? 1;

  const gatesFailed = evaluateGates(user, job, now);
  const core = scoreCore(user, job);

  const confidence = computeConfidence({
    user,
    job,
    taxonomyHitRate,
    embeddingFallbackUsed: core.embeddingFallbackUsed,
  });

  const components: ComponentResult[] = COMPONENT_ORDER.map((id) => {
    // `contribution` is derived from the ROUNDED score, not the internal one,
    // so a caller that multiplies the reported score by the reported weight
    // always reproduces the reported contribution exactly.
    const componentScore = roundScore(core.scores[id]);
    return {
      id,
      score: componentScore,
      weight: WEIGHTS[id],
      contribution: roundScore(componentScore * WEIGHTS[id] * 100),
      explanation: explain(id, core, user, job),
    };
  });

  // A failed gate zeroes the score outright. Components are still reported so
  // the UI can explain what the match WOULD have looked like, but the headline
  // number and band say ineligible.
  if (gatesFailed.length > 0) {
    return {
      score: 0,
      rawScore: 0,
      band: "ineligible" satisfies Band,
      confidence,
      displayRange: null,
      gatesFailed,
      components,
      topGaps: [],
      topStrengths: [],
      scoreVersion: SCORE_VERSION,
    };
  }

  const score = toDisplayInt(core.calibrated);
  const rawScore = toDisplayInt(core.rawScore);

  // True counterfactuals, not estimates: re-score with one skill pinned and
  // diff. `pointsLost` is therefore exactly what the user would gain by
  // acquiring that skill, in the same units shown on screen.
  const all = candidates(core);

  const gaps: SkillGap[] = all
    .filter(({ detail }) => detail.quality < 1)
    .map(({ detail, kind }) => {
      const overrides = new Map([[overrideKey(kind, detail.canonicalId), 1]]);
      const lifted = toDisplayInt(scoreCore(user, job, overrides).calibrated);
      return {
        canonicalId: detail.canonicalId,
        label: skillLabel(detail.canonicalId),
        pointsLost: lifted - score,
        kind,
        _rank: rankingKey(detail, kind),
      };
    })
    .filter((g) => g.pointsLost > 0)
    .sort((a, b) => b.pointsLost - a.pointsLost || b._rank - a._rank)
    .slice(0, TOP_GAPS_LIMIT)
    .map(({ canonicalId, label, pointsLost, kind }) => ({ canonicalId, label, pointsLost, kind }));

  const strengths: SkillStrength[] = all
    .filter(({ detail }) => detail.quality > 0)
    .map(({ detail, kind }) => {
      const overrides = new Map([[overrideKey(kind, detail.canonicalId), 0]]);
      const dropped = toDisplayInt(scoreCore(user, job, overrides).calibrated);
      return {
        canonicalId: detail.canonicalId,
        label: skillLabel(detail.canonicalId),
        pointsGained: score - dropped,
        _rank: detail.quality * detail.weightShare,
      };
    })
    .filter((s) => s.pointsGained > 0)
    .sort((a, b) => b.pointsGained - a.pointsGained || b._rank - a._rank)
    .slice(0, TOP_STRENGTHS_LIMIT)
    .map(({ canonicalId, label, pointsGained }) => ({ canonicalId, label, pointsGained }));

  return {
    score,
    rawScore,
    band: bandFor(score),
    confidence,
    displayRange: displayRangeFor(score, confidence),
    gatesFailed,
    components,
    topGaps: gaps,
    topStrengths: strengths,
    scoreVersion: SCORE_VERSION,
  };
}
