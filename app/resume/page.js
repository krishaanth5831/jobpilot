"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X, Minus, Copy, Download, Plus, Trash2, RefreshCw, RotateCcw, Sparkles, Trophy, Maximize2, ChevronDown, ChevronUp } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TemplatePreview } from "@/components/template-preview";
import { TEMPLATES, DEFAULT_TEMPLATE, getTemplate } from "@/lib/resume-templates";
import { profileToDoc, profileToMarkdown } from "@/lib/resume-doc";
import { AiCard } from "@/components/ai-loading";
import { EmptyState } from "@/components/empty-state";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { InView } from "@/components/motion-primitives/in-view";

const BLANK_EXP = { title: "", company: "", duration: "", highlights: [] };
const BLANK_EDU = { degree: "", field: "", institution: "", graduation_year: "" };
const BLANK_PROJ = { name: "", description: "", technologies: [] };

// Resume studio: audit the resume for ATS-friendliness, edit it directly on
// the page (structured, with a live preview), then download it in any template.
export default function ResumePage() {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState(null);
  const [hasResume, setHasResume] = useState(false);
  const [review, setReview] = useState(null);
  const [doc, setDoc] = useState(null); // structured resume document being edited
  const [savedDoc, setSavedDoc] = useState(null); // last persisted copy
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
        setDoc(data.resumeDoc ?? null);
        setSavedDoc(data.resumeDoc ?? null);
        setTemplate(data.template);
        setInsights(insightData.insights ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const ready = profile && hasResume && doc;
  const markdown = useMemo(() => (doc ? profileToMarkdown(doc) : ""), [doc]);
  const selectedTemplate = getTemplate(template?.selected ?? DEFAULT_TEMPLATE);

  return (
    <PageShell width="max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">Resume studio</h1>
      <p className="mt-2 max-w-2xl text-neutral-500">
        See how ATS-friendly your resume is, edit it right here, and download it
        in whichever template fits — no rewrites you didn&apos;t make.
      </p>

      {loaded && !ready && (
        <div className="mt-10">
          <EmptyState
            title={profile ? "Re-upload your resume" : "No resume yet"}
            description={
              profile
                ? "The studio works from your original resume — drop your PDF again once to enable it."
                : "Upload your resume first — the studio audits it, then lets you edit and restyle it."
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
            doc={doc}
            savedDoc={savedDoc}
            profile={profile}
            template={selectedTemplate}
            markdown={markdown}
            onChange={setDoc}
            onSaved={setSavedDoc}
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
      <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>
    </div>
  );
}

/* ---------- 01 · ATS review ---------- */

const SEVERITY_ORDER = { critical: 0, important: 1, polish: 2 };
const CHECK_ICON = { pass: Check, warn: Minus, fail: X };

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
        title="ATS score"
        description="How cleanly an Applicant Tracking System can read your resume — and how well it would rank. Every issue comes with a fix you can make in the editor below."
      />

      {!review && (
        <div className="mt-5">
          <AiCard busy={busy} className="p-5">
            {busy ? (
              <TextScramble className="font-medium" duration={1.2}>
                Auditing for ATS parsers…
              </TextScramble>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-neutral-500">
                  Checks parseability, standard sections, dates, and keyword match.
                </p>
                <button type="button" onClick={runReview} className="rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black">
                  Check ATS score
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
              <span className="text-sm text-neutral-500">/100 ATS</span>
            </p>
          </div>

          {review.checks?.length > 0 && (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {review.checks.map((check, i) => {
                const Icon = CHECK_ICON[check.status] ?? Minus;
                return (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <Icon
                      size={14}
                      strokeWidth={check.status === "pass" ? 2.5 : 2}
                      className={`mt-0.5 shrink-0 ${check.status === "fail" ? "text-black dark:text-white" : "text-neutral-400"}`}
                      aria-hidden="true"
                    />
                    <span>
                      <span className="text-sm font-medium">{check.label}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{check.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

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
            {busy ? "Re-checking…" : "Re-check"}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- 02 · Edit ---------- */

const inputCls =
  "w-full rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-800";

function EditorSection({ doc, savedDoc, profile, template, markdown, onChange, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dirty = JSON.stringify(doc) !== JSON.stringify(savedDoc);

  // Fullscreen preview: close on Escape, freeze the page behind it.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  // Immutable helpers over the structured doc.
  const setField = (key, value) => onChange({ ...doc, [key]: value });
  const setItem = (key, idx, patch) =>
    onChange({ ...doc, [key]: doc[key].map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  const addItem = (key, blank) => onChange({ ...doc, [key]: [...doc[key], structuredClone(blank)] });
  const removeItem = (key, idx) => onChange({ ...doc, [key]: doc[key].filter((_, i) => i !== idx) });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/resume/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(doc);
      toast.success("Resume saved");
      return true;
    } catch (err) {
      toast.error(err.message || "Couldn't save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    if (dirty && !(await save())) return;
    window.location.href = "/api/resume/pdf";
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown);
    toast.success("Resume copied as text");
  }

  function resetToUploaded() {
    onChange(profileToDoc(profile));
    toast.message("Reset to your uploaded resume — Save to keep it");
  }

  return (
    <section className="mt-14">
      <SectionHeader
        step={2}
        title="Edit"
        description="Your resume, editable field by field. Changes flow straight into the live preview and the PDF — nothing is rewritten but you."
      />

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-neutral-500">
          {dirty ? "unsaved changes" : "saved"}
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={resetToUploaded} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
            <RotateCcw size={12} strokeWidth={1.5} aria-hidden="true" /> Reset
          </button>
          <button type="button" onClick={copyMarkdown} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
            <Copy size={12} strokeWidth={1.5} aria-hidden="true" /> Copy
          </button>
          <button type="button" onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium transition hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-neutral-500">
            <Check size={12} strokeWidth={1.5} aria-hidden="true" /> {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={downloadPdf} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black">
            <Download size={12} strokeWidth={1.5} aria-hidden="true" /> Download PDF
          </button>
        </span>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_440px]">
        {/* Form */}
        <div className="order-2 space-y-8 lg:order-1">
          {/* Contact */}
          <FieldGroup label="Contact">
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={inputCls} placeholder="Full name" aria-label="Full name" value={doc.name} onChange={(e) => setField("name", e.target.value)} />
              <input className={inputCls} placeholder="Email" aria-label="Email" value={doc.email} onChange={(e) => setField("email", e.target.value)} />
              <input className={`${inputCls} sm:col-span-2`} placeholder="Location" aria-label="Location" value={doc.location} onChange={(e) => setField("location", e.target.value)} />
            </div>
          </FieldGroup>

          {/* Experience */}
          <FieldGroup label="Experience" onAdd={() => addItem("experience", BLANK_EXP)} addLabel="Add role">
            {doc.experience.length === 0 && <Empty>No experience yet — add your first role.</Empty>}
            {doc.experience.map((exp, i) => (
              <EntryCard key={i} onRemove={() => removeItem("experience", i)}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Job title" aria-label="Job title" value={exp.title} onChange={(e) => setItem("experience", i, { title: e.target.value })} />
                  <input className={inputCls} placeholder="Company" aria-label="Company" value={exp.company} onChange={(e) => setItem("experience", i, { company: e.target.value })} />
                  <input className={`${inputCls} sm:col-span-2`} placeholder="Dates (e.g. Jan 2023 – Present)" aria-label="Dates" value={exp.duration} onChange={(e) => setItem("experience", i, { duration: e.target.value })} />
                </div>
                <textarea
                  className={`${inputCls} mt-3`}
                  rows={4}
                  placeholder="Bullet points — one per line"
                  aria-label="Highlights"
                  value={exp.highlights.join("\n")}
                  onChange={(e) => setItem("experience", i, { highlights: e.target.value.split("\n") })}
                />
              </EntryCard>
            ))}
          </FieldGroup>

          {/* Education */}
          <FieldGroup label="Education" onAdd={() => addItem("education", BLANK_EDU)} addLabel="Add education">
            {doc.education.length === 0 && <Empty>No education yet.</Empty>}
            {doc.education.map((ed, i) => (
              <EntryCard key={i} onRemove={() => removeItem("education", i)}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Degree (e.g. BSc)" aria-label="Degree" value={ed.degree} onChange={(e) => setItem("education", i, { degree: e.target.value })} />
                  <input className={inputCls} placeholder="Field of study" aria-label="Field" value={ed.field} onChange={(e) => setItem("education", i, { field: e.target.value })} />
                  <input className={inputCls} placeholder="Institution" aria-label="Institution" value={ed.institution} onChange={(e) => setItem("education", i, { institution: e.target.value })} />
                  <input className={inputCls} placeholder="Graduation year" aria-label="Graduation year" value={ed.graduation_year} onChange={(e) => setItem("education", i, { graduation_year: e.target.value })} />
                </div>
              </EntryCard>
            ))}
          </FieldGroup>

          {/* Skills */}
          <FieldGroup label="Skills">
            <textarea
              className={inputCls}
              rows={3}
              placeholder="One skill per line"
              aria-label="Skills"
              value={doc.skills.join("\n")}
              onChange={(e) => setField("skills", e.target.value.split("\n"))}
            />
          </FieldGroup>

          {/* Projects */}
          <FieldGroup label="Projects" onAdd={() => addItem("projects", BLANK_PROJ)} addLabel="Add project">
            {doc.projects.length === 0 && <Empty>No projects — optional.</Empty>}
            {doc.projects.map((pr, i) => (
              <EntryCard key={i} onRemove={() => removeItem("projects", i)}>
                <input className={inputCls} placeholder="Project name" aria-label="Project name" value={pr.name} onChange={(e) => setItem("projects", i, { name: e.target.value })} />
                <textarea className={`${inputCls} mt-3`} rows={2} placeholder="What it is / what you did" aria-label="Project description" value={pr.description} onChange={(e) => setItem("projects", i, { description: e.target.value })} />
                <input className={`${inputCls} mt-3`} placeholder="Technologies (comma-separated)" aria-label="Technologies" value={pr.technologies.join(",")} onChange={(e) => setItem("projects", i, { technologies: e.target.value.split(",") })} />
              </EntryCard>
            ))}
          </FieldGroup>
        </div>

        {/* Live preview */}
        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                Live preview · {template.name}
              </p>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setMinimized((v) => !v)}
                  aria-label={minimized ? "Show preview" : "Minimize preview"}
                  title={minimized ? "Show preview" : "Minimize preview"}
                  className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-black dark:hover:bg-neutral-900 dark:hover:text-white"
                >
                  {minimized ? (
                    <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <ChevronUp size={14} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  aria-label="Maximize preview"
                  title="Maximize preview"
                  className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-black dark:hover:bg-neutral-900 dark:hover:text-white"
                >
                  <Maximize2 size={14} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </span>
            </div>
            {!minimized && (
              <>
                <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm dark:border-neutral-800">
                  <TemplatePreview template={template} markdown={markdown} scale={1.9} wrap />
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Updates as you type — maximize it for a full-size page. Pick a
                  different template below.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen preview */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setExpanded(false)}
        >
          <div className="mx-auto w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-neutral-300">
                Live preview · {template.name}
              </p>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-600 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-400 hover:text-white"
              >
                <X size={12} strokeWidth={1.5} aria-hidden="true" /> Close
              </button>
            </div>
            <div className="overflow-hidden rounded-xl shadow-2xl">
              <TemplatePreview template={template} markdown={markdown} scale={3.2} wrap />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FieldGroup({ label, onAdd, addLabel, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">{label}</h3>
        {onAdd && (
          <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 transition hover:text-black dark:hover:text-white">
            <Plus size={12} strokeWidth={2} aria-hidden="true" /> {addLabel}
          </button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EntryCard({ onRemove, children }) {
  return (
    <div className="relative rounded-2xl border border-neutral-200 p-4 pr-10 dark:border-neutral-800">
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="absolute right-3 top-3 rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-black dark:hover:bg-neutral-900 dark:hover:text-white"
      >
        <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

const Empty = ({ children }) => <p className="text-sm text-neutral-500">{children}</p>;

/* ---------- 03 · Template ---------- */

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
        <p className="text-sm text-neutral-500">Previewed with your live resume above.</p>
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
                  {isSelected && <Check size={11} strokeWidth={2.5} aria-hidden="true" />}
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
