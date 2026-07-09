import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/jobs — all stored jobs (with any match verdicts), plus the ids
// the latest search returned so pages can scope to it. Older jobs stay
// stored because applications and roadmaps reference them.
export async function GET() {
  const db = await getDb();
  return NextResponse.json({
    jobs: db.data.jobs,
    lastSearchIds: db.data.lastSearch?.jobIds ?? null,
  });
}
