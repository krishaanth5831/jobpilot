// Global learnings: a cross-account knowledge base the AI reads from and
// writes to. Every time an AI-produced artifact gets a measurable outcome
// (application reached an interview or got rejected, an ATS re-review moved
// the score), the patterns that were injected into its prompt are credited
// or debited. High-confidence winners get reinforced in future prompts;
// confident losers surface as pitfalls to avoid.
//
// Privacy: records hold generalized patterns only — never resume text, never
// a user id. Writes pass a sanitizer that rejects emails, phone numbers,
// URLs, and anything long enough to be copied prose. The only read surface
// outside prompts is the owner-only panel on Settings.
//
// This is retrieval-augmented prompting, not training: lightweight enough
// for the single-document lowdb store, useful from day one via seeds.

import { createHash } from "node:crypto";
import { getDb } from "./db";

export const LEARNING_CATEGORIES = [
  "resume_edit", // how to write/improve resume content
  "ats_pattern", // what makes resumes parse and score well
  "auto_apply_msg", // what makes cover letters get replies
  "company_match", // which matches users actually pursue
];

// How many outcomes a pattern needs before its stats are quotable, and the
// z-score behind the Wilson interval. z=1.28 is an 80% bound — deliberately
// looser than the textbook 1.96 so patterns become usable at this app's
// current scale; tighten it as outcome volume grows.
const MIN_SAMPLES = 3;
const WILSON_Z = 1.28;

/**
 * Wilson score lower bound: "given s successes in n tries, the success rate
 * is at least X with 80% confidence". Unlike the raw ratio it can't be
 * gamed by tiny samples — 2/2 scores ~0.5 while 45/50 scores ~0.85 — which
 * is exactly why ranking uses it instead of successCount/n.
 */
export function wilsonLower(successes, n, z = WILSON_Z) {
  if (!n) return 0;
  const p = successes / n;
  const z2 = z * z;
  return (
    (p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) /
    (1 + z2 / n)
  );
}

/**
 * Gate every pattern before it can be stored. Returns the normalized text,
 * or null when the candidate looks like it could carry personal data:
 * emails, URLs, phone-length digit runs, or prose too long to be a
 * generalized lesson (long text is usually copied from someone's resume).
 */
export function sanitizePattern(text) {
  const cleaned = String(text ?? "").replace(/\s+/g, " ").trim();
  if (cleaned.length < 10 || cleaned.length > 200) return null;
  if (/\S+@\S+\.\S+/.test(cleaned)) return null; // email
  if (/https?:\/\/|www\./i.test(cleaned)) return null; // url
  // Phone-like: a digit-ish span containing 9+ actual digits. Year ranges
  // ("2025-2026", 8 digits) stay legal; real phone numbers (9-15) don't.
  for (const span of cleaned.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []) {
    if ((span.match(/\d/g) ?? []).length >= 9) return null;
  }
  return cleaned;
}

const learningId = (category, pattern) =>
  "lrn-" +
  createHash("sha1")
    .update(`${category}|${pattern.toLowerCase()}`)
    .digest("hex")
    .slice(0, 12);

/* ---------- Seeds ---------- */

// Starter knowledge so injection is useful before any outcomes exist. Seeds
// enter prompts through the exploration slot, accumulate real outcomes like
// any other pattern, and sink or swim on the same evidence. Fixed timestamp
// keeps re-seeding deterministic (seeds regenerate identically until the
// first write persists them; a deleted seed stays gone once others exist).
const SEED_DATE = "2026-07-22T00:00:00.000Z";
const SEEDS = [
  ["ats_pattern", "Standard section headings (Experience, Education, Skills) parse more reliably than creative ones"],
  ["ats_pattern", "Single-column layouts without tables or graphics avoid ATS parsing failures"],
  ["ats_pattern", "Spelling out acronyms on first use alongside the short form matches more keyword filters"],
  ["ats_pattern", "Consistent date formats across all entries avoid timeline red flags"],
  ["resume_edit", "Bullets that quantify impact with numbers, percentages, or scale outperform duty descriptions"],
  ["resume_edit", "Leading each bullet with a strong action verb tied to a named technology reads stronger than task lists"],
  ["resume_edit", "Mirroring the job posting's exact keywords, where truthful, improves match and ATS scores"],
  ["resume_edit", "Condensing unrelated roles to one line makes relevant experience denser"],
  ["auto_apply_msg", "Cover letters that name a specific product, team, or project of the company get more replies than generic ones"],
  ["auto_apply_msg", "Opening with the candidate's single most relevant achievement beats opening with enthusiasm"],
  ["auto_apply_msg", "Keeping cover letters under 250 words increases the chance they get read"],
  ["auto_apply_msg", "Explaining why this specific company signals genuine interest and gets replies"],
  ["company_match", "Stretch roles more than one seniority level up are usually ignored by candidates"],
  ["company_match", "A local-language requirement in the posting predicts rejection for non-speakers even when skills match"],
];

function ensureSeeds(db) {
  if (Object.keys(db.data.learnings).length > 0) return;
  for (const [category, pattern] of SEEDS) {
    const id = learningId(category, pattern);
    db.data.learnings[id] = {
      id,
      category,
      pattern,
      contextTags: [],
      successCount: 0,
      failureCount: 0,
      confidence: 0,
      createdAt: SEED_DATE,
      updatedAt: SEED_DATE,
    };
  }
}

/* ---------- Write path ---------- */

/**
 * Upsert a learning and count one outcome against it. Mutates db.data but
 * does NOT write — call sites already end with their own db.write(), which
 * also keeps the whole request a single atomic document write. Returns the
 * record, or null when the pattern fails sanitization (never throws: a bad
 * distilled lesson must not break the user-facing request it rides on).
 */
export function recordOutcome(db, { category, pattern, contextTags = [], success }) {
  if (!LEARNING_CATEGORIES.includes(category)) return null;
  const cleaned = sanitizePattern(pattern);
  if (!cleaned) return null;

  ensureSeeds(db);
  const id = learningId(category, cleaned);
  const now = new Date().toISOString();
  const record = (db.data.learnings[id] ??= {
    id,
    category,
    pattern: cleaned,
    contextTags: contextTags.filter((t) => typeof t === "string").slice(0, 8),
    successCount: 0,
    failureCount: 0,
    confidence: 0,
    createdAt: now,
    updatedAt: now,
  });
  if (success) record.successCount += 1;
  else record.failureCount += 1;
  record.confidence = wilsonLower(
    record.successCount,
    record.successCount + record.failureCount
  );
  record.updatedAt = now;
  return record;
}

/**
 * Credit or debit already-stored learnings by id — the attribution path.
 * Ids come from what was injected into the prompt that produced the
 * artifact (application.learningIds, resumeReview.learningIds). Missing ids
 * are skipped silently: the owner may have deleted a pattern in between.
 * Mutates db.data; caller writes.
 */
export function recordOutcomesById(db, ids, success) {
  // Seed first: ids often point at seed patterns that exist on every read
  // (ensureSeeds is deterministic) but may not have been persisted yet —
  // without this, the first outcomes on a fresh store would vanish.
  ensureSeeds(db);
  const now = new Date().toISOString();
  for (const id of ids ?? []) {
    const record = db.data.learnings[id];
    if (!record) continue;
    if (success) record.successCount += 1;
    else record.failureCount += 1;
    record.confidence = wilsonLower(
      record.successCount,
      record.successCount + record.failureCount
    );
    record.updatedAt = now;
  }
}

/* ---------- Read path ---------- */

// Overlap between a learning's tags and the query's: 1 when they share
// every query tag, 0.5 when either side is untagged (generic applies to
// everyone), scaling down as tags diverge.
function relevance(recordTags, queryTags) {
  if (!recordTags?.length || !queryTags?.length) return 0.5;
  const hits = recordTags.filter((t) => queryTags.includes(t)).length;
  return hits / queryTags.length;
}

/**
 * The top learnings to inject into a prompt for one category.
 * Returns { proven, pitfalls, ids }:
 *  - proven: patterns with enough samples and a winning record, ranked by
 *    confidence x relevance — PLUS one exploration slot holding the least-
 *    sampled pattern, so new and seeded patterns get chances to earn
 *    evidence instead of being starved by the sample-size filter forever.
 *  - pitfalls: patterns whose FAILURE rate is Wilson-confident — the
 *    "suppress this" signal.
 *  - ids: everything selected, for attribution on the artifact.
 * Pass the request's db when you have one so seeding rides its write.
 */
export async function getRelevantLearnings({ db, category, contextTags = [], limit = 5 }) {
  db ??= await getDb();
  ensureSeeds(db);
  const candidates = Object.values(db.data.learnings).filter(
    (l) => l.category === category
  );

  const samples = (l) => l.successCount + l.failureCount;
  const proven = candidates
    .filter((l) => samples(l) >= MIN_SAMPLES && l.successCount > l.failureCount)
    .map((l) => ({ l, score: l.confidence * (0.5 + 0.5 * relevance(l.contextTags, contextTags)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit - 1))
    .map(({ l }) => l);

  const pitfalls = candidates
    .filter((l) => samples(l) >= MIN_SAMPLES && wilsonLower(l.failureCount, samples(l)) >= 0.5)
    .sort(
      (a, b) =>
        wilsonLower(b.failureCount, samples(b)) - wilsonLower(a.failureCount, samples(a))
    )
    .slice(0, 3);

  // Exploration slot: the least-tested pattern not already selected.
  const chosen = new Set([...proven, ...pitfalls].map((l) => l.id));
  const explore = candidates
    .filter((l) => !chosen.has(l.id))
    .sort((a, b) => samples(a) - samples(b) || a.createdAt.localeCompare(b.createdAt))[0];
  if (explore) proven.push(explore);

  return { proven, pitfalls, ids: [...proven, ...pitfalls].map((l) => l.id) };
}

/**
 * Render a selection into the "Proven patterns / Known pitfalls" prompt
 * block. "" when there's nothing to say, so callers can always append it.
 * Stats are only quoted once a pattern clears MIN_SAMPLES — low-evidence
 * patterns are labeled honestly instead of dressed up as proven.
 */
export function formatLearnings(selection) {
  const { proven = [], pitfalls = [] } = selection ?? {};
  if (proven.length === 0 && pitfalls.length === 0) return "";

  const cite = (l) => {
    const n = l.successCount + l.failureCount;
    if (n < MIN_SAMPLES) return `- ${l.pattern} (early signal — still being tested)`;
    const pct = Math.round((l.successCount / n) * 100);
    return `- ${l.pattern} (${pct}% success across ${n} tracked outcomes)`;
  };
  const citeFail = (l) => {
    const n = l.successCount + l.failureCount;
    const pct = Math.round((l.failureCount / n) * 100);
    return `- ${l.pattern} (failed in ${pct}% of ${n} tracked outcomes)`;
  };

  let block = "";
  if (proven.length) {
    block += `\n\nPROVEN PATTERNS — aggregated, anonymized outcomes across all applications on this platform. Apply where relevant:\n${proven.map(cite).join("\n")}`;
  }
  if (pitfalls.length) {
    block += `\n\nKNOWN PITFALLS — these correlated with bad outcomes here. Avoid them:\n${pitfalls.map(citeFail).join("\n")}`;
  }
  return block;
}

/* ---------- Context tags ---------- */

/** Coarse, non-identifying tags from a profile: field + seniority band. */
export function tagsFromProfile(profile) {
  const tags = [];
  if (profile?.field) tags.push(`field:${String(profile.field).toLowerCase().trim()}`);
  const yoe = Number(profile?.years_of_experience);
  if (Number.isFinite(yoe)) {
    tags.push(`seniority:${yoe < 2 ? "junior" : yoe < 7 ? "mid" : "senior"}`);
  }
  return tags;
}

/* ---------- Owner panel ---------- */

/** All learnings for the owner-only Settings viewer, most-evidenced first. */
export async function listLearnings() {
  const db = await getDb();
  ensureSeeds(db);
  return Object.values(db.data.learnings)
    .map((l) => ({ ...l, sampleSize: l.successCount + l.failureCount }))
    .sort((a, b) => b.sampleSize - a.sampleSize || b.confidence - a.confidence);
}

/** Owner deletes a wrong or leaky pattern. It will not be re-seeded. */
export async function removeLearning(id) {
  const db = await getDb();
  // Seed before deleting: on a store where seeds were never persisted, a
  // bare delete would be a no-op and the next read would resurrect the
  // "deleted" seed. Persisting the survivors makes the removal stick.
  ensureSeeds(db);
  delete db.data.learnings[id];
  await db.write();
}
