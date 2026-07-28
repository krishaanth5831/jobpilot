import { NextResponse } from "next/server";
import { addFeedback } from "@/lib/feedback";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// In-app feedback prompt.
//
// GET says whether this account should be asked at all. The owner never is:
// they do not need to send themselves feature requests, and they are the one
// reading the replies. Deciding it server-side keeps OWNER_EMAIL off the
// client.

export async function GET() {
  const { data, isOwner } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  return NextResponse.json({ prompt: !isOwner });
}

// POST { feature, bug, general } — any one of them is enough.
export async function POST(request) {
  const { data, userId, isOwner } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const error = await addFeedback({
    email: isOwner ? null : userId,
    feature: body.feature,
    bug: body.bug,
    general: body.general,
  });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
