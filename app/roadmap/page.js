"use client";

import { useState } from "react";

// Skill-gap roadmap: pick a job you don't qualify for (by its id from /jobs)
// and Claude turns the missing requirements into an action plan.
// TODO: replace the manual jobId input with a picker of unqualified jobs.
export default function RoadmapPage() {
  const [jobId, setJobId] = useState("");
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function generate(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRoadmap(data.roadmap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">Get qualified</h1>
      <p className="mt-2 text-neutral-500">
        A concrete plan to close the gap between your resume and the job you want.
      </p>

      <form onSubmit={generate} className="mt-6 flex gap-3">
        <input
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          placeholder="Job id (from the jobs page)"
          required
          className="flex-1 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-neutral-900 px-5 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Planning…" : "Build my roadmap"}
        </button>
      </form>

      {error && <p className="mt-4 text-red-500">{error}</p>}

      {roadmap && (
        <div className="mt-8">
          <p className="text-neutral-600 dark:text-neutral-300">{roadmap.summary}</p>
          <ol className="mt-6 flex flex-col gap-4">
            {roadmap.steps.map((step, i) => (
              <li
                key={i}
                className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{step.title}</h2>
                  <span className="text-xs text-neutral-500">
                    {step.category} · {step.estimated_time}
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                  {step.description}
                </p>
                {step.resources.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-sm text-neutral-500">
                    {step.resources.map((r, j) => (
                      <li key={j}>{r}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </main>
  );
}
