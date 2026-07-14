import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { MATCH_SCHEMA, MATCH_SYSTEM_PROMPT, buildMatchPrompt } from "@/lib/matcher";
import { AUTO_APPLY_SCORE, draftApplicationFor } from "@/lib/applications";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// POST /api/match — body: { jobId } (or { all: true } to match every unmatched job).
// Claude compares the stored profile against the job description and returns
// { qualified, score, matched_requirements, missing_requirements, reasoning }.
export async function POST(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  if (!data.profile) {
    return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });
  }

  const body = await request.json();
  // Prefer explicit jobIds (the jobs a search just returned) — `all` grows
  // unbounded with the stored backlog and each job is one Claude call.
  const targets = Array.isArray(body.jobIds)
    ? data.jobs.filter((j) => body.jobIds.includes(j.id) && j.match === null)
    : body.all
      ? data.jobs.filter((j) => j.match === null)
      : data.jobs.filter((j) => j.id === body.jobId);

  if (targets.length === 0) {
    return NextResponse.json({ error: "No jobs to match" }, { status: 404 });
  }

  // Screen jobs in parallel (bounded so a big batch doesn't trip rate
  // limits) and keep every success — one failed call must not throw away
  // the verdicts that already came back.
  const CONCURRENCY = 6;
  const matched = [];
  let firstError = null;
  let next = 0;

  async function worker() {
    while (next < targets.length) {
      const job = targets[next++];
      try {
        job.match = await askClaudeJSON({
          system: MATCH_SYSTEM_PROMPT,
          prompt: buildMatchPrompt(data.profile, job),
          schema: MATCH_SCHEMA,
        });
        job.screened_at = new Date().toISOString();
        matched.push(job);
      } catch (err) {
        console.error(`matching failed for ${job.id}:`, err);
        firstError ??= err;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker)
  );

  // Auto-apply: any job scoring above the threshold gets a cover letter drafted
  // and queued for review right away (still never auto-submitted). Bounded and
  // best-effort — a draft failure must not throw away the match verdicts.
  const toApply = matched.filter(
    (j) => (j.match?.score ?? 0) > AUTO_APPLY_SCORE && !data.applications.some((a) => a.jobId === j.id)
  );
  let autoApplied = 0;
  let ai = 0;
  async function applyWorker() {
    while (ai < toApply.length) {
      const job = toApply[ai++];
      try {
        await draftApplicationFor(data, job);
        autoApplied++;
      } catch (err) {
        console.error(`auto-apply failed for ${job.id}:`, err);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, toApply.length) }, applyWorker)
  );

  await db.write();

  if (matched.length === 0 && firstError) {
    const message =
      firstError instanceof ConfigError ? firstError.message : "Matching failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    matched,
    failed: targets.length - matched.length,
    autoApplied,
  });
}
