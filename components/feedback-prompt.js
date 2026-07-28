"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { X } from "lucide-react";

// Defined here rather than imported from lib/feedback.js: that module pulls in
// node:crypto and the database, neither of which belongs in a client bundle.
const FIELDS = [
  { key: "feature", label: "What should we build next?" },
  { key: "bug", label: "Anything broken or buggy?" },
  { key: "general", label: "Anything else?" },
];

// Asks an account what to build next, what is broken, and anything else.
//
// Timing: once per browser session, after a random delay, so it never lands
// on the first paint and never fires twice in one sitting. The owner is never
// asked; that is decided by the server (app/api/feedback/route.js) so
// OWNER_EMAIL stays off the client.

const SESSION_KEY = "jobblast:feedback-prompted";
const MIN_DELAY_MS = 45_000;
const MAX_DELAY_MS = 180_000;

const randomDelay = () =>
  MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));

function FeedbackDialog({ onClose }) {
  const reduce = useReducedMotion();
  const [values, setValues] = useState({ feature: "", bug: "", general: "" });
  const [saving, setSaving] = useState(false);
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const empty = !values.feature.trim() && !values.bug.trim() && !values.general.trim();

  const submit = async (event) => {
    event.preventDefault();
    if (empty || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not send that.");
      toast.success("Thank you, that went straight to the person building this.");
      onClose();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <motion.div
        // A scrim has to darken in both themes. Tinting it with --ink would
        // lighten the page in dark mode, where ink is the near-white value.
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-ink/5"
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-xl p-1.5 text-muted transition hover:bg-accent-wash hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>

        <h2 id="feedback-title" className="font-display text-xl font-semibold">
          How is jobblast treating you?
        </h2>
        <p className="mt-1 text-sm text-muted">
          One person builds this. Anything you write here is read.
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          {FIELDS.map(({ key, label }, i) => (
            <div key={key} className="flex flex-col gap-2">
              <label htmlFor={`feedback-${key}`} className="text-sm font-medium">
                {label}
              </label>
              <textarea
                id={`feedback-${key}`}
                ref={i === 0 ? firstField : undefined}
                rows={2}
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                placeholder="Optional"
              />
            </div>
          ))}

          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition hover:text-ink"
            >
              Not now
            </button>
            <button
              type="submit"
              disabled={empty || saving}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition hover:bg-accent-hover disabled:opacity-40"
            >
              {saving ? "Sending" : "Send"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function FeedbackPrompt() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const scheduled = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || scheduled.current) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    scheduled.current = true;

    let timer;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feedback");
        if (!res.ok) return;
        const { prompt } = await res.json();
        if (!prompt || cancelled) return;
        timer = setTimeout(() => {
          // Mark on show, not on submit: being asked once per session is the
          // point, whether or not they write anything.
          sessionStorage.setItem(SESSION_KEY, "1");
          setOpen(true);
        }, randomDelay());
      } catch {
        /* the prompt is optional, never surface a failure for it */
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status]);

  return (
    <AnimatePresence>{open && <FeedbackDialog onClose={close} />}</AnimatePresence>
  );
}
