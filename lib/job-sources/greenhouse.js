// Greenhouse adapter (https://developers.greenhouse.io/job-board.html) —
// Greenhouse hosts hiring for many well-known companies and exposes each
// board publicly with no API key. There is no global search endpoint, so we
// query a curated set of boards and rank titles against the role locally,
// then fetch descriptions only for the winners. Location filtering is done by
// the caller (index.js); this adapter just returns title-relevant jobs.

import { cleanDescription } from "./clean.js";
import { roleTerms, titleRelevance } from "./relevance.js";

// Board tokens; a board that 404s is simply skipped. A wide, well-known set
// so "companies to target" and general searches surface real openings.
const BOARDS = [
  "stripe", "figma", "databricks", "cloudflare", "discord", "duolingo",
  "gitlab", "reddit", "robinhood", "coinbase", "airtable", "brex", "plaid",
  "asana", "instacart", "lyft", "doordash", "flexport", "samsara", "rippling",
  "anthropic", "scaleai", "notion", "ramp", "benchling", "gusto", "affirm",
];

const API = "https://boards-api.greenhouse.io/v1/boards";

// Greenhouse returns job content as entity-escaped HTML ("&lt;p&gt;…"), so
// decode entities first or cleanDescription's tag stripping finds no tags.
function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function searchGreenhouse({ role, limit = 12 }) {
  const terms = roleTerms(role);

  // One light request per board (titles only, no content).
  const boards = await Promise.allSettled(
    BOARDS.map(async (board) => {
      const res = await fetch(`${API}/${board}/jobs`);
      if (!res.ok) throw new Error(`Greenhouse ${board} failed: ${res.status}`);
      const data = await res.json();
      return { board, jobs: data.jobs || [] };
    })
  );

  // Rank every posting across all boards by how many role terms its title hits.
  const scored = [];
  for (const r of boards) {
    if (r.status !== "fulfilled") continue;
    for (const job of r.value.jobs) {
      const { score, relevant } = titleRelevance(job.title, terms);
      if (relevant) scored.push({ board: r.value.board, job, score });
    }
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      new Date(b.job.first_published ?? 0) - new Date(a.job.first_published ?? 0)
  );
  const top = scored.slice(0, limit);

  // Fetch full content only for the selected jobs.
  const details = await Promise.allSettled(
    top.map(async ({ board, job }) => {
      const res = await fetch(`${API}/${board}/jobs/${job.id}`);
      if (!res.ok) throw new Error(`Greenhouse ${board}/${job.id} failed: ${res.status}`);
      return res.json();
    })
  );

  return details
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .map((job) => ({
      id: `greenhouse:${job.id}`,
      source: "greenhouse",
      title: job.title,
      company: job.company_name ?? "Unknown",
      location: job.location?.name ?? "Unknown",
      description: cleanDescription(decodeEntities(job.content ?? "")),
      url: job.absolute_url,
      salary: null,
      posted_at: job.first_published ?? null,
      queriedCountry: null,
    }));
}
