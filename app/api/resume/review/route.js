import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { REVIEW_SCHEMA, REVIEW_SYSTEM_PROMPT, buildReviewPrompt } from "@/lib/reviewer";
import { getDb } from "@/lib/db";

// POST /api/resume/review — critique the stored resume: score, strengths,
// and issues each paired with a concrete fix. Persisted so it survives reload.
export async function POST() {
  const db = await getDb();
  if (!db.data.resumeText) {
    return NextResponse.json(
      { error: "Upload a resume first — reviews work from the original text" },
      { status: 400 }
    );
  }

  try {
    const review = await askClaudeJSON({
      system: REVIEW_SYSTEM_PROMPT,
      prompt: buildReviewPrompt(db.data.resumeText, db.data.insights),
      schema: REVIEW_SCHEMA,
    });

    db.data.resumeReview = review;
    await db.write();
    return NextResponse.json({ review });
  } catch (err) {
    console.error("resume review failed:", err);
    const message = err instanceof ConfigError ? err.message : "Review failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
