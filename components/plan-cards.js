"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import {
  PLANS,
  PRICING,
  TIERS,
  annualTotal,
  cellFor,
  labelFor,
  savingsPercent,
} from "@/lib/tiers";

// Plan presentation, shared by /pricing and the pricing band on the landing
// page so the two can never quote different numbers.
//
// Every figure here is read from lib/tiers.js — the same table the server
// enforces against. Nothing on this page is typed in twice.

/** EUR, formatted by hand rather than through Intl: a locale difference
 *  between server and client render would be a hydration mismatch. */
const euros = (n) => `€${n.toFixed(2)}`;

/**
 * What a plan costs at the chosen billing interval.
 * `annual` is the per-MONTH price when billed annually, which is the number
 * the card shows big; the yearly charge goes in the small print under it.
 */
function priceFor(tier, interval) {
  if (tier === TIERS.FREE) return { amount: "€0", cadence: "forever", note: null };
  const p = PRICING[tier];
  if (interval === "annual") {
    return {
      amount: euros(p.annual),
      cadence: "/ month",
      note: `billed ${euros(annualTotal(tier))} yearly`,
    };
  }
  return { amount: euros(p.monthly), cadence: "/ month", note: "billed monthly" };
}

/** The largest annual saving across the paid plans, for the toggle badge. */
const bestSaving = () =>
  Math.max(savingsPercent(TIERS.PRO), savingsPercent(TIERS.UNLIMITED));

/** Annual / monthly switch. Annual is the default everywhere it is used. */
export function BillingToggle({ interval, onChange, className = "" }) {
  const options = [
    { id: "annual", label: "Annual" },
    { id: "monthly", label: "Monthly" },
  ];
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        role="radiogroup"
        aria-label="Billing interval"
        className="inline-flex rounded-xl border border-line bg-surface p-1"
      >
        {options.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={interval === id}
            onClick={() => onChange(id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              interval === id
                ? "bg-accent text-accent-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="text-sm font-medium text-accent">
        Save up to {bestSaving()}%
      </span>
    </div>
  );
}

/**
 * One full plan card, for /pricing.
 *
 * `live` is false until Stripe is configured AND the paywall flag is on. Until
 * then every plan is genuinely free, so the card says so and the button signs
 * people up rather than pretending to take a payment.
 */
export function PlanCard({ tier, interval, live = false, featured = false }) {
  const plan = PLANS[tier];
  const { amount, cadence, note } = priceFor(tier, interval);
  const paid = tier !== TIERS.FREE;

  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border bg-surface p-7 ${
        featured ? "border-accent" : "border-line"
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-7 rounded-xl bg-accent px-3 py-1 text-xs font-medium text-accent-ink">
          Most popular
        </span>
      )}

      <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted">{plan.blurb}</p>

      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-semibold tabular-nums">{amount}</span>
        <span className="text-sm text-muted">{cadence}</span>
      </p>
      <p className="mt-1 h-5 text-xs text-muted">{note}</p>

      {/* Every card gets this row, whether or not it has something to say in
          it, so the three buttons below stay on one line across the grid. */}
      {paid && !live ? (
        <p className="mt-4 rounded-xl bg-accent-wash px-3 py-2 text-xs font-medium text-accent">
          Free while jobblast is in early access
        </p>
      ) : !paid ? (
        <p className="mt-4 rounded-xl border border-line px-3 py-2 text-xs font-medium text-muted">
          No card needed, ever
        </p>
      ) : (
        <p className="mt-4 px-3 py-2 text-xs" aria-hidden="true">
          &nbsp;
        </p>
      )}

      <Link
        href="/upload"
        className={`mt-6 inline-flex items-center justify-center rounded-xl px-5 py-3 font-medium transition active:translate-y-px ${
          featured
            ? "bg-accent text-accent-ink hover:bg-accent-hover"
            : "border border-line text-ink hover:border-ink/30"
        }`}
      >
        Get started free
      </Link>

      <ul className="mt-7 flex flex-col gap-3 border-t border-line pt-6">
        {plan.highlights.map((name) => {
          const value = cellFor(tier, name);
          if (!value) return null;
          return (
            <li key={name} className="flex items-start gap-2.5 text-sm">
              <Check
                size={16}
                strokeWidth={2}
                className="mt-0.5 shrink-0 text-accent"
                aria-hidden="true"
              />
              <span className="text-muted">
                <span className="text-ink">{labelFor(name)}</span>
                {value !== "Included" && (
                  <span className="tabular-nums"> — {value}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The compact version that sits on a photograph on the landing page. Same
 * numbers, no feature list — the full table is one click away at /pricing.
 *
 * Smoked-glass plate rather than text straight on the photo, matching the
 * other bands: the contrast guarantee has to hold whatever photo is dropped in.
 */
export function PlanSummary({ tier, interval, featured = false }) {
  const plan = PLANS[tier];
  const { amount, cadence, note } = priceFor(tier, interval);

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border bg-black/55 p-7 backdrop-blur-md ${
        featured ? "border-on-photo/35" : "border-on-photo/15"
      }`}
    >
      <h3 className="font-display text-lg font-semibold text-on-photo">{plan.name}</h3>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold tabular-nums text-on-photo">
          {amount}
        </span>
        <span className="text-sm text-on-photo-dim">{cadence}</span>
      </p>
      <p className="mt-1 h-5 text-xs text-on-photo-dim">{note}</p>
      <p className="mt-4 text-sm leading-relaxed text-on-photo-dim">{plan.blurb}</p>
    </div>
  );
}
