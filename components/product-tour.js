"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";

// A walkthrough of the dock, shown once, right after the questionnaire.
//
// Each step is anchored to a real dock item, found by the aria-label the nav
// already sets. Nothing here holds a copy of the icon list or its positions:
// if a tab is added, removed or reordered, the tour follows it, and a step
// whose tab is missing is skipped rather than pointing at nothing.

const STEPS = [
  {
    label: "Home",
    title: "Home",
    body: "Where you land. It keeps a short checklist of what to do next until you have been through it once.",
  },
  {
    label: "Upload",
    title: "Upload your resume",
    body: "Start here. Your resume is read once and turned into a profile, and everything else works from that profile rather than from keywords.",
  },
  {
    label: "Resume studio",
    title: "Resume studio",
    body: "A blunt review with the fixes spelled out, a live editor, and ten templates that typeset whatever you write into a PDF. The score here is free forever.",
  },
  {
    label: "Jobs",
    title: "Jobs",
    body: "Search, and the verdict on every posting: a score out of 100, what matched, and what did not. Seventy and above counts as qualified.",
  },
  {
    label: "Queue",
    title: "Review queue",
    body: "Cover letters drafted for the jobs you qualify for. You read, edit and send them yourself — jobblast never submits anything on your behalf.",
  },
  {
    label: "Roadmap",
    title: "Roadmap",
    body: "For the jobs you do not qualify for yet, the specific skills standing between you and a yes. Pick a job to build one.",
  },
  {
    label: "Stats",
    title: "Stats",
    body: "Your funnel: how many you qualify for, how many replied, and whether your scores move as you close gaps.",
  },
  {
    label: "Pricing",
    title: "Plans",
    body: "What each plan includes. Everything is free while jobblast is in early access, and joining now keeps Pro free permanently.",
  },
  {
    label: "Settings",
    title: "Settings",
    body: "Your own API keys, which AI model to use, auto-apply, and how much of your plan you have used.",
  },
];

const PAD = 8; // breathing room between the highlight ring and the icon
const CARD_W = 320;
const GAP = 14; // between the highlight and the card above it

const findAnchor = (label) => document.querySelector(`nav a[aria-label="${label}"]`);

export function ProductTour({ onDone }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  // Steps whose dock item is actually on the page, snapshotted once on mount.
  // The dock hides nothing today, but a tour that silently points at empty
  // space is worse than a shorter tour. A lazy initializer rather than an
  // effect: this is one reading of the DOM, not a subscription to it, and the
  // component only ever mounts in the browser.
  const [steps] = useState(() =>
    typeof document === "undefined" ? STEPS : STEPS.filter((s) => findAnchor(s.label)),
  );

  const current = steps[step];

  const measure = useCallback(() => {
    if (!current) return;
    const el = findAnchor(current.label);
    if (!el) return setRect(null);
    // On a narrow screen the dock scrolls; bring the tab into view before
    // measuring or the ring lands on whatever happens to be at that position.
    el.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current]);

  // Measured in a frame rather than synchronously, so scrollIntoView above has
  // actually moved the dock before the ring is placed against it — measuring
  // in the same tick reads the position the tab is leaving, not the one it is
  // arriving at.
  useLayoutEffect(() => {
    let frame = requestAnimationFrame(measure);
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onDone();
      if (e.key === "ArrowRight") setStep((s) => Math.min(steps.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone, steps.length]);

  if (!current) return null;

  const last = step === steps.length - 1;
  const viewportW = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportH = typeof window === "undefined" ? 0 : window.innerHeight;

  // Card sits above the highlighted tab, centred on it, clamped to the screen.
  const cardLeft = rect
    ? Math.max(12, Math.min(viewportW - CARD_W - 12, rect.left + rect.width / 2 - CARD_W / 2))
    : 12;
  const cardBottom = rect ? viewportH - rect.top + GAP + PAD : 96;

  return (
    // z-[60]: above the dock (z-40) and the onboarding flow (z-50).
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* One element does the whole scrim. A huge spread shadow darkens
          everything outside the ring, which leaves the tab it surrounds at
          full brightness without a second cut-out layer to keep in step. */}
      {rect && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-2xl ring-2 ring-accent"
          initial={false}
          animate={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
          transition={{ duration: reduce ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
          style={{ boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.6)" }}
        />
      )}

      {/* Absorbs clicks so nothing behind the tour fires by accident. It does
          NOT dismiss: with the dock highlighted and the card right above it,
          a click-anywhere-to-close backdrop mostly closes the tour by mistake.
          Skip and Escape are the ways out. */}
      <div aria-hidden="true" className="absolute inset-0" />

      <motion.div
        className="absolute rounded-2xl border border-line bg-surface p-5 shadow-xl shadow-black/20"
        style={{ width: CARD_W, left: cardLeft, bottom: cardBottom }}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
          {step + 1} of {steps.length}
        </p>
        <h2 className="mt-2 font-display text-lg font-semibold">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{current.body}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          {last ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={onDone}
              className="text-sm font-medium text-muted transition hover:text-ink"
            >
              Skip
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              aria-label="Previous"
              className="rounded-xl border border-line p-2 text-muted transition hover:text-ink disabled:invisible"
            >
              <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => (last ? onDone() : setStep((s) => s + 1))}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition hover:bg-accent-hover"
            >
              {last ? "Start using it" : "Next"}
              {!last && <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
