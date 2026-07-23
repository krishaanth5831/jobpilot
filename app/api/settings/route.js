import { NextResponse } from "next/server";
import { MANAGED_KEYS, readManagedValues, updateManagedValues } from "@/lib/env-file";
import { API_KEY_NAMES, isOwnerAccount } from "@/lib/api-keys";
import { DEFAULT_CLAUDE, isValidEffort, isValidModel } from "@/lib/claude-models";
import { addCreatorCode, listCreatorCodes, removeCreatorCode } from "@/lib/creator-codes";
import { deleteAccount, listSignups, normalizeEmail } from "@/lib/accounts";
import { listLearnings, removeLearning } from "@/lib/learnings";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";
import { freeModelAvailable } from "@/lib/free-model";

// Settings for API credentials.
//
// API keys (Claude / Adzuna / RapidAPI) are PER-USER: each account stores its
// own in its data bucket, so one person's usage never spends another's
// credits. Full values are never returned — only presence + last 4 chars.
//
// Sign-in provider settings (AUTH_*) and the free built-in model's
// GROQ_API_KEY are server-wide and owner-only; those live in .env.local.

const SERVER_KEY_NAMES = MANAGED_KEYS.filter(
  (k) => k.startsWith("AUTH_") || k === "GROQ_API_KEY" || k.startsWith("RESEND_")
);

// On serverless hosts there is no writable .env.local — sign-in config comes
// from real environment variables managed in the host's dashboard instead.
const ENV_WRITABLE = !process.env.VERCEL;

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

  let creatorCodes = null;
  let signups = null;
  let learnings = null;
  if (isOwner) {
    creatorCodes = await listCreatorCodes();
    signups = await listSignups();
    learnings = await listLearnings();
  }

  let authKeys = null;
  if (isOwner) {
    const values = await readManagedValues();
    authKeys = {};
    for (const name of SERVER_KEY_NAMES) {
      const current = process.env[name] ?? values[name] ?? "";
      authKeys[name] = { set: Boolean(current), hint: mask(current) };
    }
  }

  return NextResponse.json({
    keys,
    authKeys,
    isOwner,
    envWritable: ENV_WRITABLE,
    autoApply: data.autoApply !== false,
    creatorCodes,
    signups,
    learnings,
    claude: {
      model: isValidModel(data.claudeModel) ? data.claudeModel : DEFAULT_CLAUDE.model,
      effort: isValidEffort(data.claudeEffort) ? data.claudeEffort : DEFAULT_CLAUDE.effort,
    },
    // Which AI serves this account: their own Claude key, or the shared
    // free built-in model (Llama 3.3 on Groq) when the server has one.
    freeModel: {
      available: freeModelAvailable(),
      active: freeModelAvailable() && !data.apiKeys?.ANTHROPIC_API_KEY,
    },
  });
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

  // Creator (affiliate) codes — owner-only management, saved on their own.
  if (body.creatorCode && typeof body.creatorCode === "object") {
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the owner can manage creator codes." },
        { status: 403 }
      );
    }
    if (body.creatorCode.add !== undefined) {
      const error = await addCreatorCode(body.creatorCode.add);
      if (error) return NextResponse.json({ error }, { status: 400 });
    } else if (body.creatorCode.remove !== undefined) {
      await removeCreatorCode(body.creatorCode.remove);
    } else {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }
    return GET();
  }

  // Global learnings — owner can delete a wrong or leaky pattern.
  if (body.learning && typeof body.learning === "object") {
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the owner can manage learnings." },
        { status: 403 }
      );
    }
    if (body.learning.remove === undefined) {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }
    await removeLearning(body.learning.remove);
    return GET();
  }

  // Deleting a signup — owner-only, and never the owner's own account (that
  // would lock this instance out of its own settings, including this panel).
  if (body.deleteAccount && typeof body.deleteAccount === "object") {
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the owner can delete accounts." },
        { status: 403 }
      );
    }
    const target = normalizeEmail(body.deleteAccount.email);
    if (isOwnerAccount(null, target)) {
      return NextResponse.json(
        { error: "You can't delete the owner account." },
        { status: 400 }
      );
    }
    const error = await deleteAccount(target);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return GET();
  }

  // AI model preference — per-account model + effort, saved on its own.
  if (body.claude && typeof body.claude === "object") {
    const { model, effort } = body.claude;
    if (model !== undefined && !isValidModel(model)) {
      return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 });
    }
    if (effort !== undefined && !isValidEffort(effort)) {
      return NextResponse.json({ error: `Unknown effort level: ${effort}` }, { status: 400 });
    }
    if (model !== undefined) data.claudeModel = model;
    if (effort !== undefined) data.claudeEffort = effort;
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
    else if (SERVER_KEY_NAMES.includes(key)) authUpdates[key] = value;
    else return NextResponse.json({ error: `Unknown setting: ${key}` }, { status: 400 });
  }

  // Authorize before mutating anything.
  if (Object.keys(authUpdates).length && !isOwner) {
    return NextResponse.json(
      { error: "Only the owner can change server-wide settings (sign-in providers, the free model key)." },
      { status: 403 }
    );
  }
  if (Object.keys(authUpdates).length && !ENV_WRITABLE) {
    return NextResponse.json(
      {
        error:
          "Server-wide settings are environment variables on this host — set them in the Vercel dashboard (Project → Settings → Environment Variables), then redeploy.",
      },
      { status: 400 }
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
