"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, RefreshCw, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TemplatePreview } from "@/components/template-preview";
import { TEMPLATES, DEFAULT_TEMPLATE } from "@/lib/resume-templates";
import { profileToMarkdown } from "@/lib/resume-doc";
import { AiCard } from "@/components/ai-loading";
import { EmptyState } from "@/components/empty-state";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { InView } from "@/components/motion-primitives/in-view";

// Resume studio: review the uploaded resume, edit it directly on the page,
// then typeset whatever you wrote into one of the templates and download it.
export default function ResumePage() {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState(null);
  const [hasResume, setHasResume] = useState(false);
  const [review, setReview] = useState(null);
  const [markdown, setMarkdown] = useState(""); // live editor content
  const [savedMarkdown, setSavedMarkdown] = useState(""); // last persisted copy
  const [template, setTemplate] = useState(null);
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
        setMarkdown(data.resumeMarkdown ?? "");
        setSavedMarkdown(data.resumeMarkdown ?? "");
        setTemplate(data.template);
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
        Get a blunt read of your resume, edit it right here, and download it in
        whichever template fits — no rewrites you didn&apos;t make.
      </p>

      {loaded && !ready && (
        <div className="mt-10">
          <EmptyState
            title={profile ? "Re-upload your resume" : "No resume yet"}
            description={
              profile
                ? "The studio works from your original resume — drop your PDF again once to enable it."
                : "Upload your resume first — the studio reviews it, then lets you edit and restyle it."
            }
            cta="Upload resume"
            href="/upload"
          />
        </div>
      )}

      {ready && (
        <>
          <ReviewSection review={review} onReview={setReview} />
          <EditorSection
            markdown={markdown}
            savedMarkdown={savedMarkdown}
            profile={profile}
            onChange={setMarkdown}
            onSaved={setSavedMarkdown}
          />
          <TemplateSection markdown={markdown} template={template} onTemplate={setTemplate} />
          <InsightsSection insights={insights} />
        </>
      )}
    </PageShell>
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
        description="A blunt read of your current resume — every issue comes with a concrete fix you can make in the editor below."
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
                  One pass over your resume — content, impact, clarity.
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

/* ---------- 02 · Edit ---------- */

function EditorSection({ markdown, savedMarkdown, profile, onChange, onSaved }) {
  const [saving, setSaving] = useState(false);
  const dirty = markdown !== savedMarkdown;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/resume/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(markdown);
      toast.success("Resume saved");
      return true;
    } catch (err) {
      toast.error(err.message || "Couldn't save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Downloads always reflect what's on screen: save first if there are edits,
  // then hand off to the PDF route (which styles it with the chosen template).
  async function downloadPdf() {
    if (dirty && !(await save())) return;
    window.location.href = "/api/resume/pdf";
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown);
    toast.success("Resume copied as markdown");
  }

  function resetToUploaded() {
    onChange(profileToMarkdown(profile));
    toast.message("Reset to your uploaded resume — Save to keep it");
  }

  return (
    <section className="mt-14">
      <SectionHeader
        step={2}
        title="Edit"
        description="Your resume, editable right here. Every change flows straight into the template previews and the PDF — nothing is rewritten but you."
      />

      <div className="mt-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <p className="font-mono text-xs text-neutral-500">
            resume.md · {dirty ? "unsaved changes" : "saved"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetToUploaded}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <RotateCcw size={12} strokeWidth={1.5} aria-hidden="true" /> Reset
            </button>
            <button
              type="button"
              onClick={copyMarkdown}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <Copy size={12} strokeWidth={1.5} aria-hidden="true" /> Copy
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium transition hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-neutral-500"
            >
              <Check size={12} strokeWidth={1.5} aria-hidden="true" /> {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              <Download size={12} strokeWidth={1.5} aria-hidden="true" /> Download PDF
            </button>
          </div>
        </div>
        <textarea
          value={markdown}
          onChange={(e) => onChange(e.target.value)}
          rows={24}
          spellCheck={false}
          aria-label="Resume markdown"
          className="w-full resize-y bg-transparent p-5 font-mono text-xs leading-relaxed text-neutral-700 outline-none dark:text-neutral-300"
        />
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Formatting: start your name with &ldquo;# &rdquo;, a section with &ldquo;## &rdquo; (e.g.
        Experience), a role or entry with &ldquo;### &rdquo;, and each bullet with &ldquo;- &rdquo;. The
        line right under your name is your contact info.
      </p>
    </section>
  );
}

/* ---------- 03 · Template ---------- */

// Ten templates, previewed with the resume text in the editor above. The 3
// Claude recommends for this profile come first; the chosen one styles every
// PDF download, including tailored resumes.
function TemplateSection({ markdown, template, onTemplate }) {
  const [busy, setBusy] = useState(false);
  const picks = template?.picks ?? null;
  const selected = template?.selected ?? DEFAULT_TEMPLATE;
  const reasonById = new Map((picks ?? []).map((p) => [p.id, p.reason]));

  const ordered = [
    ...(picks ?? [])
      .map((p) => TEMPLATES.find((t) => t.id === p.id))
      .filter(Boolean),
    ...TEMPLATES.filter((t) => !reasonById.has(t.id)),
  ];

  async function post(body, okMessage) {
    setBusy(true);
    try {
      const res = await fetch("/api/resume/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onTemplate(data.template);
      if (okMessage) toast.success(okMessage);
    } catch (err) {
      toast.error(err.message || "Template update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-14">
      <SectionHeader
        step={3}
        title="Template"
        description="Whatever's in your editor, typeset into a design. The one you pick styles every PDF download, tailored versions included."
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">Previewed with your live resume text above.</p>
        <button
          type="button"
          onClick={() => post({ recommend: true }, "Top 3 templates picked for your profile")}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-neutral-500"
        >
          <Sparkles size={13} strokeWidth={1.5} aria-hidden="true" />
          {picks ? "Re-recommend" : "Recommend 3 for me"}
        </button>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {ordered.map((t) => {
          const reason = reasonById.get(t.id);
          const isSelected = t.id === selected;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => post({ id: t.id }, `${t.name} will style your PDFs`)}
                disabled={busy}
                aria-pressed={isSelected}
                className="w-full text-left disabled:opacity-60"
              >
                <span
                  className={`block overflow-hidden rounded-xl border-2 transition ${
                    isSelected
                      ? "border-black dark:border-white"
                      : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                  }`}
                >
                  <TemplatePreview template={t} markdown={markdown} />
                </span>
                <span className="mt-1.5 flex items-center gap-1.5 px-0.5">
                  <span className="text-xs font-medium">{t.name}</span>
                  {isSelected && (
                    <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                  )}
                  {reason && (
                    <span className="ml-auto rounded-full bg-black px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white dark:bg-white dark:text-black">
                      pick
                    </span>
                  )}
                </span>
                {reason && (
                  <span className="mt-0.5 block px-0.5 text-[11px] leading-snug text-neutral-500">
                    {reason}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
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
        description="Every hire gets distilled into lessons that automatically sharpen future reviews and cover letters."
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
