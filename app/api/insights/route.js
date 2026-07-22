import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { INSIGHTS_SCHEMA, INSIGHTS_SYSTEM_PROMPT, buildInsightsPrompt } from "@/lib/reviewer";
import { recordOutcome, tagsFromProfile } from "@/lib/learnings";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// The success feedback loop. When an application is marked hired, the
// winning resume + cover letter are distilled into transferable lessons.
// Stored lessons are injected into every future review, interview, rebuild,
// and cover-letter draft — each win teaches the next application.

// POST /api/insights — body: { applicationId } — extract lessons from a
// hired application. Idempotent: a second call for the same application
// returns the stored record instead of re-extracting.
export async function POST(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  const { applicationId } = await request.json();

  const application = data.applications.find((a) => a.id === applicationId);
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.status !== "hired") {
    return NextResponse.json(
      { error: "Lessons are only extracted from hired applications" },
      { status: 400 }
    );
  }

  data.insights ??= [];
  const already = data.insights.find((i) => i.applicationId === applicationId);
  if (already) return NextResponse.json({ insight: already });

  const job = data.jobs.find((j) => j.id === application.jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const { lessons, globalLessons } = await askClaudeJSON({
      system: INSIGHTS_SYSTEM_PROMPT,
      prompt: buildInsightsPrompt({
        profile: data.profile,
        resumeText: data.resumeText ?? "",
        coverLetter: application.coverLetter ?? "",
        job,
        existing: data.insights.flatMap((i) => i.lessons),
      }),
      schema: INSIGHTS_SCHEMA,
    });

    // Anonymized lessons feed the cross-account knowledge base, starting
    // life with one success (they come from a hire). recordOutcome runs the
    // PII sanitizer and silently drops anything that fails it; the write
    // below persists both the user's insight and these in one shot.
    for (const lesson of globalLessons ?? []) {
      recordOutcome(db, {
        category: lesson.category,
        pattern: lesson.pattern,
        contextTags: tagsFromProfile(data.profile),
        success: true,
      });
    }

    const insight = {
      id: `insight-${Date.now()}`,
      applicationId,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      createdAt: new Date().toISOString(),
      lessons,
    };
    data.insights.push(insight);
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
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  return NextResponse.json({ insights: (data.insights ?? []).toReversed() });
}
