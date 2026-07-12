// Adzuna job search adapter (https://developer.adzuna.com — free tier).
// Requires ADZUNA_APP_ID and ADZUNA_APP_KEY in .env.local.

import { ConfigError } from "@/lib/claude";
import { inferCountry, matchesLocation } from "./location.js";

/**
 * @param {{ role: string, location?: string, limit?: number }} query
 * @returns {Promise<Array>} jobs in the normalized shape (see index.js)
 */
// 10 per search keeps Claude screening costs down — every stored job is
// one match call.
export async function searchAdzuna({ role, location = "", limit = 10 }) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  // Read per call (not at module load) so the settings page can change
  // credentials at runtime.
  const defaultCountry = process.env.ADZUNA_COUNTRY || "us"; // e.g. us, gb, in, au
  if (!appId || !appKey) {
    throw new ConfigError(
      "Adzuna credentials missing — add ADZUNA_APP_ID and ADZUNA_APP_KEY on the Settings page (free at https://developer.adzuna.com)"
    );
  }

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: role,
    where: location,
    results_per_page: String(limit),
    "content-type": "application/json",
  });

  // Adzuna's endpoint is per-country, so "Paris" must hit /jobs/fr/ — the
  // default country would return jobs from the wrong side of the world.
  const country = inferCountry(location)?.code ?? defaultCountry;
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Adzuna request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const jobs = (data.results || []).map((job) => ({
    id: `adzuna:${job.id}`,
    source: "adzuna",
    title: job.title,
    company: job.company?.display_name ?? "Unknown",
    location: job.location?.display_name ?? "",
    description: job.description ?? "",
    url: job.redirect_url,
    salary: job.salary_min ? `${job.salary_min}–${job.salary_max ?? "?"}` : null,
    posted_at: job.created ?? null,
  }));

  // If the location didn't map to a country endpoint, this search ran
  // against the default country — filter honestly rather than returning
  // random places (an empty result beats a wrong one).
  if (location && !inferCountry(location)) {
    return jobs.filter((j) => matchesLocation(j.location, location));
  }
  return jobs;
}
