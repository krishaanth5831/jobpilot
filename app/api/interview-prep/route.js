import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import {
  INTERVIEW_PREP_SCHEMA,
  INTERVIEW_PREP_SYSTEM_PROMPT,
  buildInterviewPrepPrompt,
} from "@/lib/reviewer";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// POST /api/interview-prep — body: { jobId, regenerate? }.
// Likely interview questions + strong sample answers for one job, grounded
// in the user's actual resume. Cached per job (regenerate to redo); runs on
// the user's own key — or the free built-in model — via askClaudeJSON.
export async function POST(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const { jobId, regenerate } = await request.json();
  const job = data.jobs.find((j) => j.id === jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!data.resumeText) {
    return NextResponse.json(
      { error: "Upload a resume first — prep answers are built from it" },
      { status: 400 }
    );
  }

  data.interviewPrep ??= {};
  const cached = data.interviewPrep[jobId];
  if (cached && !regenerate) return NextResponse.json({ prep: cached });

  try {
    const application = data.applications.find((a) => a.jobId === jobId);
    const { questions } = await askClaudeJSON({
      system: INTERVIEW_PREP_SYSTEM_PROMPT,
      prompt: buildInterviewPrepPrompt({
        profile: data.profile,
        resumeText: data.resumeText,
        job,
        coverLetter: application?.coverLetter,
      }),
      schema: INTERVIEW_PREP_SCHEMA,
      maxTokens: 6000,
    });

    const prep = { questions, createdAt: new Date().toISOString() };
    data.interviewPrep[jobId] = prep;
    await db.write();
    return NextResponse.json({ prep });
  } catch (err) {
    console.error("interview prep failed:", err);
    const message =
      err instanceof ConfigError ? err.message : "Couldn't generate interview prep";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
