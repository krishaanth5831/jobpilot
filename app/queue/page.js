"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, ChevronRight, GraduationCap, RefreshCw, Trash2, X } from "lucide-react";
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
// the application through interviews to an outcome. jobblast never
// auto-submits.
export default function QueuePage() {
  const [applications, setApplications] = useState([]);
  const [jobsById, setJobsById] = useState(new Map());
  const [prep, setPrep] = useState(null); // { job, data?, loading }

  async function openPrep(job, regenerate = false) {
    setPrep({ job, loading: true, data: regenerate ? null : prep?.data });
    try {
      const res = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, regenerate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPrep({ job, data: data.prep, loading: false });
    } catch (err) {
      toast.error(err.message || "Couldn't generate interview prep");
      setPrep(null);
    }
  }

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

          {/* Application tracker — kanban board */}
          {tracked.length > 0 && (
            <section className="mt-14">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Application tracker
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Drag a card to its new stage as you hear back — or use the
                    stage menu on the card.
                  </p>
                </div>
                <TrackerStats tracked={tracked} />
              </div>
              <KanbanBoard
                tracked={tracked}
                jobsById={jobsById}
                onStage={(app, status) => {
                  patchApplication(app.id, { status })
                    .then(() => {
                      // Feedback loop: a hire gets distilled into
                      // lessons that steer future resumes and letters.
                      if (status === "hired") extractLessons(app.id);
                    })
                    .catch(() => toast.error("Couldn't update the stage"));
                }}
                onDelete={(app) => deleteApplication(app.id)}
                onPrep={(app) => {
                  const job = jobsById.get(app.jobId);
                  if (job) openPrep(job);
                }}
              />
            </section>
          )}
        </>
      )}

      {prep && (
        <InterviewPrepDialog
          prep={prep}
          onClose={() => setPrep(null)}
          onRegenerate={() => openPrep(prep.job, true)}
        />
      )}
    </PageShell>
  );
}

// Full-screen overlay with the generated questions, answers, and tips.
function InterviewPrepDialog({ prep, onClose, onRegenerate }) {
  // Esc closes; page scroll locks while open.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Interview prep for ${prep.job.title}`}
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 sm:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-w-2xl rounded-2xl bg-white p-6 dark:bg-neutral-950 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Interview prep</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              {prep.job.title} · {prep.job.company}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-black dark:hover:bg-neutral-900 dark:hover:text-white"
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        {prep.loading ? (
          <p className="mt-8 pb-4 text-sm text-neutral-500">
            Studying the job description and your resume — usually ~20 seconds…
          </p>
        ) : (
          <>
            <ol className="mt-6 flex flex-col gap-5">
              {(prep.data?.questions ?? []).map((q, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
                >
                  <p className="font-medium leading-snug">
                    <span className="mr-2 font-mono text-xs text-neutral-400">
                      Q{i + 1}
                    </span>
                    {q.question}
                  </p>
                  <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {q.answer}
                  </p>
                  <p className="mt-2.5 border-t border-dashed border-neutral-200 pt-2 text-xs text-neutral-500 dark:border-neutral-800">
                    {q.tip}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  const text = (prep.data?.questions ?? [])
                    .map((q, i) => `Q${i + 1}: ${q.question}\n\n${q.answer}\n\nTip: ${q.tip}`)
                    .join("\n\n---\n\n");
                  navigator.clipboard.writeText(text);
                  toast.success("Prep copied — read it before the call");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
              >
                <Copy size={14} strokeWidth={1.5} aria-hidden="true" /> Copy all
              </button>
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
              >
                <RefreshCw size={14} strokeWidth={1.5} aria-hidden="true" /> Regenerate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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

// Kanban board: one column per stage, cards move by drag-and-drop (desktop)
// or the stage menu on each card (touch). Dropping a card PATCHes its status,
// which also feeds the learnings outcome hook server-side.
function KanbanBoard({ tracked, jobsById, onStage, onDelete, onPrep }) {
  const [dragOver, setDragOver] = useState(null); // column id under the drag

  const byStage = useMemo(() => {
    const m = new Map(STAGES.map(({ id }) => [id, []]));
    for (const app of tracked) (m.get(app.status) ?? m.get("submitted")).push(app);
    return m;
  }, [tracked]);

  function dropOn(stageId, e) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    const app = tracked.find((a) => a.id === id);
    if (app && app.status !== stageId) onStage(app, stageId);
  }

  return (
    <div className="-mx-6 mt-5 overflow-x-auto px-6 pb-2">
      <div className="flex min-w-max gap-3">
        {STAGES.map(({ id, label }) => {
          const cards = byStage.get(id);
          return (
            <div
              key={id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(id);
              }}
              onDragLeave={() => setDragOver((cur) => (cur === id ? null : cur))}
              onDrop={(e) => dropOn(id, e)}
              className={`w-60 shrink-0 rounded-2xl border p-3 transition ${
                dragOver === id
                  ? "border-black bg-neutral-50 dark:border-white dark:bg-neutral-900"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <p className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-widest text-neutral-500">
                {label}
                <span className="font-mono tabular-nums">{cards.length}</span>
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {cards.map((app) => (
                  <KanbanCard
                    key={app.id}
                    app={app}
                    job={jobsById.get(app.jobId)}
                    onStage={(status) => onStage(app, status)}
                    onDelete={() => onDelete(app)}
                    onPrep={() => onPrep(app)}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-4 text-center text-xs text-neutral-400 dark:border-neutral-800">
                    Drop here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ app, job, onStage, onDelete, onPrep }) {
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
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", app.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`cursor-grab rounded-xl border bg-white p-3 active:cursor-grabbing dark:bg-neutral-950 ${
        isHired
          ? "border-black dark:border-white"
          : "border-neutral-200 dark:border-neutral-800"
      } ${isRejected ? "opacity-60" : ""}`}
    >
      <p
        title={job ? `${job.title} · ${job.company}` : app.jobId}
        className={`truncate text-sm font-semibold ${isRejected ? "line-through" : ""}`}
      >
        {job ? job.title : app.jobId}
      </p>
      {job && <p className="truncate text-xs text-neutral-500">{job.company}</p>}
      <p className="mt-1 font-mono text-[11px] text-neutral-500">
        applied {new Date(app.createdAt).toLocaleDateString()}
      </p>

      {quietDays >= NUDGE_AFTER_DAYS && (
        <button
          type="button"
          onClick={draftFollowUp}
          disabled={nudging}
          className="mt-2 w-full rounded-lg border border-dashed border-neutral-300 px-2 py-1.5 text-left text-[11px] text-neutral-500 transition hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-neutral-500"
        >
          {nudging
            ? "Drafting follow-up…"
            : `Quiet for ${quietDays} days — draft a follow-up`}
        </button>
      )}

      {/* An interview on the calendar is when prep matters. */}
      {(app.status === "interviewing" || app.status === "offer") && job && (
        <button
          type="button"
          onClick={onPrep}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-black px-2 py-1.5 text-[11px] font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black"
        >
          <GraduationCap size={12} strokeWidth={1.5} aria-hidden="true" />
          Interview prep
        </button>
      )}

      <div className="mt-2 flex items-center gap-1.5">
        {/* Touch-friendly alternative to dragging. */}
        <select
          value={app.status}
          onChange={(e) => onStage(e.target.value)}
          aria-label="Move to stage"
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-transparent px-2 py-1 text-xs text-neutral-600 outline-none focus:border-neutral-500 dark:border-neutral-800 dark:text-neutral-300 dark:bg-neutral-950"
        >
          {STAGES.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        {job?.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            aria-label="Open job page"
            title="Open job page"
            className="rounded-lg border border-neutral-200 p-1.5 text-neutral-400 transition hover:border-neutral-400 hover:text-black dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:text-white"
          >
            <ExternalLink size={12} strokeWidth={1.5} aria-hidden="true" />
          </a>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete application"
          title="Delete application"
          className="rounded-lg border border-neutral-200 p-1.5 text-neutral-400 transition hover:border-neutral-400 hover:text-black dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:text-white"
        >
          <Trash2 size={12} strokeWidth={1.5} aria-hidden="true" />
        </button>
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
