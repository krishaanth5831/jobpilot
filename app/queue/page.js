"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { TransitionPanel } from "@/components/motion-primitives/transition-panel";
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContainer,
  MorphingDialogClose,
} from "@/components/motion-primitives/morphing-dialog";

// Application review queue: read each drafted cover letter in a dialog
// that morphs out of its row, tweak it, apply on the real job page
// (job.url), then mark it submitted. jobpilot never auto-submits.
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

  const pending = useMemo(
    () => applications.filter((a) => a.status === "pending_review"),
    [applications]
  );
  const submitted = useMemo(
    () => applications.filter((a) => a.status !== "pending_review"),
    [applications]
  );

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Review queue</h1>
      <p className="mt-2 text-neutral-500">
        Read each draft, tweak it, apply on the company&apos;s page, then mark it done.
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
        <ul className="mt-8 flex flex-col gap-3">
          {[...pending, ...submitted].map((app) => (
            <li key={app.id}>
              <TransitionPanel activeIndex={app.status === "pending_review" ? 0 : 1}>
                <ApplicationRow
                  app={app}
                  job={jobsById.get(app.jobId)}
                  onPatch={(patch) => patchApplication(app.id, patch)}
                />
                <SubmittedRow app={app} job={jobsById.get(app.jobId)} />
              </TransitionPanel>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
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
      toast.success("Marked as submitted — nice work");
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

// Submitted rows collapse to a quiet ✓ line.
function SubmittedRow({ app, job }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 px-5 py-3 text-sm text-neutral-500 dark:border-neutral-900">
      <Check size={14} strokeWidth={1.5} aria-hidden="true" />
      <span className="truncate">
        {job ? `${job.title} · ${job.company}` : app.jobId}
      </span>
      <span className="ml-auto font-mono text-xs uppercase">submitted</span>
    </div>
  );
}
