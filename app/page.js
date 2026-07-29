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
import { PhotoBand } from "@/components/photo-band";
import { ScoreDial } from "@/components/score-dial";
import { SiteFooter } from "@/components/site-footer";
import { Disclosure } from "@/components/motion-primitives/disclosure";

// The landing page is the only page a logged-out visitor can reach
// (components/auth-gate.js), so it has one job: explain what jobblast does
// before anyone is asked to make an account.
//
// Structure alternates quiet themed sections with full-bleed photographic
// bands (components/photo-band.js). The bands are dark in both themes and
// carry near-white text, which is what gives the page its contrast: text on
// a scrimmed photograph has nowhere to wash out.
//
// Screenshots under /public/screenshots are real captures of the jobs page
// rendering real data. Photographs under /public/photos are swapped by
// overwriting the file, see the README there.

/** Scroll reveal. Collapses to static when the visitor asks for less motion. */
function Reveal({ children, delay = 0, className }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      // min-w-0: as a grid item this defaults to min-width:auto, which lets a
      // wide child push the whole page wider than the viewport instead of
      // scrolling inside its own container.
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
 * Light/dark pair of a product capture, for themed sections. Only one is ever
 * visible, so the dark copy is hidden from assistive tech to avoid a duplicate
 * description of the same screen.
 *
 * These captures are wide and thin. Shrinking one to a 390px column turns the
 * score into an unreadable smudge, so on small screens it keeps a legible
 * width and scrolls inside its own container instead.
 */
function Shot({ name, alt, priority = false }) {
  const common = { width: 1480, height: 518, priority, sizes: "(max-width: 1024px) 100vw, 900px" };
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

// Where postings come from. Deliberately plain wordmarks rather than the
// boards' logos: jobblast reaches LinkedIn, Indeed and Glassdoor through
// JSearch and has no relationship with any of them, so their marks here
// would imply an endorsement that does not exist.
const SOURCES = ["LinkedIn", "Indeed", "Glassdoor", "Adzuna", "Company sites"];

const steps = [
  { Icon: Upload, title: "Upload", body: "Drop in your resume. It gets read once and turned into a profile." },
  { Icon: SearchCheck, title: "Match", body: "Every posting is screened against that profile, not against keywords." },
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

const faqs = [
  {
    q: "Is it actually free?",
    a: "Yes, right now. There is no card, no trial timer, and no paid tier to upgrade to yet. Job search runs on keys the server already provides, so there is nothing for you to sign up for either.",
  },
  {
    q: "Which job boards does it search?",
    a: "Postings from LinkedIn, Indeed and Glassdoor come through JSearch, and Adzuna is queried directly. You can also paste any posting you found yourself and it runs through the same screen.",
  },
  {
    q: "Does it apply to jobs for me automatically?",
    a: "No. It drafts a cover letter for roles you qualify for and puts it in a review queue. You read it, edit it, and submit the application yourself on the company's site. Nothing is ever sent on your behalf.",
  },
  {
    q: "What does the score actually mean?",
    a: "It is a judgement of how well what your resume shows lines up with what the posting asks for. Seventy and above counts as qualified. Below that you get the specific missing requirements instead of a rejection three weeks later.",
  },
  {
    q: "What happens to my resume?",
    a: "It is stored in your own account on this server and is never shared with other accounts. Deleting your account deletes your resume, saved jobs and applications with it.",
  },
  {
    q: "Do I need an API key?",
    a: "No. Job search works out of the box. The only optional extra is your own Claude key, which upgrades the AI from the free built-in model.",
  },
];

export default function Home() {
  return (
    <div className="flex-1">
      {/* 1. Hero over a photograph */}
      <PhotoBand
        photo="hero.jpg"
        alt=""
        priority
        scrim="heavy"
        className="flex min-h-[100dvh] items-center"
      >
        <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-32 text-center">
          <Reveal>
            <span className="inline-flex items-center rounded-xl border border-on-photo/25 px-3 py-1 text-xs font-medium text-on-photo-dim">
              Free while it is early
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.04] sm:text-6xl lg:text-7xl">
              <span className="text-on-photo-dim">Apply where</span>
              <br />
              <span className="text-on-photo">you qualify.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[46ch] text-lg leading-relaxed text-on-photo-dim">
              Every posting is screened against what your resume actually shows.
              You see the score, the gaps, and the reasoning.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <PrimaryCta />
              <Link
                href="#scoring"
                className="rounded-xl border border-on-photo/30 px-6 py-3.5 font-medium text-on-photo backdrop-blur-sm transition hover:border-on-photo/60"
              >
                How scoring works
              </Link>
            </div>
          </Reveal>
        </div>
      </PhotoBand>

      {/* 2. Where postings come from */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Reveal className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
            <span className="text-sm text-muted">Every search covers</span>
            <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              {SOURCES.map((source) => (
                <li key={source} className="font-display text-lg font-semibold text-ink/70">
                  {source}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 3. A real verdict, floating on a photograph */}
      <PhotoBand photo="verdict.jpg" alt="" scrim="light">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <Reveal className="text-center">
            <span className="inline-flex items-center rounded-xl border border-on-photo/25 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-on-photo-dim">
              A real verdict
            </span>
          </Reveal>
          <Reveal delay={0.1} className="mt-8">
            <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:overflow-visible sm:px-0">
              <div className="min-w-[560px] sm:min-w-0">
                <Image
                  src="/screenshots/verdict-qualified-dark.png"
                  alt="A job listing in jobblast for a Junior Data Engineer role at Kestrel Analytics, marked Qualified with a match score of 84 out of 100 and one missing requirement."
                  width={1480}
                  height={518}
                  sizes="(max-width: 1024px) 100vw, 1000px"
                  className="w-full rounded-2xl border border-white/10 shadow-2xl shadow-black/40"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </PhotoBand>

      {/* 4. The problem, stated plainly */}
      <section className="border-b border-line bg-surface">
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

      {/* 5. Scoring, with the dial and the honest "not yet" case */}
      <section id="scoring" className="mx-auto max-w-5xl scroll-mt-24 px-6 py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
            A number, and the reason behind it.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Claude reads the posting against your resume and scores the fit out
            of 100. Drag the dial to see where the line sits.
          </p>
        </Reveal>

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

        <Reveal delay={0.15} className="mt-12">
          <Shot
            name="verdict-notyet"
            alt="A Machine Learning Engineer role at Northwind Robotics marked Not yet at 38 out of 100, listing three missing requirements and offering to build a roadmap."
          />
        </Reveal>
      </section>

      {/* 6. How it runs, over a photograph */}
      <PhotoBand photo="steps.jpg" alt="" scrim="heavy">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold text-on-photo sm:text-4xl">
              How it runs
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-on-photo/15 bg-on-photo/15 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.07} className="bg-black/45 backdrop-blur-sm">
                <div className="h-full p-7">
                  <Icon size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
                  <h3 className="mt-5 font-display text-lg font-semibold text-on-photo">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-on-photo-dim">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </PhotoBand>

      {/* 7. Everything else, as a bento with one lead tile */}
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
            <Reveal key={title} delay={(i % 3) * 0.07} className={wide ? "sm:col-span-2" : undefined}>
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

      {/* 8. Cost, stated once, over a photograph */}
      <PhotoBand photo="free.jpg" alt="" scrim="heavy">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <Reveal>
            <p className="font-display text-4xl font-semibold text-on-photo sm:text-5xl">
              Free right now.
            </p>
            <div className="mt-10 flex justify-center">
              <PrimaryCta className="px-8 py-4 text-lg" />
            </div>
          </Reveal>
        </div>
      </PhotoBand>

      {/* 9. FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-28">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            Questions
          </h2>
        </Reveal>
        <Reveal delay={0.08} className="mt-10">
          {faqs.map(({ q, a }) => (
            <Disclosure key={q} title={<span className="pr-4">{q}</span>}>
              <p className="max-w-[62ch] text-sm leading-relaxed text-muted">{a}</p>
            </Disclosure>
          ))}
        </Reveal>
      </section>

      {/* 10. Footer */}
      <SiteFooter />
    </div>
  );
}
