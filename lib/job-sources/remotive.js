// Remotive adapter (https://remotive.com/api/remote-jobs) — remote jobs,
// free, no API key. Per their terms, job links point back to Remotive (the
// normalized `url` already does). Location filtering is done by the caller.

import { cleanDescription } from "./clean.js";
import { roleTerms, titleRelevance } from "./relevance.js";

export async function searchRemotive({ role, limit = 14 }) {
  // Over-fetch so title filtering still leaves `limit` jobs.
  const params = new URLSearchParams({ search: role, limit: String(limit * 5) });
  const res = await fetch(`https://remotive.com/api/remote-jobs?${params}`);
  if (!res.ok) throw new Error(`Remotive request failed: ${res.status}`);

  const terms = roleTerms(role);
  const data = await res.json();
  return (data.jobs || [])
    // Remotive's search matches descriptions loosely (a "copywriter" job can
    // surface for an engineering query) — gate on the title.
    .filter((job) => titleRelevance(job.title ?? "", terms).relevant)
    .slice(0, limit)
    .map((job) => ({
      id: `remotive:${job.id}`,
      source: "remotive",
      title: job.title,
      company: job.company_name ?? "Unknown",
      location: job.candidate_required_location
        ? `Remote (${job.candidate_required_location})`
        : "Remote",
      description: cleanDescription(job.description),
      url: job.url,
      salary: job.salary || null,
      posted_at: job.publication_date ?? null,
      employmentHint: job.job_type ?? "",
      queriedCountry: null,
    }));
}
