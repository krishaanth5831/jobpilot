// Creator (affiliate) codes. The owner defines codes on the Settings page and
// hands them to influencers; new sign-ups can enter one (or arrive already
// filled-in via a /signin?ref=CODE share link). The canonical code is stored
// on the account record, and the owner sees per-code signup counts on
// Settings — so paid promotion can be measured. Codes live in
// db.data.creatorCodes as [{ code, createdAt }].

import { getDb } from "./db";

export const normalizeCode = (code) => String(code ?? "").trim().toUpperCase();

// 2–24 chars, letters/digits plus - and _ (after uppercasing). Keeps codes
// paste-safe and URL-safe.
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,23}$/;

/** All codes with how many accounts signed up using each. Owner-only data. */
export async function listCreatorCodes() {
  const db = await getDb();
  const codes = db.data.creatorCodes ?? [];
  const counts = {};
  for (const account of Object.values(db.data.accounts ?? {})) {
    if (account.creatorCode) {
      counts[account.creatorCode] = (counts[account.creatorCode] ?? 0) + 1;
    }
  }
  return codes.map(({ code, createdAt }) => ({
    code,
    createdAt,
    signups: counts[code] ?? 0,
  }));
}

/** The canonical form of a code if it exists, else null. */
export async function findCreatorCode(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const db = await getDb();
  return (db.data.creatorCodes ?? []).some((c) => c.code === normalized)
    ? normalized
    : null;
}

/** Add a code. Returns an error string for the UI, or null on success. */
export async function addCreatorCode(code) {
  const normalized = normalizeCode(code);
  if (!CODE_RE.test(normalized)) {
    return "Codes are 2–24 characters: letters, numbers, dashes, underscores.";
  }
  const db = await getDb();
  db.data.creatorCodes ??= [];
  if (db.data.creatorCodes.some((c) => c.code === normalized)) {
    return "That code already exists.";
  }
  db.data.creatorCodes.push({ code: normalized, createdAt: new Date().toISOString() });
  await db.write();
  return null;
}

/** Remove a code. Accounts that used it keep the string; it just stops being valid. */
export async function removeCreatorCode(code) {
  const normalized = normalizeCode(code);
  const db = await getDb();
  db.data.creatorCodes = (db.data.creatorCodes ?? []).filter((c) => c.code !== normalized);
  await db.write();
}
