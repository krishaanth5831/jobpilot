// Remotive adapter (https://remotive.com/api/remote-jobs) — remote jobs,
// free, no API key. Per their terms, job links must point back to Remotive
// (the normalized `url` already does).

import { cleanDescription } from "./clean.js";
import { matchesLocation } from "./location.js";
import { roleTerms, titleRelevance } from "./relevance.js";

export async function searchRemotive({ role, location = "", limit = 10 }) {
  // Over-fetch so relevance + location filtering still leaves `limit` jobs.
  const params = new URLSearchParams({ search: role, limit: String(limit * 5) });
  const res = await fetch(`https://remotive.com/api/remote-jobs?${params}`);
  if (!res.ok) throw new Error(`Remotive request failed: ${res.status}`);

  const terms = roleTerms(role);
  const data = await res.json();
  return (data.jobs || [])
    // Remotive's search matches descriptions loosely (a "copywriter" job
    // can surface for an engineering query) — gate on the title.
    .filter((job) => titleRelevance(job.title ?? "", terms).relevant)
    // Remote jobs still have eligibility regions — "Remote (USA only)"
    // doesn't help someone searching for Paris.
    .filter((job) => matchesLocation(job.candidate_required_location || "Worldwide", location))
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
  }));
}
