// Per-user API credentials. Each account brings (and pays for) its own
// Claude / Adzuna / RapidAPI keys — they live in that user's data bucket, not
// in global .env.local, so one person's usage never spends another's credits.
//
// Keys are read at the point of use (getApiKey/getApiKeys) so a change on the
// Settings page takes effect on the very next request.

import { auth } from "./auth";
import { getDb } from "./db";

// The only keys stored per-user. ADZUNA_COUNTRY is a region preference, the
// rest are secrets.
export const API_KEY_NAMES = [
  "ANTHROPIC_API_KEY",
  "ADZUNA_APP_ID",
  "ADZUNA_APP_KEY",
  "ADZUNA_COUNTRY",
  "RAPIDAPI_KEY",
];

// The owner account inherits the shared .env.local keys once (see
// lib/user-data.js). Ownership is keyed to the email — that's the login,
// so it can't be spoofed by copying the display name. An optional OWNER_NAME
// can grant ownership by name too, but it's off unless explicitly set.
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "krishaanth2007@gmail.com").trim().toLowerCase();
const OWNER_NAME = (process.env.OWNER_NAME || "").trim().toLowerCase();
export const isOwnerAccount = (name, email) => {
  if ((email ?? "").trim().toLowerCase() === OWNER_EMAIL) return true;
  return OWNER_NAME !== "" && (name ?? "").trim().toLowerCase() === OWNER_NAME;
};

/** The .env.local values used to seed the owner's bucket the first time. */
export function ownerSeedKeys() {
  const seed = {};
  for (const name of API_KEY_NAMES) {
    if (process.env[name]) seed[name] = process.env[name];
  }
  return seed;
}

/** The current request user's stored keys ({} when unknown or none set). */
export async function getApiKeys() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return {};
  const db = await getDb();
  return db.data.users[email]?.apiKeys ?? {};
}

/** A single key for the current request's user, or undefined. */
export async function getApiKey(name) {
  const keys = await getApiKeys();
  return keys[name] || undefined;
}

/**
 * The current user's AI model preferences, raw from their bucket ({} when
 * signed out or never set). Validated against the known models/efforts by
 * the consumer (lib/claude.js, the settings API).
 */
export async function getModelPrefs() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return {};
  const db = await getDb();
  const user = db.data.users[email];
  return { model: user?.claudeModel, effort: user?.claudeEffort };
}
