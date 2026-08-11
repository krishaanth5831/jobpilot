"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { AiCard, AiLabel } from "@/components/ai-loading";
import { EmptyState } from "@/components/empty-state";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { InView } from "@/components/motion-primitives/in-view";
import { SlidingNumber } from "@/components/motion-primitives/sliding-number";

// Skill-gap roadmap: pick a job you don't qualify for and Claude turns
// the missing requirements into an ordered action plan with persisted
// step checkboxes.
export default function RoadmapPage() {
  return (
    <Suspense fallback={null}>
      <RoadmapContent />
    </Suspense>
  );
}

function RoadmapContent() {
  const preselected = useSearchParams().get("jobId");
  const [jobs, setJobs] = useState([]);
  const [selectedId, setSelectedId] = useState(preselected);
  const [loading, setLoading] = useState(false);
  const [rescreening, setRescreening] = useState(false);

  // Unqualified-but-matched jobs are roadmap candidates.
  const candidates = useMemo(
    () => jobs.filter((j) => j.match && !j.match.qualified),
    [jobs]
  );
  const selected = candidates.find((j) => j.id === selectedId);
  // The displayed roadmap lives on the job itself (as in the db).
  const roadmap = selected?.roadmap ?? null;

  // Only the latest search's jobs — mirrors what the jobs tab shows, so this
  // page doesn't fill up with the whole stored backlog.
  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => {
        const all = data.jobs ?? [];
        setJobs(
          data.lastSearchIds ? all.filter((j) => data.lastSearchIds.includes(j.id)) : all
        );
      })
      .catch(() => {});
  }, []);

  function setJobRoadmap(jobId, nextRoadmap) {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, roadmap: nextRoadmap } : j))
    );
  }

  async function generate() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobRoadmap(selectedId, data.roadmap);
    } catch (err) {
      toast.error(err.message || "Failed to generate the roadmap");
    } finally {
      setLoading(false);
    }
  }

  async function rescreen() {
    const before = selected.match.score;
    setRescreening(true);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = data.matched[0];
      setJobs((prev) => prev.map((j) => (j.id === selectedId ? updated : j)));
      if (updated.match.qualified) {
        toast.success(
          `You qualify now — score ${before} → ${updated.match.score}. Draft the application from the jobs tab!`
        );
      } else {
        toast.success(`Score ${before} → ${updated.match.score}`);
      }
    } catch (err) {
      toast.error(err.message || "Re-screening failed");
    } finally {
      setRescreening(false);
    }
  }

  async function deleteRoadmap() {
    try {
      const res = await fetch("/api/roadmap", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedId }),
      });
      if (!res.ok) throw new Error();
      setJobRoadmap(selectedId, null);
      toast.success("Roadmap deleted");
    } catch {
      toast.error("Couldn't delete the roadmap");
    }
  }

  async function toggleStep(stepIndex, done) {
    const withDone = (r, value) => ({
      ...r,
      steps: r.steps.map((s, i) => (i === stepIndex ? { ...s, done: value } : s)),
    });
    // Optimistic; the API persists to lowdb.
    setJobRoadmap(selectedId, withDone(roadmap, done));
    try {
      const res = await fetch("/api/roadmap", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedId, stepIndex, done }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setJobRoadmap(selectedId, withDone(roadmap, !done));
      toast.error("Couldn't save the checkmark");
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Get qualified"
        description="A concrete plan to close the gap between your resume and the job you want."
      />

      {candidates.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No gap to close yet"
            description="Search and screen some jobs first — anything from your latest search you don't qualify for shows up here."
            cta="Find jobs"
            href="/jobs"
          />
        </div>
      ) : (
        <>
          {/* Job picker carousel */}
          <h2 className="mt-10 text-xs font-medium uppercase tracking-widest text-muted">
            Pick a target job
          </h2>
          <ul className="-mx-6 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2">
            {candidates.map((job) => {
              const active = job.id === selectedId;
              return (
                <li key={job.id} className="w-64 shrink-0 snap-start">
                  <button
                    type="button"
                    onClick={() => setSelectedId(job.id)}
                    aria-pressed={active}
                    className={`h-full w-full rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-accent bg-accent-wash"
                        : "border-line hover:border-accent"
                    }`}
                  >
                    <span className="block truncate font-semibold">{job.title}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted">
                      {job.company}
                    </span>
                    <span className="mt-2 block font-mono text-xs text-muted">
                      score {job.match.score}/100 · missing{" "}
                      {job.match.missing_requirements.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected && (
            <div className="mt-6">
              <AiCard busy={loading} className="p-5">
                {loading ? (
                  <div className="flex flex-col gap-1">
                    <TextScramble className="font-medium" duration={1.2}>
                      Analyzing the gap…
                    </TextScramble>
                    <AiLabel>
                      Turning {selected.match.missing_requirements.length} missing
                      requirements into a plan
                    </AiLabel>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm text-muted">
                      {roadmap
                        ? `Plan for ${selected.title} at ${selected.company}`
                        : `Ready to plan for ${selected.title} at ${selected.company}`}
                    </p>
                    <span className="flex items-center gap-2">
                      {roadmap && (
                        <button
                          type="button"
                          onClick={deleteRoadmap}
                          className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-muted transition hover:border-accent "
                        >
                          <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" /> Delete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={generate}
                        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:bg-accent-hover active:translate-y-px "
                      >
                        {roadmap ? "Regenerate roadmap" : "Build my roadmap"}
                      </button>
                    </span>
                  </div>
                )}
              </AiCard>
            </div>
          )}

          {roadmap && !loading && <Timeline roadmap={roadmap} onToggle={toggleStep} />}

          {/* Close the loop: improved profile → new verdict */}
          {selected && !loading && (
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-line p-4 ">
              <p className="text-sm text-muted">
                Closed some of these gaps? Add the new skills through the{" "}
                <Link href="/resume" className="underline hover:text-accent">
                  Resume studio
                </Link>{" "}
                interview first, then see if the verdict moves.
              </p>
              <button
                type="button"
                onClick={rescreen}
                disabled={rescreening}
                className="rounded-xl border border-line px-4 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-50 "
              >
                {rescreening
                  ? "Re-screening…"
                  : `Re-screen me (now ${selected.match.score}/100)`}
              </button>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}

function Timeline({ roadmap, onToggle }) {
  const doneCount = roadmap.steps.filter((s) => s.done).length;

  return (
    <div className="relative mt-10">
      {/* Faint circle-scatter backdrop */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center opacity-30 dark:invert"
        style={{ backgroundImage: "url(/backgrounds/roadmap-circles.svg)" }}
        aria-hidden="true"
      />

      <div className="flex items-end justify-between">
        <p className="text-muted ">{roadmap.summary}</p>
      </div>
      <p className="mt-3 font-mono text-xs text-muted">
        <SlidingNumber value={doneCount} /> / {roadmap.steps.length} steps done
      </p>

      <ol className="mt-8 space-y-8 border-l border-line pl-8 ">
        {roadmap.steps.map((step, i) => (
          <InView key={i} as="li" className="relative">
            <span
              className={`absolute -left-[37px] top-1 flex h-4 w-4 items-center justify-center rounded-full border ${
                step.done
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-surface"
              }`}
              aria-hidden="true"
            >
              {step.done && <Check size={10} strokeWidth={2} />}
            </span>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(step.done)}
                  onChange={(e) => onToggle(i, e.target.checked)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <span
                  className={`font-semibold ${step.done ? "text-muted line-through " : ""}`}
                >
                  {step.title}
                </span>
              </label>
              <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-xs text-muted ">
                {step.category} · <EstimatedTime value={step.estimated_time} />
              </span>
            </div>
            <p className="mt-2 pl-7 text-sm text-muted ">
              {step.description}
            </p>
            {step.resources?.length > 0 && (
              <ul className="mt-2 list-inside list-disc pl-7 text-sm text-muted">
                {step.resources.map((r, j) => (
                  <li key={j}>{r}</li>
                ))}
              </ul>
            )}
          </InView>
        ))}
      </ol>
    </div>
  );
}

// "6 weeks" → sliding 6 + " weeks"; anything non-numeric renders as-is.
function EstimatedTime({ value }) {
  const match = String(value).match(/^(\d+)(.*)$/);
  if (!match) return value;
  return (
    <>
      <SlidingNumber value={Number(match[1])} />
      {match[2]}
    </>
  );
}
