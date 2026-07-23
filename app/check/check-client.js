"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Lock, ScanSearch } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Logo } from "@/components/logo";

const SEVERITY_LABELS = {
  critical: "Critical",
  important: "Important",
  polish: "Polish",
};

export function CheckClient() {
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  async function runCheck(e) {
    e.preventDefault();
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch("/api/public/ats-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      toast.error(err.message || "The check didn't go through — try again.");
    } finally {
      setChecking(false);
    }
  }

  const hiddenIssues = result ? Math.max(0, result.totalIssues - result.topIssues.length) : 0;

  return (
    <PageShell>
      <div className="flex flex-col items-center text-center">
        <Logo size={40} />
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
          Is your resume ATS-proof?
        </h1>
        <p className="mt-3 max-w-xl text-neutral-500">
          Most resumes are rejected by software before a human ever reads them.
          Paste yours below for an instant score — free, no account needed.
        </p>
      </div>

      <form onSubmit={runCheck} className="mt-8">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="Paste your full resume text here…"
          aria-label="Resume text"
          className="w-full resize-y rounded-2xl border border-neutral-200 bg-transparent p-5 text-sm leading-relaxed outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-800"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-neutral-400">
            Your text is scored and discarded — never stored.
          </p>
          <button
            type="submit"
            disabled={checking || text.trim().length < 200}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            <ScanSearch size={15} strokeWidth={1.5} aria-hidden="true" />
            {checking ? "Checking…" : "Check my resume"}
          </button>
        </div>
      </form>

      {result && (
        <section className="mt-10" aria-label="Your ATS check results">
          <div className="flex flex-col items-center rounded-2xl border border-neutral-200 p-8 text-center dark:border-neutral-800">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              ATS score
            </p>
            <p className="mt-1 text-6xl font-bold tabular-nums">{result.score}</p>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {result.summary}
            </p>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {result.topIssues.map((issue, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800"
              >
                <span className="mt-0.5 shrink-0 rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:border-neutral-700">
                  {SEVERITY_LABELS[issue.severity] ?? issue.severity}
                </span>
                <span className="text-sm leading-relaxed">{issue.problem}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
            <p className="flex items-center justify-center gap-2 font-medium">
              <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
              {hiddenIssues > 0
                ? `${hiddenIssues} more issue${hiddenIssues === 1 ? "" : "s"} found`
                : "Get the concrete fix for every issue"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
              A free account unlocks the full review with a concrete fix for
              each issue, an AI resume rebuild, and job matching against your
              real experience — free built-in AI included, no card needed.
            </p>
            <Link
              href="/signin"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black"
            >
              See the full review free
              <ArrowRight size={15} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
    </PageShell>
  );
}
