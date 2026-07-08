import { NextResponse } from "next/server";
import { askClaudeJSON } from "@/lib/claude";
import { MATCH_SCHEMA, MATCH_SYSTEM_PROMPT, buildMatchPrompt } from "@/lib/matcher";
import { getDb } from "@/lib/db";

// POST /api/match — body: { jobId } (or { all: true } to match every unmatched job).
// Claude compares the stored profile against the job description and returns
// { qualified, score, matched_requirements, missing_requirements, reasoning }.
export async function POST(request) {
  const db = await getDb();
  if (!db.data.profile) {
    return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });
  }

  const body = await request.json();
  const targets = body.all
    ? db.data.jobs.filter((j) => j.match === null)
    : db.data.jobs.filter((j) => j.id === body.jobId);

  if (targets.length === 0) {
    return NextResponse.json({ error: "No jobs to match" }, { status: 404 });
  }

  try {
    for (const job of targets) {
      job.match = await askClaudeJSON({
        system: MATCH_SYSTEM_PROMPT,
        prompt: buildMatchPrompt(db.data.profile, job),
        schema: MATCH_SCHEMA,
      });
    }
    await db.write();

    return NextResponse.json({ matched: targets });
  } catch (err) {
    console.error("matching failed:", err);
    return NextResponse.json({ error: "Matching failed" }, { status: 500 });
  }
}
