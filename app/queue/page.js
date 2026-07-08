"use client";

import { useEffect, useState } from "react";

// Application review queue: read the drafted cover letter, then apply on the
// real job page (job.url) and mark it submitted. jobpilot never auto-submits.
export default function QueuePage() {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    fetch("/api/applications")
      .then((res) => res.json())
      .then((data) => setApplications(data.applications ?? []));
  }, []);

  async function markSubmitted(id) {
    await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "submitted" }),
    });
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "submitted" } : a))
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">Review queue</h1>
      <p className="mt-2 text-neutral-500">
        Read each draft, tweak it, apply on the company&apos;s page, then mark it done.
      </p>

      <ul className="mt-8 flex flex-col gap-4">
        {applications.length === 0 && (
          <p className="text-neutral-500">Nothing here yet — find some jobs first.</p>
        )}
        {applications.map((app) => (
          <li
            key={app.id}
            className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">{app.jobId}</span>
              <span className="text-xs font-medium uppercase">{app.status}</span>
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-sm">{app.coverLetter}</pre>
            {/* TODO: editable textarea + copy button + link to job.url */}
            {app.status === "pending_review" && (
              <button
                onClick={() => markSubmitted(app.id)}
                className="mt-3 text-sm font-medium underline"
              >
                Mark as submitted
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
