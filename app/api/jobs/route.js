import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/jobs — all stored jobs (with any match verdicts).
export async function GET() {
  const db = await getDb();
  return NextResponse.json({ jobs: db.data.jobs });
}
