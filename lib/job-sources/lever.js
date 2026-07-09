// Lever adapter (https://github.com/lever/postings-api) — public per-company
// postings API, no key. Like Greenhouse there is no global search, so query a
// curated set of well-known companies and rank titles against the role.

import { cleanDescription } from "./clean.js";
import { matchesLocation } from "./location.js";

// Company slugs verified live to have active boards.
const COMPANIES = {
  palantir: "Palantir",
  spotify: "Spotify",
  mistral: "Mistral AI",
  zoox: "Zoox",
  matchgroup: "Match Group",
  highspot: "Highspot",
};

export async function searchLever({ role, location = "", limit = 10 }) {
  const terms = role.toLowerCase().split(/\s+/).filter(Boolean);

  const boards = await Promise.allSettled(
    Object.entries(COMPANIES).map(async ([slug, name]) => {
      const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json&limit=100`);
      if (!res.ok) throw new Error(`Lever ${slug} failed: ${res.status}`);
      const postings = await res.json();
      return { slug, name, postings: Array.isArray(postings) ? postings : [] };
    })
  );

  const scored = [];
  for (const r of boards) {
    if (r.status !== "fulfilled") continue;
    for (const posting of r.value.postings) {
      if (!matchesLocation(posting.categories?.location, location)) continue;
      const title = (posting.text ?? "").toLowerCase();
      const score = terms.filter((t) => title.includes(t)).length;
      if (score > 0) scored.push({ ...r.value, posting, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || b.posting.createdAt - a.posting.createdAt);

  return scored.slice(0, limit).map(({ slug, name, posting }) => {
    // The intro lives in descriptionPlain; requirements live in `lists`.
    const lists = (posting.lists ?? [])
      .map((l) => `${l.text}\n${l.content}`)
      .join("\n");
    const location = posting.categories?.location ?? "Unknown";
    return {
      id: `lever:${slug}:${posting.id}`,
      source: "lever",
      title: posting.text,
      company: name,
      location: posting.workplaceType === "remote" ? `${location} (Remote)` : location,
      description: cleanDescription(`${posting.descriptionPlain ?? ""}\n${lists}`),
      url: posting.hostedUrl,
      salary: null,
      posted_at: posting.createdAt ? new Date(posting.createdAt).toISOString() : null,
    };
  });
}
