// Five realistic profile + posting pairs, one per band, used as snapshot
// fixtures. Kept in their own module so the wire-up and any future
// recalibration work can score the same cases without duplicating them.
//
// None of these describe a real person. Names are absent by construction —
// `UserProfile` has no name field, because the engine must never see one.

import type { JobPosting, UserProfile } from "../types";

/** Convenience so a fixture only has to state what makes it interesting. */
export function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    skills: [],
    titles: [],
    totalMonthsExperience: 0,
    education: { degreeLevel: 0, fieldId: null, graduationDate: null },
    location: { city: null, country: null, willingRemote: false, willingRelocate: false },
    workAuth: [],
    languages: [],
    credentials: [],
    summaryEmbedding: null,
    ...overrides,
  };
}

export function makeJob(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    requiredSkills: [],
    preferredSkills: [],
    minYears: 0,
    maxYears: 40,
    seniority: 0,
    degreeRequired: 0,
    fieldPreferenceId: null,
    equivalentExperienceAccepted: false,
    location: { city: null, country: null, remotePolicy: "remote" },
    workAuthRequired: [],
    sponsorshipAvailable: true,
    requiredCredentials: [],
    languagesRequired: [],
    expiresAt: null,
    descriptionEmbedding: null,
    ...overrides,
  };
}

export interface Fixture {
  name: string;
  description: string;
  user: UserProfile;
  job: JobPosting;
}

/* ---------------------------------------------------------------------- */

/** STRONG — mid-level full-stack developer, in-city hybrid role that matches
 *  their actual stack. Not a perfect match: they have never used GraphQL in
 *  anger and their Kubernetes exposure is only adjacent. */
export const strongFixture: Fixture = {
  name: "strong",
  description: "Mid-level full-stack dev vs. a hybrid React/TypeScript role in their own city",
  user: makeUser({
    skills: [
      { canonicalId: "react", level: 3, months: 48, source: "experience" },
      { canonicalId: "typescript", level: 3, months: 42, source: "experience" },
      { canonicalId: "nodejs", level: 2, months: 36, source: "experience" },
      { canonicalId: "postgresql", level: 2, months: 30, source: "experience" },
      { canonicalId: "docker", level: 2, months: 18, source: "project" },
      { canonicalId: "aws", level: 2, months: 24, source: "experience" },
      { canonicalId: "graphql", level: 1, months: 0, source: "listed" },
      { canonicalId: "git", level: 3, months: 54, source: "experience" },
    ],
    titles: [{ normalizedTitle: "software engineer", months: 54, seniority: 3 }],
    totalMonthsExperience: 54,
    education: {
      degreeLevel: 3,
      fieldId: "field:computer-science",
      graduationDate: "2021-06-30",
    },
    location: { city: "Amsterdam", country: "NL", willingRemote: true, willingRelocate: false },
    workAuth: ["NL", "DE"],
    languages: [
      { lang: "English", cefr: "C1" },
      { lang: "Dutch", cefr: "B2" },
    ],
    credentials: [],
    summaryEmbedding: null,
  }),
  job: makeJob({
    requiredSkills: [
      { canonicalId: "react", weight: 3 },
      { canonicalId: "typescript", weight: 3 },
      { canonicalId: "nodejs", weight: 2 },
      { canonicalId: "postgresql", weight: 2 },
    ],
    preferredSkills: [
      { canonicalId: "aws", weight: 2 },
      { canonicalId: "docker", weight: 1 },
      { canonicalId: "graphql", weight: 1 },
      { canonicalId: "kubernetes", weight: 1 },
    ],
    minYears: 3,
    maxYears: 6,
    seniority: 3,
    degreeRequired: 3,
    fieldPreferenceId: "field:computer-science",
    equivalentExperienceAccepted: true,
    location: { city: "Amsterdam", country: "NL", remotePolicy: "hybrid" },
    workAuthRequired: ["NL"],
    sponsorshipAvailable: false,
    requiredCredentials: [],
    languagesRequired: [{ lang: "English", minCefr: "B2" }],
    expiresAt: null,
    descriptionEmbedding: null,
  }),
};

/** GOOD — electrical engineering student against an embedded internship.
 *  Everything is project evidence rather than paid work, which is exactly what
 *  an internship applicant looks like. */
export const goodFixture: Fixture = {
  name: "good",
  description: "EE undergraduate vs. an embedded firmware internship in the same city",
  user: makeUser({
    skills: [
      { canonicalId: "embedded-c", level: 2, months: 10, source: "project" },
      { canonicalId: "microcontrollers", level: 2, months: 14, source: "project" },
      { canonicalId: "c", level: 2, months: 20, source: "project" },
      { canonicalId: "arduino", level: 3, months: 18, source: "project" },
      { canonicalId: "git", level: 2, months: 12, source: "listed" },
      { canonicalId: "oscilloscope", level: 2, months: 8, source: "project" },
      { canonicalId: "python", level: 2, months: 16, source: "project" },
    ],
    titles: [{ normalizedTitle: "engineering intern", months: 4, seniority: 0 }],
    totalMonthsExperience: 4,
    education: {
      degreeLevel: 3,
      fieldId: "field:electrical-engineering",
      graduationDate: "2027-07-01",
    },
    location: { city: "Eindhoven", country: "NL", willingRemote: false, willingRelocate: true },
    workAuth: ["NL"],
    languages: [
      { lang: "English", cefr: "C1" },
      { lang: "Dutch", cefr: "C2" },
    ],
    credentials: [],
    summaryEmbedding: null,
  }),
  job: makeJob({
    requiredSkills: [
      { canonicalId: "embedded-c", weight: 3 },
      { canonicalId: "microcontrollers", weight: 3 },
      { canonicalId: "circuit-design", weight: 2 },
      { canonicalId: "git", weight: 1 },
    ],
    preferredSkills: [
      { canonicalId: "python", weight: 1 },
      { canonicalId: "rtos", weight: 2 },
      { canonicalId: "altium", weight: 1 },
    ],
    minYears: 0,
    maxYears: 2,
    seniority: 0,
    degreeRequired: 3,
    fieldPreferenceId: "field:electrical-engineering",
    equivalentExperienceAccepted: false,
    location: { city: "Eindhoven", country: "NL", remotePolicy: "onsite" },
    workAuthRequired: ["NL"],
    sponsorshipAvailable: false,
    requiredCredentials: [],
    languagesRequired: [{ lang: "English", minCefr: "B2" }],
    expiresAt: null,
    descriptionEmbedding: null,
  }),
};

/** STRETCH — self-taught frontend developer reaching for a data engineering
 *  role. Adjacent skills carry real partial credit; the core stack does not
 *  overlap. */
export const stretchFixture: Fixture = {
  name: "stretch",
  description: "Frontend developer reaching for a mid-level data engineering role",
  user: makeUser({
    skills: [
      { canonicalId: "python", level: 2, months: 24, source: "experience" },
      { canonicalId: "sql", level: 2, months: 18, source: "experience" },
      { canonicalId: "postgresql", level: 2, months: 18, source: "experience" },
      { canonicalId: "pandas", level: 1, months: 6, source: "project" },
      { canonicalId: "docker", level: 1, months: 8, source: "listed" },
      { canonicalId: "javascript", level: 3, months: 40, source: "experience" },
    ],
    titles: [{ normalizedTitle: "frontend developer", months: 40, seniority: 2 }],
    totalMonthsExperience: 40,
    education: {
      degreeLevel: 3,
      fieldId: "field:design",
      graduationDate: "2020-06-30",
    },
    location: { city: "Rotterdam", country: "NL", willingRemote: true, willingRelocate: false },
    workAuth: ["NL"],
    languages: [{ lang: "English", cefr: "C1" }],
    credentials: [],
    summaryEmbedding: null,
  }),
  job: makeJob({
    requiredSkills: [
      { canonicalId: "spark", weight: 3 },
      { canonicalId: "airflow", weight: 3 },
      { canonicalId: "sql", weight: 2 },
      { canonicalId: "python", weight: 2 },
      { canonicalId: "data-warehousing", weight: 2 },
    ],
    preferredSkills: [
      { canonicalId: "dbt", weight: 1 },
      { canonicalId: "kafka", weight: 1 },
      { canonicalId: "aws", weight: 1 },
    ],
    minYears: 3,
    maxYears: 7,
    seniority: 3,
    degreeRequired: 3,
    fieldPreferenceId: "field:computer-science",
    equivalentExperienceAccepted: true,
    location: { city: "Amsterdam", country: "NL", remotePolicy: "remote" },
    workAuthRequired: [],
    sponsorshipAvailable: true,
    requiredCredentials: [],
    languagesRequired: [{ lang: "English", minCefr: "B2" }],
    expiresAt: null,
    descriptionEmbedding: null,
  }),
};

/** REACH — mechanical engineering graduate against a senior cloud-security
 *  posting. Different discipline, far too little experience, wrong country
 *  but willing to move (so the relocation gate does not fire). */
export const reachFixture: Fixture = {
  name: "reach",
  description: "Mechanical engineering graduate vs. a senior cloud security role abroad",
  user: makeUser({
    skills: [
      { canonicalId: "solidworks", level: 3, months: 30, source: "experience" },
      { canonicalId: "matlab", level: 2, months: 24, source: "project" },
      { canonicalId: "python", level: 1, months: 6, source: "listed" },
      { canonicalId: "excel", level: 3, months: 30, source: "experience" },
    ],
    titles: [{ normalizedTitle: "mechanical design engineer", months: 30, seniority: 2 }],
    totalMonthsExperience: 30,
    education: {
      degreeLevel: 3,
      fieldId: "field:mechanical-engineering",
      graduationDate: "2022-09-01",
    },
    location: { city: "Porto", country: "PT", willingRemote: true, willingRelocate: true },
    workAuth: ["PT"],
    languages: [{ lang: "English", cefr: "B1" }],
    credentials: [],
    summaryEmbedding: null,
  }),
  job: makeJob({
    requiredSkills: [
      { canonicalId: "aws", weight: 3 },
      { canonicalId: "kubernetes", weight: 3 },
      { canonicalId: "terraform", weight: 2 },
      { canonicalId: "network-security", weight: 3 },
      { canonicalId: "penetration-testing", weight: 2 },
    ],
    preferredSkills: [
      { canonicalId: "go", weight: 1 },
      { canonicalId: "siem", weight: 1 },
    ],
    minYears: 6,
    maxYears: 12,
    seniority: 4,
    degreeRequired: 3,
    fieldPreferenceId: "field:cybersecurity",
    equivalentExperienceAccepted: false,
    location: { city: "Berlin", country: "DE", remotePolicy: "hybrid" },
    workAuthRequired: ["DE"],
    sponsorshipAvailable: true,
    requiredCredentials: [],
    languagesRequired: [{ lang: "English", minCefr: "C1" }],
    expiresAt: null,
    descriptionEmbedding: null,
  }),
};

/** GATED — an otherwise excellent match that cannot proceed: the posting
 *  requires US work authorisation and does not sponsor. This is the case that
 *  proves gates are multiplicative rather than just another penalty. */
export const gatedFixture: Fixture = {
  name: "gated",
  description: "Excellent skills match, but the role needs US work authorisation and will not sponsor",
  user: makeUser({
    skills: [
      { canonicalId: "python", level: 3, months: 72, source: "experience" },
      { canonicalId: "machine-learning", level: 3, months: 60, source: "experience" },
      { canonicalId: "pytorch", level: 3, months: 48, source: "experience" },
      { canonicalId: "aws", level: 2, months: 36, source: "experience" },
      { canonicalId: "sql", level: 2, months: 40, source: "experience" },
    ],
    titles: [{ normalizedTitle: "machine learning engineer", months: 72, seniority: 3 }],
    totalMonthsExperience: 72,
    education: {
      degreeLevel: 4,
      fieldId: "field:computer-science",
      graduationDate: "2019-06-30",
    },
    location: { city: "Lisbon", country: "PT", willingRemote: true, willingRelocate: true },
    workAuth: ["PT"],
    languages: [{ lang: "English", cefr: "C1" }],
    credentials: [],
    summaryEmbedding: null,
  }),
  job: makeJob({
    requiredSkills: [
      { canonicalId: "python", weight: 3 },
      { canonicalId: "machine-learning", weight: 3 },
      { canonicalId: "pytorch", weight: 2 },
    ],
    preferredSkills: [
      { canonicalId: "aws", weight: 1 },
      { canonicalId: "mlops", weight: 1 },
    ],
    minYears: 4,
    maxYears: 8,
    seniority: 3,
    degreeRequired: 3,
    fieldPreferenceId: "field:computer-science",
    equivalentExperienceAccepted: true,
    location: { city: "Austin", country: "US", remotePolicy: "remote" },
    workAuthRequired: ["US"],
    sponsorshipAvailable: false,
    requiredCredentials: [],
    languagesRequired: [{ lang: "English", minCefr: "B2" }],
    expiresAt: null,
    descriptionEmbedding: null,
  }),
};

export const ALL_FIXTURES: readonly Fixture[] = [
  strongFixture,
  goodFixture,
  stretchFixture,
  reachFixture,
  gatedFixture,
];

/** Pinned clock so the expiry gate is deterministic across runs. */
export const FIXED_NOW = new Date("2026-08-05T12:00:00.000Z");
