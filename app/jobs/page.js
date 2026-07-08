"use client";

import { useState } from "react";

// Job search + match results. Qualified jobs can be sent to the apply queue;
// unqualified ones link to the roadmap.
export default function JobsPage() {
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  async function search(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams({ role, location });
      const res = await fetch(`/api/jobs/search?${params}`);
      const data = await res.json();
      setJobs(data.jobs ?? []);
      // Kick off matching for everything we just fetched.
      const matchRes = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const matchData = await matchRes.json();
      if (matchRes.ok) {
        const byId = new Map(matchData.matched.map((j) => [j.id, j]));
        setJobs((prev) => prev.map((j) => byId.get(j.id) ?? j));
      }
    } finally {
      setLoading(false);
    }
  }

  async function draftApplication(jobId) {
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    // TODO: toast + link to /queue
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">Find jobs</h1>

      <form onSubmit={search} className="mt-6 flex flex-wrap gap-3">
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role, e.g. frontend intern"
          required
          className="flex-1 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
          className="flex-1 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-neutral-900 px-5 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <ul className="mt-8 flex flex-col gap-4">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{job.title}</h2>
                <p className="text-sm text-neutral-500">
                  {job.company} · {job.location}
                </p>
              </div>
              {job.match && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    job.match.qualified
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                  }`}
                >
                  {job.match.qualified ? `Qualified · ${job.match.score}` : "Not yet"}
                </span>
              )}
            </div>
            {job.match?.qualified ? (
              <button
                onClick={() => draftApplication(job.id)}
                className="mt-3 text-sm font-medium underline"
              >
                Draft application →
              </button>
            ) : job.match ? (
              <p className="mt-3 text-sm text-neutral-500">
                Missing: {job.match.missing_requirements.join(", ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
