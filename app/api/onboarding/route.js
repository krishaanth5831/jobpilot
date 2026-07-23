import { NextResponse } from "next/server";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// First-run checklist state. Steps are derived from what the account has
// actually done — nothing to keep in sync — and the only stored bit is the
// user's explicit dismissal.

// GET /api/onboarding — { steps: { resume, review, search }, dismissed }
export async function GET() {
  const { data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  return NextResponse.json({
    steps: {
      resume: Boolean(data.resumeText),
      review: Boolean(data.resumeReview),
      search: (data.jobs ?? []).length > 0,
    },
    dismissed: data.onboardingDismissed === true,
  });
}

// POST /api/onboarding — body: { dismiss: true } — hide the checklist.
export async function POST(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body.dismiss !== true) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }
  data.onboardingDismissed = true;
  await db.write();
  return GET();
}
