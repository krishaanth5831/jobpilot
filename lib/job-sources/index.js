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

const adapters = [searchAdzuna];
// TODO: add more sources (JSearch, USAJobs, Greenhouse boards) as adapters here.

/**
 * Search all configured job sources.
 * @param {{ role: string, location?: string, limit?: number }} query
 * @returns {Promise<Array>} normalized jobs from all sources, deduped by id
 */
export async function searchJobs(query) {
  const results = await Promise.allSettled(adapters.map((search) => search(query)));
  const jobs = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);
  return [...new Map(jobs.map((job) => [job.id, job])).values()];
}
