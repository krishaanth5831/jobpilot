"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { useInView } from "motion/react";
import { Upload, SearchCheck, Send, Map, Check, ArrowRight } from "lucide-react";
import { ScrollProgress } from "@/components/motion-primitives/scroll-progress";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { TextLoop } from "@/components/motion-primitives/text-loop";
import { InView } from "@/components/motion-primitives/in-view";
import { Spotlight } from "@/components/motion-primitives/spotlight";
import { Tilt } from "@/components/motion-primitives/tilt";
import { Magnetic } from "@/components/motion-primitives/magnetic";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { InfiniteSlider } from "@/components/motion-primitives/infinite-slider";
import { Logo } from "@/components/logo";
import { Cursor } from "@/components/motion-primitives/cursor";

// The hero scene is the heaviest client-only piece — lazy-load it with a
// grayscale wireframe poster while the real (colored) scene boots.
const HeroScene = dynamic(() => import("@/components/hero-scene"), {
  ssr: false,
  loading: () => <PosterPlane />,
});

function PosterPlane() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-full w-full text-neutral-300 dark:text-neutral-700"
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M330 190 L110 130 L150 210 Z" />
        <path d="M330 190 L110 250 L150 210 Z" />
        <path d="M330 190 L150 210 L160 260 Z" />
      </g>
    </svg>
  );
}

const steps = [
  {
    Icon: Upload,
    title: "Upload",
    description: "Drop in your resume. Claude reads it and builds your structured candidate profile.",
  },
  {
    Icon: SearchCheck,
    title: "Match",
    description: "Search real job boards. Every posting is screened against your actual experience.",
  },
  {
    Icon: Send,
    title: "Apply",
    description: "Qualified? A tailored cover letter is drafted for your review. You always hit send.",
  },
  {
    Icon: Map,
    title: "Roadmap",
    description: "Not qualified yet? Get a concrete plan to close the gap — skills, projects, timeline.",
  },
];

const sources = ["Adzuna", "LinkedIn", "Indeed", "Greenhouse", "Lever", "Wellfound", "Glassdoor"];

// Fake match card for the live-demo strip: the score counts up on scroll.
function DemoMatchCard() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -120px 0px" });

  return (
    <div
      ref={ref}
      className="mx-auto w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">Frontend Engineer Intern</p>
          <p className="text-sm text-neutral-500">Acme Corp · Remote</p>
        </div>
        <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-black">
          Qualified
        </span>
      </div>
      <div className="mt-6 flex items-end justify-between">
        <ul className="space-y-1.5 text-sm text-neutral-500">
          {["React + Next.js", "Git workflow", "REST APIs"].map((req) => (
            <li key={req} className="flex items-center gap-2">
              <Check size={14} strokeWidth={1.5} aria-hidden="true" />
              {req}
            </li>
          ))}
        </ul>
        <p className="text-right">
          <AnimatedNumber value={inView ? 92 : 0} className="text-5xl font-semibold tracking-tight" />
          <span className="block text-xs uppercase tracking-widest text-neutral-500">match score</span>
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex-1">
      <ScrollProgress />
      <Cursor />

      {/* Hero */}
      <section className="relative flex min-h-svh items-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18] dark:invert"
          style={{
            backgroundImage: "url(/backgrounds/hero-lowpoly.svg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative z-10">
            <div className="mb-8 flex items-center gap-3">
              <Logo size={36} loop />
              <span className="text-lg font-semibold tracking-tight">jobpilot</span>
            </div>
            <TextEffect
              as="h1"
              per="word"
              preset="blur"
              className="text-5xl font-bold tracking-tight sm:text-7xl"
            >
              Apply where you qualify.
            </TextEffect>
            <p className="mt-6 text-lg text-neutral-500 sm:text-xl">
              Your AI copilot for{" "}
              <TextLoop className="font-medium text-black dark:text-white">
                {["internships", "new-grad roles", "your dream job"]}
              </TextLoop>
              <br />
              It only applies where you qualify — and shows you how to qualify
              where you don&apos;t.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Magnetic>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3.5 font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black"
                >
                  Upload your resume
                  <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                </Link>
              </Magnetic>
              <Link
                href="/jobs"
                className="rounded-xl border border-neutral-300 px-6 py-3.5 font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
              >
                Browse jobs
              </Link>
            </div>
          </div>
          {/* Desktop: right column. Mobile: faint backdrop behind the copy. */}
          <div className="pointer-events-none absolute inset-0 opacity-25 lg:static lg:h-[520px] lg:opacity-100">
            <HeroScene />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-28">
        <InView>
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Four steps, no wasted applications
          </h2>
        </InView>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ Icon, title, description }, i) => (
            <InView
              key={title}
              transition={{ duration: 0.35, ease: "easeOut", delay: i * 0.08 }}
            >
              <Tilt className="h-full">
                <div className="relative h-full overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
                  <Spotlight />
                  <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                  <p className="mt-4 font-mono text-xs text-neutral-500">0{i + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{description}</p>
                </div>
              </Tilt>
            </InView>
          ))}
        </div>
      </section>

      {/* Live-demo strip */}
      <section className="dot-grid border-y border-neutral-200 py-28 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6">
          <InView>
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              An honest screen, before you apply
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-center text-neutral-500">
              Claude compares every posting against what&apos;s actually on your
              resume — no invented skills, no wishful matching.
            </p>
          </InView>
          <InView className="mt-12" transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}>
            <DemoMatchCard />
          </InView>
        </div>
      </section>

      {/* Sources marquee */}
      <section className="py-20">
        <p className="text-center font-mono text-xs uppercase tracking-widest text-neutral-500">
          Searching across
        </p>
        <InfiniteSlider className="mt-8" duration={22} gap={64}>
          {sources.map((name) => (
            <span
              key={name}
              className="text-2xl font-semibold tracking-tight text-neutral-300 dark:text-neutral-700"
            >
              {name}
            </span>
          ))}
        </InfiniteSlider>
        <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
          Adzuna live today — more sources on the roadmap.
        </p>
      </section>

      {/* Footer CTA */}
      <section className="relative overflow-hidden pb-40 pt-10">
        <div
          className="h-40 w-full opacity-70 dark:invert"
          style={{
            backgroundImage: "url(/backgrounds/divider-waves.svg)",
            backgroundSize: "100% 100%",
          }}
          aria-hidden="true"
        />
        <div className="mx-auto max-w-4xl px-6 pt-20 text-center">
          <TextEffect
            as="h2"
            per="word"
            preset="blur"
            onView
            className="text-4xl font-bold tracking-tight sm:text-6xl"
          >
            Stop spraying. Start landing.
          </TextEffect>
          <div className="mt-10 flex justify-center">
            <Magnetic>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 rounded-xl bg-black px-8 py-4 text-lg font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black"
              >
                Upload your resume
                <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Magnetic>
          </div>
        </div>
      </section>
    </div>
  );
}
