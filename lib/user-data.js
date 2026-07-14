// Per-user data access. Every API route goes through here instead of
// reading db.data directly, so a signed-in user only ever touches their
// own bucket — and with auth disabled everything maps to the "local" user.

import { auth, authEnabled } from "./auth";
import { getDb, emptyUserData } from "./db";
import { isOwnerAccount, ownerSeedKeys } from "./api-keys";

/**
 * @returns {Promise<{ db, data, userId, isOwner }>} `data` is the caller's
 * mutable bucket (call db.write() after changing it), or null when auth is
 * enabled and the request has no session — return 401 in that case.
 */
export async function getUserData() {
  const db = await getDb();

  let userId = "local";
  let isOwner = false;
  if (authEnabled) {
    const session = await auth();
    userId = session?.user?.email ?? null;
    if (!userId) return { db, data: null, userId: null, isOwner: false };
    isOwner = isOwnerAccount(session.user?.name, session.user?.email);
    await adoptLocalDataOnFirstSignIn(db, userId);
  }

  db.data.users[userId] ??= emptyUserData();

  // The owner inherits the shared .env.local keys exactly once — this also
  // migrates an owner account created before keys were per-user. Every other
  // account starts empty and must paste its own keys on the Settings page.
  const bucket = db.data.users[userId];
  if (isOwner && !bucket.apiKeysSeeded) {
    bucket.apiKeys = { ...ownerSeedKeys(), ...(bucket.apiKeys ?? {}) };
    bucket.apiKeysSeeded = true;
    await db.write();
  }

  return { db, data: bucket, userId, isOwner };
}

/** Does this bucket hold real work worth preserving (vs. an empty stub)? */
function hasRealData(b) {
  return Boolean(
    b &&
      (b.profile ||
        b.resumeText ||
        b.builtResume ||
        (b.jobs && b.jobs.length) ||
        (b.applications && b.applications.length))
  );
}

/**
 * When someone turns on accounts, their existing single-user ("local") data
 * shouldn't vanish. The first person to sign in on a formerly-local instance
 * inherits that local bucket — so the owner signs in and their resume, jobs,
 * and applications are simply there. Runs once: it's skipped as soon as any
 * account has claimed the instance, or when there's no local data to adopt.
 * (Owners sharing an instance should sign in themselves first.)
 */
async function adoptLocalDataOnFirstSignIn(db, userId) {
  if (db.data.users[userId]) return; // this account already has a bucket
  const local = db.data.users.local;
  if (!hasRealData(local)) return; // nothing worth inheriting
  const claimed = Object.keys(db.data.users).some((k) => k !== "local");
  if (claimed) return; // another account already took the instance

  db.data.users[userId] = local;
  delete db.data.users.local;
  await db.write();
}

/** The standard 401 body for routes that got no session. */
export const SIGN_IN_ERROR = { error: "Sign in to use jobpilot on this server" };
