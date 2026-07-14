import { NextResponse } from "next/server";
import { ConfigError } from "@/lib/claude";
import { draftApplicationFor } from "@/lib/applications";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// POST /api/applications — body: { jobId }.
// Only works for jobs Claude marked as qualified. Drafts a tailored cover
// letter and queues it for human review — jobpilot never auto-submits.
export async function POST(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  const { jobId } = await request.json();

  const job = data.jobs.find((j) => j.id === jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!job.match?.qualified) {
    return NextResponse.json(
      { error: "You don't qualify for this job yet — check /roadmap for what to work on" },
      { status: 400 }
    );
  }

  try {
    const application = await draftApplicationFor(data, job);
    await db.write();
    return NextResponse.json({ application });
  } catch (err) {
    console.error("application draft failed:", err);
    const message =
      err instanceof ConfigError ? err.message : "Failed to draft application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/applications — the review queue.
export async function GET() {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  return NextResponse.json({ applications: data.applications });
}

// PATCH /api/applications — body: { id, status?, coverLetter? } —
// mark reviewed/submitted and/or persist edits to the draft.
export async function PATCH(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  const { id, status, coverLetter } = await request.json();
  const application = data.applications.find((a) => a.id === id);
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (status !== undefined) {
    application.status = status;
    // First transition to submitted starts the follow-up clock.
    if (status === "submitted" && !application.submittedAt) {
      application.submittedAt = new Date().toISOString();
    }
  }
  if (coverLetter !== undefined) application.coverLetter = coverLetter;
  await db.write();
  return NextResponse.json({ application });
}

// DELETE /api/applications — body: { id } — remove an application entirely.
export async function DELETE(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  const { id } = await request.json();
  const index = data.applications.findIndex((a) => a.id === id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  data.applications.splice(index, 1);
  await db.write();
  return NextResponse.json({ ok: true });
}
