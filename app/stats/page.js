"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { InView } from "@/components/motion-primitives/in-view";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { scoreFillClass } from "@/lib/score";

// The funnel: is all of this actually working? Every number is derived
// from data the other pages already record.
const FUNNEL_STAGES = [
  { key: "found", label: "Jobs found" },
  { key: "screened", label: "Screened" },
  { key: "qualified", label: "Qualified" },
  { key: "drafted", label: "Drafted" },
  { key: "sent", label: "Submitted" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offers", label: "Offers" },
  { key: "hired", label: "Hired" },
];

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const empty = loaded && (!stats || stats.funnel.found === 0);

  return (
    <PageShell>
      <PageHeader
        title="Stats"
        description="Your whole funnel in one place — watch the numbers move as your resume and roadmaps improve."
      />

      {empty && (
        <div className="mt-10">
          <EmptyState
            title="Nothing to count yet"
            description="Search and screen some jobs — every stage you move through shows up here."
            cta="Find jobs"
            href="/jobs"
          />
        </div>
      )}

      {stats && stats.funnel.found > 0 && (
        <>
          {/* Headline numbers */}
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="qualification rate"
              value={stats.rates.qualification}
              format="percent"
            />
            <Stat label="avg match score" value={stats.avgScore} suffix="/100" />
            <Stat label="response rate" value={stats.rates.response} format="percent" />
            <Stat label="lessons banked" value={stats.lessons} />
          </div>

          {/* Funnel */}
          <section className="mt-12">
            <SectionHeader title="Funnel" />
            <ul className="mt-5 flex flex-col gap-3">
              {FUNNEL_STAGES.map(({ key, label }, i) => {
                const value = stats.funnel[key];
                const max = stats.funnel.found || 1;
                return (
                  <InView
                    key={key}
                    as="li"
                    transition={{ duration: 0.3, ease: "easeOut", delay: i * 0.05 }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-28 shrink-0 text-sm text-muted">{label}</span>
                      <span className="h-6 flex-1 overflow-hidden rounded-xl bg-line">
                        <span
                          className="block h-full rounded-xl bg-accent transition-[width] duration-700 ease-out"
                          style={{ width: `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%` }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right font-mono text-sm tabular-nums">
                        {value}
                      </span>
                    </div>
                  </InView>
                );
              })}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Bars are relative to jobs found. A widening gap between
              &ldquo;screened&rdquo; and &ldquo;qualified&rdquo; is the roadmap&apos;s
              job; between &ldquo;submitted&rdquo; and &ldquo;interviewing&rdquo;,
              the resume studio&apos;s.
            </p>
          </section>

          {/* Score trend */}
          {stats.scores.length >= 2 && (
            <section className="mt-12">
              <SectionHeader title="Match scores over time" />
              <ScoreSparkline scores={stats.scores} />
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Every screening verdict in order — this line should climb as your
                profile fills out. Each dot carries its own verdict colour: slate
                below 45, ochre to 69, forest at 70 and up.
              </p>
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}

function Stat({ label, value, format, suffix }) {
  const display =
    value === null || value === undefined
      ? null
      : format === "percent"
        ? Math.round(value * 100)
        : value;

  return (
    <Card className="p-4">
      <p className="font-mono text-3xl font-semibold tabular-nums">
        {display === null ? (
          "—"
        ) : (
          <>
            <AnimatedNumber value={display} />
            <span className="text-sm text-muted">
              {format === "percent" ? "%" : (suffix ?? "")}
            </span>
          </>
        )}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">{label}</p>
    </Card>
  );
}

// SVG polyline over the score sequence, with labeled axes: match score (y) vs.
// screening order (x). The chrome is hairline and muted so the data carries;
// the dots take the semantic score scale (lib/score.js) rather than the brand
// accent, which is the same encoding the job cards already use.
function ScoreSparkline({ scores }) {
  const w = 600;
  const h = 152;
  const top = 8;
  const right = 8;
  const left = 44;
  const bottom = 28;
  const step = (w - left - right) / (scores.length - 1);
  const y = (score) => top + (1 - score / 100) * (h - top - bottom);
  const points = scores.map((s, i) => `${left + i * step},${y(s.score)}`).join(" ");

  return (
    <div className="mt-5 overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-36 w-full min-w-[320px]"
        role="img"
        aria-label="Line chart of match scores, one per screening in order"
      >
        {[0, 50, 100].map((line) => (
          <g key={line}>
            <line
              x1={left}
              x2={w - right}
              y1={y(line)}
              y2={y(line)}
              className="stroke-line"
              strokeWidth="1"
              strokeDasharray={line === 50 ? "4 4" : undefined}
            />
            <text
              x={left - 8}
              y={y(line)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="9"
              className="fill-muted font-mono tabular-nums"
            >
              {line}
            </text>
          </g>
        ))}
        <text
          x={10}
          y={(top + h - bottom) / 2}
          transform={`rotate(-90 10 ${(top + h - bottom) / 2})`}
          textAnchor="middle"
          fontSize="9"
          letterSpacing="0.1em"
          className="fill-muted uppercase"
        >
          Match score
        </text>
        <text
          x={left + (w - left - right) / 2}
          y={h - 8}
          textAnchor="middle"
          fontSize="9"
          letterSpacing="0.1em"
          className="fill-muted uppercase"
        >
          Screenings, oldest → newest
        </text>
        <polyline
          points={points}
          fill="none"
          className="stroke-accent"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {scores.map((s, i) => (
          <circle
            key={i}
            cx={left + i * step}
            cy={y(s.score)}
            r="2.5"
            className={scoreFillClass(s.score)}
          />
        ))}
      </svg>
    </div>
  );
}
