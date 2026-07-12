import { NextResponse } from "next/server";
import { buildClaudePastePrompt } from "@/lib/reviewer";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// GET /api/resume/prompt — a self-contained rebuild prompt to paste into
// claude.ai. Pure text assembly from stored data; costs no API call.
export async function GET() {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  if (!data.resumeText) {
    return NextResponse.json(
      { error: "Upload a resume first — the prompt is built from it" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    prompt: buildClaudePastePrompt(
      data.resumeText,
      data.interview,
      data.insights,
      data.resumeReview
    ),
  });
}
