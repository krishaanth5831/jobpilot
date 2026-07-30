"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { PhotoBand } from "@/components/photo-band";
import { SiteFooter } from "@/components/site-footer";
import { BillingToggle, PlanCard } from "@/components/plan-cards";
import { Disclosure } from "@/components/motion-primitives/disclosure";
import {
  COMPARISON_ROWS,
  NEVER_GATED_LABELS,
  PLANS,
  TIERS,
  TIER_ORDER,
  cellFor,
  labelFor,
} from "@/lib/tiers";

// The pricing page. Every number on it comes from lib/tiers.js, which is the
// same table lib/entitlements.js enforces against — so a limit shown here is
// by construction the limit the server applies.
//
// `live` is false until BOTH a Stripe key is configured and PAYWALL_ENABLED is
// on. Until then the plans are real but nothing is charged, and the page says
// exactly that rather than showing a buy button that cannot take money.

const faqs = [
  {
    q: "What does early access mean for the price?",
    a: "Every plan is free right now — there is no card field anywhere in jobblast. Accounts created before paid plans start keep Pro free, permanently. That is not a promotion with an end date; it is how the account is marked, and it does not expire.",
  },
  {
    q: "Is the ATS resume score really free on every plan?",
    a: "Yes, and it is built so it cannot change. The score is the one thing that has no entry in the plan table at all, so there is nothing for a limit to be attached to. You can run it as often as you like on Free, forever, without an account for a single check at /check.",
  },
  {
    q: "What counts as an auto-drafted application?",
    a: "A job that scored above the qualification line and had a cover letter written for it automatically, into your review queue. jobblast never submits anything on your behalf, so you still read and send every one yourself.",
  },
  {
    q: "What happens to my work if I stay on Free?",
    a: "Nothing is deleted. Free keeps one saved resume version and the full ATS score; the limits apply to how much new AI work you can generate each month, not to what you have already made.",
  },
];

function ComparisonTable() {
  return (
    // `relative` is load-bearing: the sr-only labels in the cells are
    // absolutely positioned, and without a positioned ancestor here their
    // containing block is the document root, so they escape this scroller and
    // widen the whole page instead of being clipped by it.
    <div className="relative -mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">
          What each plan includes, feature by feature
        </caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="py-4 pr-4 text-left font-medium text-muted">
              Feature
            </th>
            {TIER_ORDER.map((tier) => (
              <th
                key={tier}
                scope="col"
                className="w-[22%] px-3 py-4 text-left font-display text-base font-semibold"
              >
                {PLANS[tier].name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((name) => (
            <tr key={name} className="border-b border-line">
              <th scope="row" className="py-3.5 pr-4 text-left font-normal text-ink">
                {labelFor(name)}
              </th>
              {TIER_ORDER.map((tier) => {
                const value = cellFor(tier, name);
                return (
                  <td key={tier} className="px-3 py-3.5 text-muted">
                    {value === null ? (
                      <>
                        <Minus
                          size={14}
                          strokeWidth={2}
                          className="text-line"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Not included</span>
                      </>
                    ) : value === "Included" ? (
                      <>
                        <Check
                          size={16}
                          strokeWidth={2}
                          className="text-accent"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Included</span>
                      </>
                    ) : (
                      <span className="tabular-nums">{value}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}

          {/* Never gated, on any plan. Rendered from NEVER_GATED_LABELS rather
              than hardcoded, so it stays in step with lib/tiers.js. */}
          {Object.entries(NEVER_GATED_LABELS).map(([name, label]) => (
            <tr key={name} className="border-b border-line bg-accent-wash/50">
              <th scope="row" className="py-3.5 pr-4 text-left font-medium text-ink">
                {label}
              </th>
              {TIER_ORDER.map((tier) => (
                <td key={tier} className="px-3 py-3.5 font-medium text-accent">
                  Always free
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PricingClient({ live = false }) {
  // Not named `interval`/`setInterval` — that shadows the global timer function.
  const [billing, setBilling] = useState("annual");

  return (
    <div className="flex-1">
      {/* Header over the same photograph the landing page's pricing band uses,
          so arriving here from that band feels like the same room. */}
      <PhotoBand photo="pricing.jpg" alt="" priority scrim="pool">
        <div className="mx-auto max-w-3xl px-6 pb-20 pt-36 text-center">
          {/* NOT "pay for the search": nothing here is metered per search, and
              a headline that reads that way invites exactly the wrong
              question. One flat price, however much of it you use. */}
          <h1 className="on-photo-text font-display text-4xl font-semibold leading-[1.06] sm:text-5xl lg:text-6xl">
            <span className="text-on-photo-dim">One price.</span>
            <br />
            <span className="text-on-photo">The whole search.</span>
          </h1>
          <p className="on-photo-text mx-auto mt-6 max-w-[48ch] text-lg leading-relaxed text-on-photo-dim">
            Nothing is charged per search, per application, or per resume. The
            resume score stays free on every plan, and every plan is free while
            jobblast is in early access.
          </p>
        </div>
      </PhotoBand>

      {/* Plans */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex justify-center">
          <BillingToggle interval={billing} onChange={setBilling} />
        </div>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          {TIER_ORDER.map((tier) => (
            <PlanCard
              key={tier}
              tier={tier}
              interval={billing}
              live={live}
              featured={tier === TIERS.PRO}
            />
          ))}
        </div>

        {!live && (
          <p className="mx-auto mt-10 max-w-[60ch] text-center text-sm leading-relaxed text-muted">
            Nothing is charged today. There is no card field anywhere in
            jobblast yet, and accounts created before paid plans start keep Pro
            free, permanently.
          </p>
        )}
      </section>

      {/* The guarantee, stated on its own rather than buried in a table row */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 py-16 text-center sm:flex-row sm:text-left">
          <ShieldCheck
            size={32}
            strokeWidth={1.5}
            className="shrink-0 text-accent"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-display text-xl font-semibold">
              The resume score is never behind a plan.
            </h2>
            <p className="mt-2 leading-relaxed text-muted">
              It is the thing that proves jobblast is worth anything before you
              have paid, so it takes no plan, counts against no limit, and runs
              as often as you want.{" "}
              <Link href="/check" className="text-accent hover:underline">
                Try it without an account
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Full comparison */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">
          Everything, side by side
        </h2>
        <div className="mt-10">
          <ComparisonTable />
        </div>
        <p className="mt-6 text-sm text-muted">
          Prices in euro. Annual plans are billed once a year at the yearly
          total shown on each card.
        </p>
      </section>

      {/* Questions specific to money */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">
          Questions about plans
        </h2>
        <div className="mt-8">
          {faqs.map(({ q, a }) => (
            <Disclosure key={q} title={<span className="pr-4">{q}</span>}>
              <p className="max-w-[62ch] text-sm leading-relaxed text-muted">{a}</p>
            </Disclosure>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
