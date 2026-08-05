// How much the INPUTS can be trusted — not how good the match is.
//
// A 78 from a fully-parsed resume against a detailed job description is a
// different claim from a 78 built out of three skill strings and a two-line
// posting. Confidence separates those two, and below the threshold the caller
// shows a range instead of a point estimate.

import type { JobPosting, UserProfile } from "./types";

/** Relative pull of each input-quality signal. Must sum to 1.0. */
export const CONFIDENCE_WEIGHTS = {
  /** How much of the candidate's profile the resume parser actually filled in. */
  profileCompleteness: 0.4,
  /** How specific the posting is. A JD with no stated skills or years is a
   *  guess no matter how good the parser was. */
  jdDetail: 0.35,
  /** Fraction of raw skill strings that resolved to a canonical id. Low hit
   *  rate means the score was computed over a partial view of both sides. */
  taxonomyHitRate: 0.25,
} as const;

/** Below this, `displayRange` is populated and the UI should show a band. */
export const CONFIDENCE_DISPLAY_THRESHOLD = 0.6;

/** Asymmetric on purpose: a low-confidence score is more likely to be an
 *  underestimate (unparsed skills the candidate really has) than an
 *  overestimate, so the range reaches further down than up. */
export const DISPLAY_RANGE_BELOW = 8;
export const DISPLAY_RANGE_ABOVE = 7;

/** Flat penalty when the domain component had to fall back to the skills
 *  average because an embedding was missing. One sixth of the scale — enough
 *  to matter, not enough to dominate a well-parsed pair. */
export const EMBEDDING_FALLBACK_PENALTY = 0.16;

/** Confidence can never be claimed as absolute; extraction is never certain. */
export const MAX_CONFIDENCE = 0.95;
export const MIN_CONFIDENCE = 0.05;

interface Signal {
  present: boolean;
  weight: number;
}

function weightedPresence(signals: readonly Signal[]): number {
  let total = 0;
  let hit = 0;
  for (const s of signals) {
    total += s.weight;
    if (s.present) hit += s.weight;
  }
  return total === 0 ? 0 : hit / total;
}

/**
 * Fraction of the candidate profile the parser managed to fill in.
 * Weighted by how much each field affects the score: skills and experience
 * drive 55% of the weighting, so they count for more than languages.
 *
 * Deliberately does NOT reward `graduationDate` — it is a protected
 * characteristic and no part of this engine may reward its presence.
 */
export function profileCompleteness(user: UserProfile): number {
  return weightedPresence([
    { present: user.skills.length > 0, weight: 3 },
    { present: user.skills.some((s) => s.months > 0), weight: 1 },
    { present: user.titles.length > 0, weight: 2 },
    { present: user.totalMonthsExperience > 0, weight: 2 },
    { present: user.education.degreeLevel > 0, weight: 1 },
    { present: user.education.fieldId !== null, weight: 1 },
    { present: user.location.country !== null, weight: 1 },
    { present: user.workAuth.length > 0, weight: 1 },
    { present: user.languages.length > 0, weight: 0.5 },
    { present: user.summaryEmbedding !== null, weight: 1 },
  ]);
}

/** How much the posting actually committed to, as opposed to boilerplate. */
export function jdDetail(job: JobPosting): number {
  return weightedPresence([
    { present: job.requiredSkills.length > 0, weight: 3 },
    { present: job.requiredSkills.length >= 3, weight: 1 },
    { present: job.preferredSkills.length > 0, weight: 1 },
    { present: job.maxYears > 0, weight: 2 },
    { present: job.degreeRequired > 0, weight: 1 },
    { present: job.location.country !== null, weight: 1 },
    { present: job.languagesRequired.length > 0, weight: 0.5 },
    { present: job.descriptionEmbedding !== null, weight: 1 },
  ]);
}

export interface ConfidenceInput {
  user: UserProfile;
  job: JobPosting;
  /** 0-1 from `resolveAll`. Defaults to 1 when the caller cannot report it —
   *  callers that skip it are trusting their own extraction. */
  taxonomyHitRate: number;
  /** True when the domain component fell back to the skills average. */
  embeddingFallbackUsed: boolean;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** 0-1. Deterministic: same inputs, same number. */
export function computeConfidence(input: ConfidenceInput): number {
  const { user, job, taxonomyHitRate, embeddingFallbackUsed } = input;

  const base =
    profileCompleteness(user) * CONFIDENCE_WEIGHTS.profileCompleteness +
    jdDetail(job) * CONFIDENCE_WEIGHTS.jdDetail +
    clamp01(taxonomyHitRate) * CONFIDENCE_WEIGHTS.taxonomyHitRate;

  const penalised = base - (embeddingFallbackUsed ? EMBEDDING_FALLBACK_PENALTY : 0);
  return clamp01(Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, penalised)));
}

/**
 * The range to show instead of a bare number when confidence is low.
 * Null above the threshold — a confident score is shown as a point.
 */
export function displayRangeFor(
  score: number,
  confidence: number,
): [number, number] | null {
  if (confidence >= CONFIDENCE_DISPLAY_THRESHOLD) return null;
  const low = Math.max(0, Math.min(100, score - DISPLAY_RANGE_BELOW));
  const high = Math.max(0, Math.min(100, score + DISPLAY_RANGE_ABOVE));
  return [low, high];
}
