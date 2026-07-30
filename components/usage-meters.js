"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FEATURE_LABELS, PERIODS, PLANS } from "@/lib/tiers";

// "Your plan" on Settings: the tier this account is on, and where it stands
// against every limit.
//
// The numbers come from /api/usage, which derives them from the same table the
// server enforces against. While the paywall flag is off the counts are real
// but nothing is being blocked, and the panel says so — a meter that looks
// like a threat when nothing is actually enforced would be a lie.

const PERIOD_WORD = {
  [PERIODS.DAY]: "today",
  [PERIODS.MONTH]: "this month",
  [PERIODS.LIFE]: "total",
  [PERIODS.STOCK]: "saved",
};

function Meter({ label, used, limit, period }) {
  const unlimited = limit === null;
  const locked = !unlimited && limit === 0;
  const pct = unlimited || locked ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const full = !unlimited && !locked && used >= limit;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className={locked ? "text-neutral-400 dark:text-neutral-600" : ""}>{label}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-neutral-500">
          {unlimited
            ? "Unlimited"
            : locked
              ? "Not on your plan"
              : `${used} / ${limit} ${PERIOD_WORD[period] ?? ""}`.trim()}
        </span>
      </div>
      {!unlimited && !locked && (
        <div className="h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className={`h-full rounded-full ${full ? "bg-accent" : "bg-neutral-400 dark:bg-neutral-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function UsageMeters() {
  const [usage, setUsage] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/usage")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then(setUsage)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  const plan = usage ? PLANS[usage.tier] : null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Your plan</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            What you have used against what your plan allows.
          </p>
        </div>
        <Link
          href="/pricing"
          className="font-mono text-xs text-neutral-500 hover:underline"
        >
          Compare plans
        </Link>
      </div>

      {!usage ? (
        <p className="mt-4 text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="mt-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-accent-wash px-3 py-1 text-sm font-medium text-accent">
              {plan?.name ?? usage.tier}
            </span>
            {usage.grandfathered && (
              <span className="text-sm text-neutral-500">
                Early access account — Pro, free, permanently.
              </span>
            )}
          </div>

          {!usage.enforced && (
            <p className="mt-4 text-sm leading-relaxed text-neutral-500">
              Limits are not being applied yet. Everything below is being
              counted so the plans can be sized against real usage, but nothing
              is blocked and no feature will stop working.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3.5">
            {Object.entries(usage.features).map(([feature, standing]) => (
              <Meter
                key={feature}
                label={FEATURE_LABELS[feature] ?? feature}
                used={standing.used}
                limit={standing.limit}
                period={standing.period}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
