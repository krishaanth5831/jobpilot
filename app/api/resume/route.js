import { NextResponse } from "next/server";
import { extractResumeText } from "@/lib/resume-parser";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { PROFILE_SCHEMA } from "@/lib/matcher";
import { profileToMarkdown } from "@/lib/resume-doc";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// POST /api/resume — multipart form with a "resume" PDF file.
// Parses the PDF, has Claude extract a structured profile, stores it.
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
      system:
        "You extract structured candidate profiles from resume text. Only include information actually present in the resume — never invent skills, dates, or experience.",
      prompt: `Extract the candidate profile from this resume:\n\n${text}`,
      schema: PROFILE_SCHEMA,
    });

    data.profile = profile;
    // Keep the raw text — the resume review works from it. A new resume
    // invalidates the old review and the edited document, so the studio
    // re-seeds its editor from this fresh profile.
    data.resumeText = text;
    data.resumeReview = null;
    data.builtResume = null;
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
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  return NextResponse.json({
    profile: data.profile,
    hasResumeText: Boolean(data.resumeText),
    review: data.resumeReview ?? null,
    // The document the editor loads: the last saved edit, or a fresh markdown
    // rendering of the profile if nothing's been saved yet.
    resumeMarkdown:
      data.builtResume?.markdown ??
      (data.profile ? profileToMarkdown(data.profile) : null),
    template: data.resumeTemplate ?? null,
  });
}
