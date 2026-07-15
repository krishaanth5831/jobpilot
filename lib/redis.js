// Minimal Upstash Redis REST client (plain fetch, no SDK dependency).
// jobpilot only needs Redis on serverless hosts like Vercel, where the
// filesystem is read-only so lowdb's JSON file can't persist anything.
// Both env-var spellings are accepted: UPSTASH_REDIS_REST_* (Upstash's own
// integration) and KV_REST_API_* (Vercel Marketplace Redis stores).

export function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/**
 * Run a single Redis command, e.g. redisCommand(["GET", "jobpilot:db"]).
 * @returns {Promise<any>} the command's result field
 */
export async function redisCommand(command) {
  const config = redisConfig();
  if (!config) throw new Error("Redis is not configured (no REST URL/token in the environment)");
  const res = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(`Redis ${command[0]} failed: ${body.error ?? `HTTP ${res.status}`}`);
  }
  return body.result;
}
