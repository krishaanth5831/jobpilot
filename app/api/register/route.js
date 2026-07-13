import { NextResponse } from "next/server";
import { createAccount, validateCredentials } from "@/lib/accounts";

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

  const { email, password, name } = body ?? {};
  const invalid = validateCredentials({ email, password });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const user = await createAccount({ email, password, name });
    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    if (err.code === "EMAIL_TAKEN") {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
