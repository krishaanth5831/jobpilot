// Email/password accounts, stored locally in db.data.accounts (keyed by a
// normalized, lowercased email). This is the login credential store; a
// user's actual app data lives in db.data.users under the same email.

import { getDb } from "./db";
import { hashPassword, verifyPassword } from "./password";

export const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Basic shape checks shared by sign-up. Returns an error string or null. */
export function validateCredentials({ email, password }) {
  if (!EMAIL_RE.test(normalizeEmail(email))) return "Enter a valid email address.";
  if (typeof password !== "string" || password.length < 8)
    return "Password must be at least 8 characters.";
  return null;
}

/** Create an account. Throws { code: "EMAIL_TAKEN" } if one already exists. */
export async function createAccount({ email, password, name, creatorCode }) {
  const db = await getDb();
  const key = normalizeEmail(email);
  if (db.data.accounts[key]) {
    const err = new Error("An account with this email already exists.");
    err.code = "EMAIL_TAKEN";
    throw err;
  }
  db.data.accounts[key] = {
    email: key,
    name: (name ?? "").trim() || null,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
    // Canonical creator (affiliate) code this signup came through, if any —
    // validated by the register route, counted in lib/creator-codes.js.
    creatorCode: creatorCode || null,
  };
  await db.write();
  return { email: key, name: db.data.accounts[key].name };
}

/**
 * Every account that has signed up, newest first. Owner-only data, surfaced
 * on the Settings page — deliberately picks fields one by one so a password
 * hash can never ride along into an API response.
 */
export async function listSignups() {
  const db = await getDb();
  return Object.values(db.data.accounts ?? {})
    .map(({ email, name, createdAt, creatorCode }) => ({
      email,
      name: name ?? null,
      createdAt: createdAt ?? null,
      creatorCode: creatorCode ?? null,
    }))
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

/**
 * Delete an account and the data bucket it owns. Callers are responsible for
 * authorizing this and for refusing to remove the owner's own account (the
 * settings route does both). Returns an error string for the UI, or null.
 */
export async function deleteAccount(email) {
  const key = normalizeEmail(email);
  if (!key) return "No account specified.";
  const db = await getDb();
  if (!db.data.accounts?.[key]) return "No account with that email.";
  delete db.data.accounts[key];
  delete db.data.users?.[key]; // their resume, jobs, applications
  await db.write();
  return null;
}

/**
 * Verify an email/password pair. Returns the user object on success or null
 * on any failure — never reveals whether the email exists.
 */
export async function verifyCredentials({ email, password }) {
  const db = await getDb();
  const account = db.data.accounts[normalizeEmail(email)];
  if (!account) return null;
  const ok = await verifyPassword(String(password ?? ""), account.passwordHash);
  if (!ok) return null;
  return { id: account.email, email: account.email, name: account.name };
}
