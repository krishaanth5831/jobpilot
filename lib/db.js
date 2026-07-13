// Simple JSON-file storage for the MVP (local file, multi-user aware).
// Data is partitioned per user under db.data.users — routes get their
// bucket through lib/user-data.js, never through db.data directly.
// Upgrade path: swap this module for Prisma + SQLite/Postgres when
// deploying at real scale — the rest of the app only talks to getDb().

import { JSONFilePreset } from "lowdb/node";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

// One user's complete state.
export const emptyUserData = () => ({
  apiKeys: {}, // this account's own API credentials (see lib/api-keys.js) — new accounts start empty
  profile: null, // structured resume profile extracted by Claude
  resumeText: null, // raw text of the uploaded resume (feeds the resume studio)
  resumeReview: null, // Claude's critique: { score, summary, strengths, issues }
  interview: null, // grill-me state: { questions: [{ question, focus, answer }], done }
  builtResume: null, // rebuilt resume: { markdown, createdAt }
  tailoredResumes: {}, // per-job tailored resumes keyed by jobId: { markdown, createdAt }
  resumeTemplate: null, // { selected: templateId, picks: [{ id, reason }] | null }
  targetRoles: [], // roles/locations the user wants, e.g. { role, location }
  recommendations: null, // Claude-suggested searches: { items: [{ query, kind, reason }], createdAt }
  jobs: [], // fetched + matched jobs: { id, source, title, company, ..., match }
  lastSearch: null, // { role, location, at, jobIds } — what the latest search returned
  applications: [], // review queue: { id, jobId, coverLetter, status, ... }
  insights: [], // lessons from hired applications: { id, applicationId, lessons }
});

let dbPromise;

async function init() {
  const db = await JSONFilePreset(DB_PATH, { users: {}, accounts: {} });

  // Migrate the pre-auth flat shape (fields at the top level) into the
  // "local" user's bucket, preserving everything.
  if (db.data && db.data.users === undefined) {
    const legacy = db.data;
    db.data = { users: { local: { ...emptyUserData(), ...legacy } }, accounts: {} };
    await db.write();
  }
  db.data.users ??= {};
  // Email/password login credentials, keyed by lowercased email.
  db.data.accounts ??= {};
  return db;
}

export function getDb() {
  if (!dbPromise) dbPromise = init();
  return dbPromise;
}
