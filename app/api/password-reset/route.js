import { NextResponse } from "next/server";
import { createResetToken } from "@/lib/accounts";
import { emailAvailable, sendEmail } from "@/lib/email";
import { withinRateLimit, clientIp } from "@/lib/rate-limit";

// POST /api/password-reset — body: { email }. Emails a one-hour reset link.
// The response is identical whether or not the account exists, so this
// endpoint can never be used to probe which emails have accounts.

const GENERIC = {
  ok: true,
  message: "If an account exists for that email, a reset link is on its way.",
};

export async function POST(request) {
  if (!emailAvailable()) {
    return NextResponse.json(
      {
        error:
          "Password reset emails aren't set up on this server yet — the owner needs to add a Resend key in Settings.",
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "Enter your email address." }, { status: 400 });
  }

  const ok = await withinRateLimit(`pwreset:${clientIp(request)}`, {
    limit: 5,
    windowSeconds: 86400,
  });
  if (!ok) {
    return NextResponse.json(
      { error: "Too many reset requests today — try again tomorrow." },
      { status: 429 }
    );
  }

  const token = await createResetToken(email);
  if (token) {
    // Build the link from the request's own host so it works on any
    // deployment (custom domain, preview, localhost) without config.
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const link = `${proto}://${host}/reset?token=${token}`;
    try {
      await sendEmail({
        to: email,
        subject: "Reset your jobblast password",
        text: `Someone (hopefully you) asked to reset the password for this jobblast account.\n\nSet a new password here (link works for 1 hour):\n${link}\n\nIf this wasn't you, ignore this email — your password is unchanged.`,
        html: `<p>Someone (hopefully you) asked to reset the password for this jobblast account.</p><p><a href="${link}">Set a new password</a> — the link works for 1 hour.</p><p>If this wasn't you, ignore this email — your password is unchanged.</p>`,
      });
    } catch (err) {
      // Log for the owner but stay generic outward: a send failure only
      // happens for real accounts, so surfacing it would leak existence.
      console.error("password reset email failed:", err);
    }
  }

  return NextResponse.json(GENERIC);
}
