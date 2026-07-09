// JSearch adapter (https://rapidapi.com — search "JSearch") — aggregates
// Google for Jobs results, which include LinkedIn, Indeed, Glassdoor and
// ZipRecruiter postings. Those boards have no public APIs of their own, so
// this is the legitimate way to surface them. Free tier; needs a RapidAPI key.

import { ConfigError } from "@/lib/claude";
import { cleanDescription } from "./clean.js";

export async function searchJSearch({ role, location = "", limit = 10 }) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    throw new ConfigError(
      "LinkedIn/Indeed/Glassdoor listings need a RapidAPI key — sign up free at https://rapidapi.com, subscribe to the JSearch API, add RAPIDAPI_KEY to .env.local, then restart the dev server"
    );
  }

  const params = new URLSearchParams({
    query: location ? `${role} in ${location}` : role,
    page: "1",
    num_pages: "1",
  });
  const res = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": "jsearch.p.rapidapi.com",
    },
  });
  if (!res.ok) throw new Error(`JSearch request failed: ${res.status}`);

  const data = await res.json();
  return (data.data || []).slice(0, limit).map((job) => ({
    id: `jsearch:${job.job_id}`,
    // Tag each job with where it was actually published (linkedin, indeed,
    // glassdoor…) so the source filter shows the real boards.
    source: (job.job_publisher || "jsearch").toLowerCase(),
    title: job.job_title,
    company: job.employer_name ?? "Unknown",
    location:
      [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") +
      (job.job_is_remote ? " (Remote)" : ""),
    description: cleanDescription(job.job_description),
    url: job.job_apply_link,
    salary: job.job_min_salary
      ? `${job.job_min_salary}–${job.job_max_salary ?? "?"}`
      : null,
    posted_at: job.job_posted_at_datetime_utc ?? null,
  }));
}
