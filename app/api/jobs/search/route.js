import { NextResponse } from "next/server";
import { searchJobs } from "@/lib/job-sources";
import { fuzzyJobKey } from "@/lib/job-sources/dedupe";
import { ConfigError } from "@/lib/claude";
import { getDb } from "@/lib/db";

// GET /api/jobs/search?role=software+engineer+intern&location=remote
// Fetches jobs from the configured job boards and stores them (unmatched).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const location = searchParams.get("location") ?? "";
  if (!role) {
    return NextResponse.json({ error: "role query param is required" }, { status: 400 });
  }

  try {
    let jobs = await searchJobs({ role, location });

    const db = await getDb();
    // A job already stored under another board's id (fuzzy company+title
    // match) is the same job — swap in the stored one, keeping its verdict
    // instead of paying to screen a duplicate.
    const storedByKey = new Map();
    for (const j of db.data.jobs) {
      const key = fuzzyJobKey(j);
      if (key && !storedByKey.has(key)) storedByKey.set(key, j);
    }
    jobs = jobs.map((job) => {
      const key = fuzzyJobKey(job);
      return (key && storedByKey.get(key)) || job;
    });
    // Two incoming jobs can collapse onto one stored job — dedupe by id.
    jobs = [...new Map(jobs.map((j) => [j.id, j])).values()];

    const known = new Set(db.data.jobs.map((j) => j.id));
    for (const job of jobs) {
      if (!known.has(job.id)) db.data.jobs.push({ ...job, match: null });
    }
    // Remember which jobs this search returned — the jobs and roadmap pages
    // show only the latest search instead of the whole stored backlog.
    db.data.lastSearch = {
      role,
      location,
      at: new Date().toISOString(),
      jobIds: jobs.map((j) => j.id),
    };
    await db.write();

    // Return the stored versions so already-screened jobs keep their match.
    const stored = new Map(db.data.jobs.map((j) => [j.id, j]));
    return NextResponse.json({ jobs: jobs.map((j) => stored.get(j.id) ?? j) });
  } catch (err) {
    console.error("job search failed:", err);
    const message = err instanceof ConfigError ? err.message : "Job search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
