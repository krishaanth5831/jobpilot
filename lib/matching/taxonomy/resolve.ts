// Turns a raw skill string ("Experience with React.js", "C++17", "PYTHON 3.11")
// into a canonical taxonomy id, or null when nothing matches.
//
// The same `normalize()` runs over both the query and every indexed id/label/
// alias, so the two sides can never drift apart.

import { SKILLS, FIELDS, type SkillEntry } from "./data";

/** Phrases job descriptions wrap around a skill name that carry no meaning of
 *  their own. Stripped from the front before matching so "proficient in figma"
 *  and "figma" resolve identically. */
export const NOISE_PREFIXES: readonly string[] = [
  "experience with",
  "experience in",
  "experience using",
  "hands on experience with",
  "hands on experience in",
  "working knowledge of",
  "knowledge of",
  "familiarity with",
  "familiar with",
  "proficiency in",
  "proficiency with",
  "proficient in",
  "proficient with",
  "expertise in",
  "expert in",
  "strong",
  "solid",
  "basic",
  "advanced",
  "good",
  "excellent",
  "demonstrated",
  "understanding of",
  "exposure to",
  "skilled in",
  "competent in",
  "fluent in",
];

/** Trailing words that describe the evidence rather than the skill itself. */
export const NOISE_SUFFIXES: readonly string[] = [
  "skills",
  "skill",
  "experience",
  "knowledge",
  "proficiency",
  "expertise",
  "ability",
  "abilities",
  "fundamentals",
];

/** A token that is only a version number ("3", "3.11", "v2") carries no
 *  identity — "Python 3.11" and "Python" are the same skill. */
const PURE_VERSION = /^v?\d+(\.\d+)*$/;

/** Trailing digits are only stripped when they sit directly on a symbol, which
 *  is how language standards are written ("c++17" -> "c++"). Deliberately NOT
 *  applied to letter+digit tokens: "sap2000" must not collapse onto "sap",
 *  and "5g" / "3d" / "6 sigma" must survive intact. */
const SYMBOL_VERSION = /^(.*[+#])\d+(\.\d+)*$/;

/**
 * Lowercase, flatten separators, drop version noise, collapse whitespace.
 * Punctuation that distinguishes real skills (`+`, `#`) is preserved; `.`,
 * `-`, `_` and `/` become spaces so ".NET" -> "net" and "CI/CD" -> "ci cd"
 * on both the query and the index side.
 */
export function normalize(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/[._\-/\\,()[\]{}:;"'’&]/g, " ");
  s = s.replace(/[^a-z0-9+# ]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (s === "") return "";

  let tokens = s.split(" ");
  tokens = tokens
    .map((t) => {
      const m = SYMBOL_VERSION.exec(t);
      return m && m[1] !== undefined ? m[1] : t;
    })
    .filter((t) => t !== "" && !PURE_VERSION.test(t));

  return tokens.join(" ").trim();
}

/** Strip leading/trailing filler. Applied after `normalize`, and only while
 *  something is left over — "skills" alone stays "skills". */
function stripNoise(normalized: string): string {
  let s = normalized;
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of NOISE_PREFIXES) {
      if (s === prefix) continue;
      if (s.startsWith(`${prefix} `)) {
        s = s.slice(prefix.length + 1);
        changed = true;
      }
    }
    for (const suffix of NOISE_SUFFIXES) {
      if (s === suffix) continue;
      if (s.endsWith(` ${suffix}`)) {
        s = s.slice(0, -(suffix.length + 1));
        changed = true;
      }
    }
  }
  return s.trim();
}

function buildIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const add = (key: string, id: string): void => {
    const k = normalize(key);
    // First writer wins. Entries are indexed id, then label, then aliases, so
    // a canonical id can never be shadowed by another entry's alias.
    if (k !== "" && !index.has(k)) index.set(k, id);
  };
  for (const s of SKILLS) add(s.id, s.id);
  for (const s of SKILLS) add(s.label, s.id);
  for (const s of SKILLS) for (const alias of s.aliases) add(alias, s.id);
  return index;
}

const SKILL_INDEX: ReadonlyMap<string, string> = buildIndex();

function buildFieldIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const add = (key: string, id: string): void => {
    const k = normalize(key);
    if (k !== "" && !index.has(k)) index.set(k, id);
  };
  for (const f of FIELDS) add(f.id, f.id);
  for (const f of FIELDS) add(f.label, f.id);
  for (const f of FIELDS) for (const alias of f.aliases) add(alias, f.id);
  return index;
}

const FIELD_INDEX: ReadonlyMap<string, string> = buildFieldIndex();

function lookup(index: ReadonlyMap<string, string>, raw: string): string | null {
  const normalized = normalize(raw);
  if (normalized === "") return null;

  const direct = index.get(normalized);
  if (direct !== undefined) return direct;

  const stripped = stripNoise(normalized);
  if (stripped !== normalized && stripped !== "") {
    const viaStrip = index.get(stripped);
    if (viaStrip !== undefined) return viaStrip;
  }

  // Light de-pluralisation, and only when the singular is a real key — so
  // "circuits" finds "circuit design"'s alias while "mathematics" is left
  // alone rather than becoming "mathematic".
  const base = stripped !== "" ? stripped : normalized;
  if (base.endsWith("s")) {
    const singular = index.get(base.slice(0, -1));
    if (singular !== undefined) return singular;
  }
  return null;
}

/**
 * Resolve a free-text skill string to its canonical taxonomy id.
 * Pure and synchronous. Returns null when the string is not in the taxonomy —
 * callers should count those to compute the taxonomy hit rate for confidence.
 */
export function resolveSkill(raw: string): string | null {
  return lookup(SKILL_INDEX, raw);
}

/** Same contract as `resolveSkill`, for academic fields of study. */
export function resolveField(raw: string): string | null {
  return lookup(FIELD_INDEX, raw);
}

/** Resolve a batch and report how much of it landed. The hit rate feeds
 *  `confidence`, never the score. */
export function resolveAll(raws: readonly string[]): {
  resolved: string[];
  unresolved: string[];
  hitRate: number;
} {
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const raw of raws) {
    const id = resolveSkill(raw);
    if (id === null) unresolved.push(raw);
    else resolved.push(id);
  }
  const total = raws.length;
  return { resolved, unresolved, hitRate: total === 0 ? 1 : resolved.length / total };
}

export type { SkillEntry };
