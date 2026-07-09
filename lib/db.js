// Simple JSON-file storage for the MVP (single user, local).
// Upgrade path: swap this module for Prisma + SQLite/Postgres when adding auth
// or deploying — the rest of the app only talks to getDb().

import { JSONFilePreset } from "lowdb/node";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

const defaultData = {
  profile: null, // structured resume profile extracted by Claude
  resumeText: null, // raw text of the uploaded resume (feeds the resume studio)
  resumeReview: null, // Claude's critique: { score, summary, strengths, issues }
  interview: null, // grill-me state: { questions: [{ question, focus, answer }], done }
  builtResume: null, // rebuilt resume: { markdown, createdAt }
  targetRoles: [], // roles/locations the user wants, e.g. { role, location }
  jobs: [], // fetched + matched jobs: { id, source, title, company, ..., match }
  lastSearch: null, // { role, location, at, jobIds } — what the latest search returned
  applications: [], // review queue: { id, jobId, coverLetter, answers, status }
  insights: [], // lessons from hired applications: { id, applicationId, jobTitle, company, lessons }
};

let dbPromise;

export function getDb() {
  if (!dbPromise) {
    dbPromise = JSONFilePreset(DB_PATH, defaultData);
  }
  return dbPromise;
}
