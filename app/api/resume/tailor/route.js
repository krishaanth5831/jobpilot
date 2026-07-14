import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { TAILOR_SCHEMA, TAILOR_SYSTEM_PROMPT, buildTailorPrompt } from "@/lib/reviewer";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// POST /api/resume/tailor — body: { jobId } — re-emphasize the resume's
// real material for one specific job. Stored per job; downloadable as PDF
// via /api/resume/pdf?jobId=…
export async function POST(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  if (!data.resumeText) {
    return NextResponse.json(
      { error: "Upload a resume first — tailoring works from the original text" },
      { status: 400 }
    );
  }

  const { jobId } = await request.json();
  const job = data.jobs.find((j) => j.id === jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const { resume_markdown } = await askClaudeJSON({
      system: TAILOR_SYSTEM_PROMPT,
      prompt: buildTailorPrompt(data.resumeText, data.interview, data.insights, job),
      schema: TAILOR_SCHEMA,
    });

    data.tailoredResumes ??= {};
    data.tailoredResumes[jobId] = {
      markdown: resume_markdown,
      createdAt: new Date().toISOString(),
    };
    await db.write();

    return NextResponse.json({ jobId, markdown: resume_markdown });
  } catch (err) {
    console.error("tailoring failed:", err);
    const message = err instanceof ConfigError ? err.message : "Tailoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
