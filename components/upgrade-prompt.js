"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { PRICING, TIERS, annualTotal, savingsPercent } from "@/lib/tiers";

// The one time an account is asked about paying.
//
// Timing follows components/feedback-prompt.js: once per browser session,
// after a delay, and only if the SERVER says to ask — tier, account age and
// the cooldown all live in app/api/upgrade-prompt/route.js.
//
// What it says is built from what this person has actually done. A prompt
// that can name the work it is talking about is worth several that cannot,
// and every number in it is read from their own account rather than invented.

const SESSION_KEY = "jobblast:upgrade-prompted";
const MIN_DELAY_MS = 180_000; // three minutes: long enough to have used it
const MAX_DELAY_MS = 360_000;

const randomDelay = () =>
  MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));

const euros = (n) => `€${n.toFixed(2)}`;

/** Their own numbers, as a sentence. Anything at zero is left out. */
function achievementLines({ screened, qualified, drafted, bestScore, resumeScore }) {
  const lines = [];
  if (screened) {
    lines.push(
      qualified
        ? `${screened} jobs screened, ${qualified} you qualify for`
        : `${screened} jobs screened against your resume`,
    );
  }
  if (drafted) lines.push(`${drafted} cover ${drafted === 1 ? "letter" : "letters"} drafted for you`);
  if (typeof bestScore === "number") lines.push(`Your best match so far scored ${bestScore}/100`);
  if (typeof resumeScore === "number") lines.push(`Your resume scores ${resumeScore}/100`);
  return lines;
}

function Dialog({ variant, achievements, onClose }) {
  const reduce = useReducedMotion();
  const lines = achievementLines(achievements);
  const pro = PRICING[TIERS.PRO];
  const upgrade = variant === "upgrade";

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <motion.div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-black/20"
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-xl p-1.5 text-muted transition hover:bg-accent-wash hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>

        <h2 id="upgrade-title" className="pr-8 font-display text-xl font-semibold">
          {upgrade ? "You have outgrown Free." : "You are on Pro, and it costs you nothing."}
        </h2>

        {lines.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-l-2 border-accent pl-4">
            {lines.map((line) => (
              <li key={line} className="text-sm leading-relaxed text-muted">
                {line}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 leading-relaxed text-muted">
          {upgrade ? (
            <>
              Free covers a look around. Pro removes the limits on screening,
              cover letters and tailored resumes, and gives you the application
              tracker and PDF export.
            </>
          ) : (
            <>
              You joined before paid plans started, so Pro is yours free —
              permanently, not for a trial period. Nothing will be charged and
              no card is stored.
            </>
          )}
        </p>

        <div className="mt-5 rounded-xl border border-line bg-paper p-4">
          <p className="flex items-baseline gap-2">
            <span className="text-sm text-muted line-through">{euros(pro.monthly)}</span>
            <span className="font-display text-2xl font-semibold tabular-nums">
              {euros(pro.annual)}
            </span>
            <span className="text-sm text-muted">/ month</span>
            <span className="ml-auto rounded-lg bg-accent-wash px-2 py-0.5 text-xs font-medium text-accent">
              −{savingsPercent(TIERS.PRO)}%
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {upgrade
              ? `Billed ${euros(annualTotal(TIERS.PRO))} yearly. Cancel whenever you like.`
              : `What Pro will cost — ${euros(annualTotal(TIERS.PRO))} a year. Yours at no charge.`}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition hover:text-ink"
          >
            {upgrade ? "Not now" : "Got it"}
          </button>
          <Link
            href="/pricing"
            onClick={onClose}
            className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition hover:bg-accent-hover"
          >
            {upgrade ? "See Pro" : "See what is included"}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export function UpgradePrompt() {
  const { status } = useSession();
  const [offer, setOffer] = useState(null);
  const scheduled = useRef(false);

  const close = useCallback(() => setOffer(null), []);

  useEffect(() => {
    if (status !== "authenticated" || scheduled.current) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    scheduled.current = true;

    let timer;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/upgrade-prompt");
        if (!res.ok) return;
        const body = await res.json();
        if (!body.show || cancelled) return;
        timer = setTimeout(() => {
          sessionStorage.setItem(SESSION_KEY, "1");
          // Recorded on show, so the week-long cooldown starts whether or not
          // they do anything with it.
          fetch("/api/upgrade-prompt", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ seen: true }),
          }).catch(() => {});
          setOffer(body);
        }, randomDelay());
      } catch {
        /* the prompt is optional; never surface a failure for it */
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status]);

  return (
    <AnimatePresence>
      {offer && (
        <Dialog
          variant={offer.variant}
          achievements={offer.achievements}
          onClose={close}
        />
      )}
    </AnimatePresence>
  );
}
