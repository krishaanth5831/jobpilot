import { NextResponse } from "next/server";
import { extractResumeText } from "@/lib/resume-parser";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { PROFILE_SCHEMA } from "@/lib/matcher";
import { getDb } from "@/lib/db";

// POST /api/resume — multipart form with a "resume" PDF file.
// Parses the PDF, has Claude extract a structured profile, stores it.
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("resume");
    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "Upload a PDF as 'resume'" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractResumeText(buffer);

    const profile = await askClaudeJSON({
      system:
        "You extract structured candidate profiles from resume text. Only include information actually present in the resume — never invent skills, dates, or experience.",
      prompt: `Extract the candidate profile from this resume:\n\n${text}`,
      schema: PROFILE_SCHEMA,
    });

    const db = await getDb();
    db.data.profile = profile;
    // Keep the raw text — the resume studio (review / grill-me / rebuild)
    // works from it. A new resume invalidates the old studio artifacts.
    db.data.resumeText = text;
    db.data.resumeReview = null;
    db.data.interview = null;
    db.data.builtResume = null;
    await db.write();

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("resume upload failed:", err);
    const message =
      err instanceof ConfigError ? err.message : "Failed to process resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/resume — the stored profile plus resume-studio state.
export async function GET() {
  const db = await getDb();
  return NextResponse.json({
    profile: db.data.profile,
    hasResumeText: Boolean(db.data.resumeText),
    review: db.data.resumeReview ?? null,
    interview: db.data.interview ?? null,
    builtResume: db.data.builtResume ?? null,
    template: db.data.resumeTemplate ?? null,
  });
}
