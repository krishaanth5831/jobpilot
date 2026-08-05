// Tier enforcement. One check, server-side, that every gated route calls.
//
// THE GATE IS OFF BY DEFAULT. With PAYWALL_ENABLED unset, every account is
// allowed everything — but the counters still increment and every would-have-
// blocked moment is still logged. That is the point: the measurement has to
// exist before the gate does, or there is no way to know what a gate would
// cost in lost usage.
//
// Nothing here trusts the client. Callers pass a userId resolved from the
// session (lib/user-data.js), never from a request body.

import { NextResponse } from "next/server";
import { getDb, emptyUserData } from "./db";
import { isOwnerAccount } from "./api-keys";
import {
  CAPABILITIES,
  FEATURES,
  PERIODS,
  PLANS,
  TIERS,
  UNLIMITED,
  assertNeverGated,
  hasCapability,
  isCapability,
  isFeature,
  limitFor,
  upgradeTierFor,
} from "./tiers";

/** The flag. Off unless explicitly turned on — "true"/"1" both count. */
export function paywallEnabled() {
  const raw = (process.env.PAYWALL_ENABLED ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/** Global kill switch for auto-apply, independent of tier or paywall. */
export function autoApplyDisabled() {
  const raw = (process.env.AUTO_APPLY_DISABLED ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * The owner's own account, which no limit in this file applies to.
 *
 * This is not a tier and not a plan — it is the person whose Anthropic key,
 * Redis instance and hosting bill this whole thing runs on. Metering them
 * would be charging them an allowance against their own credits, and capping
 * them would cap the account that has to be able to exercise every path in
 * the product to see whether it works.
 *
 * Deliberately derived from OWNER_EMAIL rather than stored on the bucket, so
 * it survives a database reset and cannot be granted by editing data. Exactly
 * one account matches, on any instance — see isOwnerAccount in lib/api-keys.js.
 */
export const isUncapped = (userId) => Boolean(userId) && isOwnerAccount(null, userId);

/**
 * The tier an account is actually on.
 *
 * The owner is Unlimited, always. Otherwise a live Stripe subscription wins,
 * then a grandfathered account — one that signed up before the paywall
 * flipped — keeps Pro permanently and free. Everyone else is Free.
 */
export function effectiveTier(bucket, userId = null) {
  if (isUncapped(userId)) return TIERS.UNLIMITED;
  const sub = bucket?.subscription;
  if (sub?.tier && ACTIVE_SUB_STATUSES.has(sub.status)) return sub.tier;
  if (bucket?.grandfathered) return TIERS.PRO;
  return TIERS.FREE;
}

// Stripe statuses that still entitle the account. `past_due` deliberately
// still counts: dunning should not lock someone out mid-retry — the
// subscription.deleted webhook is what actually ends access.
const ACTIVE_SUB_STATUSES = new Set(["active", "trialing", "past_due"]);

const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/**
 * The start of the account's current monthly period, as YYYY-MM-DD.
 *
 * Monthly counters reset on the billing anniversary, not the 1st. An account
 * anchored on the 31st clamps to the last day of shorter months, so February
 * does not silently skip a reset.
 */
function monthPeriodStart(anchorISO, now = new Date()) {
  const anchor = new Date(anchorISO);
  const anchorDay = Number.isNaN(anchor.getTime()) ? 1 : anchor.getUTCDate();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  let start = Date.UTC(y, m, Math.min(anchorDay, daysInMonth(y, m)));
  if (now.getTime() < start) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    start = Date.UTC(y, m, Math.min(anchorDay, daysInMonth(y, m)));
  }
  return new Date(start).toISOString().slice(0, 10);
}

/** The key a counter is stored under for the current period. */
function periodKey(period, anchorISO, now = new Date()) {
  if (period === PERIODS.DAY) return now.toISOString().slice(0, 10);
  if (period === PERIODS.MONTH) return monthPeriodStart(anchorISO, now);
  return "life";
}

/**
 * How many resume versions the account currently holds. This is a stock, not
 * a flow: deleting a version frees the slot, so it is counted live from the
 * bucket rather than from an ever-increasing counter.
 */
function resumeVersionCount(bucket) {
  return (bucket?.builtResume ? 1 : 0) + Object.keys(bucket?.tailoredResumes ?? {}).length;
}

function usedFor(bucket, feature, rule, now) {
  if (rule.period === PERIODS.STOCK) {
    return feature === FEATURES.RESUME_VERSION ? resumeVersionCount(bucket) : 0;
  }
  const key = periodKey(rule.period, bucket?.billingAnchorAt, now);
  const entry = bucket?.usage?.[feature];
  // A counter from an expired period reads as zero. Lazily resetting on read
  // means no cron job and no migration when a period rolls over.
  return entry && entry.key === key ? entry.n : 0;
}

/**
 * Can this account use this feature right now?
 *
 * @returns {{allowed, used, limit, tier, upgradeRequired, feature, period,
 *            remaining, gateEnforced, wouldBlock}}
 *
 * `wouldBlock` is the honest verdict against the account's tier.
 * `allowed` is what the caller must obey — identical to !wouldBlock once the
 * paywall is on, and always true while it is off.
 */
export async function canUseFeature(userId, feature, opts = {}) {
  const db = await getDb();
  return verdictFor(db.data.users?.[userId] ?? null, feature, { userId, ...opts });
}

/**
 * The same verdict, against a bucket that has already been read.
 *
 * Pure — no database access. usageSummary answers for every feature at once,
 * and the whole database is a single JSON document in a single Redis key, so
 * going back to getDb() per feature would be one full re-read each. This is
 * what keeps the meters at one read instead of nine.
 */
function verdictFor(
  bucket,
  feature,
  { now = new Date(), enforced = paywallEnabled(), userId = null } = {},
) {
  assertNeverGated(feature);

  const tier = effectiveTier(bucket, userId);
  const base = { feature, tier, gateEnforced: enforced };

  // The owner is exempt from the table entirely, not merely placed on its top
  // row. Unlimited still carries a 300/month auto-apply ceiling — fair use, to
  // stop one runaway account draining the Claude budget — and that reason does
  // not apply to the account paying the Claude bill. Usage is still counted,
  // because the meters are how the owner sees what the product costs.
  if (isUncapped(userId)) {
    const rule = isFeature(feature) ? limitFor(tier, feature) : null;
    return {
      ...base,
      allowed: true,
      wouldBlock: false,
      used: rule ? usedFor(bucket, feature, rule, now) : null,
      limit: null,
      remaining: null,
      period: rule?.period ?? null,
      upgradeRequired: null,
    };
  }

  if (isCapability(feature)) {
    const has = hasCapability(tier, feature);
    return {
      ...base,
      allowed: enforced ? has : true,
      wouldBlock: !has,
      used: null,
      limit: null,
      remaining: null,
      period: null,
      upgradeRequired: has ? null : upgradeTierFor(tier, feature),
    };
  }

  if (!isFeature(feature)) {
    throw new Error(`Unknown feature "${feature}" — add it to FEATURES in lib/tiers.js`);
  }

  const rule = limitFor(tier, feature);
  const used = usedFor(bucket, feature, rule, now);
  const wouldBlock = used >= rule.limit;

  return {
    ...base,
    allowed: enforced ? !wouldBlock : true,
    wouldBlock,
    used,
    limit: rule.limit === UNLIMITED ? null : rule.limit,
    remaining: rule.limit === UNLIMITED ? null : Math.max(0, rule.limit - used),
    period: rule.period,
    upgradeRequired: wouldBlock ? upgradeTierFor(tier, feature) : null,
  };
}

/**
 * Increment a feature's counter. Call AFTER the work succeeds, so a failed
 * Claude call does not spend someone's quota.
 *
 * Stock features have no counter — their usage is the live count.
 */
export async function recordUse(userId, feature, { now = new Date(), times = 1 } = {}) {
  assertNeverGated(feature);
  if (!isFeature(feature) || times <= 0) return;

  const db = await getDb();
  const bucket = (db.data.users[userId] ??= emptyUserData());
  const tier = effectiveTier(bucket, userId);
  const rule = limitFor(tier, feature);
  if (!rule || rule.period === PERIODS.STOCK) return;

  const key = periodKey(rule.period, bucket.billingAnchorAt, now);
  const entry = bucket.usage?.[feature];
  bucket.usage ??= {};
  bucket.usage[feature] = { key, n: (entry && entry.key === key ? entry.n : 0) + times };
  await db.write();
}

/**
 * How many of `wanted` uses an account may make right now.
 *
 * Batch routes (screen 20 jobs, auto-apply to 6) would otherwise have to
 * choose between blocking the whole request when one unit is over budget, or
 * ignoring the limit entirely. Neither is right: this trims the batch to what
 * fits, so a Free account with 2 auto-applies left gets 2 rather than 0 or 6.
 *
 * Logs a single limit-hit when the batch is trimmed — not one per unit, which
 * would drown the buying signal in duplicates.
 */
export async function takeBudget(userId, feature, wanted, opts = {}) {
  const verdict = await canUseFeature(userId, feature, opts);
  const unlimited = verdict.limit === null;
  const short = !unlimited && wanted > verdict.remaining;

  if (short) await logLimitHit(userId, verdict, opts);

  // With the gate off nothing is trimmed — the point is to measure demand,
  // which means letting it happen and writing down that it would have been cut.
  const granted =
    unlimited || !verdict.gateEnforced ? wanted : Math.max(0, verdict.remaining);
  return { granted, verdict, trimmed: short };
}

// The whole database is one JSON document in one Redis key, so an unbounded
// event log would be re-read and re-written on every single request. The raw
// log is therefore a capped recent sample, while `limitHitTotals` keeps the
// complete counts — the number that matters for "how many people hit this"
// survives even after the sample has rolled over.
const LIMIT_HIT_LOG_MAX = 2000;

/**
 * Record a would-have-blocked moment. Called whether or not the gate is on —
 * with the gate off this is the entire point of the exercise.
 */
export async function logLimitHit(userId, verdict, { now = new Date() } = {}) {
  const db = await getDb();
  db.data.limitHits ??= [];
  db.data.limitHitTotals ??= {};

  db.data.limitHits.push({
    at: now.toISOString(),
    userId,
    feature: verdict.feature,
    tier: verdict.tier,
    used: verdict.used,
    limit: verdict.limit,
    period: verdict.period,
    upgradeRequired: verdict.upgradeRequired,
    // False here means the user was NOT actually blocked — they got the
    // feature anyway and this row is pure signal.
    enforced: verdict.gateEnforced,
  });
  if (db.data.limitHits.length > LIMIT_HIT_LOG_MAX) {
    db.data.limitHits = db.data.limitHits.slice(-LIMIT_HIT_LOG_MAX);
  }

  const totals = (db.data.limitHitTotals[verdict.feature] ??= {});
  totals[verdict.tier] = (totals[verdict.tier] ?? 0) + 1;

  await db.write();
}

/**
 * The one call a route makes. Returns null when the request may proceed, or a
 * 402 NextResponse when it may not.
 *
 * Logs the limit-hit either way, so turning the gate on changes what users
 * experience but not what gets measured.
 */
export async function enforce(userId, feature, opts = {}) {
  const verdict = await canUseFeature(userId, feature, opts);
  if (verdict.wouldBlock) await logLimitHit(userId, verdict, opts);
  return verdict.allowed ? null : upgradeResponse(verdict);
}

/**
 * 402 Payment Required with enough structure for the UI to name the exact
 * feature that ran out — the spec calls for that rather than a generic modal.
 */
function upgradeResponse(verdict) {
  const plan = PLANS[verdict.upgradeRequired];
  return NextResponse.json(
    {
      error: "upgrade_required",
      upgrade: {
        feature: verdict.feature,
        tier: verdict.tier,
        used: verdict.used,
        limit: verdict.limit,
        period: verdict.period,
        requiredTier: verdict.upgradeRequired,
        requiredTierName: plan?.name ?? null,
      },
    },
    { status: 402 },
  );
}

/**
 * Every feature's current standing, for the in-app usage meters.
 *
 * One database read for the whole answer — see verdictFor.
 */
export async function usageSummary(userId, opts = {}) {
  const db = await getDb();
  const bucket = db.data.users?.[userId] ?? null;
  const enforced = paywallEnabled();
  const tier = effectiveTier(bucket, userId);

  const features = {};
  for (const feature of Object.values(FEATURES)) {
    const v = verdictFor(bucket, feature, { ...opts, enforced, userId });
    features[feature] = {
      used: v.used,
      limit: v.limit,
      remaining: v.remaining,
      period: v.period,
    };
  }

  const capabilities = {};
  for (const capability of Object.values(CAPABILITIES)) {
    capabilities[capability] = hasCapability(tier, capability);
  }

  return {
    tier,
    grandfathered: Boolean(bucket?.grandfathered),
    // False means the limits below are being measured but not applied.
    enforced,
    features,
    capabilities,
  };
}
