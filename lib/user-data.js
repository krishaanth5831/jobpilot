// Per-user data access. Every API route goes through here instead of
// reading db.data directly, so a signed-in user only ever touches their
// own bucket — and with auth disabled everything maps to the "local" user.

import { auth, authEnabled } from "./auth";
import { getDb, emptyUserData } from "./db";
import { isOwnerAccount, ownerSeedKeys } from "./api-keys";
import { normalizeEmail } from "./accounts";
import { paywallEnabled } from "./entitlements";

// How stale an account's lastActiveAt stamp may get before it's refreshed.
// Every API route calls through here, and a write re-serializes the whole
// document (one Redis SET on serverless) — so we trade five minutes of
// precision for one write per active user per five minutes, not one per
// request. Surfaced in the owner's Signups panel.
const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Stamp when this account was last seen, at most once per throttle window.
 * Returns true if the caller still needs to db.write(). Accounts created
 * through a social login have no credentials record — nothing to stamp.
 */
function touchLastActive(db, userId) {
  const account = db.data.accounts?.[normalizeEmail(userId)];
  if (!account) return false;
  const last = Date.parse(account.lastActiveAt ?? "");
  if (Number.isFinite(last) && Date.now() - last < ACTIVITY_THROTTLE_MS) return false;
  account.lastActiveAt = new Date().toISOString();
  return true;
}

/**
 * @returns {Promise<{ db, data, userId, isOwner }>} `data` is the caller's
 * mutable bucket (call db.write() after changing it), or null when auth is
 * enabled and the request has no session — return 401 in that case.
 */
export async function getUserData() {
  const db = await getDb();

  let userId = "local";
  let isOwner = false;
  let dirty = false;
  if (authEnabled) {
    const session = await auth();
    userId = session?.user?.email ?? null;
    if (!userId) return { db, data: null, userId: null, isOwner: false };
    isOwner = isOwnerAccount(session.user?.name, session.user?.email);
    await adoptLocalDataOnFirstSignIn(db, userId);
    dirty = touchLastActive(db, userId);
  }

  db.data.users[userId] ??= emptyUserData();

  // The owner inherits the shared .env.local keys exactly once — this also
  // migrates an owner account created before keys were per-user. Every other
  // account starts empty and must paste its own keys on the Settings page.
  const bucket = db.data.users[userId];
  if (isOwner && !bucket.apiKeysSeeded) {
    bucket.apiKeys = { ...ownerSeedKeys(), ...(bucket.apiKeys ?? {}) };
    bucket.apiKeysSeeded = true;
    dirty = true;
  }

  // Subscription fields, initialised once. A null billingAnchorAt is the
  // "never set up" marker, so this backfills accounts that predate the
  // subscription system on their next request — no migration script.
  //
  // Grandfathering is decided HERE rather than at signup because that is what
  // makes it self-maintaining: while the paywall is off every account that
  // arrives is grandfathered, and the moment the flag flips new accounts stop
  // being. Nobody has to remember to run anything on flip day.
  if (!bucket.billingAnchorAt) {
    bucket.billingAnchorAt =
      db.data.accounts?.[normalizeEmail(userId)]?.createdAt ?? new Date().toISOString();
    bucket.grandfathered = !paywallEnabled();
    dirty = true;
  }

  if (dirty) await db.write();

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
export const SIGN_IN_ERROR = { error: "Sign in to use jobblast on this server" };
