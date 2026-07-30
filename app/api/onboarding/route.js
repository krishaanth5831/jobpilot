import { NextResponse } from "next/server";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";
import { normalizeEmail } from "@/lib/accounts";
import { ONBOARDING_VERSION, sanitizeAnswers } from "@/lib/onboarding";

// Two separate first-run things live behind this route:
//
//  1. The signup QUESTIONNAIRE (`onboarding`) — asked once, before the app is
//     usable, and answered from lib/onboarding.js.
//  2. The first-run CHECKLIST (`steps`) — derived from what the account has
//     actually done, so there is nothing to keep in sync, plus the one stored
//     bit of the user's explicit dismissal.
//
// The TOUR rides along because from the user's side it is the same first-run
// sequence: questionnaire, then walkthrough, then the app.

function state(data) {
  return {
    // Never returns the answers themselves. The client only needs to know
    // whether to ask; nothing in the UI reads back what was said.
    needsOnboarding: !data.onboarding?.completedAt,
    needsTour: Boolean(data.onboarding?.completedAt) && !data.tourCompletedAt,
    steps: {
      resume: Boolean(data.resumeText),
      review: Boolean(data.resumeReview),
      search: (data.jobs ?? []).length > 0,
    },
    dismissed: data.onboardingDismissed === true,
  };
}

// GET /api/onboarding
export async function GET() {
  const { data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  return NextResponse.json(state(data));
}

// POST /api/onboarding — body is one of:
//   { answers: {...} }   save the questionnaire
//   { tourDone: true }   mark the walkthrough seen
//   { dismiss: true }    hide the first-run checklist
export async function POST(request) {
  const { db, data, userId } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const body = await request.json().catch(() => ({}));

  if (body.answers) {
    const { answers, missing } = sanitizeAnswers(body.answers);
    if (missing.length) {
      return NextResponse.json(
        { error: "Some answers are still needed", missing },
        { status: 400 },
      );
    }

    data.onboarding = {
      version: ONBOARDING_VERSION,
      completedAt: new Date().toISOString(),
      answers,
    };

    // The questionnaire is not a survey that gets filed away — two of its
    // answers are the ones the job search itself needs, so they go straight
    // into the shape the rest of the app already reads. Only when the account
    // has no targets yet: this must never clobber real work.
    if (answers.role && answers.location && (data.targetRoles ?? []).length === 0) {
      data.targetRoles = [{ role: answers.role, location: answers.location }];
    }

    // Same for the display name, which until now was whatever was typed at
    // sign-up. An account created through a social login has no credentials
    // record, hence the guard.
    const account = db.data.accounts?.[normalizeEmail(userId)];
    if (account && answers.fullName) account.name = answers.fullName;

    await db.write();
    return NextResponse.json(state(data));
  }

  if (body.tourDone === true) {
    data.tourCompletedAt = new Date().toISOString();
    await db.write();
    return NextResponse.json(state(data));
  }

  if (body.dismiss === true) {
    data.onboardingDismissed = true;
    await db.write();
    return NextResponse.json(state(data));
  }

  return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
}
