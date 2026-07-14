// Himalayas adapter (https://himalayas.app/jobs/api) — free, no key, remote
// jobs worldwide with structured employment type + seniority. No free-text
// search, so pull the recent feed and gate on the title. Location filtering is
// done by the caller (index.js).

import { cleanDescription } from "./clean.js";
import { roleTerms, titleRelevance } from "./relevance.js";

export async function searchHimalayas({ role, limit = 14 }) {
  const res = await fetch("https://himalayas.app/jobs/api?limit=100");
  if (!res.ok) throw new Error(`Himalayas request failed: ${res.status}`);
  const data = await res.json();

  const terms = roleTerms(role);
  return (data.jobs || [])
    .map((job) => ({ job, rel: titleRelevance(job.title ?? "", terms) }))
    .filter(({ rel }) => rel.relevant)
    .sort(
      (a, b) =>
        b.rel.score - a.rel.score ||
        new Date(b.job.pubDate ?? 0) - new Date(a.job.pubDate ?? 0)
    )
    .slice(0, limit)
    .map(({ job }) => ({
      id: `himalayas:${job.guid}`,
      source: "himalayas",
      title: job.title,
      company: job.companyName ?? "Unknown",
      location: `Remote${(job.locationRestrictions ?? []).length ? ` (${job.locationRestrictions.join(", ")})` : ""}`,
      description: cleanDescription(job.description ?? job.excerpt ?? ""),
      url: job.applicationLink,
      salary: job.minSalary ? `${job.minSalary}–${job.maxSalary ?? "?"}` : null,
      posted_at: job.pubDate ?? null,
      employmentHint: job.employmentType ?? "",
      levelHint: (job.seniority ?? []).join(" "),
      queriedCountry: null,
    }));
}
