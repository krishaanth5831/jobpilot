import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { MATCH_SCHEMA, MATCH_SYSTEM_PROMPT, buildMatchPrompt } from "@/lib/matcher";
import { AUTO_APPLY_SCORE, draftApplicationFor } from "@/lib/applications";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";
import { autoApplyDisabled, recordUse, takeBudget } from "@/lib/entitlements";
import { FEATURES } from "@/lib/tiers";

// POST /api/match — body: { jobId } (or { all: true } to match every unmatched job).
// Claude compares the stored profile against the job description and returns
// { qualified, score, matched_requirements, missing_requirements, reasoning }.
export async function POST(request) {
  const { db, data, userId } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  if (!data.profile) {
    return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });
  }

  const body = await request.json();
  // Prefer explicit jobIds (the jobs a search just returned) — `all` grows
  // unbounded with the stored backlog and each job is one Claude call.
  const wanted = Array.isArray(body.jobIds)
    ? data.jobs.filter((j) => body.jobIds.includes(j.id) && j.match === null)
    : body.all
      ? data.jobs.filter((j) => j.match === null)
      : data.jobs.filter((j) => j.id === body.jobId);

  if (wanted.length === 0) {
    return NextResponse.json({ error: "No jobs to match" }, { status: 404 });
  }

  // Each job is one metered company match. Trim the batch to the daily budget
  // rather than failing the whole request — a Free account with 2 left should
  // get 2 verdicts, not an error.
  const matchBudget = await takeBudget(userId, FEATURES.COMPANY_MATCH, wanted.length);
  const targets = wanted.slice(0, matchBudget.granted);
  if (targets.length === 0) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        upgrade: {
          feature: FEATURES.COMPANY_MATCH,
          tier: matchBudget.verdict.tier,
          used: matchBudget.verdict.used,
          limit: matchBudget.verdict.limit,
          period: matchBudget.verdict.period,
          requiredTier: matchBudget.verdict.upgradeRequired,
        },
      },
      { status: 402 },
    );
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
          task: "job_match",
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
  const eligible = data.autoApply === false || autoApplyDisabled()
    ? []
    : matched.filter(
        (j) => (j.match?.score ?? 0) > AUTO_APPLY_SCORE && !data.applications.some((a) => a.jobId === j.id)
      );
  // Free is 3 for the lifetime of the account, Pro 50/month, Unlimited 300 —
  // so this budget is what actually decides how many drafts get written.
  const applyBudget = await takeBudget(userId, FEATURES.AUTO_APPLY, eligible.length);
  const toApply = eligible.slice(0, applyBudget.granted);
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

  // Counted after the work, not before, so a failed Claude call never spends
  // someone's quota. Only successes are billed against the limits.
  await recordUse(userId, FEATURES.COMPANY_MATCH, { times: matched.length });
  await recordUse(userId, FEATURES.AUTO_APPLY, { times: autoApplied });

  if (matched.length === 0 && firstError) {
    const message =
      firstError instanceof ConfigError ? firstError.message : "Matching failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    matched,
    failed: targets.length - matched.length,
    autoApplied,
    // Present only when a limit trimmed the batch, so the UI can name the
    // exact feature that ran out instead of showing a generic paywall.
    ...(matchBudget.trimmed || applyBudget.trimmed
      ? {
          limited: {
            ...(matchBudget.trimmed
              ? { [FEATURES.COMPANY_MATCH]: matchBudget.verdict }
              : {}),
            ...(applyBudget.trimmed ? { [FEATURES.AUTO_APPLY]: applyBudget.verdict } : {}),
          },
        }
      : {}),
  });
}
