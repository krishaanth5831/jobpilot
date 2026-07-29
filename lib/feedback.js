// In-app feedback collected from accounts: what they want built, what is
// broken, and anything else. Stored outside db.data.users because it is
// addressed to the owner rather than being part of anyone's own data, the
// same shape as lib/learnings.js.
//
// Unlike learnings, these records DO keep the account email: a bug report you
// cannot follow up on is close to useless. The owner-only Settings panel is
// the single read surface.

import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export const FEEDBACK_FIELDS = [
  { key: "feature", label: "What should we build next?" },
  { key: "bug", label: "Anything broken or buggy?" },
  { key: "general", label: "Anything else?" },
];

const MAX_LEN = 4000;

/** Trim, drop control characters, and cap length. Returns "" for junk. */
function clean(value) {
  if (typeof value !== "string") return "";
  return value
    // Strip control characters but keep newlines and tabs: people paste
    // multi-line bug reports and those line breaks are worth keeping.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_LEN);
}

/**
 * Save one submission. Returns an error string for the UI, or null.
 * At least one of the three fields has to say something.
 */
export async function addFeedback({ email, feature, bug, general }) {
  const entry = {
    feature: clean(feature),
    bug: clean(bug),
    general: clean(general),
  };
  if (!entry.feature && !entry.bug && !entry.general) {
    return "Write something in at least one box first.";
  }

  const db = await getDb();
  db.data.feedback ??= {};
  const id = randomUUID();
  db.data.feedback[id] = {
    id,
    email: email ?? null,
    ...entry,
    createdAt: new Date().toISOString(),
  };
  await db.write();
  return null;
}

/** Everything submitted, newest first. Owner-only. */
export async function listFeedback() {
  const db = await getDb();
  return Object.values(db.data.feedback ?? {}).sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
  );
}

/** Owner clears one entry once it has been acted on. */
export async function removeFeedback(id) {
  const db = await getDb();
  if (!db.data.feedback?.[id]) return;
  delete db.data.feedback[id];
  await db.write();
}
