"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, MapPin, ExternalLink, Sparkles, ClipboardPaste, Download } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AiLabel } from "@/components/ai-loading";
import { EmptyState } from "@/components/empty-state";
import { BorderTrail } from "@/components/motion-primitives/border-trail";
import { TextShimmer } from "@/components/motion-primitives/text-shimmer";
import { Tilt } from "@/components/motion-primitives/tilt";
import { Magnetic } from "@/components/motion-primitives/magnetic";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { AnimatedBackground } from "@/components/motion-primitives/animated-background";
import { Disclosure } from "@/components/motion-primitives/disclosure";
import { InView } from "@/components/motion-primitives/in-view";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "qualified", label: "Qualified" },
  { id: "notyet", label: "Not yet" },
];

// Job search + match results. Qualified jobs go to the apply queue;
// unqualified ones link to the roadmap.
export default function JobsPage() {
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [searching, setSearching] = useState(false);
  const [matching, setMatching] = useState(false);
  const [drafting, setDrafting] = useState(null); // jobId being drafted
  const [filter, setFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sort, setSort] = useState("score"); // score | newest
  const [recs, setRecs] = useState(null);
  const [recommending, setRecommending] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [tailoredIds, setTailoredIds] = useState(new Set());
  const [tailoring, setTailoring] = useState(null); // jobId being tailored

  // Restore the latest search's results (not the whole stored backlog)
  // and any stored recommendations.
  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => {
        const all = data.jobs ?? [];
        setJobs(
          data.lastSearchIds ? all.filter((j) => data.lastSearchIds.includes(j.id)) : all
        );
        setTailoredIds(new Set(data.tailoredJobIds ?? []));
      })
      .catch(() => {});
    fetch("/api/recommend")
      .then((res) => res.json())
      .then((data) => setRecs(data.recommendations))
      .catch(() => {});
  }, []);

  async function recommend() {
    setRecommending(true);
    try {
      const res = await fetch("/api/recommend", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecs(data.recommendations);
    } catch (err) {
      toast.error(err.message || "Recommendation failed");
    } finally {
      setRecommending(false);
    }
  }

  function search(event) {
    event.preventDefault();
    runSearch(role);
  }

  async function pasteJob(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    setPasting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          company: form.get("company"),
          url: form.get("url"),
          description: form.get("description"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobs((prev) => [data.job, ...prev]);
      setShowPaste(false);

      // Same pipeline as searched jobs: screen it right away.
      setMatching(true);
      const matchRes = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: [data.job.id] }),
      });
      const matchData = await matchRes.json();
      if (matchRes.ok) {
        const byId = new Map(matchData.matched.map((j) => [j.id, j]));
        setJobs((prev) => prev.map((j) => byId.get(j.id) ?? j));
      } else {
        toast.error(matchData.error || "Screening failed");
      }
    } catch (err) {
      toast.error(err.message || "Couldn't add the job");
    } finally {
      setPasting(false);
      setMatching(false);
    }
  }

  async function tailorJob(job) {
    setTailoring(job.id);
    try {
      const res = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTailoredIds((prev) => new Set([...prev, job.id]));
      toast.success(`Resume tailored for ${job.company}`, {
        action: {
          label: "Download PDF",
          onClick: () =>
            (window.location.href = `/api/resume/pdf?jobId=${encodeURIComponent(job.id)}`),
        },
      });
    } catch (err) {
      toast.error(err.message || "Tailoring failed");
    } finally {
      setTailoring(null);
    }
  }

  async function runSearch(roleValue) {
    setSearching(true);
    try {
      const params = new URLSearchParams({ role: roleValue, location });
      const res = await fetch(`/api/jobs/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Show exactly what this search returned — the API keeps the match for
      // anything screened before, so replacing the list loses nothing.
      const fresh = (data.jobs ?? []).map((j) => ({ ...j, match: j.match ?? null }));
      setJobs(fresh);
      setSearching(false);

      // Screen only this search's results — each job is one Claude call.
      setMatching(true);
      const matchRes = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: fresh.map((j) => j.id) }),
      });
      const matchData = await matchRes.json();
      if (matchRes.ok) {
        const byId = new Map(matchData.matched.map((j) => [j.id, j]));
        setJobs((prev) => prev.map((j) => byId.get(j.id) ?? j));
        if (matchData.failed > 0) {
          toast.warning(`${matchData.failed} job(s) couldn't be screened — search again to retry`);
        }
      } else {
        toast.error(matchData.error || "Screening failed");
      }
    } catch (err) {
      toast.error(err.message || "Search failed");
    } finally {
      setSearching(false);
      setMatching(false);
    }
  }

  async function draftApplication(job) {
    setDrafting(job.id);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Application drafted for ${job.title}`, {
        action: { label: "Review", onClick: () => (window.location.href = "/queue") },
      });
    } catch (err) {
      toast.error(err.message || "Failed to draft application");
    } finally {
      setDrafting(null);
    }
  }

  const sources = useMemo(
    () => [...new Set(jobs.map((j) => j.source).filter(Boolean))].sort(),
    [jobs]
  );

  const visible = useMemo(() => {
    const filtered = jobs.filter((job) => {
      if (filter === "qualified" && !job.match?.qualified) return false;
      if (filter === "notyet" && (!job.match || job.match.qualified)) return false;
      if (sourceFilter !== "all" && job.source !== sourceFilter) return false;
      if (remoteOnly && !`${job.location}`.toLowerCase().includes("remote")) return false;
      return true;
    });
    if (sort === "newest") {
      return filtered.toSorted(
        (a, b) => new Date(b.posted_at ?? 0) - new Date(a.posted_at ?? 0)
      );
    }
    // Matched-and-scored first, best score on top.
    return filtered.toSorted(
      (a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1)
    );
  }, [jobs, filter, sourceFilter, remoteOnly, sort]);

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Find jobs</h1>
      <p className="mt-2 text-neutral-500">
        Search live postings — every result is screened against your resume.
      </p>

      {/* Expandable search toolbar */}
      <form
        onSubmit={search}
        className="mt-8 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-48 flex-1 items-center gap-2">
            <Search size={16} strokeWidth={1.5} className="shrink-0 text-neutral-500" aria-hidden="true" />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onFocus={() => setExpanded(true)}
              placeholder="Role, e.g. frontend intern"
              required
              aria-label="Role"
              className="w-full bg-transparent py-2 outline-none placeholder:text-neutral-400"
            />
          </div>
          <button
            type="submit"
            disabled={searching || matching}
            className="rounded-xl bg-black px-5 py-2.5 font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
        {/* Location row reveals once the toolbar is touched */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="mt-2 flex items-center gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <MapPin size={16} strokeWidth={1.5} className="shrink-0 text-neutral-500" aria-hidden="true" />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (optional)"
                aria-label="Location"
                className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-neutral-400"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Profile-based recommendations */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={recommend}
            disabled={recommending || searching || matching}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-neutral-500"
          >
            <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" />
            {recs ? "Refresh recommendations" : "Recommend for me"}
          </button>
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            aria-expanded={showPaste}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
          >
            <ClipboardPaste size={14} strokeWidth={1.5} aria-hidden="true" />
            Paste a job
          </button>
          {recommending ? (
            <AiLabel>Reading your resume for the right roles…</AiLabel>
          ) : (
            !recs && (
              <p className="text-sm text-neutral-500">
                Jobs, internships, and programs you actually qualify for — from
                your resume, not guesswork.
              </p>
            )
          )}
        </div>

        {/* Screen a job found anywhere — same pipeline as searched jobs */}
        {showPaste && (
          <form
            onSubmit={pasteJob}
            className="mt-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="title"
                required
                placeholder="Job title *"
                aria-label="Job title"
                className="rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-800"
              />
              <input
                name="company"
                placeholder="Company"
                aria-label="Company"
                className="rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-800"
              />
            </div>
            <input
              name="url"
              type="url"
              placeholder="Link to the posting (where you'd apply)"
              aria-label="Job URL"
              className="mt-3 w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-800"
            />
            <textarea
              name="description"
              required
              rows={6}
              placeholder="Paste the full job description *"
              aria-label="Job description"
              className="mt-3 w-full resize-y rounded-xl border border-neutral-200 bg-transparent p-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-800"
            />
            <div className="mt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPaste(false)}
                className="text-sm text-neutral-500 transition hover:text-black dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pasting || matching}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {pasting ? "Adding…" : "Add & screen"}
              </button>
            </div>
          </form>
        )}

        {recs && !recommending && (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {recs.map((rec) => (
              <li key={rec.query}>
                <button
                  type="button"
                  onClick={() => {
                    setRole(rec.query);
                    runSearch(rec.query);
                  }}
                  disabled={searching || matching}
                  className="h-full w-full rounded-2xl border border-neutral-200 p-4 text-left transition hover:border-neutral-400 disabled:opacity-50 dark:border-neutral-800 dark:hover:border-neutral-600"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-medium">{rec.query}</span>
                    <span className="shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 font-mono text-[10px] uppercase text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
                      {rec.kind}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-neutral-500">{rec.reason}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Filters */}
      {jobs.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <AnimatedBackground
            defaultValue={filter}
            onValueChange={(id) => id && setFilter(id)}
            className="rounded-full bg-neutral-100 dark:bg-neutral-900"
          >
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                data-id={id}
                type="button"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-500 transition data-[checked=true]:text-black dark:data-[checked=true]:text-white"
              >
                {label}
              </button>
            ))}
          </AnimatedBackground>

          {sources.length > 1 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              aria-label="Job source"
              className="rounded-full border border-neutral-200 bg-transparent px-3 py-1.5 text-sm font-medium text-neutral-500 outline-none transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setRemoteOnly((v) => !v)}
            aria-pressed={remoteOnly}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              remoteOnly
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "border border-neutral-200 text-neutral-500 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            }`}
          >
            Remote only
          </button>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort results"
            className="rounded-full border border-neutral-200 bg-transparent px-3 py-1.5 text-sm font-medium text-neutral-500 outline-none transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <option value="score">Best match</option>
            <option value="newest">Newest</option>
          </select>

          {matching && <AiLabel className="ml-auto">Screening…</AiLabel>}
        </div>
      )}

      {/* Results */}
      {searching ? (
        <ul className="mt-6 flex flex-col gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800"
            >
              <TextShimmer className="text-lg font-semibold">Searching job boards…</TextShimmer>
              <div className="mt-3 h-3 w-2/3 rounded bg-neutral-100 dark:bg-neutral-900" />
              <div className="mt-2 h-3 w-1/3 rounded bg-neutral-100 dark:bg-neutral-900" />
            </li>
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title={jobs.length === 0 ? "No jobs yet" : "Nothing in this filter"}
            description={
              jobs.length === 0
                ? "Search a role above — results are stored and screened against your profile."
                : "Try another filter, or search again."
            }
            cta={jobs.length === 0 ? "Upload your resume first" : undefined}
            href={jobs.length === 0 ? "/upload" : undefined}
          />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {visible.map((job) => (
            <InView key={job.id} as="li">
              <JobCard
                job={job}
                matching={matching && !job.match}
                drafting={drafting === job.id}
                onDraft={() => draftApplication(job)}
                tailored={tailoredIds.has(job.id)}
                tailoring={tailoring === job.id}
                onTailor={() => tailorJob(job)}
              />
            </InView>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function JobCard({ job, matching, drafting, onDraft, tailored, tailoring, onTailor }) {
  return (
    <Tilt rotationFactor={2}>
      <article className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        {(matching || drafting || tailoring) && <BorderTrail size={64} duration={2.4} />}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-semibold">
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                {job.title}
                <ExternalLink size={13} strokeWidth={1.5} className="shrink-0 text-neutral-400" aria-hidden="true" />
              </a>
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              {job.company} · {job.location}
              {job.source && (
                <span className="ml-2 rounded border border-neutral-200 px-1.5 py-0.5 font-mono text-[10px] uppercase text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
                  {job.source}
                </span>
              )}
            </p>
            {job.salary && (
              <p className="mt-1 font-mono text-xs text-neutral-500">{job.salary}</p>
            )}
          </div>

          {job.match ? (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {/* Verdict is never color-coded: filled = qualified, outline = not yet */}
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  job.match.qualified
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                }`}
              >
                {job.match.qualified ? "Qualified" : "Not yet"}
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums">
                <AnimatedNumber value={job.match.score} />
                <span className="text-xs text-neutral-500">/100</span>
              </span>
            </div>
          ) : matching ? (
            <AiLabel className="shrink-0">Screening…</AiLabel>
          ) : null}
        </div>

        {job.match && (
          <div className="mt-4 border-t border-neutral-100 pt-1 dark:border-neutral-900">
            {job.match.missing_requirements?.length > 0 && (
              <Disclosure
                className="!border-b-0"
                title={
                  <span className="text-sm text-neutral-500">
                    Missing requirements ({job.match.missing_requirements.length})
                  </span>
                }
              >
                <ul className="list-inside list-disc space-y-1 text-sm text-neutral-500">
                  {job.match.missing_requirements.map((req) => (
                    <li key={req}>{req}</li>
                  ))}
                </ul>
              </Disclosure>
            )}

            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="line-clamp-2 text-xs text-neutral-400 dark:text-neutral-600">
                {job.match.reasoning}
              </p>
              {job.match.qualified ? (
                <span className="flex shrink-0 items-center gap-2">
                  {tailored ? (
                    <a
                      href={`/api/resume/pdf?jobId=${encodeURIComponent(job.id)}`}
                      download="resume.pdf"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
                    >
                      <Download size={13} strokeWidth={1.5} aria-hidden="true" /> Tailored PDF
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={onTailor}
                      disabled={tailoring || drafting}
                      className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-neutral-500"
                    >
                      {tailoring ? "Tailoring…" : "Tailor resume"}
                    </button>
                  )}
                  <Magnetic>
                    <button
                      type="button"
                      onClick={onDraft}
                      disabled={drafting}
                      className="shrink-0 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
                    >
                      {drafting ? "Drafting…" : "Draft application"}
                    </button>
                  </Magnetic>
                </span>
              ) : (
                <Link
                  href={`/roadmap?jobId=${encodeURIComponent(job.id)}`}
                  className="shrink-0 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
                >
                  Build roadmap
                </Link>
              )}
            </div>
          </div>
        )}
      </article>
    </Tilt>
  );
}
