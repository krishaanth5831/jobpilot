"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, ChevronRight, Trash2, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { SlidingNumber } from "@/components/motion-primitives/sliding-number";
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContainer,
  MorphingDialogClose,
} from "@/components/motion-primitives/morphing-dialog";

// An application sitting in "submitted" this long with no reply gets a
// follow-up nudge.
const NUDGE_AFTER_DAYS = 10;

// The application pipeline after review. "hired" and "rejected" are
// terminal outcomes; everything else is a stage you move through.
const STAGES = [
  { id: "submitted", label: "Submitted" },
  { id: "interviewing", label: "Interviewing" },
  { id: "offer", label: "Offer" },
  { id: "hired", label: "Hired" },
  { id: "rejected", label: "Rejected" },
];

// Review queue + application tracker: read each drafted cover letter in a
// dialog that morphs out of its row, apply on the real job page, then track
// the application through interviews to an outcome. jobpilot never
// auto-submits.
export default function QueuePage() {
  const [applications, setApplications] = useState([]);
  const [jobsById, setJobsById] = useState(new Map());

  useEffect(() => {
    Promise.all([
      fetch("/api/applications").then((res) => res.json()),
      fetch("/api/jobs").then((res) => res.json()),
    ])
      .then(([apps, jobs]) => {
        setApplications(apps.applications ?? []);
        setJobsById(new Map((jobs.jobs ?? []).map((j) => [j.id, j])));
      })
      .catch(() => {});
  }, []);

  async function patchApplication(id, patch) {
    const res = await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) throw new Error("Update failed");
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function extractLessons(applicationId) {
    fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.insight?.lessons?.length) {
          toast.success(
            `Congrats! ${data.insight.lessons.length} lesson${
              data.insight.lessons.length === 1 ? "" : "s"
            } saved from this win — future resumes get the benefit`
          );
        }
      })
      .catch(() => {});
  }

  async function deleteApplication(id) {
    try {
      const res = await fetch("/api/applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setApplications((prev) => prev.filter((a) => a.id !== id));
      toast.success("Application deleted");
    } catch {
      toast.error("Couldn't delete the application");
    }
  }

  const pending = useMemo(
    () => applications.filter((a) => a.status === "pending_review"),
    [applications]
  );
  const tracked = useMemo(
    () => applications.filter((a) => a.status !== "pending_review"),
    [applications]
  );

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Review queue</h1>
      <p className="mt-2 text-neutral-500">
        Read each draft, tweak it, apply on the company&apos;s page, then track it
        below all the way to an offer.
      </p>

      {applications.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nothing to review yet"
            description="Draft an application from a qualified job and it lands here for your review."
            cta="Find jobs"
            href="/jobs"
          />
        </div>
      ) : (
        <>
          {/* Drafts awaiting review */}
          {pending.length > 0 && (
            <ul className="mt-8 flex flex-col gap-3">
              {pending.map((app) => (
                <li key={app.id}>
                  <ApplicationRow
                    app={app}
                    job={jobsById.get(app.jobId)}
                    onPatch={(patch) => patchApplication(app.id, patch)}
                  />
                </li>
              ))}
            </ul>
          )}
          {pending.length === 0 && (
            <p className="mt-8 text-sm text-neutral-500">
              No drafts waiting for review.
            </p>
          )}

          {/* Application tracker */}
          {tracked.length > 0 && (
            <section className="mt-14">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Application tracker
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Move each application along as you hear back.
                  </p>
                </div>
                <TrackerStats tracked={tracked} />
              </div>
              <ul className="mt-5 flex flex-col gap-3">
                {tracked.map((app) => (
                  <li key={app.id}>
                    <TrackerRow
                      app={app}
                      job={jobsById.get(app.jobId)}
                      onStage={(status) => {
                        patchApplication(app.id, { status })
                          .then(() => {
                            // Feedback loop: a hire gets distilled into
                            // lessons that steer future resumes and letters.
                            if (status === "hired") extractLessons(app.id);
                          })
                          .catch(() => toast.error("Couldn't update the stage"));
                      }}
                      onDelete={() => deleteApplication(app.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}

function TrackerStats({ tracked }) {
  const active = tracked.filter(
    (a) => a.status !== "hired" && a.status !== "rejected"
  ).length;
  const hired = tracked.filter((a) => a.status === "hired").length;

  return (
    <div className="flex gap-5 font-mono text-sm">
      <span>
        <SlidingNumber value={active} className="text-xl font-semibold" />
        <span className="block text-[10px] uppercase tracking-widest text-neutral-500">
          in play
        </span>
      </span>
      <span>
        <SlidingNumber value={hired} className="text-xl font-semibold" />
        <span className="block text-[10px] uppercase tracking-widest text-neutral-500">
          hired
        </span>
      </span>
    </div>
  );
}

function TrackerRow({ app, job, onStage, onDelete }) {
  const [nudging, setNudging] = useState(false);
  // Snapshot "now" once per mount — day precision, and render stays pure.
  const [now] = useState(() => Date.now());
  const isHired = app.status === "hired";
  const isRejected = app.status === "rejected";

  const quietDays =
    app.status === "submitted"
      ? Math.floor((now - new Date(app.submittedAt ?? app.createdAt)) / 86400000)
      : 0;

  async function draftFollowUp() {
    setNudging(true);
    try {
      const res = await fetch("/api/applications/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await navigator.clipboard.writeText(data.followUp);
      toast.success("Follow-up note copied — paste it into an email or the portal");
    } catch (err) {
      toast.error(err.message || "Couldn't draft the follow-up");
    } finally {
      setNudging(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isHired
          ? "border-black dark:border-white"
          : "border-neutral-200 dark:border-neutral-800"
      } ${isRejected ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate font-semibold ${isRejected ? "line-through" : ""}`}>
            {job ? `${job.title} · ${job.company}` : app.jobId}
          </p>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">
            applied {new Date(app.createdAt).toLocaleDateString()}
            {job?.url && (
              <>
                {" · "}
                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  job page <ExternalLink size={10} strokeWidth={1.5} aria-hidden="true" />
                </a>
              </>
            )}
          </p>
        </div>
        {isHired && (
          <span className="flex items-center gap-1.5 rounded-full bg-black px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-black">
            <Check size={12} strokeWidth={2} aria-hidden="true" /> Hired
          </span>
        )}
        {isRejected && (
          <span className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-500 dark:border-neutral-700">
            <X size={12} strokeWidth={2} aria-hidden="true" /> Rejected
          </span>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete application"
          title="Delete application"
          className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-black dark:hover:bg-neutral-900 dark:hover:text-white"
        >
          <Trash2 size={15} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {/* Gone-quiet nudge */}
      {quietDays >= NUDGE_AFTER_DAYS && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-neutral-300 px-3 py-2 dark:border-neutral-700">
          <p className="text-sm text-neutral-500">
            No reply in <span className="font-mono">{quietDays}</span> days — a
            short follow-up can restart the conversation.
          </p>
          <button
            type="button"
            onClick={draftFollowUp}
            disabled={nudging}
            className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium transition hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-neutral-500"
          >
            {nudging ? "Drafting…" : "Draft follow-up"}
          </button>
        </div>
      )}

      {/* Stage pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STAGES.map(({ id, label }) => {
          const current = app.status === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onStage(id)}
              aria-pressed={current}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                current
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "border border-neutral-200 text-neutral-500 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ApplicationRow({ app, job, onPatch }) {
  const [draft, setDraft] = useState(app.coverLetter);

  async function copyDraft() {
    await navigator.clipboard.writeText(draft);
    toast.success("Cover letter copied");
  }

  async function saveDraft() {
    if (draft === app.coverLetter) return;
    try {
      await onPatch({ coverLetter: draft });
      toast.success("Draft saved");
    } catch {
      toast.error("Couldn't save the draft");
    }
  }

  async function markSubmitted() {
    try {
      if (draft !== app.coverLetter) await onPatch({ coverLetter: draft });
      await onPatch({ status: "submitted" });
      toast.success("Marked as submitted — track it below");
    } catch {
      toast.error("Couldn't update the application");
    }
  }

  return (
    <MorphingDialog>
      <MorphingDialogTrigger className="w-full rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600">
        <span className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {job ? `${job.title} · ${job.company}` : app.jobId}
            </span>
            <span className="mt-0.5 block truncate text-sm text-neutral-500">
              {draft.split("\n").find(Boolean)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
              Pending review
            </span>
            <ChevronRight size={16} strokeWidth={1.5} className="text-neutral-400" aria-hidden="true" />
          </span>
        </span>
      </MorphingDialogTrigger>

      <MorphingDialogContainer>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {job ? job.title : "Application"}
            </h2>
            {job && (
              <p className="mt-0.5 text-sm text-neutral-500">
                {job.company} · {job.location}
              </p>
            )}
          </div>
          <MorphingDialogClose />
        </div>

        <label className="mt-5 block text-xs font-medium uppercase tracking-widest text-neutral-500">
          Cover letter
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveDraft}
            rows={12}
            className="mt-2 w-full resize-y rounded-xl border border-neutral-200 bg-transparent p-4 font-sans text-sm normal-case tracking-normal leading-relaxed text-black outline-none focus:border-neutral-500 dark:border-neutral-800 dark:text-white"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copyDraft}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
          >
            <Copy size={14} strokeWidth={1.5} aria-hidden="true" /> Copy
          </button>
          {job?.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
            >
              <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" /> Open job page
            </a>
          )}
          <button
            type="button"
            onClick={markSubmitted}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black"
          >
            <Check size={14} strokeWidth={1.5} aria-hidden="true" /> Mark as submitted
          </button>
        </div>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}
