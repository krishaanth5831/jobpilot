// Fixture wiring: the five committed PDFs, the profile Claude would have
// extracted from each at upload, and the counts the classifier would return.
//
// The CLASSIFIER IS STUBBED here. The counts below are fixed so the snapshots
// stay deterministic and the suite never touches the network — the parse and
// scoring layers are exercised for real, against the real PDFs.

import fs from "node:fs";
import path from "node:path";

import type { LegacyProfile } from "../../matching/adapt";
import type { ContentStats, Locale } from "../types";

export const FIXTURE_DIR = path.join(process.cwd(), "lib/resume-health/__tests__/fixtures");

export interface HealthFixture {
  name: string;
  description: string;
  file: string;
  profile: LegacyProfile | null;
  contentStats: ContentStats;
  locale: Locale;
}

const stats = (over: Partial<ContentStats> = {}): ContentStats => ({
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
  ...over,
});

/** A well-built single-column resume: quantified, action-led, one page. */
export const cleanFixture: HealthFixture = {
  name: "clean-single-column",
  description: "Clean single-column LaTeX-style resume, quantified bullets",
  file: "clean-single-column.pdf",
  locale: "NL",
  profile: {
    name: "A. Candidate",
    email: "candidate@example.com",
    location: "Amsterdam, Netherlands",
    field: "software engineering",
    education: [
      { institution: "Delft University", degree: "BSc", field: "Computer Science", graduation_year: "2020" },
    ],
    experience: [
      {
        title: "Backend Engineer",
        company: "Northwind Systems",
        duration: "Mar 2022 - Aug 2025",
        highlights: [
          "Reduced median API latency from 480 ms to 120 ms by adding query-level caching",
          "Migrated 14 services to Docker and Kubernetes, cutting deploy time by 65%",
          "Built a CI/CD pipeline in GitHub Actions covering 320 pytest cases",
          "Designed the PostgreSQL schema behind a 40 million row event store",
        ],
      },
      {
        title: "Junior Developer",
        company: "Halcyon Labs",
        duration: "Jun 2020 - Feb 2022",
        highlights: [
          "Shipped 3 React features used by 12000 monthly active users",
          "Automated weekly reporting with Python, saving 6 hours per week",
          "Wrote REST APIs in Node.js serving 90 requests per second at peak",
        ],
      },
    ],
    skills: [
      "Python", "JavaScript", "TypeScript", "React", "Node.js", "PostgreSQL",
      "Docker", "Kubernetes", "Terraform", "AWS", "Git", "REST APIs",
      "pytest", "CI/CD", "Linux",
    ],
    projects: [{ name: "Ledger", description: "Double-entry accounting library", technologies: ["TypeScript"] }],
    years_of_experience: 5,
  },
  contentStats: stats({
    bulletsTotal: 7,
    bulletsWithMetric: 6,
    bulletsWithStrongVerb: 7,
    bulletsOverTwoLines: 0,
    skillsEvidencedInBullets: [
      "docker", "kubernetes", "ci-cd", "pytest", "postgresql", "react", "python", "nodejs", "rest-api",
    ],
  }),
};

/** The designed CV: two columns, photo, header contact, duty-phrased prose. */
export const canvaFixture: HealthFixture = {
  name: "canva-two-column",
  description: "Canva-style two-column CV with a photo, rating bars and header contact",
  file: "canva-two-column.pdf",
  locale: "NL",
  profile: {
    name: "A. Candidate",
    email: "candidate@example.com",
    location: "Rotterdam, Netherlands",
    field: "design",
    education: [
      { institution: "Willem de Kooning", degree: "BA", field: "Graphic Design", graduation_year: "2020" },
    ],
    experience: [
      {
        title: "Product Designer",
        company: "Vantage Studio",
        duration: "2021 - 2024",
        highlights: ["Responsible for the redesign of the onboarding flow"],
      },
      {
        title: "Design Intern",
        company: "Kettle & Co",
        duration: "2020 - 2021",
        highlights: ["Helped with various design tasks"],
      },
    ],
    skills: ["Python", "React", "Docker", "AWS", "SQL", "Git", "Linux"],
    projects: [],
    years_of_experience: 4,
  },
  contentStats: stats({
    bulletsTotal: 3,
    bulletsWithMetric: 0,
    bulletsWithStrongVerb: 0,
    bulletsPassiveOrDuty: 3,
    bulletsOverTwoLines: 2,
    clichePhraseCount: 5,
    firstPersonPronounCount: 6,
    tenseInconsistencies: 2,
    skillsEvidencedInBullets: [],
  }),
};

/** The Word export: table layout, mixed date formats, duty-phrased bullets. */
export const wordFixture: HealthFixture = {
  name: "word-with-tables",
  description: "Word export using a table layout, mixed date formats",
  file: "word-with-tables.pdf",
  locale: "NL",
  profile: {
    name: "A. Candidate",
    email: "candidate@example.com",
    location: "Utrecht, Netherlands",
    field: "mechanical engineering",
    education: [
      { institution: "TU Eindhoven", degree: "MSc", field: "Mechanical Engineering", graduation_year: "2019" },
    ],
    experience: [
      { title: "Mechanical Engineer", company: "Ardent Manufacturing", duration: "03/2021 - 09/2024", highlights: ["Produced technical drawings using SolidWorks and AutoCAD"] },
      { title: "Design Engineer", company: "Braid Industrial", duration: "2019 - 2021", highlights: ["Ran FEA studies in ANSYS"] },
      { title: "Engineering Intern", company: "Corvus Works", duration: "Jun 2018 - Sep 2018", highlights: ["Supported GD&T reviews"] },
      { title: "Workshop Assistant", company: "Delta Fabrication", duration: "2017 - 2018", highlights: ["Workshop support"] },
    ],
    skills: ["SolidWorks", "AutoCAD", "ANSYS", "GD&T", "DFM", "MATLAB", "Six Sigma"],
    projects: [],
    years_of_experience: 6,
  },
  contentStats: stats({
    bulletsTotal: 3,
    bulletsWithMetric: 0,
    bulletsWithStrongVerb: 0,
    bulletsPassiveOrDuty: 3,
    bulletsOverTwoLines: 1,
    tenseInconsistencies: 1,
    skillsEvidencedInBullets: ["solidworks", "autocad", "ansys", "gd-t"],
  }),
};

/** A scan. No text layer at all — the gate case. */
export const scannedFixture: HealthFixture = {
  name: "scanned-image",
  description: "Scanned image resume with no text layer",
  file: "scanned-image.pdf",
  locale: "NL",
  profile: null,
  contentStats: stats(),
};

/** The student: almost nothing on the page, no experience section, no bullets. */
export const sparseFixture: HealthFixture = {
  name: "sparse-student",
  description: "Sparse student resume: no experience section, no bullets, cliches",
  file: "sparse-student.pdf",
  locale: "NL",
  profile: {
    name: "A. Candidate",
    email: "candidate@example.com",
    location: "Delft, Netherlands",
    field: "electrical engineering",
    education: [
      { institution: "TU Delft", degree: "BSc", field: "Electrical Engineering", graduation_year: "2027" },
    ],
    experience: [],
    skills: ["Python", "MATLAB", "teamwork", "communication", "problem solving"],
    projects: [],
    years_of_experience: 0,
  },
  contentStats: stats({
    bulletsTotal: 0,
    clichePhraseCount: 3,
    firstPersonPronounCount: 4,
  }),
};

export const ALL_HEALTH_FIXTURES: readonly HealthFixture[] = [
  cleanFixture,
  canvaFixture,
  wordFixture,
  scannedFixture,
  sparseFixture,
];

export function fixtureBuffer(fixture: HealthFixture): Buffer {
  return fs.readFileSync(path.join(FIXTURE_DIR, fixture.file));
}

/** Stubbed classifier: returns the fixture's fixed counts, never calls out. */
export function stubAsk(contentStats: ContentStats) {
  return async (): Promise<unknown> => ({
    ...contentStats,
    // The real model reports plain names; classify.ts resolves them. Feeding
    // ids back through resolveSkill is a no-op, so the stub round-trips.
    skillsEvidencedInBullets: contentStats.skillsEvidencedInBullets,
  });
}
