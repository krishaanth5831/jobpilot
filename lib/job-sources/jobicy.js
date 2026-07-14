// Jobicy adapter (https://jobicy.com/jobs-rss-feed — JSON API v2) — free, no
// key, remote jobs worldwide with structured type + seniority. Its `tag`
// param does server-side filtering; we still gate on the title. Location
// filtering is done by the caller (index.js).

import { cleanDescription } from "./clean.js";
import { roleTerms, titleRelevance } from "./relevance.js";

export async function searchJobicy({ role, limit = 14 }) {
  // The `tag` filter works best with a single keyword — use the last word of
  // the role (usually the role noun: "engineer", "designer", "analyst").
  const tag = role.trim().split(/\s+/).pop()?.toLowerCase() || role;
  const params = new URLSearchParams({ count: "50", tag });
  const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?${params}`);
  if (!res.ok) throw new Error(`Jobicy request failed: ${res.status}`);
  const data = await res.json();

  const terms = roleTerms(role);
  return (data.jobs || [])
    .map((job) => ({ job, rel: titleRelevance(job.jobTitle ?? "", terms) }))
    .filter(({ rel }) => rel.relevant)
    .sort(
      (a, b) =>
        b.rel.score - a.rel.score ||
        new Date(b.job.pubDate ?? 0) - new Date(a.job.pubDate ?? 0)
    )
    .slice(0, limit)
    .map(({ job }) => ({
      id: `jobicy:${job.id}`,
      source: "jobicy",
      title: job.jobTitle,
      company: job.companyName ?? "Unknown",
      location: `Remote${job.jobGeo ? ` (${job.jobGeo})` : ""}`,
      description: cleanDescription(job.jobDescription ?? job.jobExcerpt ?? ""),
      url: job.url,
      salary: job.salaryMin ? `${job.salaryMin}–${job.salaryMax ?? "?"}` : null,
      posted_at: job.pubDate ?? null,
      employmentHint: (job.jobType ?? []).join(" "),
      levelHint: job.jobLevel ?? "",
      queriedCountry: null,
    }));
}
