// Bridges jobblast's stored JSON onto the engine's typed inputs.
//
// Everything here is deterministic. The only model output involved is
// `RawJobFacts`, which arrives already extracted; this module just resolves
// free text onto the taxonomy and normalises units.

import { resolveField, resolveSkill } from "./taxonomy/resolve";
import type {
  Cefr,
  DegreeLevel,
  JobPosting,
  RemotePolicy,
  Seniority,
  SkillSource,
  UserProfile,
  UserSkill,
} from "./types";
import type { RawJobFacts } from "./extract";

/* -------------------------------------------------------------------------
 * The legacy stored profile (lib/matcher.js PROFILE_SCHEMA)
 * ---------------------------------------------------------------------- */

export interface LegacyEducation {
  institution?: string;
  degree?: string;
  field?: string;
  graduation_year?: string;
}

export interface LegacyExperience {
  title?: string;
  company?: string;
  duration?: string;
  highlights?: string[];
}

export interface LegacyProject {
  name?: string;
  description?: string;
  technologies?: string[];
}

export interface LegacyProfile {
  name?: string;
  email?: string;
  location?: string;
  field?: string;
  education?: LegacyEducation[];
  experience?: LegacyExperience[];
  skills?: string[];
  projects?: LegacyProject[];
  years_of_experience?: number;
}

/* -------------------------------------------------------------------------
 * Small lookup tables
 * ---------------------------------------------------------------------- */

/** Degree wording -> level. Checked longest-first so "master of science"
 *  cannot be shadowed by a shorter pattern. */
export const DEGREE_PATTERNS: readonly (readonly [RegExp, DegreeLevel])[] = [
  [/\b(ph\.?d|doctor(ate|al)?|dphil)\b/i, 5],
  [/\b(m\.?sc|m\.?eng|m\.?b\.?a|m\.?a\b|master'?s?|magister)\b/i, 4],
  [/\b(b\.?sc|b\.?eng|b\.?a\b|b\.?tech|bachelor'?s?|licentiate|undergraduate)\b/i, 3],
  [/\b(associate'?s?|foundation degree|hbo propedeuse)\b/i, 2],
  [/\b(high school|secondary|vwo|havo|a[- ]levels|diploma|certificate)\b/i, 1],
];

/** Title wording -> seniority on the 0-5 scale. First match wins, so the most
 *  specific patterns are listed first. */
export const SENIORITY_PATTERNS: readonly (readonly [RegExp, Seniority])[] = [
  [/\b(intern|internship|co-?op|trainee|apprentice|working student|werkstudent|stagiair)\b/i, 0],
  [/\b(lead|principal|staff|head of|director|vp|chief|architect|manager)\b/i, 5],
  [/\b(senior|sr\.?)\b/i, 4],
  [/\b(junior|jr\.?)\b/i, 2],
  [/\b(entry|graduate|new grad|starter)\b/i, 1],
];

/** Fallback when a title carries no seniority signal at all. Mid-level is the
 *  modal case in job postings and the least wrong default. */
export const DEFAULT_SENIORITY: Seniority = 3;

/** Country names seen in jobblast's free-text location strings -> ISO 3166-1
 *  alpha-2. Two-letter inputs are passed through untouched. */
export const COUNTRY_CODES: Readonly<Record<string, string>> = {
  netherlands: "NL",
  holland: "NL",
  nederland: "NL",
  germany: "DE",
  deutschland: "DE",
  belgium: "BE",
  france: "FR",
  spain: "ES",
  portugal: "PT",
  italy: "IT",
  poland: "PL",
  ireland: "IE",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  switzerland: "CH",
  austria: "AT",
  "united kingdom": "GB",
  uk: "GB",
  england: "GB",
  scotland: "GB",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  us: "US",
  canada: "CA",
  australia: "AU",
  india: "IN",
  singapore: "SG",
};

const CEFR_VALUES: readonly string[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

function degreeLevelOf(degree: string): DegreeLevel {
  for (const [pattern, level] of DEGREE_PATTERNS) {
    if (pattern.test(degree)) return level;
  }
  return 0;
}

function seniorityOf(title: string): Seniority {
  for (const [pattern, level] of SENIORITY_PATTERNS) {
    if (pattern.test(title)) return level;
  }
  return DEFAULT_SENIORITY;
}

/** "Eindhoven, Netherlands" -> { city: "Eindhoven", country: "NL" }. */
export function parseLocation(raw: string | undefined): {
  city: string | null;
  country: string | null;
} {
  const text = (raw ?? "").trim();
  if (text === "") return { city: null, country: null };

  const parts = text
    .split(",")
    .map((p) => p.replace(/\((remote|hybrid|onsite)\)/i, "").trim())
    .filter((p) => p !== "");
  if (parts.length === 0) return { city: null, country: null };

  const last = parts[parts.length - 1] ?? "";
  const code =
    /^[A-Za-z]{2}$/.test(last) ? last.toUpperCase() : COUNTRY_CODES[last.toLowerCase()] ?? null;

  const city = parts.length > 1 ? (parts[0] ?? null) : code === null ? (parts[0] ?? null) : null;
  return { city, country: code };
}

/** Pull an explicit duration out of free text like "2 years" or "6 months". */
function monthsFromDuration(duration: string | undefined): number {
  const text = duration ?? "";
  const years = /(\d+(?:\.\d+)?)\s*(?:\+\s*)?(?:years?|yrs?|jaar)/i.exec(text);
  const months = /(\d+)\s*(?:months?|mos?|maanden)/i.exec(text);
  let total = 0;
  if (years?.[1] !== undefined) total += Number.parseFloat(years[1]) * 12;
  if (months?.[1] !== undefined) total += Number.parseInt(months[1], 10);
  return Number.isFinite(total) ? Math.round(total) : 0;
}

const clampInt = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));

/* -------------------------------------------------------------------------
 * Profile
 * ---------------------------------------------------------------------- */

export interface AdaptedProfile {
  profile: UserProfile;
  /** Fraction of the resume's raw skill strings that resolved. Feeds confidence. */
  taxonomyHitRate: number;
  unresolvedSkills: string[];
}

/**
 * Build a `UserProfile` from the stored resume profile.
 *
 * Evidence source is derived, not guessed: a skill named in an experience
 * bullet counts as `experience`, one named only in a project's technology list
 * counts as `project`, and anything that appears solely in the "Skills:" array
 * counts as `listed`. That mapping is the whole reason the quality table has
 * three tiers, so it is worth doing properly rather than defaulting everything
 * to `listed`.
 */
export function toUserProfile(legacy: LegacyProfile | null | undefined): AdaptedProfile {
  const source: LegacyProfile = legacy ?? {};

  const experience = source.experience ?? [];
  const projects = source.projects ?? [];
  const listedSkills = source.skills ?? [];

  const experienceText = experience
    .flatMap((e) => [e.title ?? "", ...(e.highlights ?? [])])
    .join(" \n ")
    .toLowerCase();
  const projectText = projects
    .flatMap((p) => [p.name ?? "", p.description ?? "", ...(p.technologies ?? [])])
    .join(" \n ")
    .toLowerCase();

  const totalMonths = Math.max(0, Math.round((source.years_of_experience ?? 0) * 12));

  // Every raw string worth resolving: the skills list plus project stacks.
  const rawStrings = [...listedSkills, ...projects.flatMap((p) => p.technologies ?? [])];

  const bySkill = new Map<string, UserSkill>();
  const unresolved: string[] = [];
  let attempted = 0;

  for (const raw of rawStrings) {
    const text = (raw ?? "").trim();
    if (text === "") continue;
    attempted++;

    const canonicalId = resolveSkill(text);
    if (canonicalId === null) {
      unresolved.push(text);
      continue;
    }

    const needle = text.toLowerCase();
    let evidence: SkillSource = "listed";
    if (experienceText.includes(needle)) evidence = "experience";
    else if (projectText.includes(needle)) evidence = "project";

    const existing = bySkill.get(canonicalId);
    const rank: Record<SkillSource, number> = { experience: 3, project: 2, listed: 1 };
    if (existing === undefined || rank[evidence] > rank[existing.source]) {
      bySkill.set(canonicalId, {
        canonicalId,
        // `level` is not read by v1.0.0 scoring; it is recorded from the
        // strength of the evidence so a later version has something to use.
        level: evidence === "experience" ? 3 : evidence === "project" ? 2 : 1,
        months: evidence === "experience" ? totalMonths : 0,
        source: evidence,
      });
    }
  }

  const titles = experience
    .map((e) => (e.title ?? "").trim())
    .filter((t) => t !== "")
    .map((title) => ({
      normalizedTitle: title.toLowerCase(),
      months: monthsFromDuration(experience.find((e) => e.title === title)?.duration),
      seniority: seniorityOf(title),
    }));

  const education = source.education ?? [];
  const degreeLevel = education.reduce<DegreeLevel>(
    (max, e) => (degreeLevelOf(e.degree ?? "") > max ? degreeLevelOf(e.degree ?? "") : max),
    0,
  );
  const fieldId =
    education.map((e) => resolveField(e.field ?? "")).find((id) => id !== null) ??
    resolveField(source.field ?? "");

  const { city, country } = parseLocation(source.location);

  return {
    profile: {
      skills: [...bySkill.values()],
      titles,
      totalMonthsExperience: totalMonths,
      education: {
        degreeLevel,
        fieldId: fieldId ?? null,
        // Extracted for display only. The scoring engine never reads it.
        graduationDate: education[0]?.graduation_year ?? null,
      },
      location: {
        city,
        country,
        // The resume does not state these, and a GATE MUST NOT FIRE ON ABSENT
        // EVIDENCE — defaulting `willingRelocate` to false would mark every
        // onsite role abroad "ineligible" for users who never said so. Cross-
        // border friction is still charged as a logistics penalty.
        willingRemote: true,
        willingRelocate: true,
      },
      // Not present in the stored resume profile. Left empty so the
      // corresponding gates stay closed rather than firing on a guess; this
      // also lowers confidence, which is the honest signal.
      workAuth: [],
      languages: [],
      credentials: [],
      summaryEmbedding: null,
    },
    taxonomyHitRate: attempted === 0 ? 0 : (attempted - unresolved.length) / attempted,
    unresolvedSkills: unresolved,
  };
}

/* -------------------------------------------------------------------------
 * Job posting
 * ---------------------------------------------------------------------- */

export interface AdaptedJob {
  posting: JobPosting;
  taxonomyHitRate: number;
  unresolvedSkills: string[];
}

/**
 * Turn extracted job facts into a typed `JobPosting`.
 * `expiresAt` is taken from jobblast's own job record rather than the model —
 * postings rarely state a closing date and a hallucinated one would gate the
 * job out entirely.
 */
export function toJobPosting(
  facts: RawJobFacts,
  record: { expiresAt?: string | null } = {},
): AdaptedJob {
  const unresolved: string[] = [];
  let attempted = 0;

  const resolveList = (
    entries: readonly { skill: string; weight: number }[],
  ): { canonicalId: string; weight: number }[] => {
    const out = new Map<string, number>();
    for (const entry of entries) {
      const text = (entry.skill ?? "").trim();
      if (text === "") continue;
      attempted++;
      const canonicalId = resolveSkill(text);
      if (canonicalId === null) {
        unresolved.push(text);
        continue;
      }
      const weight = Math.min(5, Math.max(1, Number.isFinite(entry.weight) ? entry.weight : 1));
      // The same canonical skill named twice keeps its highest weight rather
      // than counting twice and skewing the weighted mean.
      out.set(canonicalId, Math.max(out.get(canonicalId) ?? 0, weight));
    }
    return [...out.entries()].map(([canonicalId, weight]) => ({ canonicalId, weight }));
  };

  const requiredSkills = resolveList(facts.requiredSkills ?? []);
  const preferredSkills = resolveList(facts.preferredSkills ?? []);

  const minYears = Math.max(0, Number.isFinite(facts.minYears) ? facts.minYears : 0);
  const maxYears = Math.max(minYears, Number.isFinite(facts.maxYears) ? facts.maxYears : 40);

  const remotePolicy: RemotePolicy =
    facts.remotePolicy === "onsite" || facts.remotePolicy === "hybrid" ? facts.remotePolicy : "remote";

  const country = (facts.country ?? "").trim();
  const city = (facts.city ?? "").trim();

  const languagesRequired = (facts.languagesRequired ?? [])
    .filter((l) => (l.lang ?? "").trim() !== "" && CEFR_VALUES.includes(l.minCefr))
    .map((l) => ({ lang: l.lang.trim(), minCefr: l.minCefr as Cefr }));

  return {
    posting: {
      requiredSkills,
      preferredSkills,
      minYears,
      maxYears,
      seniority: clampInt(facts.seniority, 0, 5) as Seniority,
      degreeRequired: clampInt(facts.degreeRequired, 0, 5) as DegreeLevel,
      fieldPreferenceId: resolveField(facts.fieldPreference ?? ""),
      equivalentExperienceAccepted: facts.equivalentExperienceAccepted === true,
      location: {
        city: city === "" ? null : city,
        country: country === "" ? null : country.toUpperCase(),
        remotePolicy,
      },
      workAuthRequired: (facts.workAuthRequired ?? [])
        .map((c) => (c ?? "").trim().toUpperCase())
        .filter((c) => /^[A-Z]{2}$/.test(c)),
      // Silence means sponsorship is possible. Only an explicit "we cannot
      // sponsor" should be able to arm the work-auth gate.
      sponsorshipAvailable: facts.sponsorshipAvailable !== false,
      requiredCredentials: (facts.requiredCredentials ?? [])
        .map((c) => (c ?? "").trim())
        .filter((c) => c !== ""),
      languagesRequired,
      expiresAt: record.expiresAt ?? null,
      // No embeddings provider is wired into jobblast, so the domain component
      // always takes its documented fallback path today.
      descriptionEmbedding: null,
    },
    taxonomyHitRate: attempted === 0 ? 1 : (attempted - unresolved.length) / attempted,
    unresolvedSkills: unresolved,
  };
}

/** Combined hit rate across both sides, for `MatchOptions.taxonomyHitRate`. */
export function combinedHitRate(profile: AdaptedProfile, job: AdaptedJob): number {
  // Weighted by how many strings each side contributed, so a resume with 30
  // skills is not outvoted by a posting with 4.
  const profileAttempts = profile.profile.skills.length + profile.unresolvedSkills.length;
  const jobAttempts =
    job.posting.requiredSkills.length +
    job.posting.preferredSkills.length +
    job.unresolvedSkills.length;
  const total = profileAttempts + jobAttempts;
  if (total === 0) return 0;
  return (profile.taxonomyHitRate * profileAttempts + job.taxonomyHitRate * jobAttempts) / total;
}
