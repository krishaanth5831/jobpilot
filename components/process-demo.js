"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy, FileText, Send } from "lucide-react";
import { AiLabel } from "@/components/ai-loading";
import { BorderTrail } from "@/components/motion-primitives/border-trail";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";

// Animated walkthrough of the application process for the landing page.
// Every "job" and "skill" is a skeleton bar on purpose — placeholder
// shapes can't be mistaken for real postings or real results.

const STEPS = [
  { id: "upload", label: "Upload", path: "/upload" },
  { id: "screen", label: "Screen", path: "/jobs" },
  { id: "draft", label: "Draft", path: "/queue" },
  { id: "track", label: "Track", path: "/roadmap" },
];

const STEP_MS = 3600;

function Bar({ w, className }) {
  return (
    <div
      className={`h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-800 ${className ?? ""}`}
      style={{ width: w }}
      aria-hidden="true"
    />
  );
}

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: "easeOut", delay },
});

// 1 — a resume drops in and Claude reads it into skill pills
function UploadScene() {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-dashed border-neutral-300 px-4 py-6 dark:border-neutral-700">
        <BorderTrail size={56} duration={2.4} />
        <motion.div
          initial={{ y: -28, opacity: 0, rotate: -6 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
        >
          <FileText size={14} strokeWidth={1.5} aria-hidden="true" />
          <span className="font-mono text-xs">resume.pdf</span>
        </motion.div>
        <AiLabel>Reading your resume…</AiLabel>
      </div>
      <div className="flex flex-wrap gap-2">
        {[52, 74, 44, 64, 38].map((w, i) => (
          <motion.div
            key={i}
            {...rise(0.9 + i * 0.12)}
            className="rounded-full border border-neutral-200 px-2 py-1 dark:border-neutral-800"
          >
            <Bar w={w} className="h-2" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// 2 — postings get screened: two resolved verdicts, one still in flight
function ScreenScene() {
  const rows = [
    { score: 92, verdict: "qualified", delay: 0.15 },
    { score: 48, verdict: "notyet", delay: 0.45 },
    { score: null, verdict: "screening", delay: 0.75 },
  ];
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <motion.div
          key={i}
          {...rise(row.delay)}
          className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800"
        >
          {row.verdict === "screening" && <BorderTrail size={48} duration={2.2} />}
          <div className="flex flex-col gap-2">
            <Bar w={i === 1 ? 150 : 120} />
            <Bar w={80} className="h-2 opacity-60" />
          </div>
          {row.verdict === "qualified" && (
            <span className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold">
                <AnimatedNumber value={row.score} />
              </span>
              <span className="rounded-full bg-black px-2.5 py-0.5 text-[10px] font-medium text-white dark:bg-white dark:text-black">
                Qualified
              </span>
            </span>
          )}
          {row.verdict === "notyet" && (
            <span className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold">
                <AnimatedNumber value={row.score} />
              </span>
              <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:border-neutral-700">
                Not yet
              </span>
            </span>
          )}
          {row.verdict === "screening" && <AiLabel>Screening…</AiLabel>}
        </motion.div>
      ))}
    </div>
  );
}

// 3 — a cover letter drafts itself line by line, ready for review
function DraftScene() {
  const lines = [200, 230, 180, 220, 140];
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <BorderTrail size={56} duration={2.6} />
        <AiLabel>Drafting your cover letter…</AiLabel>
        <div className="mt-3 flex max-w-full flex-col gap-2.5">
          {lines.map((w, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.5 + i * 0.25 }}
              style={{ transformOrigin: "left" }}
            >
              <Bar w={`min(${w}px, 100%)`} className="h-2" />
            </motion.div>
          ))}
        </div>
      </div>
      <motion.div {...rise(1.9)} className="flex items-center gap-2 self-end">
        <span className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium dark:border-neutral-700">
          <Copy size={11} strokeWidth={1.5} aria-hidden="true" /> Copy
        </span>
        <span className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black">
          Review & apply
        </span>
      </motion.div>
    </div>
  );
}

// 4 — you hit send on the real page, mark it done, close the gaps
function TrackScene() {
  return (
    <div className="flex flex-col gap-3">
      <motion.div
        {...rise(0.15)}
        className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.7 }}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black"
        >
          <Check size={11} strokeWidth={2} aria-hidden="true" />
        </motion.span>
        <Bar w={130} />
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase text-neutral-500">
          <Send size={10} strokeWidth={1.5} aria-hidden="true" /> submitted
        </span>
      </motion.div>
      <motion.div
        {...rise(0.45)}
        className="rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800"
      >
        <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
          Roadmap for the one you want next
        </p>
        <div className="mt-3 flex flex-col gap-2.5 border-l border-neutral-200 pl-4 dark:border-neutral-800">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} {...rise(0.8 + i * 0.25)} className="flex items-center gap-2.5">
              <span
                className={`h-3 w-3 rounded-full border ${
                  i === 0
                    ? "border-black bg-black dark:border-white dark:bg-white"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
                aria-hidden="true"
              />
              <Bar w={i === 1 ? 160 : 110} className="h-2" />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const SCENES = { upload: UploadScene, screen: ScreenScene, draft: DraftScene, track: TrackScene };

export function ProcessDemo() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const step = STEPS[index];
  const Scene = SCENES[step.id];

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      className="mx-auto w-full max-w-md"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      {/* Browser frame */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
          <span className="flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2.5 w-2.5 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            ))}
          </span>
          <span className="ml-2 flex-1 rounded-md bg-neutral-100 px-3 py-1 text-center font-mono text-[10px] text-neutral-500 dark:bg-neutral-900">
            jobpilot{step.path}
          </span>
        </div>
        <div className="min-h-[290px] p-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step.id}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Scene />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mt-5 flex items-center justify-center gap-1">
        {STEPS.map(({ id, label }, i) => (
          <button
            key={id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show step: ${label}`}
            aria-current={i === index ? "step" : undefined}
            className={`relative rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              i === index ? "text-black dark:text-white" : "text-neutral-400 dark:text-neutral-600"
            }`}
          >
            {i === index && (
              <motion.span
                layoutId="process-demo-step"
                className="absolute inset-0 rounded-full bg-neutral-100 dark:bg-neutral-900"
                transition={{ type: "spring", stiffness: 350, damping: 32 }}
              />
            )}
            <span className="relative font-mono">
              {i + 1} · {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
