// Jobicy adapter (https://jobicy.com/jobs-rss-feed) — remote jobs, free,
// no API key. Per their notice, apply links must use the original job URL
// (the normalized `url` does).

import { cleanDescription } from "./clean.js";

export async function searchJobicy({ role, limit = 10 }) {
  const params = new URLSearchParams({ count: String(limit), tag: role });
  const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?${params}`);
  if (!res.ok) throw new Error(`Jobicy request failed: ${res.status}`);

  const data = await res.json();
  return (data.jobs || []).map((job) => ({
    id: `jobicy:${job.id}`,
    source: "jobicy",
    title: job.jobTitle,
    company: job.companyName ?? "Unknown",
    location: job.jobGeo ? `Remote (${job.jobGeo})` : "Remote",
    description: cleanDescription(job.jobDescription || job.jobExcerpt),
    url: job.url,
    salary:
      job.salaryMin && job.salaryMax
        ? `${job.salaryMin}–${job.salaryMax} ${job.salaryCurrency ?? ""}`.trim()
        : null,
    posted_at: job.pubDate ?? null,
  }));
}
