// Adzuna job search adapter (https://developer.adzuna.com — free tier).
// Uses the account's own ADZUNA_APP_ID/ADZUNA_APP_KEY, falling back to the
// server's shared keys (see getAdzunaCreds) so new accounts work out of the box.

import { ConfigError } from "@/lib/claude";
import { getAdzunaCreds } from "@/lib/api-keys";

/**
 * @param {{ role: string, country?: string|null, where?: string, limit?: number }} query
 * @returns {Promise<Array>} jobs in the normalized shape (see index.js)
 *
 * Adzuna's endpoint is per-country. `country` is the 2-letter endpoint to
 * hit (falling back to the user's default); `where` narrows within it (used
 * for city searches — left empty for a whole-country/continent search so we
 * don't over-constrain). The caller does the final location filtering; each
 * job is tagged with the country it was queried under. 12 per search keeps
 * Claude screening costs down — every stored job is one match call.
 */
export async function searchAdzuna({ role, country = null, where = "", limit = 12 }) {
  // The user's own credentials, falling back to the shared server keys (read
  // per call, so a Settings change takes effect immediately).
  const { appId, appKey, country: defaultCountry } = await getAdzunaCreds();
  if (!appId || !appKey) {
    throw new ConfigError(
      "Adzuna credentials missing — add ADZUNA_APP_ID and ADZUNA_APP_KEY on the Settings page (free at https://developer.adzuna.com)"
    );
  }

  const useCountry = country || defaultCountry;
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: role,
    where,
    results_per_page: String(limit),
    "content-type": "application/json",
  });

  const url = `https://api.adzuna.com/v1/api/jobs/${useCountry}/search/1?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Adzuna request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return (data.results || []).map((job) => ({
    id: `adzuna:${job.id}`,
    source: "adzuna",
    title: job.title,
    company: job.company?.display_name ?? "Unknown",
    location: job.location?.display_name ?? "",
    description: job.description ?? "",
    url: job.redirect_url,
    salary: job.salary_min ? `${job.salary_min}–${job.salary_max ?? "?"}` : null,
    posted_at: job.created ?? null,
    queriedCountry: useCountry,
  }));
}
