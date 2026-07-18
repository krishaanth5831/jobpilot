"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, KeyRound, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { CLAUDE_MODELS, EFFORT_LEVELS } from "@/lib/claude-models";

// Paste API keys here instead of editing .env.local by hand. Saved keys are
// written to .env.local and applied to the running server immediately.
// The server only ever reports presence + last 4 characters, never values.
const GROUPS = [
  {
    scope: "user",
    title: "Claude",
    description:
      "Powers everything AI: screening, letters, the resume studio. Without a key, your account uses the free built-in model instead.",
    href: "https://platform.claude.com",
    linkLabel: "platform.claude.com",
    fields: [{ key: "ANTHROPIC_API_KEY", label: "API key", secret: true }],
    freeModelBanner: true,
  },
  {
    scope: "user",
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
    scope: "user",
    title: "JSearch (RapidAPI)",
    description: "Surfaces LinkedIn, Indeed, and Glassdoor postings (free tier).",
    href: "https://rapidapi.com",
    linkLabel: "rapidapi.com → JSearch",
    fields: [{ key: "RAPIDAPI_KEY", label: "RapidAPI key", secret: true }],
  },
  {
    scope: "auth",
    title: "Free built-in model (owner)",
    description:
      "One free Groq API key gives every new account working AI out of the box — Llama 3.3 70B serves anyone who hasn't added their own Claude key. Takes effect immediately, no restart.",
    href: "https://console.groq.com",
    linkLabel: "console.groq.com",
    fields: [{ key: "GROQ_API_KEY", label: "Groq API key", secret: true }],
  },
  {
    scope: "auth",
    title: "Social logins (optional)",
    description:
      "Email + password sign-in already works out of the box. Optionally also let people continue with Google, GitHub, or Microsoft — all free to set up. Restart the server after saving these.",
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
  const [info, setInfo] = useState(null); // { keys, authKeys, isOwner }
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch(() => toast.error("Couldn't load settings"));
  }, []);

  const dirty = Object.keys(drafts).length > 0;

  // Owners see the server-wide sign-in config; everyone else only their keys.
  const visibleGroups = GROUPS.filter(
    (g) => g.scope !== "auth" || info?.isOwner
  );
  const statusFor = (group) =>
    (group.scope === "auth" ? info?.authKeys : info?.keys) ?? null;

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
      setInfo(data);
      setDrafts({});
      toast.success("Saved to your account — active immediately");
    } catch (err) {
      toast.error(err.message || "Couldn't save settings");
    } finally {
      setSaving(false);
    }
  }

  function clearKey(key) {
    setDrafts((prev) => ({ ...prev, [key]: "" }));
  }

  // Model + effort save immediately on click, like the auto-apply toggle.
  async function updateClaude(patch) {
    const prev = info?.claude;
    setInfo((p) => ({ ...p, claude: { ...p.claude, ...patch } })); // optimistic
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claude: patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInfo(data);
      toast.success("AI model settings saved");
    } catch (err) {
      setInfo((p) => ({ ...p, claude: prev })); // revert
      toast.error(err.message || "Couldn't update AI model settings");
    }
  }

  async function toggleAutoApply(next) {
    setInfo((prev) => ({ ...prev, autoApply: next })); // optimistic
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApply: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInfo(data);
      toast.success(next ? "Auto-apply on" : "Auto-apply off");
    } catch (err) {
      setInfo((prev) => ({ ...prev, autoApply: !next })); // revert
      toast.error(err.message || "Couldn't update auto-apply");
    }
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-neutral-500">
        Paste your API keys once — they&apos;re saved to your account on this
        server (never shared with other users) and take effect immediately.
      </p>

      {visibleGroups.map((group) => {
        const { title, description, href, linkLabel, fields } = group;
        const statusMap = statusFor(group);
        return (
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

          {group.freeModelBanner && info?.freeModel?.active && (
            <p className="mt-4 rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800">
              You&apos;re currently on the <strong>free built-in model</strong>{" "}
              (Llama 3.3 70B) — it works out of the box, but it&apos;s shared by
              every account on this server and Claude is noticeably better at
              matching and writing. Paste your own Claude API key below to
              switch; it takes effect immediately.
            </p>
          )}
          {group.scope === "auth" && info?.envWritable === false && (
            <p className="mt-4 rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800">
              On this host, sign-in settings are environment variables: set
              them in the Vercel dashboard (Project → Settings → Environment
              Variables), then redeploy. The status badges below still show
              what&apos;s configured.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-4">
            {fields.map(({ key, label, secret, required }) => {
              const fieldInfo = statusMap?.[key];
              const cleared = drafts[key] === "";
              const readOnly = group.scope === "auth" && info?.envWritable === false;
              return (
                <label key={key} className="block">
                  <span className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
                    {label}
                    {required && <span className="normal-case tracking-normal">(required)</span>}
                    {fieldInfo?.set && !cleared ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-white dark:bg-white dark:text-black">
                        <Check size={10} strokeWidth={2.5} aria-hidden="true" />
                        configured {fieldInfo.hint}
                      </span>
                    ) : (
                      <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-neutral-500 dark:border-neutral-700">
                        {cleared ? "will be cleared on save" : "not set"}
                      </span>
                    )}
                  </span>
                  <span className={`mt-1.5 flex gap-2 ${readOnly ? "hidden" : ""}`}>
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
                        fieldInfo?.set ? "Paste a new value to replace" : "Paste your key"
                      }
                      aria-label={`${title} ${label}`}
                      className="w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2.5 font-mono text-sm outline-none placeholder:font-sans placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-800"
                    />
                    {fieldInfo?.set && !cleared && (
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
        );
      })}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">AI model</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Which Claude model powers your account, and how hard it thinks
              before answering. Uses your own key and credits, so the choice is
              yours — prices are per million tokens (input / output). Doesn&apos;t
              apply while you&apos;re on the free built-in model.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CLAUDE_MODELS.map((m) => {
            const isSelected = info?.claude?.model === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => updateClaude({ model: m.id })}
                disabled={!info}
                aria-pressed={isSelected}
                className={`rounded-2xl border-2 p-4 text-left transition disabled:opacity-50 ${
                  isSelected
                    ? "border-black dark:border-white"
                    : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{m.name}</span>
                  {isSelected && <Check size={13} strokeWidth={2.5} aria-hidden="true" />}
                </span>
                <span className="mt-1 block font-mono text-xs text-neutral-500">
                  {m.price} per 1M tokens
                </span>
                <span className="mt-2 block text-sm text-neutral-500">{m.blurb}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-6 text-xs font-medium uppercase tracking-widest text-neutral-500">
          Thinking effort
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {EFFORT_LEVELS.map((e) => {
            const isSelected = info?.claude?.effort === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => updateClaude({ effort: e.id })}
                disabled={!info}
                aria-pressed={isSelected}
                className={`rounded-xl border-2 px-4 py-3 text-left transition disabled:opacity-50 ${
                  isSelected
                    ? "border-black dark:border-white"
                    : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                }`}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {e.name}
                  {isSelected && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">{e.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Auto-apply</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              When on, any job scoring above the match threshold gets a cover
              letter drafted straight into your review queue. jobpilot never
              submits for you — you still send every application yourself.
            </p>
          </div>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={info?.autoApply ?? false}
            onClick={() => toggleAutoApply(!info?.autoApply)}
            disabled={!info}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition disabled:opacity-50 ${
              info?.autoApply ? "bg-black dark:bg-white" : "bg-neutral-300 dark:bg-neutral-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition dark:bg-black ${
                info?.autoApply ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-neutral-600 dark:text-neutral-300">
            {info?.autoApply ? "On — drafting applications automatically" : "Off — draft applications yourself"}
          </span>
        </label>
      </section>

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
        Keys never leave this server, and they belong to your account alone —
        other users can&apos;t see or use them. This page only ever shows
        whether a key is set plus its last four characters.
      </p>
    </PageShell>
  );
}
