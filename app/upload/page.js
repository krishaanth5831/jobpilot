"use client";

import { useState } from "react";

// Resume upload: POSTs the PDF to /api/resume, shows the extracted profile.
export default function UploadPage() {
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error
  const [profile, setProfile] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("uploading");
    try {
      const res = await fetch("/api/resume", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data.profile);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">Upload your resume</h1>
      <p className="mt-2 text-neutral-500">
        PDF only. Claude will extract your skills, experience, education, and projects.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <input
          type="file"
          name="resume"
          accept="application/pdf"
          required
          className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={status === "uploading"}
          className="rounded-lg bg-neutral-900 px-5 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {status === "uploading" ? "Analyzing…" : "Upload & analyze"}
        </button>
      </form>

      {status === "error" && (
        <p className="mt-4 text-red-500">Something went wrong — check the server logs.</p>
      )}

      {profile && (
        <pre className="mt-8 overflow-x-auto rounded-lg bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
          {JSON.stringify(profile, null, 2)}
        </pre>
      )}
      {/* TODO: render the profile as editable cards instead of raw JSON */}
    </main>
  );
}
