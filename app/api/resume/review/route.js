import { NextResponse } from "next/server";
import { computeHealth } from "@/lib/resume-health/score";
import { toStoredReview } from "@/lib/resume-health/legacy";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// POST /api/resume/review — the resume's ATS health.
//
// NO MODEL CALL HAPPENS HERE ANY MORE. The score used to be whatever Claude
// said it was; it is now computed by lib/resume-health/score.ts, a pure
// function over facts the parsers and one counting classifier produced at
// upload time. This route re-runs that pure function over the stored parse
// report, which is free, instant and deterministic.
//
// STILL DELIBERATELY UNGATED, ON EVERY TIER. The ATS score is the thing that
// proves jobblast is worth anything before anyone has paid, so it takes no
// entitlement check and increments no counter. `ats_resume_score` is on
// NEVER_GATED in lib/tiers.js and assertNeverGated() throws if a future change
// tries to meter it — do not add an enforce() call here.
export async function POST() {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const stored = data.resumeReview;
  if (!stored?.parseReport) {
    return NextResponse.json(
      {
        error: data.resumeText
          ? "Re-upload your resume to get an ATS score — the layout checks need the original PDF."
          : "Upload a resume first.",
      },
      { status: 400 }
    );
  }

  try {
    // Recomputed rather than echoed, so a locale change or a scoring-version
    // bump is reflected without asking the user to upload the file again.
    const health = computeHealth({
      parseReport: stored.parseReport,
      profile: stored.profile ?? emptyProfile(),
      contentStats: stored.contentStats ?? emptyStats(),
      rawText: data.resumeText ?? "",
      locale: data.resumeLocale ?? "NL",
    });

    data.resumeReview = {
      ...toStoredReview(health),
      // Carried forward: the learnings whose advice this document was shown,
      // graded on the next upload (app/api/resume/route.js).
      learningIds: stored.learningIds ?? [],
      profile: stored.profile ?? null,
      contentStats: stored.contentStats ?? null,
    };
    await db.write();

    return NextResponse.json({ review: data.resumeReview });
  } catch (err) {
    console.error("resume health scoring failed:", err);
    return NextResponse.json({ error: "Scoring failed" }, { status: 500 });
  }
}

function emptyStats() {
  return {
    bulletsTotal: 0,
    bulletsWithMetric: 0,
    bulletsWithStrongVerb: 0,
    bulletsPassiveOrDuty: 0,
    bulletsOverTwoLines: 0,
    clichePhraseCount: 0,
    firstPersonPronounCount: 0,
    tenseInconsistencies: 0,
    spellingErrors: 0,
    skillsEvidencedInBullets: [],
  };
}

function emptyProfile() {
  return {
    skills: [],
    titles: [],
    totalMonthsExperience: 0,
    education: { degreeLevel: 0, fieldId: null, graduationDate: null },
    location: { city: null, country: null, willingRemote: true, willingRelocate: true },
    workAuth: [],
    languages: [],
    credentials: [],
    summaryEmbedding: null,
  };
}
