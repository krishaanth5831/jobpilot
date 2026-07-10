import { NextResponse } from "next/server";
import { buildClaudePastePrompt } from "@/lib/reviewer";
import { getDb } from "@/lib/db";

// GET /api/resume/prompt — a self-contained rebuild prompt to paste into
// claude.ai. Pure text assembly from stored data; costs no API call.
export async function GET() {
  const db = await getDb();
  if (!db.data.resumeText) {
    return NextResponse.json(
      { error: "Upload a resume first — the prompt is built from it" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    prompt: buildClaudePastePrompt(
      db.data.resumeText,
      db.data.interview,
      db.data.insights,
      db.data.resumeReview
    ),
  });
}
