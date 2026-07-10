"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, Flame, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AiCard, AiLabel } from "@/components/ai-loading";
import { EmptyState } from "@/components/empty-state";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { Disclosure } from "@/components/motion-primitives/disclosure";
import { InView } from "@/components/motion-primitives/in-view";

// Resume studio: review the uploaded resume, get grilled for the material it
// leaves out, then rebuild it — the enriched profile also sharpens job
// matching, since screening only sees what the profile contains.
export default function ResumePage() {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState(null);
  const [hasResume, setHasResume] = useState(false);
  const [review, setReview] = useState(null);
  const [interview, setInterview] = useState(null);
  const [builtResume, setBuiltResume] = useState(null);
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/resume").then((res) => res.json()),
      fetch("/api/insights").then((res) => res.json()),
    ])
      .then(([data, insightData]) => {
        setProfile(data.profile);
        setHasResume(Boolean(data.hasResumeText));
        setReview(data.review);
        setInterview(data.interview);
        setBuiltResume(data.builtResume);
        setInsights(insightData.insights ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const ready = profile && hasResume;

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Resume studio</h1>
      <p className="mt-2 text-neutral-500">
        Get your resume torn apart, answer the questions it should have
        answered, and walk out with a stronger one — better matches included.
      </p>

      {loaded && !ready && (
        <div className="mt-10">
          <EmptyState
            title={profile ? "Re-upload your resume" : "No resume yet"}
            description={
              profile
                ? "The studio works from the original resume text — drop your PDF again once to enable it."
                : "Upload your resume first — the studio reviews and rebuilds it from the original text."
            }
            cta="Upload resume"
            href="/upload"
          />
        </div>
      )}

      {ready && (
        <>
          <ReviewSection review={review} onReview={setReview} />
          <InterviewSection
            interview={interview}
            hasReview={Boolean(review)}
            onChange={setInterview}
          />
          <BuildSection
            interview={interview}
            builtResume={builtResume}
            onBuilt={(data) => {
              setBuiltResume(data.builtResume);
              setProfile(data.profile);
            }}
          />
          <InsightsSection insights={insights} />
        </>
      )}
    </PageShell>
  );
}

/* ---------- 04 · What's worked ---------- */

function InsightsSection({ insights }) {
  const lessons = insights.flatMap((record) =>
    record.lessons.map((l) => ({ ...l, from: `${record.jobTitle} · ${record.company}` }))
  );

  return (
    <section className="mt-14">
      <SectionHeader
        step={4}
        title="What's worked"
        description="Every hire gets distilled into lessons that automatically sharpen future reviews, interviews, rebuilds, and cover letters."
      />

      {lessons.length === 0 ? (
        <p className="mt-5 flex items-start gap-2.5 text-sm text-neutral-500">
          <Trophy size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden="true" />
          Nothing recorded yet — when you mark an application as Hired in the
          queue, the winning traits of that resume and cover letter land here
          and feed every step above.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {lessons.map((lesson, i) => (
            <InView key={i} as="li" transition={{ duration: 0.3, ease: "easeOut", delay: i * 0.04 }}>
              <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-neutral-200 px-1.5 py-0.5 font-mono text-[10px] uppercase text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
                    {lesson.category.replace("_", " ")}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 dark:text-neutral-600">
                    from {lesson.from}
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{lesson.insight}</p>
              </div>
            </InView>
          ))}
        </ul>
      )}
    </section>
  );
}

function SectionHeader({ step, title, description }) {
  return (
    <div className="border-b border-neutral-200 pb-4 dark:border-neutral-800">
      <p className="font-mono text-xs text-neutral-500">0{step}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
    </div>
  );
}

/* ---------- 01 · Review ---------- */

const SEVERITY_ORDER = { critical: 0, important: 1, polish: 2 };

function ReviewSection({ review, onReview }) {
  const [busy, setBusy] = useState(false);

  async function runReview() {
    setBusy(true);
    try {
      const res = await fetch("/api/resume/review", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onReview(data.review);
    } catch (err) {
      toast.error(err.message || "Review failed");
    } finally {
      setBusy(false);
    }
  }

  const issues = useMemo(
    () =>
      (review?.issues ?? []).toSorted(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      ),
    [review]
  );

  return (
    <section className="mt-12">
      <SectionHeader
        step={1}
        title="Review"
        description="A blunt read of your current resume — every issue comes with a concrete fix."
      />

      {!review && (
        <div className="mt-5">
          <AiCard busy={busy} className="p-5">
            {busy ? (
              <TextScramble className="font-medium" duration={1.2}>
                Reading like a recruiter…
              </TextScramble>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-neutral-500">
                  One pass over the original text — content, impact, clarity.
                </p>
                <button type="button" onClick={runReview} className="rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black">
                  Review my resume
                </button>
              </div>
            )}
          </AiCard>
        </div>
      )}

      {review && (
        <div className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="max-w-lg text-neutral-600 dark:text-neutral-300">{review.summary}</p>
            <p className="font-mono text-4xl font-semibold tabular-nums">
              <AnimatedNumber value={review.score} />
              <span className="text-sm text-neutral-500">/100</span>
            </p>
          </div>

          {review.strengths?.length > 0 && (
            <ul className="mt-5 space-y-1.5">
              {review.strengths.map((s) => (
                <li key={s} className="flex items-start gap-2.5 text-sm text-neutral-500">
                  <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          )}

          <ul className="mt-6 flex flex-col gap-3">
            {issues.map((issue, i) => (
              <InView key={i} as="li" transition={{ duration: 0.3, ease: "easeOut", delay: i * 0.05 }}>
                <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                        issue.severity === "critical"
                          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                          : "border-neutral-200 text-neutral-400 dark:border-neutral-800 dark:text-neutral-600"
                      }`}
                    >
                      {issue.severity}
                    </span>
                    <span className="text-sm font-medium">{issue.section}</span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{issue.problem}</p>
                  <p className="mt-2 border-l-2 border-neutral-200 pl-3 text-sm text-neutral-500 dark:border-neutral-800">
                    {issue.fix}
                  </p>
                </div>
              </InView>
            ))}
          </ul>

          <button
            type="button"
            onClick={runReview}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-black disabled:opacity-50 dark:hover:text-white"
          >
            <RefreshCw size={13} strokeWidth={1.5} className={busy ? "animate-spin" : ""} aria-hidden="true" />
            {busy ? "Re-reviewing…" : "Re-review"}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- 02 · Grill me ---------- */

const MIN_ANSWERS_TO_FINISH = 4;
const MAX_QUESTIONS = 10;

function InterviewSection({ interview, hasReview, onChange }) {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");

  const pending = interview?.questions.find((q) => q.answer === null) ?? null;
  const answered = interview?.questions.filter((q) => q.answer !== null) ?? [];

  async function step(body) {
    setBusy(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.interview);
      setAnswer("");
    } catch (err) {
      toast.error(err.message || "Interview failed");
    } finally {
      setBusy(false);
    }
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (!answer.trim()) return;
    step({ answer });
  }

  return (
    <section className="mt-14">
      <SectionHeader
        step={2}
        title="Grill me"
        description="Works through your resume's gaps one question at a time — each answer supplies the material the rebuild needs to fix that gap."
      />

      {!interview && (
        <div className="mt-5">
          <AiCard busy={busy} className="p-5">
            {busy ? (
              <TextScramble className="font-medium" duration={1.2}>
                Reading your resume for weak spots…
              </TextScramble>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-neutral-500">
                  Up to {MAX_QUESTIONS} questions, a couple of sentences each.{" "}
                  {hasReview
                    ? "Questions follow the gaps your review found, worst first."
                    : "Run the review first for the sharpest questions — it gives the interview its gap list."}
                </p>
                <button type="button" onClick={() => step({})} className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black">
                  <Flame size={14} strokeWidth={1.5} aria-hidden="true" /> Grill me
                </button>
              </div>
            )}
          </AiCard>
        </div>
      )}

      {interview && (
        <div className="mt-5">
          {/* Progress */}
          <div className="flex items-center justify-between font-mono text-xs text-neutral-500">
            <span>
              {answered.length} answered · max {MAX_QUESTIONS}
            </span>
            {interview.done && <span className="text-black dark:text-white">interview complete</span>}
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
            <div
              className="h-full rounded-full bg-black transition-[width] duration-500 dark:bg-white"
              style={{ width: `${(answered.length / MAX_QUESTIONS) * 100}%` }}
            />
          </div>

          {/* Active question */}
          {!interview.done && (
            <AiCard busy={busy} className="mt-4 p-5">
              {busy ? (
                <TextScramble className="font-medium" duration={1.2}>
                  Thinking about what to ask…
                </TextScramble>
              ) : pending ? (
                <form onSubmit={submitAnswer}>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                    question {answered.length + 1} · {pending.focus}
                  </p>
                  <p className="mt-2 font-medium">{pending.question}</p>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={3}
                    placeholder="A couple of sentences is plenty…"
                    aria-label="Your answer"
                    className="mt-4 w-full resize-y rounded-xl border border-neutral-200 bg-transparent p-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-800"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={!answer.trim()} className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black">
                      Answer
                    </button>
                    {answered.length >= MIN_ANSWERS_TO_FINISH && (
                      <button type="button" onClick={() => step({ finish: true })} className="text-sm text-neutral-500 transition hover:text-black dark:hover:text-white">
                        That&apos;s enough — finish
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-neutral-500">Ready for the next question.</p>
                  <button type="button" onClick={() => step({})} className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black">
                    Next question
                  </button>
                </div>
              )}
            </AiCard>
          )}

          {/* Transcript */}
          {answered.length > 0 && (
            <div className="mt-4">
              <Disclosure
                title={<span className="text-sm text-neutral-500">Your answers ({answered.length})</span>}
              >
                <ol className="space-y-4">
                  {answered.map((q, i) => (
                    <li key={i}>
                      <p className="text-sm font-medium">
                        <span className="font-mono text-xs text-neutral-500">Q{i + 1}</span> {q.question}
                      </p>
                      <p className="mt-1 pl-6 text-sm text-neutral-500">{q.answer}</p>
                    </li>
                  ))}
                </ol>
              </Disclosure>
            </div>
          )}

          {interview.done && (
            <button
              type="button"
              onClick={() => step({ restart: true })}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-black disabled:opacity-50 dark:hover:text-white"
            >
              <RefreshCw size={13} strokeWidth={1.5} aria-hidden="true" /> Start over
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- 03 · Rebuild ---------- */

function BuildSection({ interview, builtResume, onBuilt }) {
  const [busy, setBusy] = useState(false);
  const answered = interview?.questions.filter((q) => q.answer !== null).length ?? 0;

  async function build() {
    setBusy(true);
    try {
      const res = await fetch("/api/resume/build", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onBuilt(data);
      toast.success("Resume rebuilt — your profile now includes everything, so matches improve too");
    } catch (err) {
      toast.error(err.message || "Resume build failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyResume() {
    await navigator.clipboard.writeText(builtResume.markdown);
    toast.success("Resume copied as markdown");
  }

  async function copyClaudePrompt() {
    try {
      const res = await fetch("/api/resume/prompt");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await navigator.clipboard.writeText(data.prompt);
      toast.success("Prompt copied — paste it into claude.ai for the highest-quality rebuild");
    } catch (err) {
      toast.error(err.message || "Couldn't build the prompt");
    }
  }

  return (
    <section className="mt-14">
      <SectionHeader
        step={3}
        title="Rebuild"
        description="Your resume rewritten with everything the interview surfaced — and the richer profile makes every job screen sharper."
      />

      <div className="mt-5">
        <AiCard busy={busy} className="p-5">
          {busy ? (
            <div className="flex flex-col gap-1">
              <TextScramble className="font-medium" duration={1.2}>
                Rebuilding your resume…
              </TextScramble>
              <AiLabel>Folding {answered} interview answer{answered === 1 ? "" : "s"} into the rewrite</AiLabel>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-neutral-500">
                {answered > 0
                  ? `Uses your original resume plus ${answered} interview answer${answered === 1 ? "" : "s"}.`
                  : "Works from the original resume alone — the interview above makes it much better."}
              </p>
              <span className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={copyClaudePrompt} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500">
                  <Copy size={14} strokeWidth={1.5} aria-hidden="true" /> Copy Claude prompt
                </button>
                <button type="button" onClick={build} className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black">
                  <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" />
                  {builtResume ? "Rebuild again" : "Build my resume"}
                </button>
              </span>
            </div>
          )}
        </AiCard>

        {!busy && (
          <p className="mt-3 text-xs text-neutral-500">
            Want the best possible result? &ldquo;Copy Claude prompt&rdquo; packages your
            resume, its gaps, and your answers into one prompt — paste it into
            claude.ai and let a stronger model do the rebuild there.
          </p>
        )}

        {builtResume && !busy && (
          <div className="mt-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <p className="font-mono text-xs text-neutral-500">
                resume.md · {new Date(builtResume.createdAt).toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={copyResume} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
                  <Copy size={12} strokeWidth={1.5} aria-hidden="true" /> Copy
                </button>
                <a href="/api/resume/pdf" download="resume.pdf" className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black">
                  <Download size={12} strokeWidth={1.5} aria-hidden="true" /> Download PDF
                </a>
              </div>
            </div>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
              {builtResume.markdown}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
