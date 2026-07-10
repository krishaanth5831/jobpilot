import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/stats — the funnel and outcome numbers, computed from the store.
// Everything here is derived; nothing extra is written.
export async function GET() {
  const db = await getDb();
  const jobs = db.data.jobs ?? [];
  const apps = db.data.applications ?? [];

  const screened = jobs.filter((j) => j.match);
  const qualified = screened.filter((j) => j.match.qualified);

  const byStatus = {};
  for (const a of apps) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
  const count = (s) => byStatus[s] ?? 0;

  // Everything at or past "submitted" was actually sent.
  const sent =
    count("submitted") + count("interviewing") + count("offer") + count("hired") + count("rejected");
  // Any movement past "submitted" (including a rejection) is a response.
  const responses = sent - count("submitted");

  const scores = screened
    .filter((j) => j.screened_at)
    .toSorted((a, b) => new Date(a.screened_at) - new Date(b.screened_at))
    .map((j) => ({ score: j.match.score, at: j.screened_at }));

  return NextResponse.json({
    funnel: {
      found: jobs.length,
      screened: screened.length,
      qualified: qualified.length,
      drafted: apps.length,
      sent,
      interviewing: count("interviewing"),
      offers: count("offer") + count("hired"),
      hired: count("hired"),
    },
    rates: {
      qualification: screened.length ? qualified.length / screened.length : null,
      response: sent ? responses / sent : null,
    },
    avgScore: screened.length
      ? Math.round(screened.reduce((sum, j) => sum + j.match.score, 0) / screened.length)
      : null,
    scores,
    lessons: (db.data.insights ?? []).reduce((n, i) => n + i.lessons.length, 0),
  });
}
