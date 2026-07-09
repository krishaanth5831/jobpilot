// Remotive adapter (https://remotive.com/api/remote-jobs) — remote jobs,
// free, no API key. Per their terms, job links must point back to Remotive
// (the normalized `url` already does).

import { cleanDescription } from "./clean.js";

export async function searchRemotive({ role, limit = 10 }) {
  const params = new URLSearchParams({ search: role, limit: String(limit) });
  const res = await fetch(`https://remotive.com/api/remote-jobs?${params}`);
  if (!res.ok) throw new Error(`Remotive request failed: ${res.status}`);

  const data = await res.json();
  return (data.jobs || []).map((job) => ({
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
