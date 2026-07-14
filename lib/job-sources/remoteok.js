// RemoteOK adapter (https://remoteok.com/api) — free, no key, remote jobs
// worldwide. The response is an array whose first element is a legal notice
// (no job id), so we skip anything without a position. A browser-like
// User-Agent is required. Location filtering is done by the caller.

import { cleanDescription } from "./clean.js";
import { roleTerms, titleRelevance } from "./relevance.js";

export async function searchRemoteOk({ role, limit = 14 }) {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; jobpilot/1.0)" },
  });
  if (!res.ok) throw new Error(`RemoteOK request failed: ${res.status}`);
  const data = await res.json();

  const terms = roleTerms(role);
  return (Array.isArray(data) ? data : [])
    .filter((job) => job && job.id && job.position)
    .map((job) => ({ job, rel: titleRelevance(job.position, terms) }))
    .filter(({ rel }) => rel.relevant)
    .sort((a, b) => b.rel.score - a.rel.score || (b.job.epoch ?? 0) - (a.job.epoch ?? 0))
    .slice(0, limit)
    .map(({ job }) => ({
      id: `remoteok:${job.id}`,
      source: "remoteok",
      title: job.position,
      company: job.company ?? "Unknown",
      location: `Remote${job.location ? ` (${job.location})` : ""}`,
      description: cleanDescription(job.description ?? ""),
      url: job.url || job.apply_url,
      salary: job.salary_min ? `${job.salary_min}–${job.salary_max ?? "?"}` : null,
      posted_at: job.date ?? null,
      queriedCountry: null,
    }));
}
