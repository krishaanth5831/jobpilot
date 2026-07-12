// Per-user data access. Every API route goes through here instead of
// reading db.data directly, so a signed-in user only ever touches their
// own bucket — and with auth disabled everything maps to the "local" user.

import { auth, authEnabled } from "./auth";
import { getDb, emptyUserData } from "./db";

/**
 * @returns {Promise<{ db, data, userId }>} `data` is the caller's mutable
 * bucket (call db.write() after changing it), or null when auth is enabled
 * and the request has no session — return 401 in that case.
 */
export async function getUserData() {
  const db = await getDb();

  let userId = "local";
  if (authEnabled) {
    const session = await auth();
    userId = session?.user?.email ?? null;
    if (!userId) return { db, data: null, userId: null };
  }

  db.data.users[userId] ??= emptyUserData();
  return { db, data: db.data.users[userId], userId };
}

/** The standard 401 body for routes that got no session. */
export const SIGN_IN_ERROR = { error: "Sign in to use jobpilot on this server" };
