import { askClaudeText } from "@/lib/claude";
import { formatInsights } from "@/lib/reviewer";

// Jobs whose match score is ABOVE this get an application drafted and queued
// for review automatically (see app/api/match/route.js). jobblast still never
// auto-submits — the draft lands in the review queue for the user to send.
export const AUTO_APPLY_SCORE = 35;

// Draft a tailored cover letter for one job and queue it for review. Returns
// the already-queued application if one exists for the job (so re-screening or
// re-searching never creates duplicates). Caller is responsible for db.write().
export async function draftApplicationFor(data, job) {
  const existing = data.applications.find((a) => a.jobId === job.id);
  if (existing) return existing;

  const coverLetter = await askClaudeText({
    system:
      "You write specific, honest cover letters. Ground every claim in the candidate's actual profile — never exaggerate or invent experience. Keep it under 300 words, warm but direct.",
    prompt: `Candidate profile:\n${JSON.stringify(data.profile, null, 2)}\n\nJob:\n${job.title} at ${job.company}\n${job.description}${formatInsights(data.insights)}\n\nWrite a tailored cover letter for this application.`,
  });

  const application = {
    id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    jobId: job.id,
    coverLetter,
    status: "pending_review", // -> "submitted" once the user applies via job.url
    createdAt: new Date().toISOString(),
  };
  data.applications.push(application);
  return application;
}
