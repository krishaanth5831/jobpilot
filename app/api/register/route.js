import { NextResponse } from "next/server";
import { createAccount, validateCredentials } from "@/lib/accounts";
import { findCreatorCode, normalizeCode } from "@/lib/creator-codes";

// POST /api/register — body: { email, password, name? }. Creates an
// email/password account, then the client signs in with the same credentials
// (see components/sign-in-card.js). Passwords are hashed (scrypt) before
// storage and never returned.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { email, password, name, creatorCode } = body ?? {};
  const invalid = validateCredentials({ email, password });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Optional creator (affiliate) code — reject unknown ones so a typo
  // doesn't silently lose an influencer their signup.
  let canonicalCode = null;
  if (normalizeCode(creatorCode)) {
    canonicalCode = await findCreatorCode(creatorCode);
    if (!canonicalCode) {
      return NextResponse.json(
        { error: "That creator code isn't recognized — check the spelling, or leave it blank." },
        { status: 400 }
      );
    }
  }

  try {
    const user = await createAccount({ email, password, name, creatorCode: canonicalCode });
    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    if (err.code === "EMAIL_TAKEN") {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
