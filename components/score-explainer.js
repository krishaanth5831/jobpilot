"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { InView } from "@/components/motion-primitives/in-view";

// Landing-page section explaining the 0–100 match score. The example card
// mirrors the real verdict shape from lib/matcher.js: must-haves decide
// "Qualified", the score says how comfortably, and every verdict carries
// its receipts (matched + missing requirements, written reasoning).

const POINTS = [
  {
    title: "Only what's on the page",
    description:
      "Your resume becomes a structured profile — skills, experience, projects. Claude judges from what's actually written and never assumes skills you didn't list.",
  },
  {
    title: "Must-haves vs nice-to-haves",
    description:
      "The posting's requirements are split into hard requirements and bonuses, and each one is marked met or missing against your profile.",
  },
  {
    title: "The verdict, with receipts",
    description:
      "Meet every must-have and you're Qualified. The score says how comfortably — how much of the full list you cover and how relevant your experience is. Each verdict includes what matched, what's missing, and why.",
  },
];

// Example verdict — every must-have met, one bonus missing, hence a
// qualified-but-not-perfect 84.
const REQUIREMENTS = [
  { label: "React + modern JavaScript", kind: "must-have", met: true },
  { label: "REST APIs & databases", kind: "must-have", met: true },
  { label: "Git collaboration workflow", kind: "must-have", met: true },
  { label: "TypeScript in production", kind: "nice-to-have", met: true },
  { label: "3+ years of experience", kind: "nice-to-have", met: false },
];

const SCORE = 84;

export function ScoreExplainer() {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.9fr]">
      <InView>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          How the 0–100 score works
        </h2>
        <p className="mt-4 text-neutral-500">
          No keyword counting. Claude reads both sides — your resume and the
          full posting — and screens you the way a strict but fair recruiter
          would.
        </p>
        <ol className="mt-8 space-y-6">
          {POINTS.map(({ title, description }, i) => (
            <li key={title} className="flex gap-4">
              <span className="font-mono text-xs text-neutral-500">0{i + 1}</span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-neutral-500">
          A low score isn&apos;t a dead end — the missing requirements feed
          straight into your roadmap on the Get qualified tab.
        </p>
      </InView>

      <InView transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}>
        <VerdictCard />
      </InView>
    </div>
  );
}

function VerdictCard() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -120px 0px" });
  const reduced = useReducedMotion();
  const revealed = inView || reduced;

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
          Match verdict — example
        </p>
        <motion.span
          initial={reduced ? false : { opacity: 0, scale: 0.85 }}
          animate={revealed ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 1.1, duration: 0.3, ease: "easeOut" }}
          className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-black"
        >
          Qualified
        </motion.span>
      </div>

      <ul className="mt-5 space-y-2.5">
        {REQUIREMENTS.map(({ label, kind, met }, i) => (
          <motion.li
            key={label}
            initial={reduced ? false : { opacity: 0, x: -8 }}
            animate={revealed ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.15 + i * 0.15, duration: 0.3, ease: "easeOut" }}
            className="flex items-center gap-3 text-sm"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                met
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "border border-neutral-300 text-neutral-400 dark:border-neutral-700"
              }`}
            >
              {met ? (
                <Check size={11} strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <X size={11} strokeWidth={2.5} aria-hidden="true" />
              )}
            </span>
            <span className={met ? "" : "text-neutral-400 dark:text-neutral-600"}>
              {label}
            </span>
            <span className="ml-auto shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 font-mono text-[10px] uppercase text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
              {kind}
            </span>
          </motion.li>
        ))}
      </ul>

      <div className="mt-6 border-t border-neutral-100 pt-5 dark:border-neutral-900">
        <div className="flex items-end justify-between">
          <p className="text-sm text-neutral-500">
            3/3 must-haves · 1/2 nice-to-haves
          </p>
          <p className="font-mono text-3xl font-semibold tabular-nums">
            <AnimatedNumber value={revealed ? SCORE : 0} />
            <span className="text-sm text-neutral-500">/100</span>
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
          <motion.div
            initial={reduced ? { width: `${SCORE}%` } : { width: 0 }}
            animate={revealed ? { width: `${SCORE}%` } : {}}
            transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
            className="h-full rounded-full bg-black dark:bg-white"
          />
        </div>
      </div>
    </div>
  );
}
