"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { QUESTIONS } from "@/lib/onboarding";
import { Logo } from "@/components/logo";

// The signup questionnaire: one question per screen, ten at most.
//
// Choices commit and advance on a single click — the extra "Next" press per
// question is the difference between finishing and abandoning, and there is a
// Back button for the misclick. Only two questions are required, so almost
// every screen can be skipped; a half-answered profile is still worth more
// than a person who closed the tab on question four.

const isAnswered = (value) => typeof value === "string" && value.trim().length > 0;

/** 1-9 pick a choice. Fast for anyone on a keyboard, invisible to everyone else. */
function useNumberKeys(enabled, count, onPick) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(count, 9)) onPick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, count, onPick]);
}

function TextQuestion({ question, value, onChange, onSubmit }) {
  const input = useRef(null);
  useEffect(() => {
    input.current?.focus();
  }, [question.id]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="mt-8"
    >
      <input
        ref={input}
        type="text"
        value={value ?? ""}
        maxLength={question.maxLength ?? 120}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder}
        aria-label={question.question}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-lg text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
      />
    </form>
  );
}

function ChoiceQuestion({ question, value, onPick }) {
  // "Other" is a choice that opens a text field. Its answer is stored in the
  // same slot as any other, so nothing downstream has to know the difference.
  const knownPick = value && question.choices.includes(value);
  const [otherOpen, setOtherOpen] = useState(Boolean(value) && !knownPick);
  const [otherText, setOtherText] = useState(knownPick ? "" : (value ?? ""));
  const otherInput = useRef(null);

  useEffect(() => {
    if (otherOpen) otherInput.current?.focus();
  }, [otherOpen]);

  useNumberKeys(!otherOpen, question.choices.length, (i) => onPick(question.choices[i]));

  return (
    <div className="mt-8 flex flex-col gap-2.5">
      {question.choices.map((choice, i) => {
        const active = value === choice;
        return (
          <button
            key={choice}
            type="button"
            onClick={() => onPick(choice)}
            className={`group flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
              active
                ? "border-accent bg-accent-wash text-ink"
                : "border-line bg-surface text-ink hover:border-ink/25"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs ${
                active ? "bg-accent text-accent-ink" : "bg-paper text-muted"
              }`}
            >
              {active ? <Check size={13} strokeWidth={2.5} /> : i + 1}
            </span>
            <span>{choice}</span>
          </button>
        );
      })}

      {question.other &&
        (otherOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isAnswered(otherText)) onPick(otherText.trim());
            }}
            className="flex gap-2"
          >
            <input
              ref={otherInput}
              type="text"
              value={otherText}
              maxLength={120}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder={question.other}
              aria-label={question.other}
              className="w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={!isAnswered(otherText)}
              className="shrink-0 rounded-xl bg-accent px-5 py-3.5 font-medium text-accent-ink transition hover:bg-accent-hover disabled:opacity-40"
            >
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOtherOpen(true)}
            className="rounded-xl border border-dashed border-line px-4 py-3.5 text-left text-muted transition hover:border-ink/25 hover:text-ink"
          >
            {question.other}
          </button>
        ))}
    </div>
  );
}

export function OnboardingFlow({ onDone }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const question = QUESTIONS[step];
  const last = step === QUESTIONS.length - 1;
  const value = answers[question.id] ?? "";
  const canAdvance = !question.required || isAnswered(value);

  const set = (id, v) => setAnswers((prev) => ({ ...prev, [id]: v }));

  const finish = async (final) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: final }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save that.");
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const advance = (override) => {
    const next = override ? { ...answers, ...override } : answers;
    if (override) setAnswers(next);
    if (last) finish(next);
    else setStep((s) => s + 1);
  };

  const pick = (choice) => advance({ [question.id]: choice });

  const progress = useMemo(
    () => Math.round(((step + (last ? 1 : 0)) / QUESTIONS.length) * 100),
    [step, last],
  );

  return (
    // A modal takeover, and announced as one: the app is still mounted behind
    // this, so without a dialog role a screen reader walks straight into a
    // page the visitor cannot see or reach.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set up your account"
      className="fixed inset-0 z-50 overflow-y-auto bg-paper"
    >
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-6 py-10">
        <div className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="font-display text-base font-semibold">jobblast</span>
          <span className="ml-auto font-mono text-xs text-muted">
            {step + 1} / {QUESTIONS.length}
          </span>
        </div>

        <div
          className="mt-4 h-1 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
        >
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${progress}%` }}
            initial={false}
            transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
                {question.question}
              </h1>
              {question.hint && (
                <p className="mt-3 max-w-[46ch] leading-relaxed text-muted">
                  {question.hint}
                </p>
              )}

              {question.kind === "text" ? (
                <TextQuestion
                  question={question}
                  value={value}
                  onChange={(v) => set(question.id, v)}
                  onSubmit={() => canAdvance && advance()}
                />
              ) : (
                <ChoiceQuestion question={question} value={value} onPick={pick} />
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <p role="alert" className="mt-6 text-sm text-accent">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:text-ink disabled:invisible"
          >
            <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {!question.required && (
              <button
                type="button"
                onClick={() => advance({ [question.id]: "" })}
                disabled={saving}
                className="rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:text-ink"
              >
                Skip
              </button>
            )}
            {/* Choices advance on click, so the explicit button is only for the
                text questions and for a choice already picked with Back. */}
            <button
              type="button"
              onClick={() => advance()}
              disabled={!canAdvance || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:bg-accent-hover disabled:opacity-40"
            >
              {saving ? "Saving" : last ? "Finish" : "Next"}
              {!saving && <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
