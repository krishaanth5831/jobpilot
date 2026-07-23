"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

// First-run guided path: upload resume → run the ATS check → search jobs.
// Renders nothing once every step is done (quiet success) or after an
// explicit dismiss — steps are derived server-side from real account state,
// so it can never nag someone who has already done the work.

const STEPS = [
  {
    id: "resume",
    title: "Upload your resume",
    blurb: "Everything starts from it — matching, reviews, cover letters.",
    href: "/upload",
  },
  {
    id: "review",
    title: "Run the ATS check",
    blurb: "See your score and exactly what to fix before applying anywhere.",
    href: "/resume",
  },
  {
    id: "search",
    title: "Search jobs you qualify for",
    blurb: "The AI screens each posting against your actual experience.",
    href: "/jobs",
  },
];

export function OnboardingChecklist() {
  const [state, setState] = useState(null); // { steps, dismissed }

  useEffect(() => {
    fetch("/api/onboarding")
      .then((res) => (res.ok ? res.json() : null))
      .then(setState)
      .catch(() => {});
  }, []);

  if (!state || state.dismissed) return null;
  const done = STEPS.filter((s) => state.steps[s.id]).length;
  if (done === STEPS.length) return null;

  function dismiss() {
    setState((prev) => ({ ...prev, dismissed: true })); // optimistic
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: true }),
    }).catch(() => {});
  }

  return (
    <section
      aria-label="Getting started checklist"
      className="mt-8 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold tracking-tight">Get set up in two minutes</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {done} of {STEPS.length} done — finish these and jobblast starts
            working for you.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss checklist"
          title="Dismiss"
          className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-black dark:hover:bg-neutral-900 dark:hover:text-white"
        >
          <X size={15} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {STEPS.map((step, i) => {
          const isDone = state.steps[step.id];
          // The first not-done step is where they should go next.
          const isNext = !isDone && STEPS.findIndex((s) => !state.steps[s.id]) === i;
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className={`flex h-full flex-col rounded-xl border p-3.5 transition ${
                  isDone
                    ? "border-neutral-200 opacity-60 dark:border-neutral-800"
                    : isNext
                      ? "border-black dark:border-white"
                      : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                      isDone
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "border border-neutral-300 text-neutral-500 dark:border-neutral-700"
                    }`}
                  >
                    {isDone ? (
                      <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className={isDone ? "line-through" : ""}>{step.title}</span>
                </span>
                <span className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                  {step.blurb}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
