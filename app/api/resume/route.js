import { NextResponse } from "next/server";
import { extractResumeText } from "@/lib/resume-parser";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { PROFILE_SCHEMA } from "@/lib/matcher";
import { profileToDoc } from "@/lib/resume-doc";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";
import { analyzeResumeDetailed } from "@/lib/resume-health/analyze";
import { toStoredReview } from "@/lib/resume-health/legacy";
import { getRelevantLearnings, recordOutcomesById, tagsFromProfile } from "@/lib/learnings";

// POST /api/resume — multipart form with a "resume" PDF file.
// Parses the PDF, has Claude extract a structured profile, stores it, and
// scores the document's ATS health.
//
// THE HEALTH SCORE IS COMPUTED HERE, not in /api/resume/review, because this
// is the only place the PDF BYTES exist. The dual-parse harness needs the file
// itself — text alone cannot reveal a two-column layout or a header/footer —
// and keeping a copy of every PDF in the shared lowdb/Redis document would
// bloat a record that is re-read on every single request.
export async function POST(request) {
  // Auth check FIRST — never spend a Claude call on an unauthenticated request.
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("resume");
    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "Upload a PDF as 'resume'" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractResumeText(buffer);

    const profile = await askClaudeJSON({
      task: "profile_extract",
      system:
        "You extract structured candidate profiles from resume text. Only include information actually present in the resume — never invent skills, dates, or experience.",
      prompt: `Extract the candidate profile from this resume:\n\n${text}`,
      schema: PROFILE_SCHEMA,
    });

    // Global learnings ride alongside the score; their ids are stored so the
    // NEXT upload can grade whether following that advice moved the number.
    const learnings = await getRelevantLearnings({
      db,
      category: "ats_pattern",
      contextTags: tagsFromProfile(profile),
    });

    // Classifier results are cached by content hash, so re-uploading the same
    // document never spends a second Claude call on counting its bullets.
    data.resumeClassifyCache ??= {};
    const cache = {
      get: (hash) => data.resumeClassifyCache[hash] ?? null,
      set: (hash, stats) => {
        data.resumeClassifyCache[hash] = stats;
      },
    };

    const { result: health, input: healthInput } = await analyzeResumeDetailed({
      buffer,
      fileType: file.type,
      legacyProfile: profile,
      locale: data.resumeLocale ?? undefined,
      ask: askClaudeJSON,
      cache,
    });

    // Outcome for the PREVIOUS result's injected patterns: a different document
    // whose score moved is a measured result of following (or fighting) that
    // advice. Same document = re-upload noise, so it is skipped.
    const previous = data.resumeReview;
    if (
      previous?.learningIds?.length &&
      previous.contentHash &&
      previous.contentHash !== health.contentHash &&
      typeof previous.score === "number" &&
      health.score !== previous.score
    ) {
      recordOutcomesById(db, previous.learningIds, health.score > previous.score);
    }

    data.profile = profile;
    // Keep the raw text — the studio and tailoring work from it. A new resume
    // invalidates the edited document, so the studio re-seeds its editor from
    // this fresh profile.
    data.resumeText = text;
    // The full result, the derived compatibility fields the resume studio
    // reads, and the two inputs a re-score needs. Persisting the inputs means
    // /api/resume/review can recompute for free, without the PDF.
    data.resumeReview = {
      ...toStoredReview(health),
      learningIds: learnings.ids,
      profile: healthInput.profile,
      contentStats: healthInput.contentStats,
    };
    data.builtResume = null;
    await db.write();

    return NextResponse.json({ profile, review: data.resumeReview });
  } catch (err) {
    console.error("resume upload failed:", err);
    const message =
      err instanceof ConfigError ? err.message : "Failed to process resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/resume — the stored profile plus resume-studio state.
export async function GET() {
  const { data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  return NextResponse.json({
    profile: data.profile,
    hasResumeText: Boolean(data.resumeText),
    review: data.resumeReview ?? null,
    // The structured document the editor loads: the last saved edit, or a
    // fresh doc derived from the profile if nothing's been saved yet.
    resumeDoc:
      data.builtResume?.structured ??
      (data.profile ? profileToDoc(data.profile) : null),
    template: data.resumeTemplate ?? null,
  });
}
