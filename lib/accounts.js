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
export async function createAccount({ email, password, name }) {
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
  };
  await db.write();
  return { email: key, name: db.data.accounts[key].name };
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
