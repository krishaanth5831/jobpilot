import { NextResponse } from "next/server";
import { MANAGED_KEYS, readManagedValues, updateManagedValues } from "@/lib/env-file";
import { API_KEY_NAMES } from "@/lib/api-keys";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// Settings for API credentials.
//
// API keys (Claude / Adzuna / RapidAPI) are PER-USER: each account stores its
// own in its data bucket, so one person's usage never spends another's
// credits. Full values are never returned — only presence + last 4 chars.
//
// Sign-in provider settings (AUTH_*) are server-wide and owner-only; those
// still live in .env.local.

const AUTH_KEY_NAMES = MANAGED_KEYS.filter((k) => k.startsWith("AUTH_"));

function mask(value) {
  if (!value) return null;
  return value.length > 8 ? `···· ${value.slice(-4)}` : "····";
}

// GET /api/settings — masked status of this user's API keys, plus (owner
// only) the server-wide auth config.
export async function GET() {
  const { data, isOwner } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const keys = {};
  for (const name of API_KEY_NAMES) {
    const value = data.apiKeys?.[name] ?? "";
    keys[name] = { set: Boolean(value), hint: mask(value) };
  }

  let authKeys = null;
  if (isOwner) {
    const values = await readManagedValues();
    authKeys = {};
    for (const name of AUTH_KEY_NAMES) {
      const current = process.env[name] ?? values[name] ?? "";
      authKeys[name] = { set: Boolean(current), hint: mask(current) };
    }
  }

  return NextResponse.json({ keys, authKeys, isOwner, autoApply: data.autoApply !== false });
}

// POST /api/settings — body: { values: { KEY: "secret" | "" } }.
// API keys are written to this user's bucket; AUTH_* keys (owner only) to
// .env.local. Empty string clears a key.
export async function POST(request) {
  const { db, data, isOwner } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const body = await request.json();

  // Auto-apply preference — a per-account boolean, saved on its own.
  if (typeof body.autoApply === "boolean") {
    data.autoApply = body.autoApply;
    await db.write();
    return GET();
  }

  const entries = Object.entries(body.values ?? {});
  if (entries.length === 0) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  const apiUpdates = {};
  const authUpdates = {};
  for (const [key, raw] of entries) {
    if (typeof raw !== "string" || /[\r\n\x00-\x1f]/.test(raw)) {
      return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
    }
    const value = raw.trim();
    if (API_KEY_NAMES.includes(key)) apiUpdates[key] = value;
    else if (AUTH_KEY_NAMES.includes(key)) authUpdates[key] = value;
    else return NextResponse.json({ error: `Unknown setting: ${key}` }, { status: 400 });
  }

  // Authorize before mutating anything.
  if (Object.keys(authUpdates).length && !isOwner) {
    return NextResponse.json(
      { error: "Only the owner can change sign-in provider settings." },
      { status: 403 }
    );
  }

  // Per-user API keys → this account's bucket.
  if (Object.keys(apiUpdates).length) {
    data.apiKeys = data.apiKeys ?? {};
    for (const [key, value] of Object.entries(apiUpdates)) {
      if (value) data.apiKeys[key] = value;
      else delete data.apiKeys[key];
    }
    await db.write();
  }

  // Server-wide sign-in config → .env.local (owner only).
  if (Object.keys(authUpdates).length) {
    await updateManagedValues(authUpdates);
    for (const [key, value] of Object.entries(authUpdates)) {
      if (value) process.env[key] = value;
      else delete process.env[key];
    }
  }

  return GET();
}
