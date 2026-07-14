// The Muse adapter (https://www.themuse.com/developers/api/v2) — free, no key
// required. Broad worldwide coverage across many companies, with structured
// seniority levels. No free-text search, so pull a few pages and gate on the
// title. Location filtering is done by the caller (index.js).

import { cleanDescription } from "./clean.js";
import { roleTerms, titleRelevance } from "./relevance.js";

export async function searchTheMuse({ role, limit = 14 }) {
  const pages = await Promise.allSettled(
    [1, 2, 3].map(async (page) => {
      const res = await fetch(`https://www.themuse.com/api/public/jobs?page=${page}`);
      if (!res.ok) throw new Error(`The Muse page ${page} failed: ${res.status}`);
      const data = await res.json();
      return data.results || [];
    })
  );
  const all = pages.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);

  const terms = roleTerms(role);
  return all
    .map((job) => ({ job, rel: titleRelevance(job.name ?? "", terms) }))
    .filter(({ rel }) => rel.relevant)
    .sort(
      (a, b) =>
        b.rel.score - a.rel.score ||
        new Date(b.job.publication_date ?? 0) - new Date(a.job.publication_date ?? 0)
    )
    .slice(0, limit)
    .map(({ job }) => ({
      id: `themuse:${job.id}`,
      source: "themuse",
      title: job.name,
      company: job.company?.name ?? "Unknown",
      location: (job.locations ?? []).map((l) => l.name).join("; ") || "Flexible / Remote",
      description: cleanDescription(job.contents ?? ""),
      url: job.refs?.landing_page ?? job.company?.name,
      salary: null,
      posted_at: job.publication_date ?? null,
      levelHint: (job.levels ?? []).map((l) => l.name).join(" "),
      queriedCountry: null,
    }));
}
