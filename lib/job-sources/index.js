// Job source adapter layer. Every adapter fetches from one job board API and
// returns jobs normalized to this shape:
//
// {
//   id: string,          // "<source>:<external id>"
//   source: string,      // e.g. "adzuna"
//   title: string,
//   company: string,
//   location: string,
//   description: string, // full text used for matching
//   url: string,         // where the user actually applies
//   salary: string|null,
//   posted_at: string|null, // ISO date
// }

import { fuzzyJobKey } from "./dedupe.js";
import { searchAdzuna } from "./adzuna.js";
import { searchJSearch } from "./jsearch.js";
import {
  resolveLocation,
  acceptsJob,
  countryName,
  countryOfLocation,
  isAdzunaCountry,
  BRUTE_JSEARCH,
  BRUTE_ADZUNA,
} from "./location.js";

// JSearch is maddeningly inconsistent about where the place goes: some
// countries return results only when the country is in the query text ("… in
// portugal"), others only when it's left out (country param alone). So for a
// specific country we try BOTH; a continent's primary markets are strong
// enough to skip the extra call; a city needs its name in the query.
function jsearchHints(scope, code) {
  if (scope.kind === "any") return [""];
  if (scope.kind === "unknown") return [scope.label];
  if (scope.kind === "city") return ["", scope.city];
  if (scope.kind === "continent") return [""];
  return ["", countryName(code) || ""]; // country
}

// Two sources: JSearch rides Google's job index (LinkedIn, Indeed, Glassdoor,
// company sites) and covers most countries; Adzuna adds per-country depth
// where it has an endpoint. The locally-filtered boards (Greenhouse/Lever/
// Remotive/GitHub lists) were the residual location-noise source and were
// removed deliberately — precision over volume, and every junk job was a
// paid screening call.

// How many listings a single search can pull. Screening is bounded separately
// (on demand, in the UI), so this is just how big a browsable pool we build:
// large for a worldwide brute-force search, smaller for a scoped one.
const POOL_BRUTE = 80;
const POOL_SCOPED = 30;

/**
 * Search all configured job sources.
 * @param {{ roles: string[], role?: string, location?: string }} query
 *   `roles` is one or more title variants (keyword boards are picky, so we try
 *   a few). With no `location`, brute-force the major markets and tag each job
 *   with its country so the UI can filter; with a `location`, scope to it.
 * @returns {Promise<Array>} normalized jobs, each tagged { country, countryName }
 */
export async function searchJobs({ roles, role, location = "" }) {
  const titles = (roles?.length ? roles : [role]).filter(Boolean);
  const bruteForce = !location.trim();
  // Brute force accepts everything (we filter by country in the UI); a scoped
  // search keeps only jobs in the requested place.
  const scope = bruteForce ? { kind: "any" } : resolveLocation(location);

  const tasks = [];
  if (bruteForce) {
    // Pull the same role from every major market at once — one JSearch call
    // per market (its quota is tight) plus Adzuna's wider, cheaper set.
    const title = titles[0];
    for (const country of BRUTE_JSEARCH) tasks.push(searchJSearch({ role: title, country, where: "" }));
    for (const country of BRUTE_ADZUNA) tasks.push(searchAdzuna({ role: title, country, where: "" }));
  } else {
    for (const country of scope.queryCodes) {
      titles.forEach((title, i) => {
        // The best title tries both location phrasings (JSearch is inconsistent
        // about whether the place belongs in the query text); alternates just
        // use the plain form to keep the number of calls bounded.
        const hints = i === 0 ? jsearchHints(scope, country) : [jsearchHints(scope, country)[0]];
        for (const where of hints) tasks.push(searchJSearch({ role: title, country, where }));
      });
      if (country === null || isAdzunaCountry(country)) {
        tasks.push(searchAdzuna({ role: titles[0], country, where: scope.kind === "city" ? scope.city : "" }));
      }
    }
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === "rejected") console.warn("job source failed:", r.reason?.message);
  }
  const fulfilled = results.filter((r) => r.status === "fulfilled").map((r) => r.value);

  // If every request failed, surface the first error instead of silently
  // returning an empty result set (a partial failure still returns jobs).
  if (fulfilled.length === 0) {
    const failure = results.find((r) => r.status === "rejected");
    if (failure) throw failure.reason;
    return [];
  }

  // Keep only jobs in scope, then tag each with its country (for the UI's
  // country filter) and drop the transient queriedCountry field.
  const perSource = fulfilled
    .map((list) =>
      list
        .filter((job) => acceptsJob(scope, job))
        .map(({ queriedCountry, ...job }) => {
          const code = countryOfLocation(job.location) || queriedCountry || null;
          return { ...job, country: code, countryName: code ? countryName(code) || code : null };
        })
    )
    .filter((list) => list.length > 0);

  if (perSource.length === 0) return [];

  const cap = bruteForce ? POOL_BRUTE : POOL_SCOPED;
  // Round-robin across sources so the cap keeps variety (and a spread of
  // countries) instead of letting one board or market fill the whole quota.
  const interleaved = [];
  for (let i = 0; interleaved.length < cap; i++) {
    const remaining = perSource.filter((list) => i < list.length);
    if (remaining.length === 0) break;
    for (const list of remaining) {
      if (interleaved.length >= cap) break;
      interleaved.push(list[i]);
    }
  }

  // Dedupe by id, then fuzzily: the same posting often appears on several
  // boards (e.g. a Greenhouse job syndicated to Adzuna) and each stored
  // duplicate would cost its own screening call.
  const byId = [...new Map(interleaved.map((job) => [job.id, job])).values()];
  const seen = new Set();
  return byId.filter((job) => {
    const key = fuzzyJobKey(job);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
