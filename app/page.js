"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  Upload,
  SearchCheck,
  Send,
  Map,
  ArrowRight,
  FileText,
  Download,
  ClipboardPaste,
  Inbox,
  ChartNoAxesColumn,
} from "lucide-react";
import { ScoreDial } from "@/components/score-dial";
import { HeroField } from "@/components/hero-field";

// The landing page is the only page a logged-out visitor can reach
// (components/auth-gate.js), so it has one job: explain what jobblast does
// before anyone is asked to make an account.
//
// It shows the real product rather than describing it. Both screenshots under
// /public/screenshots are captures of the actual jobs page rendering real
// data, in light and dark, swapped by CSS so neither theme shows the other's
// screenshot.

/** Scroll reveal. Collapses to static when the visitor asks for less motion. */
function Reveal({ children, delay = 0, className }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      // min-w-0: as a grid item this defaults to min-width:auto, which lets a
      // wide child (the screenshots) push the whole page wider than the
      // viewport instead of scrolling inside its own container.
      className={`min-w-0 ${className ?? ""}`}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** The one primary action on the page. Same label everywhere it appears. */
function PrimaryCta({ className = "" }) {
  return (
    <Link
      href="/upload"
      className={`inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 font-medium text-accent-ink transition hover:bg-accent-hover active:translate-y-px ${className}`}
    >
      Get started free
      <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}

/**
 * Light/dark pair of the same product capture. Only one is ever visible, so
 * the dark copy is hidden from assistive tech to avoid a duplicate
 * description of the same screen.
 */
function Shot({ name, alt, priority = false }) {
  const common = {
    width: 1480,
    height: 518,
    priority,
    sizes: "(max-width: 1024px) 100vw, 640px",
  };
  // These captures are wide and thin. Shrinking one to a 390px column turns
  // the score into an unreadable smudge, so on small screens it keeps a
  // legible width and scrolls inside its own container instead.
  return (
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:overflow-visible sm:px-0">
      <div className="min-w-[560px] sm:min-w-0">
        <Image
          {...common}
          src={`/screenshots/${name}-light.png`}
          alt={alt}
          className="w-full rounded-2xl border border-line dark:hidden"
        />
        <Image
          {...common}
          src={`/screenshots/${name}-dark.png`}
          alt=""
          aria-hidden="true"
          className="hidden w-full rounded-2xl border border-line dark:block"
        />
      </div>
    </div>
  );
}

const steps = [
  { Icon: Upload, title: "Upload", body: "Drop in your resume. It gets read once and turned into a profile." },
  { Icon: SearchCheck, title: "Match", body: "Postings from LinkedIn, Indeed, Glassdoor and Adzuna, screened against that profile." },
  { Icon: Send, title: "Apply", body: "Qualified roles get a drafted letter. You read it, edit it, and send it yourself." },
  { Icon: Map, title: "Close the gap", body: "For the rest, a plan: the specific skills standing between you and a yes." },
];

const toolkit = [
  {
    Icon: FileText,
    title: "Resume studio",
    body: "A blunt review with the fixes spelled out, a live editor, and ten templates that typeset whatever you write into a PDF.",
    wide: true,
  },
  { Icon: Download, title: "Tailored resumes", body: "One click re-emphasises your real experience for a specific posting. Selection, never invention." },
  { Icon: ClipboardPaste, title: "Paste any job", body: "Found something elsewhere? Paste the posting and it runs through the same screen." },
  { Icon: Inbox, title: "Tracker and follow-ups", body: "Every application from submitted to offer, with a follow-up note when a company goes quiet." },
  { Icon: ChartNoAxesColumn, title: "Your funnel, measured", body: "Qualification rate, response rate, and how your scores move as you close gaps." },
];

export default function Home() {
  return (
    <div className="flex-1">
      {/* Hero: copy over a full-bleed animated field */}
      <section className="relative isolate flex min-h-[calc(100dvh-4rem)] items-center overflow-hidden">
        <HeroField />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-24">
          <Reveal>
            <h1 className="font-display text-5xl font-semibold leading-[1.03] sm:text-6xl lg:text-7xl">
              Apply where
              <br />
              you qualify.
            </h1>
            <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-muted">
              Every posting gets screened against what your resume actually
              shows. You see the score, the gaps, and the reasoning.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <PrimaryCta />
              <Link
                href="#scoring"
                className="rounded-xl border border-line bg-paper/60 px-6 py-3.5 font-medium backdrop-blur-sm transition hover:border-accent hover:text-accent"
              >
                How scoring works
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* The problem, stated plainly. No cards, no columns. */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-3xl px-6 py-28 text-center">
          <Reveal>
            <h2 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Most job hunts fail quietly.
            </h2>
            <p className="mx-auto mt-6 max-w-[52ch] text-lg leading-relaxed text-muted">
              You send two hundred applications and hear back from four. Nobody
              tells you which ones were never winnable, or why.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Scoring: the differentiator, shown as two real verdicts side by side */}
      <section id="scoring" className="mx-auto max-w-5xl scroll-mt-24 px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h2 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
              A number, and the reason behind it.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              Claude reads the posting against your resume and scores the fit
              out of 100. Here are two real verdicts from the same search.
            </p>
          </Reveal>
        </div>

        {/* The dial belongs here rather than in the hero: it is a teaching
            aid for the 70 line, not decoration. */}
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[auto_1fr] lg:gap-16">
          <Reveal className="flex justify-center">
            <ScoreDial />
          </Reveal>
          <Reveal delay={0.1}>
            <dl className="flex flex-col gap-6 border-t border-line pt-8 text-left">
              <div className="flex items-baseline gap-5">
                <dt className="w-[4.5rem] shrink-0 whitespace-nowrap font-mono text-xl font-semibold tabular-nums text-score-strong">
                  70+
                </dt>
                <dd className="text-muted">
                  <span className="font-medium text-ink">Qualified.</span> Worth
                  your afternoon. A cover letter is drafted for you to edit.
                </dd>
              </div>
              <div className="flex items-baseline gap-5">
                <dt className="w-[4.5rem] shrink-0 whitespace-nowrap font-mono text-xl font-semibold tabular-nums text-score-weak">
                  &lt; 70
                </dt>
                <dd className="text-muted">
                  <span className="font-medium text-ink">Not yet.</span> You get
                  the specific gap instead of a rejection three weeks later.
                </dd>
              </div>
            </dl>
          </Reveal>
        </div>

        <div className="mt-14 flex flex-col gap-5">
          <Reveal>
            <Shot
              name="verdict-qualified"
              alt="A job listing in jobblast for a Junior Data Engineer role at Kestrel Analytics, marked Qualified with a match score of 84 out of 100 and one missing requirement."
              priority
            />
          </Reveal>
          <Reveal delay={0.1}>
            <Shot
              name="verdict-notyet"
              alt="A Machine Learning Engineer role at Northwind Robotics on the same screen, marked Not yet at 38 out of 100, listing three missing requirements and offering to build a roadmap."
            />
          </Reveal>
        </div>
      </section>

      {/* Process rail: hairlines instead of four identical cards */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              How it runs
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.07} className="bg-surface">
                <div className="h-full p-7">
                  <Icon size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
                  <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Everything else, as a bento with one lead tile */}
      <section className="mx-auto max-w-6xl px-6 py-28">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            The rest of the application
          </h2>
          <p className="mt-4 max-w-[54ch] text-muted">
            Search is the start. Everything from the first resume review to the
            offer lives in the same loop.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {toolkit.map(({ Icon, title, body, wide }, i) => (
            <Reveal
              key={title}
              delay={(i % 3) * 0.07}
              className={wide ? "sm:col-span-2" : undefined}
            >
              <div
                className={`h-full rounded-2xl border border-line p-7 ${
                  wide ? "bg-accent-wash" : i === 2 ? "dot-grid bg-surface" : "bg-surface"
                }`}
              >
                <Icon size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
                <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Cost, stated once and plainly */}
      <section className="border-y border-line">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-6 py-20 text-center">
          <Reveal>
            <p className="font-display text-3xl font-semibold sm:text-4xl">
              Free right now.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Close */}
      <section className="mx-auto max-w-4xl px-6 pb-40 pt-28 text-center">
        <Reveal>
          <h2 className="font-display text-4xl font-semibold leading-tight sm:text-6xl">
            Stop spraying.
            <br />
            Start landing.
          </h2>
          <div className="mt-10 flex justify-center">
            <PrimaryCta className="px-8 py-4 text-lg" />
          </div>
        </Reveal>
      </section>
    </div>
  );
}
