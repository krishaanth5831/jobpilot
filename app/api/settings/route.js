import { NextResponse } from "next/server";
import { MANAGED_KEYS, readManagedValues, updateManagedValues } from "@/lib/env-file";

// Settings for API credentials. Values live in .env.local (gitignored) and
// are applied to the running process immediately — no restart, no editor.
// Full values are NEVER returned to the client: GET exposes only presence
// and the last 4 characters.

function mask(value) {
  if (!value) return null;
  return value.length > 8 ? `···· ${value.slice(-4)}` : "····";
}

// GET /api/settings — which keys are configured (masked).
export async function GET() {
  const values = await readManagedValues();
  const status = {};
  for (const key of MANAGED_KEYS) {
    // Prefer the live process value: it's what requests actually use.
    const current = process.env[key] ?? values[key] ?? "";
    status[key] = { set: Boolean(current), hint: mask(current) };
  }
  return NextResponse.json({ keys: status });
}

// POST /api/settings — body: { values: { KEY: "secret" | "" } }.
// Empty string clears a key. Writes .env.local and updates process.env so
// the change takes effect on the very next request.
export async function POST(request) {
  const body = await request.json();
  const entries = Object.entries(body.values ?? {});
  if (entries.length === 0) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  const updates = {};
  for (const [key, raw] of entries) {
    if (!MANAGED_KEYS.includes(key)) {
      return NextResponse.json({ error: `Unknown setting: ${key}` }, { status: 400 });
    }
    if (typeof raw !== "string" || /[\r\n\x00-\x1f]/.test(raw)) {
      return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
    }
    updates[key] = raw.trim();
  }

  await updateManagedValues(updates);
  for (const [key, value] of Object.entries(updates)) {
    if (value) process.env[key] = value;
    else delete process.env[key];
  }

  // Return the refreshed (masked) status, never the values.
  return GET();
}
