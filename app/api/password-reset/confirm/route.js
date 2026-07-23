import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/accounts";

// POST /api/password-reset/confirm — body: { token, password }.
// Consumes a reset token and sets the new password.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { token, password } = body;

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const error = await resetPasswordWithToken(token, password);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
