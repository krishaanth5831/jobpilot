"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, KeyRound, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";

// Paste API keys here instead of editing .env.local by hand. Saved keys are
// written to .env.local and applied to the running server immediately.
// The server only ever reports presence + last 4 characters, never values.
const GROUPS = [
  {
    title: "Claude",
    description: "Powers everything AI: screening, letters, the resume studio.",
    href: "https://platform.claude.com",
    linkLabel: "platform.claude.com",
    fields: [{ key: "ANTHROPIC_API_KEY", label: "API key", secret: true, required: true }],
  },
  {
    title: "Adzuna",
    description: "Broad job-board aggregator (free tier).",
    href: "https://developer.adzuna.com",
    linkLabel: "developer.adzuna.com",
    fields: [
      { key: "ADZUNA_APP_ID", label: "App ID", secret: true },
      { key: "ADZUNA_APP_KEY", label: "App key", secret: true },
      { key: "ADZUNA_COUNTRY", label: "Default country code (us, gb, fr…)", secret: false },
    ],
  },
  {
    title: "JSearch (RapidAPI)",
    description: "Surfaces LinkedIn, Indeed, and Glassdoor postings (free tier).",
    href: "https://rapidapi.com",
    linkLabel: "rapidapi.com → JSearch",
    fields: [{ key: "RAPIDAPI_KEY", label: "RapidAPI key", secret: true }],
  },
  {
    title: "Accounts (optional)",
    description:
      "Let people sign in with Google, GitHub, or Microsoft and keep their own data. All free to set up. Restart the server after saving these.",
    href: "https://authjs.dev/getting-started/authentication/oauth",
    linkLabel: "authjs.dev setup guide",
    fields: [
      { key: "AUTH_SECRET", label: "Auth secret (run: npx auth secret)", secret: true },
      { key: "AUTH_GOOGLE_ID", label: "Google client ID", secret: true },
      { key: "AUTH_GOOGLE_SECRET", label: "Google client secret", secret: true },
      { key: "AUTH_GITHUB_ID", label: "GitHub client ID", secret: true },
      { key: "AUTH_GITHUB_SECRET", label: "GitHub client secret", secret: true },
      { key: "AUTH_MICROSOFT_ENTRA_ID_ID", label: "Microsoft client ID", secret: true },
      { key: "AUTH_MICROSOFT_ENTRA_ID_SECRET", label: "Microsoft client secret", secret: true },
    ],
  },
];

export default function SettingsPage() {
  const [status, setStatus] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setStatus(data.keys))
      .catch(() => toast.error("Couldn't load settings"));
  }, []);

  const dirty = Object.keys(drafts).length > 0;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: drafts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus(data.keys);
      setDrafts({});
      toast.success("Saved to .env.local — active immediately, no restart needed");
    } catch (err) {
      toast.error(err.message || "Couldn't save settings");
    } finally {
      setSaving(false);
    }
  }

  function clearKey(key) {
    setDrafts((prev) => ({ ...prev, [key]: "" }));
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-neutral-500">
        Paste your API keys once — they&apos;re stored in{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-sm dark:bg-neutral-900">
          .env.local
        </code>{" "}
        (never committed) and take effect immediately.
      </p>

      {GROUPS.map(({ title, description, href, linkLabel, fields }) => (
        <section key={title} className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
            </div>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-500 hover:underline"
            >
              {linkLabel} <ExternalLink size={11} strokeWidth={1.5} aria-hidden="true" />
            </a>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {fields.map(({ key, label, secret, required }) => {
              const info = status?.[key];
              const cleared = drafts[key] === "";
              return (
                <label key={key} className="block">
                  <span className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
                    {label}
                    {required && <span className="normal-case tracking-normal">(required)</span>}
                    {info?.set && !cleared ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-white dark:bg-white dark:text-black">
                        <Check size={10} strokeWidth={2.5} aria-hidden="true" />
                        configured {info.hint}
                      </span>
                    ) : (
                      <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-neutral-500 dark:border-neutral-700">
                        {cleared ? "will be cleared on save" : "not set"}
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 flex gap-2">
                    <input
                      type={secret ? "password" : "text"}
                      autoComplete="off"
                      spellCheck={false}
                      value={drafts[key] ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => {
                          const next = { ...prev };
                          if (e.target.value === "" && !prev[key]) delete next[key];
                          else next[key] = e.target.value;
                          return next;
                        })
                      }
                      placeholder={
                        info?.set ? "Paste a new value to replace" : "Paste your key"
                      }
                      aria-label={`${title} ${label}`}
                      className="w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2.5 font-mono text-sm outline-none placeholder:font-sans placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-800"
                    />
                    {info?.set && !cleared && (
                      <button
                        type="button"
                        onClick={() => clearKey(key)}
                        title="Clear this key"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 text-xs font-medium text-neutral-500 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                      >
                        <X size={12} strokeWidth={1.5} aria-hidden="true" /> Clear
                      </button>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ))}

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3 font-medium text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          <KeyRound size={15} strokeWidth={1.5} aria-hidden="true" />
          {saving ? "Saving…" : "Save changes"}
        </button>
        {!dirty && <p className="text-sm text-neutral-500">Nothing to save yet.</p>}
      </div>

      <p className="mt-8 text-xs text-neutral-500">
        Keys never leave this machine: they&apos;re stored in the gitignored{" "}
        .env.local, and this page only ever sees whether a key is set plus its
        last four characters.
      </p>
    </PageShell>
  );
}
