// The ONE model call in this engine.
//
// It returns COUNTS AND NOTHING ELSE. No score, no rating, no verdict, no
// advice. Every judgement in the product is made by the arithmetic in
// score.ts, from these counts. If a future edit adds a "quality" or "rating"
// field to this schema, the architecture has been broken.
//
// Determinism: lib/claude.js sends every request with extended thinking, which
// pins temperature at 1 — there is no temperature-0 path through this codebase
// (see lib/claude-tasks.js, which is the single enforced model policy). Stable
// output therefore comes from two other places: a strict JSON schema, and the
// contentHash cache below, which guarantees identical text is never classified
// twice.

import { resolveSkill } from "../matching/taxonomy/resolve";
import type { ContentStats } from "./types";

/** The task name registered in lib/claude-tasks.js. That file decides the
 *  model and effort, and asserts the choice is legal — a pinned model id here
 *  would route around those assertions. */
export const CLASSIFIER_TASK = "resume_classify";

/** Bumped when the prompt or schema changes in a way that could move counts.
 *  Persisted alongside the score so a stored result names the classifier that
 *  produced it. */
export const CLASSIFIER_VERSION = "1.0.0";

/** Resumes are short; this bounds a hostile upload. */
export const MAX_CLASSIFY_CHARS = 20000;

export const CONTENT_STATS_SCHEMA = {
  type: "object",
  properties: {
    bulletsTotal: {
      type: "integer",
      description: "total number of bullet points across the whole resume",
    },
    bulletsWithMetric: {
      type: "integer",
      description:
        "bullets containing a number that measures something: a quantity, percentage, currency amount, duration, or a count of people or systems. A date alone does not count.",
    },
    bulletsWithStrongVerb: {
      type: "integer",
      description:
        "bullets whose FIRST word is a concrete past or present action verb (built, shipped, reduced, designed, led). Not 'responsible', 'worked', 'helped', 'involved'.",
    },
    bulletsPassiveOrDuty: {
      type: "integer",
      description:
        "bullets phrased as a duty or in the passive voice ('responsible for X', 'tasked with X', 'X was maintained by me')",
    },
    bulletsOverTwoLines: {
      type: "integer",
      description:
        "bullets longer than roughly 200 characters, which is about two printed lines",
    },
    clichePhraseCount: {
      type: "integer",
      description:
        "occurrences of empty resume cliches: team player, results-driven, go-getter, think outside the box, hard-working, detail-oriented, self-starter, synergy, dynamic professional",
    },
    firstPersonPronounCount: {
      type: "integer",
      description: "occurrences of I, me, my, we, our anywhere in the resume body",
    },
    tenseInconsistencies: {
      type: "integer",
      description:
        "places where past and present tense are mixed inside the same role's bullets",
    },
    spellingErrors: {
      type: "integer",
      description:
        "clear misspellings of ordinary English words. Do NOT count proper nouns, product names, company names, or non-English words.",
    },
    skillsEvidencedInBullets: {
      type: "array",
      description:
        "names of skills, tools or technologies that appear inside an experience or project BULLET (not merely in a skills list). Plain names as written, e.g. 'React', 'SolidWorks'.",
      items: { type: "string" },
    },
  },
  required: [
    "bulletsTotal",
    "bulletsWithMetric",
    "bulletsWithStrongVerb",
    "bulletsPassiveOrDuty",
    "bulletsOverTwoLines",
    "clichePhraseCount",
    "firstPersonPronounCount",
    "tenseInconsistencies",
    "spellingErrors",
    "skillsEvidencedInBullets",
  ],
  additionalProperties: false,
} as const;

export const CLASSIFIER_SYSTEM_PROMPT = `You COUNT things in a resume. You do not evaluate it.

You never produce a score, a rating, a grade, a verdict, or advice. You never
say whether the resume is good. Another system does all of that from your
counts, and it needs them to be accurate and reproducible above all else.

Counting rules:
- Count what is actually there. If a category has none, the answer is 0.
- A "bullet" is one item in a bulleted or dashed list. A heading is not a
  bullet. A paragraph is not a bullet.
- Count each occurrence separately, not each distinct phrase: a resume saying
  "team player" three times has a clichePhraseCount of 3.
- For skillsEvidencedInBullets, list a skill only if it appears inside a bullet
  describing work done. A name that appears only in a "Skills:" list does not
  qualify. Report the plain skill name, not the sentence around it.
- Be conservative with spellingErrors. Proper nouns, product names, company
  names and non-English words are never spelling errors.`;

export function buildClassifierPrompt(rawText: string): string {
  return `Count the following in this resume text. Report numbers only.

RESUME TEXT:

${rawText.slice(0, MAX_CLASSIFY_CHARS)}`;
}

/** Raw shape the model returns, before skill resolution. */
interface RawContentStats {
  bulletsTotal: number;
  bulletsWithMetric: number;
  bulletsWithStrongVerb: number;
  bulletsPassiveOrDuty: number;
  bulletsOverTwoLines: number;
  clichePhraseCount: number;
  firstPersonPronounCount: number;
  tenseInconsistencies: number;
  spellingErrors: number;
  skillsEvidencedInBullets: string[];
}

/** Persistence the caller supplies. Keyed by contentHash. */
export interface ClassifierCache {
  get: (contentHash: string) => ContentStats | null | undefined;
  set: (contentHash: string, stats: ContentStats) => void;
}

export type AskJson = (args: {
  task: string;
  system: string;
  prompt: string;
  schema: unknown;
}) => Promise<unknown>;

const asCount = (value: unknown, cap: number): number => {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(cap, Math.max(0, n));
};

/** Generous ceilings that only catch a model returning something absurd. */
export const MAX_BULLETS = 200;
export const MAX_COUNT = 500;

/**
 * Normalise and canonicalise the model's raw output.
 *
 * The model reports skills as PLAIN NAMES and this resolves them against the
 * taxonomy. Asking a model to emit canonical ids directly would either require
 * shipping 332 ids in the prompt or accept invented ones; resolving here means
 * an id the taxonomy does not know can never reach the scorer.
 */
export function normaliseStats(raw: RawContentStats): ContentStats {
  const bulletsTotal = asCount(raw.bulletsTotal, MAX_BULLETS);

  const resolved = new Set<string>();
  for (const phrase of raw.skillsEvidencedInBullets ?? []) {
    if (typeof phrase !== "string") continue;
    const id = resolveSkill(phrase);
    if (id !== null) resolved.add(id);
  }

  return {
    bulletsTotal,
    // Sub-counts can never exceed the total they are a subset of; a model that
    // says 12 of 8 bullets are quantified would otherwise push a ratio over 1.
    bulletsWithMetric: Math.min(bulletsTotal, asCount(raw.bulletsWithMetric, MAX_BULLETS)),
    bulletsWithStrongVerb: Math.min(bulletsTotal, asCount(raw.bulletsWithStrongVerb, MAX_BULLETS)),
    bulletsPassiveOrDuty: Math.min(bulletsTotal, asCount(raw.bulletsPassiveOrDuty, MAX_BULLETS)),
    bulletsOverTwoLines: Math.min(bulletsTotal, asCount(raw.bulletsOverTwoLines, MAX_BULLETS)),
    clichePhraseCount: asCount(raw.clichePhraseCount, MAX_COUNT),
    firstPersonPronounCount: asCount(raw.firstPersonPronounCount, MAX_COUNT),
    tenseInconsistencies: asCount(raw.tenseInconsistencies, MAX_COUNT),
    spellingErrors: asCount(raw.spellingErrors, MAX_COUNT),
    skillsEvidencedInBullets: [...resolved].sort(),
  };
}

/** Counts for an empty document, so a caller never has to handle null. */
export const EMPTY_STATS: ContentStats = {
  bulletsTotal: 0,
  bulletsWithMetric: 0,
  bulletsWithStrongVerb: 0,
  bulletsPassiveOrDuty: 0,
  bulletsOverTwoLines: 0,
  clichePhraseCount: 0,
  firstPersonPronounCount: 0,
  tenseInconsistencies: 0,
  spellingErrors: 0,
  skillsEvidencedInBullets: [],
};

export interface ClassifyArgs {
  rawText: string;
  contentHash: string;
  ask: AskJson;
  /** Omit to disable caching entirely (tests, one-off analysis). */
  cache?: ClassifierCache | undefined;
}

/**
 * Count the content signals in a resume, hitting the cache first.
 * IDENTICAL TEXT IS NEVER CLASSIFIED TWICE — the contentHash is the key, so
 * re-opening a resume, re-running a review, or two accounts uploading the same
 * document all cost exactly one call between them.
 */
export async function classifyContent(args: ClassifyArgs): Promise<ContentStats> {
  const { rawText, contentHash, ask, cache } = args;

  const cached = cache?.get(contentHash);
  if (cached !== null && cached !== undefined) return cached;

  if (rawText.trim() === "") return EMPTY_STATS;

  const raw = (await ask({
    task: CLASSIFIER_TASK,
    system: CLASSIFIER_SYSTEM_PROMPT,
    prompt: buildClassifierPrompt(rawText),
    schema: CONTENT_STATS_SCHEMA,
  })) as RawContentStats;

  const stats = normaliseStats(raw);
  cache?.set(contentHash, stats);
  return stats;
}
