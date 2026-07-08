// Adzuna job search adapter (https://developer.adzuna.com — free tier).
// Requires ADZUNA_APP_ID and ADZUNA_APP_KEY in .env.local.

const COUNTRY = process.env.ADZUNA_COUNTRY || "us"; // e.g. us, gb, in, au

/**
 * @param {{ role: string, location?: string, limit?: number }} query
 * @returns {Promise<Array>} jobs in the normalized shape (see index.js)
 */
export async function searchAdzuna({ role, location = "", limit = 20 }) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Adzuna credentials missing — set ADZUNA_APP_ID and ADZUNA_APP_KEY");
  }

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: role,
    where: location,
    results_per_page: String(limit),
    "content-type": "application/json",
  });

  const url = `https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search/1?${params}`;
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
  }));
}
