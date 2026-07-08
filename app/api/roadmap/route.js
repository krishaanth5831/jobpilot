import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { ROADMAP_SCHEMA } from "@/lib/matcher";
import { getDb } from "@/lib/db";

// POST /api/roadmap — body: { jobId }.
// For a job the user wants but doesn't qualify for, Claude turns the
// missing requirements into a concrete, ordered action plan.
export async function POST(request) {
  const db = await getDb();
  if (!db.data.profile) {
    return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });
  }

  const { jobId } = await request.json();
  const job = db.data.jobs.find((j) => j.id === jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!job.match) {
    return NextResponse.json({ error: "Run matching for this job first" }, { status: 400 });
  }

  try {
    const roadmap = await askClaudeJSON({
      system:
        "You are a pragmatic career coach for students and early-career developers. Turn skill gaps into a concrete, ordered plan with realistic time estimates and free/cheap resources. Prefer building projects over passive courses.",
      prompt: `Candidate profile:\n${JSON.stringify(db.data.profile, null, 2)}\n\nTarget job: ${job.title} at ${job.company}\n\nRequirements they already meet:\n${JSON.stringify(job.match.matched_requirements)}\n\nRequirements they are missing:\n${JSON.stringify(job.match.missing_requirements)}\n\nCreate a step-by-step plan to become qualified for this job.`,
      schema: ROADMAP_SCHEMA,
    });

    job.roadmap = roadmap;
    await db.write();

    return NextResponse.json({ roadmap });
  } catch (err) {
    console.error("roadmap generation failed:", err);
    const message =
      err instanceof ConfigError ? err.message : "Failed to generate roadmap";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/roadmap — body: { jobId, stepIndex, done } — persist a
// completed-step checkbox on the stored roadmap.
export async function PATCH(request) {
  const db = await getDb();
  const { jobId, stepIndex, done } = await request.json();
  const job = db.data.jobs.find((j) => j.id === jobId);
  if (!job?.roadmap?.steps?.[stepIndex]) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  job.roadmap.steps[stepIndex].done = Boolean(done);
  await db.write();
  return NextResponse.json({ roadmap: job.roadmap });
}
