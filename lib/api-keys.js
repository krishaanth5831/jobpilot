// Per-user API credentials. Each account can bring (and pay for) its own
// Claude / Adzuna / RapidAPI keys — they live in that user's data bucket, not
// in global .env.local, so one person's usage never spends another's credits.
//
// Job search is the exception: Adzuna and RapidAPI (JSearch) fall back to the
// server's own keys when an account hasn't set its own, so a brand-new account
// gets working job search out of the box (see getAdzunaCreds/getRapidApiKey) —
// the same shared-key idea as the free Groq model (lib/free-model.js).
//
// Keys are read at the point of use (getApiKey/getApiKeys/getAdzunaCreds/
// getRapidApiKey) so a change on the Settings page takes effect on the very
// next request.

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

// Job-search keys with a shared-server fallback. A brand-new account has no
// keys of its own, so instead of an "add your key" wall it borrows the
// server's Adzuna / RapidAPI keys (the ADZUNA_*/RAPIDAPI_KEY in .env.local —
// i.e. the owner's) — the same idea as the free Groq model. An account that
// pastes its own key on the Settings page overrides the shared one and then
// spends its own quota instead of the shared one.

/** Resolved Adzuna credentials: the user's own, else the shared server keys. */
export async function getAdzunaCreds() {
  const keys = await getApiKeys();
  return {
    appId: keys.ADZUNA_APP_ID || process.env.ADZUNA_APP_ID || null,
    appKey: keys.ADZUNA_APP_KEY || process.env.ADZUNA_APP_KEY || null,
    // Country is a per-user region preference, not a shared secret; it just
    // backstops to the server default, then to "us".
    country: keys.ADZUNA_COUNTRY || process.env.ADZUNA_COUNTRY || "us",
  };
}

/** Resolved RapidAPI (JSearch) key: the user's own, else the shared server key. */
export async function getRapidApiKey() {
  const keys = await getApiKeys();
  return keys.RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || undefined;
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
