import { NextResponse } from "next/server";
import { askClaudeText } from "@/lib/claude";
import { getDb } from "@/lib/db";

// POST /api/applications — body: { jobId }.
// Only works for jobs Claude marked as qualified. Drafts a tailored cover
// letter and queues it for human review — jobpilot never auto-submits.
export async function POST(request) {
  const db = await getDb();
  const { jobId } = await request.json();

  const job = db.data.jobs.find((j) => j.id === jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!job.match?.qualified) {
    return NextResponse.json(
      { error: "You don't qualify for this job yet — check /roadmap for what to work on" },
      { status: 400 }
    );
  }

  try {
    const coverLetter = await askClaudeText({
      system:
        "You write specific, honest cover letters. Ground every claim in the candidate's actual profile — never exaggerate or invent experience. Keep it under 300 words, warm but direct.",
      prompt: `Candidate profile:\n${JSON.stringify(db.data.profile, null, 2)}\n\nJob:\n${job.title} at ${job.company}\n${job.description}\n\nWrite a tailored cover letter for this application.`,
    });

    const application = {
      id: `app-${Date.now()}`,
      jobId: job.id,
      coverLetter,
      status: "pending_review", // -> "submitted" once the user applies via job.url
      createdAt: new Date().toISOString(),
    };
    db.data.applications.push(application);
    await db.write();

    return NextResponse.json({ application });
  } catch (err) {
    console.error("application draft failed:", err);
    return NextResponse.json({ error: "Failed to draft application" }, { status: 500 });
  }
}

// GET /api/applications — the review queue.
export async function GET() {
  const db = await getDb();
  return NextResponse.json({ applications: db.data.applications });
}

// PATCH /api/applications — body: { id, status?, coverLetter? } —
// mark reviewed/submitted and/or persist edits to the draft.
export async function PATCH(request) {
  const db = await getDb();
  const { id, status, coverLetter } = await request.json();
  const application = db.data.applications.find((a) => a.id === id);
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (status !== undefined) application.status = status;
  if (coverLetter !== undefined) application.coverLetter = coverLetter;
  await db.write();
  return NextResponse.json({ application });
}
