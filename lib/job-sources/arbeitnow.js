// Arbeitnow adapter (https://www.arbeitnow.com/api/job-board-api) — mostly
// European tech jobs, free, no API key. The API has no keyword search, so
// fetch the latest page and filter by the role locally.

import { cleanDescription } from "./clean.js";

export async function searchArbeitnow({ role, limit = 10 }) {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api");
  if (!res.ok) throw new Error(`Arbeitnow request failed: ${res.status}`);

  const data = await res.json();
  const terms = role.toLowerCase().split(/\s+/).filter(Boolean);

  return (data.data || [])
    .filter((job) => {
      const haystack = `${job.title} ${(job.tags || []).join(" ")} ${(job.job_types || []).join(" ")}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    })
    .slice(0, limit)
    .map((job) => ({
      id: `arbeitnow:${job.slug}`,
      source: "arbeitnow",
      title: job.title,
      company: job.company_name ?? "Unknown",
      location: job.remote ? `${job.location || "Unknown"} (Remote)` : job.location || "Unknown",
      description: cleanDescription(job.description),
      url: job.url,
      salary: null,
      posted_at: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
    }));
}
