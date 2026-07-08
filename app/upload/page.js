"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { FileText, GraduationCap, Briefcase, FolderGit2, Wrench, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AiLabel } from "@/components/ai-loading";
import { BorderTrail } from "@/components/motion-primitives/border-trail";
import { GlowEffect } from "@/components/motion-primitives/glow-effect";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import { Disclosure } from "@/components/motion-primitives/disclosure";
import { SlidingNumber } from "@/components/motion-primitives/sliding-number";

// Resume upload: drop a PDF, Claude extracts a structured profile,
// rendered as cards instead of raw JSON.
export default function UploadPage() {
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error
  const [profile, setProfile] = useState(null);

  // Show a previously extracted profile on revisit.
  useEffect(() => {
    fetch("/api/resume")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          setStatus("done");
        }
      })
      .catch(() => {});
  }, []);

  const onDrop = useCallback(async (accepted) => {
    const file = accepted[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("resume", file);
    setStatus("uploading");
    try {
      const res = await fetch("/api/resume", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data.profile);
      setStatus("done");
      toast.success("Profile extracted from your resume");
    } catch (err) {
      console.error(err);
      setStatus("error");
      toast.error(err.message || "Failed to process the resume");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: status === "uploading",
  });

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Upload your resume</h1>
      <p className="mt-2 text-neutral-500">
        PDF only. Claude extracts your skills, experience, education, and projects —
        nothing is invented.
      </p>

      <div className="relative mt-8 rounded-2xl">
        {/* Accent glow is an animation state: only while dragging a file over */}
        <GlowEffect active={isDragActive} blur={28} />
        <div
          {...getRootProps({
            className: `relative flex cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-2xl border border-dashed px-6 py-14 text-center transition ${
              isDragActive
                ? "border-neutral-500 bg-neutral-50 dark:border-neutral-400 dark:bg-neutral-950"
                : "border-neutral-300 hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
            }`,
          })}
        >
          <input {...getInputProps()} aria-label="Resume PDF" />
          {status === "uploading" && <BorderTrail size={72} duration={2.4} />}
          <FileText size={28} strokeWidth={1.5} className="text-neutral-400" aria-hidden="true" />
          {status === "uploading" ? (
            <AiLabel>Reading your resume…</AiLabel>
          ) : (
            <>
              <p className="font-medium">
                {isDragActive
                  ? "Drop it"
                  : profile
                    ? "Drop a new PDF to re-analyze"
                    : "Drag a PDF here, or click to browse"}
              </p>
              <p className="text-sm text-neutral-500">Max one file · PDF</p>
            </>
          )}
        </div>
      </div>

      {status === "error" && (
        <p className="mt-4 text-sm text-neutral-500">
          Something went wrong — check the server logs and try again.
        </p>
      )}

      {profile && status !== "uploading" && <ProfileCards profile={profile} />}
    </PageShell>
  );
}

function ProfileCards({ profile }) {
  return (
    <AnimatedGroup className="mt-10 flex flex-col" asChild="section">
      {/* Identity */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{profile.name}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {profile.email} · {profile.location}
          </p>
        </div>
        <p className="text-right">
          <span className="font-mono text-3xl font-semibold">
            <SlidingNumber value={profile.skills?.length ?? 0} />
          </span>
          <span className="block text-xs uppercase tracking-widest text-neutral-500">
            skills found
          </span>
        </p>
      </header>

      {/* Skills */}
      <Disclosure
        defaultOpen
        title={
          <span className="flex items-center gap-2">
            <Wrench size={16} strokeWidth={1.5} aria-hidden="true" /> Skills
          </span>
        }
      >
        <ul className="flex flex-wrap gap-2">
          {(profile.skills ?? []).map((skill) => (
            <li
              key={skill}
              className="rounded-full border border-neutral-200 px-3 py-1 text-sm dark:border-neutral-800"
            >
              {skill}
            </li>
          ))}
        </ul>
      </Disclosure>

      {/* Experience timeline */}
      <Disclosure
        defaultOpen
        title={
          <span className="flex items-center gap-2">
            <Briefcase size={16} strokeWidth={1.5} aria-hidden="true" /> Experience
            <span className="font-mono text-xs text-neutral-500">
              {profile.years_of_experience} yr{profile.years_of_experience === 1 ? "" : "s"}
            </span>
          </span>
        }
      >
        <ol className="ml-2 space-y-6 border-l border-neutral-200 pl-6 dark:border-neutral-800">
          {(profile.experience ?? []).map((exp, i) => (
            <li key={i} className="relative">
              <span
                className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-black dark:bg-white"
                aria-hidden="true"
              />
              <p className="font-medium">
                {exp.title} <span className="text-neutral-500">· {exp.company}</span>
              </p>
              <p className="font-mono text-xs text-neutral-500">{exp.duration}</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-neutral-500">
                {(exp.highlights ?? []).map((h, j) => (
                  <li key={j}>{h}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Disclosure>

      {/* Projects grid */}
      <Disclosure
        title={
          <span className="flex items-center gap-2">
            <FolderGit2 size={16} strokeWidth={1.5} aria-hidden="true" /> Projects
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(profile.projects ?? []).map((project) => (
            <div
              key={project.name}
              className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <p className="font-medium">{project.name}</p>
              <p className="mt-1 text-sm text-neutral-500">{project.description}</p>
              <p className="mt-2 font-mono text-xs text-neutral-500">
                {(project.technologies ?? []).join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </Disclosure>

      {/* Education */}
      <Disclosure
        title={
          <span className="flex items-center gap-2">
            <GraduationCap size={16} strokeWidth={1.5} aria-hidden="true" /> Education
          </span>
        }
      >
        <ul className="space-y-3">
          {(profile.education ?? []).map((edu, i) => (
            <li key={i}>
              <p className="font-medium">
                {edu.degree} in {edu.field}
              </p>
              <p className="text-sm text-neutral-500">
                {edu.institution} · <span className="font-mono">{edu.graduation_year}</span>
              </p>
            </li>
          ))}
        </ul>
      </Disclosure>

      <p className="mt-6 flex items-center gap-2 text-xs text-neutral-500">
        <RefreshCw size={12} strokeWidth={1.5} aria-hidden="true" />
        Wrong or outdated? Drop a newer PDF above to re-extract.
      </p>
    </AnimatedGroup>
  );
}
