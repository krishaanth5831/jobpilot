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

import { searchAdzuna } from "./adzuna.js";
import { searchRemotive } from "./remotive.js";
import { searchJobicy } from "./jobicy.js";
import { searchArbeitnow } from "./arbeitnow.js";

const adapters = [searchAdzuna, searchRemotive, searchJobicy, searchArbeitnow];

// Every stored job costs one Claude screening call, so cap what a single
// search can add regardless of how many sources respond.
const MAX_JOBS_PER_SEARCH = 16;

/**
 * Search all configured job sources.
 * @param {{ role: string, location?: string, limit?: number }} query
 * @returns {Promise<Array>} normalized jobs from all sources, deduped by id
 */
export async function searchJobs(query) {
  const results = await Promise.allSettled(adapters.map((search) => search(query)));
  for (const r of results) {
    if (r.status === "rejected") console.warn("job source failed:", r.reason?.message);
  }
  const perSource = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((list) => list.length > 0);

  // If every source failed, surface the first error instead of silently
  // returning an empty result set (a partial failure still returns jobs).
  if (perSource.length === 0) {
    const failure = results.find((r) => r.status === "rejected");
    if (failure) throw failure.reason;
    return [];
  }

  // Round-robin across sources so the cap keeps variety instead of letting
  // one board fill the whole quota.
  const interleaved = [];
  for (let i = 0; interleaved.length < MAX_JOBS_PER_SEARCH; i++) {
    const remaining = perSource.filter((list) => i < list.length);
    if (remaining.length === 0) break;
    for (const list of remaining) {
      if (interleaved.length >= MAX_JOBS_PER_SEARCH) break;
      interleaved.push(list[i]);
    }
  }

  return [...new Map(interleaved.map((job) => [job.id, job])).values()];
}
