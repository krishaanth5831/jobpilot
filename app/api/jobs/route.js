import { NextResponse } from "next/server";
import { cleanDescription } from "@/lib/job-sources/clean";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// GET /api/jobs — all stored jobs (with any match verdicts), plus the ids
// the latest search returned so pages can scope to it. Older jobs stay
// stored because applications and roadmaps reference them.
export async function GET() {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  return NextResponse.json({
    jobs: data.jobs,
    lastSearchIds: data.lastSearch?.jobIds ?? null,
    tailoredJobIds: Object.keys(data.tailoredResumes ?? {}),
  });
}

// POST /api/jobs — body: { title, company?, url?, description } — store a
// job the user found anywhere (LinkedIn, a company site…) so it runs
// through the same screen → verdict → draft pipeline as searched jobs.
export async function POST(request) {
  const { title, company, url, description } = await request.json();
  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json(
      { error: "A job title and its description are required" },
      { status: 400 }
    );
  }

  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  const job = {
    id: `pasted:${Date.now()}`,
    source: "pasted",
    title: title.trim(),
    company: company?.trim() || "Unknown",
    location: "",
    description: cleanDescription(description),
    url: url?.trim() || null,
    salary: null,
    posted_at: new Date().toISOString(),
    match: null,
  };
  data.jobs.push(job);
  // Pasted jobs join the current working set so they show up on the page.
  if (data.lastSearch) data.lastSearch.jobIds.push(job.id);
  else data.lastSearch = { role: "(pasted)", location: "", at: job.posted_at, jobIds: [job.id] };
  await db.write();

  return NextResponse.json({ job });
}
