// Community-maintained GitHub job lists fused into one source. Two shapes:
// - Simplify repos publish a clean listings.json (title, company, locations,
//   url, active, sponsorship…)
// - speedyapply / jobright / zapply / vanshb03 publish markdown pipe-tables
// Everything is merged, deduped (fuzzy company+title), ranked against the
// role, and served under one "github" source tag. These lists carry no job
// descriptions, so entries are screened from listing metadata.

import { cleanDescription } from "./clean.js";
import { fuzzyJobKey } from "./dedupe.js";
import { matchesLocation } from "./location.js";
import { roleTerms, titleRelevance } from "./relevance.js";

const JSON_REPOS = [
  {
    name: "SimplifyJobs/Summer2026-Internships",
    url: "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json",
    kind: "internship",
  },
  {
    name: "SimplifyJobs/New-Grad-Positions",
    url: "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json",
    kind: "new grad",
  },
];

const MD_REPOS = [
  {
    name: "speedyapply/2027-SWE-College-Jobs",
    files: ["README.md", "INTERN_INTL.md", "NEW_GRAD_USA.md", "NEW_GRAD_INTL.md"],
    branch: "main",
  },
  { name: "jobright-ai/2026-Software-Engineer-New-Grad", files: ["README.md"], branch: "master" },
  { name: "zapplyjobs/New-Grad-Software-Engineering-Jobs-2026", files: ["README.md"], branch: "main" },
  { name: "vanshb03/New-Grad-2027", files: ["README.md", "Canada.md"], branch: "main" },
];

// These repos hold tens of thousands of rows — cache the raw fetches so
// consecutive searches don't re-download megabytes.
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map(); // url -> { at, body }

async function fetchCached(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  const body = await res.text();
  cache.set(url, { at: Date.now(), body });
  return body;
}

// Stable id from the apply URL, so re-searches hit the stored copy.
function hashId(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const stripMarkup = (cell) =>
  cell
    .replace(/<img[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/🛂|🇺🇸|↳/g, "")
    .trim();

// The apply link position varies by repo: jobright puts it in the title
// cell, speedyapply/zapply/vanshb03 in a later "apply" column. Prefer the
// title cell's link, then the last non-image link in the row.
function extractUrl(cells) {
  const urlsIn = (cell) =>
    [...cell.matchAll(/(?:href="|\]\()(https?:\/\/[^")\s]+)/g)]
      .map((m) => m[1])
      .filter((u) => !/\.(png|jpe?g|gif|svg)(\?|$)/i.test(u) && !u.includes("imgur.com"));
  const inTitle = urlsIn(cells[1] ?? "");
  if (inTitle.length) return inTitle[0];
  const rest = cells.slice(2).flatMap(urlsIn);
  if (rest.length) return rest[rest.length - 1];
  return null;
}

function parseMarkdownTables(markdown, repoName) {
  const jobs = [];
  let lastCompany = "";
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    if (/^:?-{3,}/.test(cells[0]) || /company/i.test(cells[0])) continue;

    let company = stripMarkup(cells[0]);
    if (!company) company = lastCompany;
    else lastCompany = company;

    const title = stripMarkup(cells[1]);
    const url = extractUrl(cells);
    if (!company || !title || !url) continue;

    const location = stripMarkup(cells[2] ?? "");
    const salary = cells.map(stripMarkup).find((c) => /^\$\d/.test(c)) ?? null;
    jobs.push({
      id: `github:${hashId(url)}`,
      source: "github",
      title,
      company,
      location: location || "Unknown",
      description: cleanDescription(
        `${title} at ${company}. Location: ${location || "unspecified"}. Listed on the community job board ${repoName} (no full description available — judge from the title and listing metadata).`
      ),
      url,
      salary,
      posted_at: null,
    });
  }
  return jobs;
}

function parseSimplify(jsonText, repo) {
  return JSON.parse(jsonText)
    .filter((l) => l.active && l.is_visible && l.url)
    .map((l) => ({
      id: `github:simplify:${l.id}`,
      source: "github",
      title: l.title,
      company: l.company_name,
      location: (l.locations ?? []).join("; ") || "Unknown",
      description: cleanDescription(
        `${l.title} at ${l.company_name} (${repo.kind}). Locations: ${(l.locations ?? []).join(", ") || "unspecified"}. ` +
          `${l.terms?.length ? `Terms: ${l.terms.join(", ")}. ` : ""}` +
          `${l.degrees?.length ? `Degrees: ${l.degrees.join(", ")}. ` : ""}` +
          `${l.sponsorship ? `Sponsorship: ${l.sponsorship}. ` : ""}` +
          `Listed on ${repo.name} (no full description available — judge from the title and listing metadata).`
      ),
      url: l.url,
      salary: null,
      posted_at: l.date_posted ? new Date(l.date_posted * 1000).toISOString() : null,
    }));
}

export async function searchGithubRepos({ role, location = "", limit = 10 }) {
  const terms = roleTerms(role);

  const fetches = [
    ...JSON_REPOS.map(async (repo) => parseSimplify(await fetchCached(repo.url), repo)),
    ...MD_REPOS.flatMap((repo) =>
      repo.files.map(async (file) =>
        parseMarkdownTables(
          await fetchCached(`https://raw.githubusercontent.com/${repo.name}/${repo.branch}/${file}`),
          repo.name
        )
      )
    ),
  ];
  const results = await Promise.allSettled(fetches);
  for (const r of results) {
    if (r.status === "rejected") console.warn("github job list failed:", r.reason?.message);
  }
  const all = results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);

  // Fuse: the same posting appears across these repos constantly.
  const seen = new Set();
  const scored = [];
  for (const job of all) {
    if (!matchesLocation(job.location, location)) continue;
    const { score, relevant } = titleRelevance(job.title, terms);
    if (!relevant) continue;
    const key = fuzzyJobKey(job) ?? job.id;
    if (seen.has(key)) continue;
    seen.add(key);
    scored.push({ job, score });
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.job.posted_at ?? 0) - new Date(a.job.posted_at ?? 0)
    )
    .slice(0, limit)
    .map(({ job }) => job);
}
