import { NextResponse } from "next/server";
import { askClaudeText, ConfigError } from "@/lib/claude";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// POST /api/applications/followup — body: { id } — draft a short follow-up
// note for an application that's gone quiet. Not stored; the user copies it
// and sends it themselves.
export async function POST(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  const { id } = await request.json();

  const application = data.applications.find((a) => a.id === id);
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = data.jobs.find((j) => j.id === application.jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const followUp = await askClaudeText({
      system:
        "You write short, polite follow-up notes on job applications. Under 120 words, warm but not pushy: reference the role, restate ONE concrete strength drawn from the original cover letter, and ask about the timeline. Never invent claims or fake urgency.",
      prompt: `Role: ${job.title} at ${job.company}
Applied on: ${application.submittedAt ?? application.createdAt}

Original cover letter:
${application.coverLetter}

Write the follow-up note.`,
    });

    return NextResponse.json({ followUp });
  } catch (err) {
    console.error("follow-up draft failed:", err);
    const message = err instanceof ConfigError ? err.message : "Couldn't draft the follow-up";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
