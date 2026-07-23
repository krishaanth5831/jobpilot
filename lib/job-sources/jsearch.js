// JSearch adapter (https://rapidapi.com — search "JSearch") — aggregates
// Google for Jobs results, which include LinkedIn, Indeed, Glassdoor and
// ZipRecruiter postings. Those boards have no public APIs of their own, so
// this is the legitimate way to surface them. Free tier; needs a RapidAPI key.

import { ConfigError } from "@/lib/claude";
import { getRapidApiKey } from "@/lib/api-keys";
import { cleanDescription } from "./clean.js";
import { countryName } from "./location.js";

// `country` (a 2-letter code) scopes the search server-side; `where` is a
// location hint added to the query text (used for city/unknown searches).
// The caller (index.js) resolves both from what the user typed and does the
// final location filtering — this adapter just fetches and tags each job with
// the country it was queried under.
export async function searchJSearch({ role, country = null, where = "", limit = 12 }) {
  const key = await getRapidApiKey();
  if (!key) {
    throw new ConfigError(
      "LinkedIn/Indeed/Glassdoor listings need a RapidAPI key — sign up free at https://rapidapi.com, subscribe to the JSearch API, and add the key on the Settings page"
    );
  }

  // v5 of the API renamed the endpoint to /search-v2 and nests results under
  // data.jobs (cursor pagination; one page is all we need).
  const params = new URLSearchParams({
    query: where ? `${role} in ${where}` : role,
    ...(country ? { country } : {}),
  });
  const res = await fetch(`https://jsearch.p.rapidapi.com/search-v2?${params}`, {
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": "jsearch.p.rapidapi.com",
    },
  });
  if (!res.ok) throw new Error(`JSearch request failed: ${res.status}`);

  const data = await res.json();
  // Tag jobs with the recognizable board they were published on; the long
  // tail of one-off publishers ("careers at X") would clutter the source
  // filter, so anything else is just "jsearch".
  const KNOWN_BOARDS = ["linkedin", "indeed", "glassdoor", "ziprecruiter", "monster", "dice", "wellfound"];
  const publisherTag = (publisher) => {
    const p = (publisher ?? "").toLowerCase();
    return KNOWN_BOARDS.find((b) => p.includes(b)) ?? "jsearch";
  };
  const jobs = (data.data?.jobs || []).map((job) => ({
    id: `jsearch:${job.job_id}`,
    source: publisherTag(job.job_publisher),
    title: job.job_title,
    company: job.employer_name ?? "Unknown",
    // Spell the country out ("US" → "united states") so the location
    // matcher can recognize country-scoped remote listings.
    location:
      [job.job_city, job.job_state, countryName(job.job_country) ?? job.job_country]
        .filter(Boolean)
        .join(", ") + (job.job_is_remote ? " (Remote)" : ""),
    description: cleanDescription(job.job_description),
    url: job.job_apply_link,
    salary: job.job_min_salary
      ? `${job.job_min_salary}–${job.job_max_salary ?? "?"}`
      : null,
    posted_at: job.job_posted_at_datetime_utc ?? null,
    queriedCountry: country,
  }));

  return jobs.slice(0, limit);
}
