// Storage for all app data (multi-user aware). Data is partitioned per user
// under db.data.users — routes get their bucket through lib/user-data.js,
// never through db.data directly.
//
// Two backends, picked by environment:
//  - Local / self-hosted: the MVP JSON file (data/db.json), cached in memory.
//  - Serverless (Vercel): the filesystem is read-only and instances don't
//    share memory, so the same document lives in one Redis key (Upstash REST,
//    lib/redis.js) and is re-read fresh on every request.

import { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";
import path from "path";
import { redisConfig, redisCommand } from "./redis";

const DB_PATH = path.join(process.cwd(), "data", "db.json");
const REDIS_KEY = "jobpilot:db";

const defaultData = () => ({ users: {}, accounts: {} });

// One user's complete state.
export const emptyUserData = () => ({
  apiKeys: {}, // this account's own API credentials (see lib/api-keys.js) — new accounts start empty
  autoApply: true, // when true, jobs scoring above the threshold auto-draft into the review queue
  profile: null, // structured resume profile extracted by Claude
  resumeText: null, // raw text of the uploaded resume (feeds the resume studio)
  resumeReview: null, // Claude's critique: { score, summary, strengths, issues }
  builtResume: null, // the resume the user edits in the studio: { markdown, createdAt }
  tailoredResumes: {}, // per-job tailored resumes keyed by jobId: { markdown, createdAt }
  resumeTemplate: null, // { selected: templateId, picks: [{ id, reason }] | null }
  targetRoles: [], // roles/locations the user wants, e.g. { role, location }
  recommendations: null, // Claude-suggested searches: { items: [{ query, kind, reason }], createdAt }
  jobs: [], // fetched + matched jobs: { id, source, title, company, ..., match }
  lastSearch: null, // { role, location, at, jobIds } — what the latest search returned
  applications: [], // review queue: { id, jobId, coverLetter, status, ... }
  insights: [], // lessons from hired applications: { id, applicationId, lessons }
});

// lowdb adapter that stores the whole document as one JSON string in Redis.
class RedisAdapter {
  async read() {
    const raw = await redisCommand(["GET", REDIS_KEY]);
    return raw == null ? null : JSON.parse(raw);
  }
  async write(data) {
    await redisCommand(["SET", REDIS_KEY, JSON.stringify(data)]);
  }
}

function ensureShape(db) {
  db.data.users ??= {};
  // Email/password login credentials, keyed by lowercased email.
  db.data.accounts ??= {};
  // Global cross-account knowledge base (lib/learnings.js), keyed by
  // learning id. Deliberately outside users: learnings are anonymous
  // aggregates and are never linked back to an account.
  db.data.learnings ??= {};
}

async function initFile() {
  const db = await JSONFilePreset(DB_PATH, defaultData());

  // Migrate the pre-auth flat shape (fields at the top level) into the
  // "local" user's bucket, preserving everything.
  if (db.data && db.data.users === undefined) {
    const legacy = db.data;
    db.data = { users: { local: { ...emptyUserData(), ...legacy } }, accounts: {} };
    await db.write();
  }
  ensureShape(db);
  return db;
}

async function initRedis() {
  const db = new Low(new RedisAdapter(), defaultData());
  await db.read();
  ensureShape(db);
  return db;
}

let filePromise;

export function getDb() {
  if (redisConfig()) {
    // A fresh instance (and read) per call: serverless instances can't trust
    // a cached copy — another instance may have written since — and routes
    // mutate db.data then call db.write(), so each request's read and write
    // must share one instance.
    return initRedis();
  }
  if (process.env.VERCEL) {
    throw new Error(
      "No database is connected: on Vercel the filesystem is read-only, so jobblast needs a Redis store. " +
        "In the Vercel dashboard open the project's Storage tab, create an Upstash Redis database, connect it, and redeploy."
    );
  }
  if (!filePromise) filePromise = initFile();
  return filePromise;
}
