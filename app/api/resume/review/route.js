import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { REVIEW_SCHEMA, REVIEW_SYSTEM_PROMPT, buildReviewPrompt } from "@/lib/reviewer";
import { getRelevantLearnings, recordOutcomesById, tagsFromProfile } from "@/lib/learnings";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// POST /api/resume/review — critique the stored resume: score, strengths,
// and issues each paired with a concrete fix. Persisted so it survives reload.
export async function POST() {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  if (!data.resumeText) {
    return NextResponse.json(
      { error: "Upload a resume first — reviews work from the original text" },
      { status: 400 }
    );
  }

  try {
    // Global learnings ride into the prompt; their ids are stored on the
    // review so a later re-review can grade the advice they carried.
    const learnings = await getRelevantLearnings({
      db,
      category: "ats_pattern",
      contextTags: tagsFromProfile(data.profile),
    });

    const review = await askClaudeJSON({
      system: REVIEW_SYSTEM_PROMPT,
      prompt: buildReviewPrompt(data.resumeText, data.insights, learnings),
      schema: REVIEW_SCHEMA,
    });

    // Outcome for the PREVIOUS review's injected patterns: if the resume
    // changed since then and the score moved, that's a measured result of
    // following (or fighting) the advice. Same text = re-run noise; skip.
    const textHash = createHash("sha1").update(data.resumeText).digest("hex").slice(0, 12);
    const prev = data.resumeReview;
    if (
      prev?.learningIds?.length &&
      prev.textHash &&
      prev.textHash !== textHash &&
      typeof prev.score === "number" &&
      review.score !== prev.score
    ) {
      recordOutcomesById(db, prev.learningIds, review.score > prev.score);
    }

    data.resumeReview = { ...review, learningIds: learnings.ids, textHash };
    await db.write();
    return NextResponse.json({ review });
  } catch (err) {
    console.error("resume review failed:", err);
    const message = err instanceof ConfigError ? err.message : "Review failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
