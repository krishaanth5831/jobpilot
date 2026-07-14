// Arbeitnow adapter (https://www.arbeitnow.com/api/job-board-api) — free, no
// key, strong European coverage (plus remote worldwide). No free-text search,
// so we pull the recent feed and gate on the title. Location filtering is done
// by the caller (index.js).

import { cleanDescription } from "./clean.js";
import { roleTerms, titleRelevance } from "./relevance.js";

export async function searchArbeitnow({ role, limit = 14 }) {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api");
  if (!res.ok) throw new Error(`Arbeitnow request failed: ${res.status}`);
  const data = await res.json();

  const terms = roleTerms(role);
  return (data.data || [])
    .map((job) => ({ job, rel: titleRelevance(job.title ?? "", terms) }))
    .filter(({ rel }) => rel.relevant)
    .sort((a, b) => b.rel.score - a.rel.score || (b.job.created_at ?? 0) - (a.job.created_at ?? 0))
    .slice(0, limit)
    .map(({ job }) => ({
      id: `arbeitnow:${job.slug}`,
      source: "arbeitnow",
      title: job.title,
      company: job.company_name ?? "Unknown",
      location: `${job.location || "Unknown"}${job.remote ? " (Remote)" : ""}`,
      description: cleanDescription(job.description ?? ""),
      url: job.url,
      salary: null,
      posted_at: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
      employmentHint: (job.job_types ?? []).join(" "),
      queriedCountry: null,
    }));
}
