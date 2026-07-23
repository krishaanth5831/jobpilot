// Per-key rate limiting for public, unauthenticated endpoints. On Vercel
// the counter lives in Redis (INCR + EXPIRE on a namespaced key) so every
// serverless instance shares one budget; locally a plain in-memory map is
// enough. Fail-open on Redis errors: a broken counter shouldn't take the
// public page down with it.

import { redisConfig, redisCommand } from "./redis";

const memory = new Map(); // key -> { count, resetAt }

/** True when this request is within budget, false when over the limit. */
export async function withinRateLimit(key, { limit, windowSeconds }) {
  if (redisConfig()) {
    try {
      const redisKey = `jobpilot:rl:${key}`;
      const count = await redisCommand(["INCR", redisKey]);
      // First hit in this window starts the clock.
      if (count === 1) await redisCommand(["EXPIRE", redisKey, String(windowSeconds)]);
      return count <= limit;
    } catch (err) {
      console.error("rate limit check failed (allowing request):", err);
      return true;
    }
  }

  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/** Best-effort client IP: Vercel sets x-forwarded-for, first hop is the client. */
export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
