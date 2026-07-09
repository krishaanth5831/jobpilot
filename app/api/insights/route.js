import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { INSIGHTS_SCHEMA, INSIGHTS_SYSTEM_PROMPT, buildInsightsPrompt } from "@/lib/reviewer";
import { getDb } from "@/lib/db";

// The success feedback loop. When an application is marked hired, the
// winning resume + cover letter are distilled into transferable lessons.
// Stored lessons are injected into every future review, interview, rebuild,
// and cover-letter draft — each win teaches the next application.

// POST /api/insights — body: { applicationId } — extract lessons from a
// hired application. Idempotent: a second call for the same application
// returns the stored record instead of re-extracting.
export async function POST(request) {
  const db = await getDb();
  const { applicationId } = await request.json();

  const application = db.data.applications.find((a) => a.id === applicationId);
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.status !== "hired") {
    return NextResponse.json(
      { error: "Lessons are only extracted from hired applications" },
      { status: 400 }
    );
  }

  db.data.insights ??= [];
  const already = db.data.insights.find((i) => i.applicationId === applicationId);
  if (already) return NextResponse.json({ insight: already });

  const job = db.data.jobs.find((j) => j.id === application.jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const { lessons } = await askClaudeJSON({
      system: INSIGHTS_SYSTEM_PROMPT,
      prompt: buildInsightsPrompt({
        profile: db.data.profile,
        resumeText: db.data.resumeText ?? "",
        coverLetter: application.coverLetter ?? "",
        job,
        existing: db.data.insights.flatMap((i) => i.lessons),
      }),
      schema: INSIGHTS_SCHEMA,
    });

    const insight = {
      id: `insight-${Date.now()}`,
      applicationId,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      createdAt: new Date().toISOString(),
      lessons,
    };
    db.data.insights.push(insight);
    await db.write();

    return NextResponse.json({ insight });
  } catch (err) {
    console.error("insight extraction failed:", err);
    const message =
      err instanceof ConfigError ? err.message : "Couldn't extract lessons";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/insights — every recorded win and its lessons, newest first.
export async function GET() {
  const db = await getDb();
  return NextResponse.json({ insights: (db.data.insights ?? []).toReversed() });
}
