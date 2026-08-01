import { NextResponse } from "next/server";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";
import { effectiveTier, isUncapped, paywallEnabled } from "@/lib/entitlements";
import { normalizeEmail } from "@/lib/accounts";
import { TIERS } from "@/lib/tiers";

// Whether to show this account the upgrade prompt, and with what to say.
//
// The DECISION is made here rather than in the browser, the same way
// app/api/feedback/route.js decides whether to ask for feedback: tier, account
// age and cooldown are all server state, and none of it needs to reach a
// client that could be lying about it.

const NEW_ACCOUNT_DAYS = 14; // "someone who just made an account"
const COOLDOWN_DAYS = 7; // after a dismissal, do not ask again for a week

const days = (ms) => ms / 86_400_000;

/**
 * What this person has actually got out of jobblast so far.
 *
 * Specifics convert; "upgrade for more" does not. Everything here is a real
 * count from their own account, and anything at zero is left out rather than
 * padded, because a prompt that claims work you have not done reads as spam.
 */
function achievements(data) {
  const jobs = data.jobs ?? [];
  const scores = jobs.map((j) => j.match?.score).filter((s) => typeof s === "number");
  return {
    screened: jobs.length,
    qualified: jobs.filter((j) => j.match?.qualified).length,
    drafted: (data.applications ?? []).length,
    bestScore: scores.length ? Math.max(...scores) : null,
    resumeScore: typeof data.resumeReview?.score === "number" ? data.resumeReview.score : null,
  };
}

// GET /api/upgrade-prompt
export async function GET() {
  const { db, data, userId } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const no = (reason) => NextResponse.json({ show: false, reason });

  // Never on top of the first run — the questionnaire and the tour own that
  // moment, and a third dialog behind them is how people close everything.
  if (!data.onboarding?.completedAt) return no("onboarding");

  // Someone already paying has nothing to be sold, and neither does the owner
  // — selling the operator a plan on their own instance is nonsense.
  const tier = effectiveTier(data, userId);
  if (isUncapped(userId)) return no("owner");
  const subscribed = Boolean(data.subscription?.tier);
  if (subscribed) return no("subscribed");

  const now = Date.now();
  if (data.upgradePromptAt && days(now - Date.parse(data.upgradePromptAt)) < COOLDOWN_DAYS) {
    return no("cooldown");
  }

  const createdAt = db.data.accounts?.[normalizeEmail(userId)]?.createdAt;
  const age = createdAt ? days(now - Date.parse(createdAt)) : 0;
  if (createdAt && age > NEW_ACCOUNT_DAYS) return no("not-new");

  // Two honest situations, and they need different words.
  //
  //   "upgrade"      - on Free with the gate live. There is a real thing to
  //                    buy and real limits being applied.
  //   "early-access" - grandfathered. Nothing can be sold, because they
  //                    already have Pro for nothing. Pretending otherwise
  //                    would be asking for money for what they already hold,
  //                    so this variant states what that is worth instead.
  const variant =
    tier === TIERS.FREE && paywallEnabled() ? "upgrade" : data.grandfathered ? "early-access" : null;

  if (!variant) return no("nothing-to-offer");

  return NextResponse.json({
    show: true,
    variant,
    tier,
    achievements: achievements(data),
  });
}

// POST /api/upgrade-prompt — body: { seen: true } — start the cooldown.
// Recorded when the prompt is SHOWN, not when it is acted on: being asked is
// the thing that should not repeat.
export async function POST(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body.seen !== true) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }
  data.upgradePromptAt = new Date().toISOString();
  await db.write();
  return NextResponse.json({ ok: true });
}
